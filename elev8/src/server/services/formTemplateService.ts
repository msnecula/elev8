import 'server-only';
import type { FormTemplateType, FormTemplateInfo } from '@/lib/formTemplateInfo';

// FormTemplateType, FormTemplateInfo, FORM_TEMPLATE_INFO, and FORM_TYPES live in
// @/lib/formTemplateInfo so client components can import them without 'server-only'.
export type { FormTemplateType, FormTemplateInfo };
export { FORM_TEMPLATE_INFO, FORM_TYPES } from '@/lib/formTemplateInfo';

/**
 * Reads all fillable field names from an uploaded PDF.
 * Returns a map of field names to their current values.
 */
export interface PdfFieldInfo {
  name: string;
  type: string;
  value: string;
}

export interface PdfInspection {
  fields: PdfFieldInfo[];
  /** True when the PDF uses XFA (Adobe's XML form architecture). XFA fields render
   *  in Acrobat/Chrome but pdf-lib cannot read or write them — getFields() returns [].
   *  A flat/PDFium-printed version of the same form will have isXfa=false and no fields. */
  isXfa: boolean;
}

export async function detectPdfFields(
  pdfBuffer: Buffer,
): Promise<Array<{ name: string; type: string; value: string }>> {
  const inspection = await inspectPdf(pdfBuffer);
  return inspection.fields;
}

/**
 * Inspects a PDF buffer and returns both its AcroForm fields and whether it uses XFA.
 * Use this instead of detectPdfFields when you need to distinguish between:
 *   - A proper AcroForm PDF (fields.length > 0, isXfa = false) → fillable normally
 *   - An XFA PDF     (fields.length = 0, isXfa = true)         → needs coordinate overlay
 *   - A flat PDF     (fields.length = 0, isXfa = false)        → needs coordinate overlay
 */
export async function inspectPdf(pdfBuffer: Buffer): Promise<PdfInspection> {
  const { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown } = await import('pdf-lib');

  // XFA detection: look for the /XFA key inside /AcroForm.
  // A raw string scan is the simplest cross-platform approach — the XFA marker
  // appears in the first few kilobytes of any XFA PDF.
  const pdfText = pdfBuffer.toString('latin1');
  const isXfa = pdfText.includes('/XFA') || pdfText.includes('xfa:data');

  // ── Primary path: pdf-lib ────────────────────────────────────────────────
  // Works correctly on unencrypted PDFs.  On encrypted PDFs (e.g. Cal/OSHA
  // DOSH-100) ignoreEncryption:true loads the raw bytes but cannot decrypt the
  // field dictionary — getFields() returns [] even though 18 fields exist.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rawFields: any[] = [];
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    rawFields = pdfDoc.getForm().getFields();
  } catch {
    // pdf-lib failed to parse at all — fall through to python3 fallback
  }

  // ── Fallback: python3/pypdf ───────────────────────────────────────────────
  // pypdf auto-decrypts null-password encrypted PDFs (like Cal/OSHA forms).
  // We use this when pdf-lib finds 0 fields and there's no XFA marker —
  // that combination means encrypted AcroForm rather than a genuinely flat PDF.
  if (rawFields.length === 0 && !isXfa) {
    try {
      const { spawnSync } = await import('child_process');
      const pyScript = [
        'import sys, io, json, traceback',
        'data = sys.stdin.buffer.read()',
        'PdfReader = None',
        'for lib in ["pypdf", "PyPDF2"]:',
        '    try: mod = __import__(lib); PdfReader = mod.PdfReader; break',
        '    except ImportError: pass',
        'if not PdfReader: sys.exit(1)',
        'reader = None',
        'for kw in [{"password": b""}, {}]:',
        '    try:',
        '        reader = PdfReader(io.BytesIO(data), **kw)',
        '        if reader.is_encrypted: reader.decrypt("")',
        '        break',
        '    except Exception as e:',
        '        sys.stderr.write("inspectPdf kw={}: {}\\n{}\\n".format(list(kw.keys()), e, traceback.format_exc()))',
        '        reader = None',
        'if not reader: sys.exit(1)',
        'fields = reader.get_fields() or {}',
        'result = []',
        'for name, field in fields.items():',
        '    ft = str(field.get("/FT", ""))',
        '    raw_val = field.get("/V", "")',
        '    val = str(raw_val) if raw_val else ""',
        '    result.append({"name": name, "type": ft, "value": val})',
        'print(json.dumps(result))',
      ].join('\n');

      // Try python3 (Linux/macOS) then python (Windows)
      for (const cmd of ['python3', 'python']) {
        const r = spawnSync(cmd, ['-c', pyScript], {
          input: pdfBuffer,
          timeout: 15_000,
          maxBuffer: 10 * 1024 * 1024,
        });
        if (r.status === 0 && r.stdout && r.stdout.length > 2) {
          try {
            const parsed = JSON.parse(r.stdout.toString()) as Array<{ name: string; type: string; value: string }>;
            if (Array.isArray(parsed) && parsed.length > 0) {
              const ftMap: Record<string, string> = {
                '/Tx': 'Text', '/Btn': 'CheckBox', '/Ch': 'Dropdown', '/Sig': 'Signature',
              };
              return {
                fields: parsed.map(f => ({
                  name: f.name,
                  type: ftMap[f.type] ?? (f.type.replace('/', '') || 'Unknown'),
                  value: f.value,
                })),
                isXfa: false,
              };
            }
          } catch { /* JSON parse failed — try next command */ }
          break;
        }
      }
    } catch (err) {
      console.warn('[inspectPdf] python3 fallback failed:', (err as Error).message);
    }
  }

  // ── Map pdf-lib fields to PdfFieldInfo ───────────────────────────────────
  const fields: PdfFieldInfo[] = rawFields.map(field => ({
    name: field.getName(),
    type: field.constructor.name.replace('PDF', '').replace('Field', ''),
    value: (() => {
      try {
        if (field instanceof PDFTextField) return field.getText() ?? '';
        if (field instanceof PDFCheckBox) return field.isChecked() ? 'true' : 'false';
        if (field instanceof PDFDropdown) return field.getSelected()?.[0] ?? '';
        return '';
      } catch { return ''; }
    })(),
  }));

  return { fields, isXfa };
}

