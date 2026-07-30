import 'server-only';

export type FormTemplateType =
  | 'eu632'   // Notice of Conveyance Compliance
  | 'eu787'   // Annual & 5 Year Test Notification
  | 'eu776'   // Annual Testing Form
  | 'dosh100' // Request for Inspection
  | 'eu215'   // Intent to Install
  | 'eu237'   // Alteration Intent to Install
  | 'eu943';  // Change in Responsible Party

export const FORM_TEMPLATE_INFO: Record<FormTemplateType, {
  label: string;
  description: string;
  officialUrl: string;
  filedWith: string;
  filedWhen: string;
}> = {
  eu632: {
    label: 'EU-632 — Notice of Conveyance Compliance',
    description: 'Filed with Cal/OSHA after ALL violations on a Preliminary Order are corrected. One form per conveyance.',
    officialUrl: 'https://www.dir.ca.gov/dosh/elevator/compliance%20form%20Doc%20EU-632.pdf',
    filedWith: 'Cal/OSHA District Office that issued the Preliminary Order',
    filedWhen: 'After all corrective work is complete — before the compliance deadline on the PO',
  },
  eu787: {
    label: 'EU-787 — Annual & 5 Year Test Notification',
    description: 'Filed with Cal/OSHA district office BEFORE scheduled annual or 5-year tests. Groups III and IV.',
    officialUrl: 'https://www.dir.ca.gov/dosh/elevator/Annual%205%20Yr%20Test%20Notification%20form%20EU-787.pdf',
    filedWith: 'Cal/OSHA District Office',
    filedWhen: 'Before the test — confirm specific lead time with your district office',
  },
  eu776: {
    label: 'EU-776 — Annual Testing Form',
    description: 'Filed with Cal/OSHA after annual testing is complete.',
    officialUrl: 'https://www.dir.ca.gov/dosh/Annual%20Tesing%20Form%20Doc%20%20EU-776.pdf',
    filedWith: 'Cal/OSHA District Office',
    filedWhen: 'After annual testing is complete',
  },
  dosh100: {
    label: 'DIR DOSH 100 — Request for Inspection',
    description: 'Requests a Division inspection for permit renewal or post-repair reinspection.',
    officialUrl: 'https://www.dir.ca.gov/dosh/dosh100.pdf',
    filedWith: 'Cal/OSHA District Office',
    filedWhen: 'When requesting reinspection after repairs, or for permit renewal',
  },
  eu215: {
    label: 'EU-215 — Intent to Install',
    description: 'Filed before new elevator installation begins.',
    officialUrl: 'https://www.dir.ca.gov/dosh/elevator/EU-215.pdf',
    filedWith: 'Cal/OSHA District Office',
    filedWhen: 'Before installation begins',
  },
  eu237: {
    label: 'EU-237 — Alteration Intent to Install',
    description: 'Filed before a material alteration begins. A §7301.1 permit must already be obtained.',
    officialUrl: 'https://www.dir.ca.gov/dosh/elevator/Intent%20to%20Alter%20Form%20Doc%20EU-237.pdf',
    filedWith: 'Cal/OSHA District Office',
    filedWhen: 'Before alteration work begins — after permit is obtained',
  },
  eu943: {
    label: 'EU-943 — Change in Responsible Party',
    description: 'Filed when building ownership or property management changes.',
    officialUrl: 'https://www.dir.ca.gov/dosh/elevator/Change%20in%20responsible%20Party%20Form%20Doc%20EU-943%20fillable.pdf',
    filedWith: 'Cal/OSHA Elevator District Office',
    filedWhen: 'Promptly after ownership or management changes',
  },
};

/**
 * Reads all fillable field names from an uploaded PDF.
 * Returns a map of field names to their current values.
 */
