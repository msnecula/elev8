'use server';

import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { notices, jobs, workOrders, accounts, properties, technicians } from '@/drizzle/schema';
import { eq, desc } from 'drizzle-orm';
import type { FormTemplateType } from '@/server/services/formTemplateService';
import type { ParsedNoticeData } from '@/server/services/noticeParser';
import type { ActionResult } from '@/types/api';

const BUCKET = 'form-templates';

// ── Upload official form template ─────────────────────────────────────────────

export async function uploadFormTemplate(
  formType: FormTemplateType,
  fileBase64: string,
  fileName: string,
): Promise<ActionResult<{
  fields: Array<{ name: string; type: string; value: string }>;
  isXfa: boolean;
  fingerprint: string;
}>> {
  await requireRole('admin');

  const { createServiceClient } = await import('@/lib/supabase/server');
  const supabase = createServiceClient();

  // Decode base64 to buffer
  const rawBuffer = Buffer.from(fileBase64, 'base64');

  // Repair PDF: strip encryption and rebuild broken xref tables so pdf-lib can parse
  // form fields. California DIR PDFs are often encrypted with a null owner password
  // and have non-standard cross-reference structures that pdf-lib cannot traverse.
  //
  // Strategy 1: qpdf --decrypt  (Linux servers; not available on Windows dev or Vercel)
  // Strategy 2: python3 + pypdf  (most POSIX environments; pure-Python, no native deps)
  // Fallback:   original buffer  (upload still succeeds; warn user to pre-decrypt)
  //
  // Both strategies use spawnSync with a hard timeout so we never hang the upload.
  let buffer = rawBuffer;
  try {
    const { spawnSync } = await import('child_process');
    const os   = await import('os');
    const path = await import('path');
    const fs   = await import('fs');

    // ── Strategy 1: qpdf ────────────────────────────────────────────────────────
    const hasQpdf = spawnSync('which', ['qpdf'], { timeout: 3_000 }).status === 0
                 || spawnSync('where', ['qpdf'], { timeout: 3_000 }).status === 0; // Windows

    if (hasQpdf) {
      const stamp  = Date.now();
      const tmpIn  = path.join(os.tmpdir(), `elev8-${stamp}-in.pdf`);
      const tmpOut = path.join(os.tmpdir(), `elev8-${stamp}-out.pdf`);
      try {
        fs.writeFileSync(tmpIn, rawBuffer);
        const r = spawnSync('qpdf', ['--decrypt', tmpIn, tmpOut], { timeout: 15_000 });
        if (r.status === 0) {
          buffer = fs.readFileSync(tmpOut);
          console.log(`[uploadFormTemplate] qpdf repair OK for ${formType}`);
        } else {
          console.warn('[uploadFormTemplate] qpdf non-zero:', r.stderr?.toString());
        }
      } finally {
        try { fs.unlinkSync(tmpIn);  } catch { /* ignore */ }
        try { fs.unlinkSync(tmpOut); } catch { /* ignore */ }
      }
    }

    // ── Strategy 2: python3 / python + pypdf ────────────────────────────────────
    // pypdf 6.x removed the 'strict' parameter — do not pass it.
    // Use writer.append(reader) — NOT page-by-page add_page() — so the
    // /AcroForm dictionary is preserved alongside the page content.
    // add_page() copies only page streams and widget annotations; it silently
    // drops the document-level /AcroForm dict, leaving inspectPdf with 0 fields.
    if (buffer === rawBuffer) {
      const pyScript = [
        'import sys, io, traceback',
        'inp = sys.stdin.buffer.read()',
        'sys.stderr.write("[py] stdin: {} bytes\\n".format(len(inp)))',
        'result = None',
        'for lib in ["pypdf", "PyPDF2"]:',
        '    try:',
        '        mod = __import__(lib)',
        '        PdfReader = mod.PdfReader',
        '        PdfWriter = mod.PdfWriter',
        '    except ImportError:',
        '        sys.stderr.write("[py] {} not installed\\n".format(lib))',
        '        continue',
        '    for kw in [{"password": b""}, {}]:',
        '        try:',
        '            reader = PdfReader(io.BytesIO(inp), **kw)',
        '            if reader.is_encrypted:',
        '                reader.decrypt("")',
        '            w = PdfWriter()',
        '            # append() copies pages AND the /AcroForm dictionary (fields)',
        '            # page-by-page add_page() copies only pages — AcroForm is lost',
        '            try:',
        '                w.append(reader)',
        '                if len(w.pages) == 0: raise ValueError("append: 0 pages")',
        '                sys.stderr.write("[{}] append ok, {} pages\\n".format(lib, len(w.pages)))',
        '            except Exception as e_app:',
        '                sys.stderr.write("[{}] append fallback: {}\\n".format(lib, e_app))',
        '                w = PdfWriter()',
        '                for page in reader.pages:',
        '                    w.add_page(page)',
        '            buf = io.BytesIO()',
        '            w.write(buf)',
        '            result = buf.getvalue()',
        '            sys.stderr.write("[{}] ok {} bytes\\n".format(lib, len(result)))',
        '            break',
        '        except Exception as exc:',
        '            sys.stderr.write("[{}] kw={}: {}\\n{}\\n".format(',
        '                lib, list(kw.keys()), exc, traceback.format_exc()))',
        '    if result:',
        '        break',
        'if result and len(result) > 100:',
        '    sys.stdout.buffer.write(result)',
        'else:',
        '    sys.stderr.write("[py] all strategies failed\\n")',
        '    sys.exit(1)',
      ].join('\n');

      for (const cmd of ['python3', 'python']) {
        const r = spawnSync(cmd, ['-c', pyScript], {
          input: rawBuffer,
          timeout: 15_000,
          maxBuffer: 50 * 1024 * 1024,
        });
        if (r.status === 0 && r.stdout && r.stdout.length > 100) {
          buffer = r.stdout;
          console.log(`[uploadFormTemplate] ${cmd}/pypdf repair OK for ${formType}`);
          break;
        } else {
          console.warn(`[uploadFormTemplate] ${cmd} repair failed:`, r.stderr?.toString().slice(0, 300));
        }
      }
    }

    if (buffer === rawBuffer) {
      console.warn(`[uploadFormTemplate] No PDF repair available for ${formType} — storing original. ` +
        'If fields are not detected, run: qpdf --decrypt original.pdf fixed.pdf and upload fixed.pdf');
    }
  } catch (err) {
    console.warn('[uploadFormTemplate] PDF repair error:', (err as Error).message);
  }

  // Upload to Supabase Storage — overwrites existing
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(`${formType}.pdf`, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    return { success: false, error: `Upload failed: ${uploadError.message}` };
  }

  // Inspect the uploaded PDF — detect AcroForm fields, XFA format, and compute fingerprint
  const { inspectPdf, fingerprintPdf } = await import('@/server/services/formTemplateService');
  let fields: Array<{ name: string; type: string; value: string }> = [];
  let isXfa = false;
  let fingerprint = '';

  try {
    const inspection = await inspectPdf(buffer);
    fields = inspection.fields;
    isXfa = inspection.isXfa;
    fingerprint = await fingerprintPdf(buffer);
  } catch (err) {
    console.warn('[formTemplates] PDF inspection failed:', err);
    // Non-fatal — template is stored, inspection metadata just won't be available
  }

  // For dosh100: store a metadata sidecar so generateFilledForm can detect version drift.
  // If the fingerprint later changes (new form uploaded), we surface a warning at generation
  // time so users know to verify field positions before filing.
  if (formType === 'dosh100' && fingerprint) {
    const meta = JSON.stringify({
      fingerprint,
      uploadedAt: new Date().toISOString(),
      hasAcroFormFields: fields.length > 0,
      isXfa,
      fileName,
    });
    await supabase.storage
      .from(BUCKET)
      .upload('dosh100_meta.json', Buffer.from(meta), {
        contentType: 'application/json',
        upsert: true,
      });
  }

  // NOTE: no revalidatePath here — the client calls getUploadedTemplates() directly
  // after upload and updates its own state, so no RSC re-render of the page is needed.
  return { success: true, data: { fields, isXfa, fingerprint } };
}