/**
 * Computes a SHA-256 fingerprint of a PDF buffer.
 * Used to detect when a stored template has been replaced with a new version,
 * which may require re-calibration of coordinate overlays.
 */
export async function fingerprintPdf(pdfBuffer: Buffer): Promise<string> {
  const crypto = await import('crypto');
  return crypto.createHash('sha256').update(pdfBuffer).digest('hex').slice(0, 16);
}

/**
 * Fills a PDF form buffer with the provided field values.
 * Returns the filled PDF as a Buffer.
 */
export async function fillPdfForm(
  templateBuffer: Buffer,
  fieldValues: Record<string, string>,
  flatten = false,
): Promise<Buffer> {
  const { PDFDocument } = await import('pdf-lib');

  const pdfDoc = await PDFDocument.load(templateBuffer, { ignoreEncryption: true });
  const form = pdfDoc.getForm();

  // Build a name→field map using getFields() — more reliable than getField() for field
  // names containing special characters (colons, parentheses) that some PDF editors embed.
  const { PDFTextField, PDFCheckBox, PDFDropdown } = await import('pdf-lib');
  const allFormFields = form.getFields();
  const fieldByName = new Map<string, (typeof allFormFields)[0]>();
  for (const f of allFormFields) {
    fieldByName.set(f.getName(), f);
  }

  for (const [fieldName, value] of Object.entries(fieldValues)) {
    const field = fieldByName.get(fieldName);
    if (!field) continue; // field doesn't exist in this PDF — skip silently
    try {
      if (field instanceof PDFTextField) {
        // value = '' explicitly clears the field; non-empty sets it
        field.setText(value);
      } else if (field instanceof PDFCheckBox) {
        if (value === 'true' || value === 'yes' || value === '1') {
          field.check();
        }
      } else if (field instanceof PDFDropdown) {
        try { if (value) field.select(value); } catch { /* skip invalid option */ }
      }
    } catch {
      // Unexpected error setting field value — skip silently
    }
  }

  // Save a pre-flatten snapshot so we can fall back if flatten() corrupts the PDF.
  // Some Cal/OSHA PDFs (e.g. DOSH-100) have invalid cross-reference structures that
  // cause pdfDoc.save() to throw "Expected instance of PDFDict, but got instance of
  // undefined". We try two serialization strategies:
  //   1. Default save() — works for most PDFs.
  //   2. useObjectStreams: false — writes a traditional xref table instead of xref
  //      streams, which sidesteps some cross-reference serialization failures.
  // If both fail we return the original template bytes rather than crashing.
  let preFlattenBytes: Uint8Array;
  try {
    preFlattenBytes = await pdfDoc.save();
  } catch {
    try {
      preFlattenBytes = await pdfDoc.save({ useObjectStreams: false });
    } catch {
      console.warn('[fillPdfForm] pdfDoc.save() failed with both strategies — returning original template buffer');
      return Buffer.from(templateBuffer);
    }
  }

  if (flatten) {
    // Regenerate appearance streams from the current field values BEFORE flattening.
    // Many Cal/OSHA PDFs don't embed a standard font, so updateFieldAppearances()
    // throws unless we supply one. We embed Helvetica (a PDF standard font that never
    // requires an external file) so appearance streams are always regenerated from the
    // current values — cleared fields (CCCM rows 6–11) render blank and newly-set
    // fields (Phone Number:) render their new value, rather than the template's stale
    // appearance streams.
    try {
      const { StandardFonts } = await import('pdf-lib');
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      form.updateFieldAppearances(helvetica);
    } catch {
      // Fallback: try without a supplied font (works if PDF already embeds one)
      try { form.updateFieldAppearances(); } catch { /* give up — flatten with stale streams */ }
    }
    try {
      form.flatten();
      const bytes = await pdfDoc.save();
      return Buffer.from(bytes);
    } catch {
      // flatten() or the post-flatten save corrupted this PDF's structure.
      // Return the filled-but-not-flattened version — still fully usable.
      console.warn('[fillPdfForm] flatten failed — returning filled PDF without flattening');
      return Buffer.from(preFlattenBytes);
    }
  }

  return Buffer.from(preFlattenBytes);
}