export async function detectPdfFields(
  pdfBuffer: Buffer,
): Promise<Array<{ name: string; type: string; value: string }>> {
  const { PDFDocument } = await import('pdf-lib');

  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const fields = form.getFields();

  return fields.map(field => ({
    name: field.getName(),
    type: field.constructor.name.replace('PDF', '').replace('Field', ''),
    value: (() => {
      try {
        const name = field.constructor.name;
        if (name === 'PDFTextField') return (field as any).getText() ?? '';
        if (name === 'PDFCheckBox') return (field as any).isChecked() ? 'true' : 'false';
        if (name === 'PDFDropdown') return (field as any).getSelected()?.[0] ?? '';
        return '';
      } catch { return ''; }
    })(),
  }));
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

  for (const [fieldName, value] of Object.entries(fieldValues)) {
    if (!value) continue;
    try {
      const field = form.getField(fieldName);
      const typeName = field.constructor.name;
      if (typeName === 'PDFTextField') {
        (field as any).setText(value);
      } else if (typeName === 'PDFCheckBox') {
        if (value === 'true' || value === 'yes' || value === '1') {
          (field as any).check();
        }
      } else if (typeName === 'PDFDropdown') {
        try { (field as any).select(value); } catch { /* skip invalid option */ }
      }
    } catch {
      // Field not found in this PDF — skip silently
    }
  }

  if (flatten) form.flatten();

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

/**
 * Builds field value mappings from parsed notice data.
 * These are our best guesses for common Cal/OSHA form fields.
 * The system tries multiple common field name patterns since 
 * field names vary between form versions.
 */
export function buildFieldMappings(
  parsedData: Record<string, unknown>,
  jobData?: Record<string, unknown>,
): Record<string, string> {
  const today = new Date().toLocaleDateString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric',
  });

  const address = String(parsedData.propertyAddress ?? '');
  const city = address.includes(',')
    ? address.split(',')[1]?.trim() ?? ''
    : '';
  const zip = address.match(/\d{5}/)?.[0] ?? '';
  const streetOnly = address.split(',')[0]?.trim() ?? address;

  // Build all possible field name variations
  const mappings: Record<string, string> = {};

  const set = (value: string, ...keys: string[]) => {
    for (const key of keys) {
      if (key && value) mappings[key] = value;
    }
  };

  set(streetOnly,
    'Address', 'address', 'Property Address', 'propertyAddress',
    'Street Address', 'street', 'Location', 'location',
    'Text1', 'TextField1',
  );

  set(city,
    'City', 'city', 'City Name', 'cityName',
  );

  set(zip,
    'Zip', 'zip', 'ZIP', 'Zip Code', 'zipCode', 'Postal Code',
  );

  set(String(parsedData.equipmentId ?? parsedData.serialNumber ?? ''),
    'State No', 'StateNo', 'state_no', 'State ID', 'stateId',
    'Conveyance Number', 'conveyanceNumber', 'State Number',
    'Conveyance State No', 'CA State ID', 'State No.',
    'TextField4', 'TextField5',
  );

  set(String(parsedData.inspectionDate ?? ''),
    'Inspection Date', 'inspectionDate', 'Date of Inspection',
    'Insp Date', 'TextField2', 'TextField3',
  );

  set(today,
    'Date', 'date', 'Today', 'Current Date', 'TextField6',
  );

  // Job-specific mappings
  if (jobData) {
    set(String(jobData.mechanicName ?? ''),
      'Mechanic Name', 'mechanicName', 'CCCM Name', 'cccmName',
      'Printed Name', 'printedName', 'TextField7',
    );
    set(String(jobData.mechanicLicense ?? ''),
      'CCCM', 'CCCM#', 'cccm', 'License No', 'licenseNo',
      'CCCM License', 'TextField8',
    );
    set(String(jobData.testDate ?? ''),
      'Test Date', 'testDate', 'Date of Test', 'TextField9',
    );
    set(String(jobData.testTime ?? ''),
      'Test Time', 'testTime', 'Time of Test', 'TextField10',
    );
  }

  return mappings;
}