// ── Check which templates are uploaded ───────────────────────────────────────

export async function getUploadedTemplates(): Promise<ActionResult<
  Record<FormTemplateType, { uploaded: boolean; updatedAt?: string }>
>> {
  await requireRole('admin', 'dispatcher');

  const { createServiceClient } = await import('@/lib/supabase/server');
  const supabase = createServiceClient();

  const { data: files } = await supabase.storage.from(BUCKET).list('', { limit: 50 });

  const formTypes: FormTemplateType[] = [
    'eu632', 'eu787', 'eu776a', 'eu776b', 'dosh100',
    'eu215', 'eu237', 'eu471', 'firelog', 'suspension', 'eu943',
  ];
  const result = {} as Record<FormTemplateType, { uploaded: boolean; updatedAt?: string }>;

  for (const formType of formTypes) {
    const file = files?.find(f => f.name === `${formType}.pdf`);
    result[formType] = {
      uploaded: !!file,
      updatedAt: file?.updated_at ?? undefined,
    };
  }

  return { success: true, data: result };
}

// ── Generate filled form ──────────────────────────────────────────────────────

export async function generateFilledForm(input: {
  formType: FormTemplateType;
  noticeId?: string;
  workOrderId?: string;
  additionalFields?: Record<string, string>;
  flatten?: boolean;
}): Promise<ActionResult<{ pdfBase64: string; filename: string; unfilledFields: string[]; allPdfFields: Array<{ name: string; type: string; value: string }>; autoFilledFields: Record<string, string>; templateVersionWarning: string | null }>> {
  await requireRole('admin', 'dispatcher');

  const { createServiceClient } = await import('@/lib/supabase/server');
  const supabase = createServiceClient();

  // Download template from storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(`${input.formType}.pdf`);

  if (downloadError || !fileData) {
    return {
      success: false,
      error: `Template not found. Please upload the ${input.formType.toUpperCase()} form in Settings → Form Templates first.`,
    };
  }

  const templateBuffer = Buffer.from(await fileData.arrayBuffer());

  // Gather parsed data from notice/job
  let parsedData: Record<string, unknown> = {};
  let jobData: Record<string, unknown> = {};

  if (input.noticeId) {
    const notice = await db.query.notices.findFirst({ where: eq(notices.id, input.noticeId) });
    if (notice?.parsedData) {
      parsedData = notice.parsedData as Record<string, unknown>;
    }

    // If no explicit workOrderId, walk notice → job → most recent WO → technician
    if (!input.workOrderId) {
      const jobRows = await db
        .select({ job: jobs })
        .from(jobs)
        .where(eq(jobs.noticeId, input.noticeId))
        .limit(1);

      if (jobRows[0]) {
        const woRows = await db
          .select({ wo: workOrders, tech: technicians })
          .from(workOrders)
          .leftJoin(technicians, eq(workOrders.assignedTechnicianId, technicians.id))
          .where(eq(workOrders.jobId, jobRows[0].job.id))
          .orderBy(desc(workOrders.createdAt))
          .limit(1);

        if (woRows[0]) {
          const { wo, tech } = woRows[0];
          jobData = {
            mechanicName: tech?.fullName ?? '',
            // leave undefined if no license — lets formTemplateService fall back to CCCM_LICENSE env var
            mechanicLicense: tech?.cccmLicense ?? undefined,
            testDate: wo.scheduledStart
              ? new Date(wo.scheduledStart).toLocaleDateString('en-US')
              : '',
            testTime: wo.scheduledStart
              ? new Date(wo.scheduledStart).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
              : '',
          };
        }
      }
    }
  }

  if (input.workOrderId) {
    const woRows = await db
      .select({ wo: workOrders, job: jobs, tech: technicians })
      .from(workOrders)
      .leftJoin(jobs, eq(workOrders.jobId, jobs.id))
      .leftJoin(technicians, eq(workOrders.assignedTechnicianId, technicians.id))
      .where(eq(workOrders.id, input.workOrderId))
      .limit(1);

    if (woRows[0]) {
      const { wo, tech } = woRows[0];
      jobData = {
        mechanicName: tech?.fullName ?? '',
        // leave undefined if no license — lets formTemplateService fall back to CCCM_LICENSE env var
        mechanicLicense: tech?.cccmLicense ?? undefined,
        testDate: wo.scheduledStart
          ? new Date(wo.scheduledStart).toLocaleDateString('en-US')
          : '',
        testTime: wo.scheduledStart
          ? new Date(wo.scheduledStart).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          : '',
      };
    }
  }

  // Build field mappings from our data, using exact field names for this form type
  const { buildFieldMappings, fillPdfForm, inspectPdf, fingerprintPdf, drawDosh100Overlay } = await import('@/server/services/formTemplateService');
  const autoFields = buildFieldMappings(parsedData, jobData, input.formType);

  // Merge with any manually provided fields
  const allFields = { ...autoFields, ...(input.additionalFields ?? {}) };

  let filledBuffer: Buffer;
  let pdfFields: Array<{ name: string; type: string; value: string }> = [];
  let unfilledFields: string[] = [];
  let templateVersionWarning: string | null = null;

  if (input.formType === 'dosh100') {
    // ── DOSH-100 smart path ────────────────────────────────────────────────────
    //
    // Step 1: Inspect the uploaded template.
    //   • If it now has real AcroForm fields (Cal/OSHA fixed their PDF), use the
    //     standard AcroForm fill path automatically — no code change needed.
    //   • If it has no AcroForm fields (XFA or flat), use the coordinate overlay.
    //
    // Step 2: Compare the template fingerprint against the stored metadata sidecar
    //   (dosh100_meta.json). If fingerprints differ, a new form version was uploaded
    //   and the overlay coordinates may no longer align. Surface a warning so the
    //   user can verify the output before filing.

    const inspection = await inspectPdf(templateBuffer);

    if (inspection.fields.length > 0) {
      // ✅ Cal/OSHA has released an AcroForm version — fill normally
      pdfFields = inspection.fields;
      unfilledFields = pdfFields
        .filter(f => !allFields[f.name] || allFields[f.name] === '')
        .map(f => f.name);
      filledBuffer = await fillPdfForm(templateBuffer, allFields, input.flatten ?? false);
    } else {
      // No AcroForm fields — use coordinate overlay (XFA or flat PDF)
      filledBuffer = await drawDosh100Overlay(templateBuffer, parsedData);

      // Check for template version drift
      try {
        const { data: metaFile } = await supabase.storage
          .from(BUCKET)
          .download('dosh100_meta.json');

        if (metaFile) {
          const meta = JSON.parse(await metaFile.text()) as {
            fingerprint?: string;
            uploadedAt?: string;
          };

          if (meta.fingerprint) {
            const currentFingerprint = await fingerprintPdf(templateBuffer);
            if (meta.fingerprint !== currentFingerprint) {
              templateVersionWarning =
                'The DOSH-100 template has changed since field positions were last calibrated. ' +
                'Verify that all fields are correctly positioned before filing. ' +
                'If positions look wrong, contact your admin to recalibrate the overlay coordinates.';
              console.warn(
                `[dosh100] Template fingerprint mismatch — stored: ${meta.fingerprint}, current: ${currentFingerprint}. ` +
                'Overlay coordinates may be misaligned with the new form version.',
              );
            }
          }
        }
      } catch (err) {
        // Non-fatal — metadata sidecar may not exist yet (first upload before this fix)
        console.warn('[dosh100] Could not read dosh100_meta.json:', err);
      }
    }
  } else {
    // ── Standard AcroForm path for all other form types ────────────────────────
    const inspection = await inspectPdf(templateBuffer);
    pdfFields = inspection.fields;

    if (pdfFields.length === 0 && inspection.isXfa) {
      // XFA form uploaded — warn clearly rather than returning a blank PDF silently
      return {
        success: false,
        error:
          `The uploaded ${input.formType.toUpperCase()} template uses XFA format, which cannot be auto-filled. ` +
          'Please upload the Chrome-printed (flat) version of this form, or contact your admin ' +
          'to set up coordinate-based overlay support for this form type.',
      };
    }

    // Find fields that exist in PDF but have no value
    unfilledFields = pdfFields
      .filter(f => !allFields[f.name] || allFields[f.name] === '')
      .map(f => f.name);

    // Fill the PDF via AcroForm field names
    filledBuffer = await fillPdfForm(templateBuffer, allFields, input.flatten ?? false);
  }

  const propertyName = String(parsedData.propertyName ?? 'document').replace(/\s+/g, '-').slice(0, 30);
  const filename = `${input.formType.toUpperCase()}-${propertyName}-${Date.now()}.pdf`;

  return {
    success: true,
    data: {
      pdfBase64: filledBuffer.toString('base64'),
      filename,
      unfilledFields,
      allPdfFields: pdfFields,
      autoFilledFields: autoFields,
      templateVersionWarning,
    },
  };
}