/**
 * Builds field value mappings from parsed notice data.
 *
 * Each Cal/OSHA PDF form uses its own non-standard field names
 * (e.g. "TEST DATE", "Todays Date", "Cable Traction"). When `formType`
 * is provided we apply the exact names from the official fillable PDF
 * first, then fall back to generic guesses for anything unmatched.
 */
export function buildFieldMappings(
  parsedData: Record<string, unknown>,
  jobData?: Record<string, unknown>,
  formType?: FormTemplateType,
): Record<string, string> {
  const today = new Date().toLocaleDateString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric',
  });

  // ── Parse address into parts ────────────────────────────────────────────────
  const address = String(parsedData.propertyAddress ?? '');
  const addrParts = address.split(',');
  const streetOnly = addrParts[0]?.trim() ?? address;
  // Try to extract "City, CA 90001" pattern from the remainder
  const afterStreet = addrParts.slice(1).join(',').trim();
  const stateZipMatch = afterStreet.match(/^(.*?),?\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)\s*$/);
  const city = stateZipMatch ? stateZipMatch[1].trim() : (addrParts[1]?.trim() ?? '');
  const state = stateZipMatch ? stateZipMatch[2] : 'CA';
  const zip = address.match(/\d{5}/)?.[0] ?? '';

  // ── Company info from env vars ──────────────────────────────────────────────
  const companyName   = process.env.COMPANY_NAME    ?? '';
  const companyPhone  = process.env.COMPANY_PHONE   ?? '';
  const companyEmail  = process.env.COMPANY_EMAIL   ?? '';
  const companyAddr   = process.env.COMPANY_ADDRESS ?? '';
  const companyCity   = process.env.COMPANY_CITY    ?? '';
  const companyState  = process.env.COMPANY_STATE   ?? 'CA';
  const companyZip    = process.env.COMPANY_ZIP     ?? '';
  const cccmLicense   = process.env.CCCM_LICENSE    ?? '';
  const qeiNumber     = process.env.QEI_NUMBER      ?? '';

  // ── Parsed data helpers ────────────────────────────────────────────────────
  const propertyName   = String(parsedData.propertyName  ?? '');
  const clientCompany  = String(parsedData.clientCompany ?? '');  // building owner / responsible party
  const equipmentId    = String(parsedData.equipmentId   ?? parsedData.serialNumber ?? '');
  const elevatorType   = String(parsedData.elevatorType  ?? '').toLowerCase();
  const inspectionDate = String(parsedData.inspectionDate ?? '');

  const mechanicName    = String(jobData?.mechanicName    ?? '');
  const mechanicLicense = String(jobData?.mechanicLicense ?? cccmLicense);
  const testDate        = String(jobData?.testDate        ?? '');
  const testTime        = String(jobData?.testTime        ?? '');

  // ── Violation / action-plan arrays (EU-632 line items) ────────────────────
  const violationItems = Array.isArray(parsedData.violationItems)
    ? (parsedData.violationItems as string[])
    : [];
  const actionPlanSteps = Array.isArray(parsedData.actionPlan)
    ? (parsedData.actionPlan as Array<{ title?: string; description?: string }>)
    : [];

  // ── Helper ─────────────────────────────────────────────────────────────────
  const mappings: Record<string, string> = {};
  const set = (value: string, ...keys: string[]) => {
    for (const key of keys) {
      if (key && value) mappings[key] = value;
    }
  };

  // ── Generic fallback mappings (common field name patterns) ─────────────────
  set(streetOnly,    'Address', 'address', 'Property Address', 'Street Address', 'street', 'Location', 'Text1', 'TextField1');
  set(city,          'City', 'city', 'City Name');
  set(state,         'State', 'state');
  set(zip,           'Zip', 'zip', 'ZIP', 'Zip Code', 'zipCode', 'Postal Code');
  set(propertyName,  'Building', 'Building Name', 'Property Name');
  set(equipmentId,   'State  No', 'State No:', 'State No', 'State No.', 'StateNo', 'State ID', 'Conveyance Number', 'State Number', 'TextField4', 'TextField5');
  set(inspectionDate,'Inspection Date', 'inspectionDate', 'Date of Inspection', 'Insp Date', 'TextField2', 'TextField3');
  set(today,         'Date', 'date', 'Today', 'Current Date', 'TextField6');
  set(companyName,   'Company', 'Company Name', 'Elevator Company', 'TextField7');
  set(companyPhone,  'Phone Number', 'Phone Number:', 'Phone', 'phone', 'Company Phone');

  if (jobData) {
    set(mechanicName,    'Mechanic Name', 'mechanicName', 'CCCM Name', 'Printed Name', 'TextField8');
    set(mechanicLicense, 'CCCM', 'CCCM#', 'cccm', 'License No', 'CCCM License', 'TextField9');
    set(testDate,        'Test Date', 'testDate', 'Date of Test', 'TextField10');
    set(testTime,        'Test Time', 'testTime', 'Time of Test', 'TextField11');
  }

  // ── Form-type-specific exact field name mappings ────────────────────────────
  // These match the ACTUAL field names in the official Cal/OSHA fillable PDFs.
  // If field names are wrong after a Cal/OSHA form update, run detectPdfFields
  // on the new PDF and update the keys below accordingly.

  if (formType === 'eu787') {
    // ─ EU-787: Annual & 5-Year Test Notification ─────────────────────────────
    // Property / building info
    set(propertyName,  'Building Name');
    set(streetOnly,    'Street');
    set(city,          'City');
    set(state,         'State');
    set(zip,           'Zip Code', 'Zip');
    set(equipmentId,   'State No.', 'State No', 'StateNo', 'State Number',
                     'Unit No', 'Unit No.', 'Car No', 'Car No.',
                     'Device No', 'Device No.', 'Equipment No',
                     'Cal State No', 'CA State No', 'State ID');

    // Elevator company (the filer)
    set(companyName,  'Elevator Company Name', 'Prepared by');
    set(companyPhone, 'Telephone Number');
    set(companyAddr,  'Company Street', 'Company Address');
    set(companyCity,  'Company City');
    set(companyState, 'Company State');
    set(companyZip,   'Company Zip');

    // Test scheduling
    set(testDate, 'TEST DATE');
    set(testTime, 'TIME');

    // Mechanic / CCCM
    set(mechanicName,    'Mechanic Performing Test');
    set(mechanicLicense, 'License No', 'CCCM No', 'CCCM License No');

    // Dates
    set(today, 'Todays Date', "Today's Date");

    // Elevator type checkboxes — set if we can infer from parsedData
    const isTraction  = elevatorType.includes('traction') || elevatorType.includes('cable');
    const isHydraulic = elevatorType.includes('hydraulic');
    const isEscalator = elevatorType.includes('escalator');
    if (isTraction)  set('true', 'Cable Traction');
    if (isHydraulic) set('true', 'Hydraulic');
    if (isEscalator) set('true', 'Escalator');

    // Group checkboxes — infer from safetyTestsRequired if available
    const safetyTests = parsedData.safetyTestsRequired as string[] | undefined;
    if (Array.isArray(safetyTests)) {
      const hasGroupIII = safetyTests.some(t =>
        /group\s*iii|group\s*3|annual\s+test/i.test(t));
      const hasGroupIV  = safetyTests.some(t =>
        /group\s*iv|group\s*4|5.?year\s+test/i.test(t));
      if (hasGroupIII) set('true', 'Group 3');
      if (hasGroupIV)  set('true', 'Group 4');
    }
    // Note: Dropdown1 and Dropdown2 require knowing the exact allowed values
    // in the PDF; leave them for the user to fill via field overrides.
  }

  if (formType === 'eu632') {
    // ─ EU-632: Notice of Conveyance Compliance (Rev. 10/2026) ────────────────
    // Field names from the 2026 redesigned form. COMPLETELY different from the
    // pre-2026 form (old: Req_1/Solution_1/CCCM_1 → new: Req_N_Number/Req_N_Solution/Req_N_CCCM).

    // Header fields
    set(equipmentId,    'State_Number');         // CA state elevator ID
    set(inspectionDate, 'Inspection_Date');       // original inspection / PO date
    set(today,          'CCCM_Date', 'Second_CCCM_Date', 'Non_CCCM_Date');

    // Property address (new form has separate address fields)
    set(streetOnly,  'Street_Address');
    set(city,        'City');
    set(zip,         'Zip');

    // Form pagination (not typically filled by automation)
    // 'Form_Number' and 'Form_Total' — left for user

    // CCCM info — primary CCCM
    set(mechanicName,    'CCCM_Print_Name');
    set(mechanicLicense, 'CCCM_Expiration_Date');  // license # goes in expiry field per form design
    // 'CCCM_Signature' — signature widget, left blank

    // Company / non-CCCM representative
    set(companyName,  'Company');
    // 'Office_Location' — company city/state
    const officeLocation632 = [companyCity, companyState].filter(Boolean).join(', ');
    set(officeLocation632, 'Office_Location');
    // 'Name_and_Title' — non-CCCM printed name & title (leave for user)
    // 'Non_CCCM_Signature' — signature widget, left blank

    // Violation items → Req_N_Number holds the item number (1, 2, 3 …)
    // The new form has 10 rows (Req_1 through Req_10).
    const maxContentRows632 = Math.max(violationItems.length, actionPlanSteps.length);
    for (let idx = 0; idx < Math.min(maxContentRows632, 10); idx++) {
      const hasViolation = !!violationItems[idx];
      const hasStep = !!(actionPlanSteps[idx]?.title || actionPlanSteps[idx]?.description);
      if (hasViolation || hasStep) {
        mappings[`Req_${idx + 1}_Number`] = String(idx + 1);
      }
    }

    // CCCM license # → Req_N_CCCM (only for rows with content)
    if (mechanicLicense) {
      for (let idx = 0; idx < Math.min(maxContentRows632, 10); idx++) {
        const hasViolation = !!violationItems[idx];
        const hasStep = !!(actionPlanSteps[idx]?.title || actionPlanSteps[idx]?.description);
        if (hasViolation || hasStep) {
          mappings[`Req_${idx + 1}_CCCM`] = mechanicLicense;
        }
      }
    }

    // Action plan steps → Req_N_Solution (describes what was done)
    actionPlanSteps.slice(0, 10).forEach((step, idx) => {
      const text = [step.title, step.description].filter(Boolean).join(': ');
      if (text) mappings[`Req_${idx + 1}_Solution`] = text.substring(0, 500);
    });
  }

  if (formType === 'eu776a') {
    // ─ DIR DOSH 776A: Periodic Elevator Test — Hydraulic (Rev. 9/2026) ────────
    // 183 fields; exact field names from PDF inspection.
    set(streetOnly,        'Building_Street_Address');
    set(city,              'City');
    set(state,             'State');           // pre-filled 'CA' in PDF
    set(zip,               'Zip');
    set(equipmentId,       'State_ID_#');
    set(testDate || today, 'Date_of_Testing');

    // CCCM performing test
    set(mechanicName,    'CCCM Performing Test', 'Printed Name');
    set(mechanicLicense, 'CCCM Certificate #');
    // 'Cert Expiration Date' — leave for user

    // CQCC (company cert number)
    set(qeiNumber, 'CQCC');

    // Driving machine type checkboxes
    const isDirectHydraulic = elevatorType.includes('direct');
    const isRopedHydraulic  = elevatorType.includes('roped');
    if (isDirectHydraulic) set('true', 'DrivingMachine_Type_Direct');
    if (isRopedHydraulic)  set('true', 'DrivingMachine_Type_Roped');
    // Note: Row test results (Pass/Fail/NA per row) are filled manually by the tester
  }

  if (formType === 'eu776b') {
    // ─ DIR DOSH 776B: Periodic Elevator Test — Traction (Rev. 9/2026) ─────────
    // 107 fields; exact field names from PDF inspection (note: no underscore in names).
    set(streetOnly,        'Building Street Address');
    set(city,              'City');
    set(state,             'State');           // pre-filled 'CA' in PDF
    set(zip,               'Zip');
    set(equipmentId,       'State ID');
    set(testDate || today, 'Date of Testing');

    // CCCM performing test
    set(mechanicName,    'CCCM Performing Test', 'Printed Name');
    set(mechanicLicense, 'CCCM Certificate');
    // 'Cert Expiration Date' — leave for user

    // CQCC
    set(qeiNumber, 'CQCC');
    // Note: Row test results (Choice1-Choice6 button groups per row) are filled manually
  }

  if (formType === 'dosh100') {
    // ─ DIR DOSH-100: Request for Inspection (Rev. 10/2026 & Rev. 2/2026) ─────
    // Both the 10/2026 (New Install) and 2/2026 (Reinspect) versions have 18 real
    // AcroForm fields with IDENTICAL field names — standard fillPdfForm works for both.

    // Date
    set(today, 'Date');

    // Conveyance / property info
    set(propertyName, 'Building Name');
    set(equipmentId,  'Conveyance State Nos');
    set(streetOnly,   'Location Address of Conveyance (s)');

    // Contact info — Precision Lift Co. is requesting the inspection
    set(companyName,  'Contact Name');
    set(companyPhone, 'Contact Phone');
    set(companyEmail, 'Contact Email');
    // 'Contact Fax' — leave blank (no fax in env vars)

    // Responsible party (building owner / property manager from parsed notice)
    set(clientCompany, 'Name');
    // 'Attention To' — no structured data; user fills manually
    set(streetOnly,    'Address');
    set(city,          'City');
    set(state,         'State');
    set(zip,           'Zip');

    // 'Additional Instructions' and 'Supervisor\'s Notes' — left for manual entry
  }

  if (formType === 'eu215') {
    // ─ EU-215: Intent to Install (field names from PDF inspection — 22 fields) ─
    set(companyName,  'Elevator Company Name');
    set(companyPhone, 'Telephone Number');
    set(companyAddr,  'Billing Address');
    set(qeiNumber,    'CQCC #');
    set(propertyName, 'Building Name');
    set(streetOnly,   'Street');
    set(city,         'City');
    set(zip,          'Zip Code');
    set(today,        'Todays date');
    // Spec fields left for user: Rated Speed, Rated Load, Rise, Controller Model,
    // Prepared by, Estimated completion Date, Number of Units, etc.
  }

  if (formType === 'eu237') {
    // ─ EU-237: Alteration Intent to Install (field names from PDF inspection — 38 fields) ─
    set(companyName,  'Elevator Company Name');
    set(companyPhone, 'Telephone Number');
    set(companyAddr,  'Billing Address');
    set(qeiNumber,    'CQCC #');
    set(propertyName, 'Building Name');
    set(streetOnly,   'Street');
    set(city,         'City');
    set(zip,          'Zip Code');
    set(equipmentId,  'California State ID Number_1');   // first unit; multi-unit jobs: user fills _2–_5
    set(today,        'Today\'s date');
    // Spec fields left for user: Rated Load, Rated Speed, Rise, Control type,
    // Prepared by, Estimated completion Date, etc.
  }

  if (formType === 'eu471') {
    // ─ EU-471: Group 2 Five Year Hydraulic Load Test Report (33 fields) ───────
    set(today,        'Date of Test');
    set(city,         'City');
    set(zip,          'Zip');
    set(equipmentId,  'Elevator State Number');
    set(streetOnly,   'Location of Elevator');

    // Company certification info
    set(companyName,  'Company Name Certification Number and Expiration');
    set(companyPhone, 'CQCC Telephone Number');

    // CCCM info
    set(mechanicName,    'Printed Name');
    set(mechanicLicense, 'CCCM Certification Number');
    // 'CCCM Expiration Date' — leave for user

    // Responsible party (building owner from parsed notice)
    set(clientCompany, 'Name of Responsible Party');
    set(streetOnly,    'Address of Responsible Party');
    set(city,          'City of Responsible Party');
    set(companyPhone,  'Phone Number of Responsible Party');

    // Technical fields left for user: Working Pressure, OSV Tripping Speed, Relief Valve
    // Pressure, Ram dimensions, pump pressures, movement readings, etc.
  }

  if (formType === 'firelog') {
    // ─ Monthly Fire Testing Log (45 fields) ─────────────────────────────────
    set(streetOnly,  'JOB LOCATION');
    set(companyName, 'ELEVATOR COMPANY');
    set(qeiNumber,   'CQCC NUMBER');
    set(equipmentId, 'STATE NUMBER');
    // 'FIRE KEY NUMBER' and 'YEAR' — left for user
    // Monthly fields (PRINT MECHANICS NAME [MON], MECHANICS SIGNATURE [MON],
    // CCCM Number [MON]) are filled by the mechanic each month — not pre-filled.
    // MECHANICS NOTES lines are left blank.
  }

  if (formType === 'suspension') {
    // ─ Suspension Means Fastenings Replacement Notification (69 fields) ──────
    set(today,        'Date');
    set(equipmentId,  'State Conveyance Number');
    set(streetOnly,   'Complete Address of Conveyance');

    // CQCC info
    set(companyName,  'CQCC Business Name');
    set(qeiNumber,    'CQCC cert');

    // CCCM performing work (primary)
    set(mechanicName,    'CCCM Name1');
    set(mechanicLicense, 'CCCM1');
    // 'Certification Expiration Date1' — leave for user
    // CCCM 2 and 3 — additional CCCMs, left for user

    // Responsible party (building owner)
    set(clientCompany, 'Responsible Party Name');
    set(streetOnly,    'Complete Business Address');
    set(companyPhone,  'Telephone');
    // 'Contact Person' — leave for user

    // Conveyance specs — left for user: Rated Load, Rated Speed, rope/belt details
    // Dates (removal, commencement, completion, return to service) — filled by field crew
    // 'Elevator Components Adjusted, Repaired, or Replaced 1-10' — filled by field crew
  }

  if (formType === 'eu943') {
    // ─ EU-943: Change in Responsible Party ───────────────────────────────────
    set(companyName,  'New Responsible Party', 'Company Name');
    set(companyPhone, 'Phone', 'Telephone Number');
    set(companyAddr,  'New Address', 'Company Address');
    set(companyCity,  'New City', 'City');
    set(companyZip,   'New Zip', 'Zip');
    set(propertyName, 'Building Name');
    set(streetOnly,   'Building Street', 'Street', 'Address');
    set(city,         'Building City');
    set(equipmentId,  'State No.', 'State No', 'Unit No');
    set(today,        'Date', 'Todays Date');
  }

  return mappings;
}

/**
 * The SHA-256 fingerprint prefix of the DOSH-100 template this overlay was
 * calibrated against (PDFium-printed flat version of Rev. 2/2026).
 *
 * At generation time, generateFilledForm compares the stored template's fingerprint
 * against this value. If they differ a new form version has been uploaded and the
 * coordinates below may no longer align — the response includes versionWarning=true
 * so the UI can alert the user to verify the output before filing.
 *
 * When Cal/OSHA releases a new DOSH-100 version:
 *   1. Upload the new Chrome-printed PDF via Settings → Form Templates
 *   2. Re-derive coordinates using pdfplumber (y = pageHeight - pdfplumber_bottom + 2)
 *   3. Update DOSH100_CALIBRATED_FINGERPRINT to the new template's fingerprint
 *   4. Update the addField() calls below with the new coordinates
 */
export const DOSH100_CALIBRATED_FINGERPRINT = 'UNCALIBRATED';
// ↑ Will be set to the real fingerprint on first upload via Settings → Form Templates.
// generateFilledForm writes it to dosh100_meta.json in Supabase on the first upload
// and reads it back on every generation to detect template version drift.

/**
 * Draws filled data directly onto the DOSH-100 PDF using AcroForm text fields.
 *
 * The official Cal/OSHA DOSH-100 Rev. 2/2026 PDF uses XFA (XML Forms Architecture)
 * which pdf-lib cannot write to — form.getFields() returns an empty array.
 * We instead create editable AcroForm text fields at exact coordinates verified
 * against the 612×792 pt form. Fields are pre-filled but remain editable in any
 * AcroForm-aware PDF viewer (Acrobat, PDF Gear, Chrome, Preview).
 *
 * Upload the Chrome-printed (PDFium-generated) flat version of the PDF as the
 * dosh100 template — it is free of XFA structure and saves cleanly.
 */
export async function drawDosh100Overlay(
  templateBuffer: Buffer,
  parsedData: Record<string, unknown>,
): Promise<Buffer> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

  // ── Parse source data (mirrors buildFieldMappings dosh100 logic) ───────────
  const today = new Date().toLocaleDateString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric',
  });

  const address    = String(parsedData.propertyAddress ?? '');
  const addrParts  = address.split(',');
  const streetOnly = addrParts[0]?.trim() ?? address;
  const afterStreet = addrParts.slice(1).join(',').trim();
  const stateZipMatch = afterStreet.match(/^(.*?),?\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)\s*$/);
  const city  = stateZipMatch ? stateZipMatch[1].trim() : (addrParts[1]?.trim() ?? '');
  const state = stateZipMatch ? stateZipMatch[2] : 'CA';
  const zip   = address.match(/\d{5}/)?.[0] ?? '';

  const companyName  = process.env.COMPANY_NAME  ?? '';
  const companyPhone = process.env.COMPANY_PHONE ?? '';
  const companyEmail = process.env.COMPANY_EMAIL ?? '';

  const propertyName  = String(parsedData.propertyName  ?? '');
  const clientCompany = String(parsedData.clientCompany ?? '');
  const equipmentId   = String(parsedData.equipmentId   ?? parsedData.serialNumber ?? '');

  // ── Build editable AcroForm fields ───────────────────────────────────────────
  const pdfDoc = await PDFDocument.load(templateBuffer, { ignoreEncryption: true });
  const _pages = pdfDoc.getPages();
  if (_pages.length === 0) {
    throw new Error(
      'DOSH-100 template is encrypted and could not be loaded by pdf-lib. ' +
      'Re-upload the PDF after running "pip install pypdf" on your machine. ' +
      'pypdf is required to decrypt Cal/OSHA null-password encrypted PDFs at upload time.',
    );
  }
  const page   = _pages[0];
  const form   = pdfDoc.getForm();
  const font   = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const black  = rgb(0, 0, 0);
  const white  = rgb(1, 1, 1);

  /**
   * Adds a pre-filled, editable AcroForm text field at the given position.
   *
   * x, y — same coordinate space as page.drawText() (y = baseline, measured
   *          from page bottom). The field rectangle is offset 2pt below so the
   *          rendered text baseline lands exactly where a drawText call would.
   *
   * Fields have no visible border — they look like typed text but are fully
   * editable in Acrobat, PDF Gear, Preview, and any AcroForm-aware viewer.
   * If the system misparses a value the user just clicks the field and types.
   */
  const addField = (
    name: string,
    value: string,
    x: number,
    y: number,
    width: number,
    height = 14,
    multiline = false,
  ) => {
    try {
      const field = form.createTextField(name);
      if (value) field.setText(value);
      // NOTE: do NOT call field.setFontSize() here — it requires a pre-existing /DA
      // (Default Appearance) entry on the field.  When the template PDF has no AcroForm
      // /DR resource dict (e.g. after a page-by-page pypdf repair), createTextField()
      // produces a field with no /DA, and setFontSize() throws "No /DA entry found".
      // updateAppearances(font) below writes the complete /DA including size, so the
      // font is rendered correctly without calling setFontSize() first.
      if (multiline) field.enableMultiline();
      field.addToPage(page, {
        x,
        y: y - 2,       // shift rect down so text baseline aligns with y
        width,
        height,
        borderWidth: 0,
        textColor: black,
        backgroundColor: white,
      });
      field.updateAppearances(font);
    } catch (err) {
      console.warn(`[dosh100] addField(${name}) failed:`, err);
    }
  };

  // Coordinates verified against DOSH-100 Rev. 2/2026 (PDFium flat, 612×792 pt letter).
  // x/y origin: bottom-left of page. y values are text baseline positions
  // derived from pdfplumber analysis (y = 792 − pdfplumber_bottom + 2).
  addField('dosh100_date',         today,         55,  682, 120);
  addField('dosh100_address',      address,       22,  609, 568, 28, true);  // may wrap
  addField('dosh100_buildingName', propertyName,  108, 566, 440);
  addField('dosh100_conveyanceNo', equipmentId,   168, 545, 300);
  addField('dosh100_contactName',  companyName,   106, 486, 320);
  addField('dosh100_contactPhone', companyPhone,  463, 486, 120);
  addField('dosh100_contactEmail', companyEmail,  108, 461, 400);
  addField('dosh100_rpName',       clientCompany,  61, 407, 500);
  addField('dosh100_rpAddress',    streetOnly,     73, 386, 490);
  addField('dosh100_city',         city,           50, 365, 330);
  addField('dosh100_state',        state,          411, 365,  50);
  addField('dosh100_zip',          zip,            496, 365,  80);

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
