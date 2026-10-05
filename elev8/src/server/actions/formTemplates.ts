'use server';

import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { notices, jobs, workOrders, accounts, properties, technicians } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { FormTemplateType } from '@/server/services/formTemplateService';
import type { ParsedNoticeData } from '@/server/services/noticeParser';
import type { ActionResult } from '@/types/api';

const BUCKET = 'form-templates';

// ── Upload official form template ─────────────────────────────────────────────

export async function uploadFormTemplate(
  formType: FormTemplateType,
  fileBase64: string,
  fileName: string,
): Promise<ActionResult<{ fields: Array<{ name: string; type: string; value: string }> }>> {
  const user = await requireRole('admin');

  const { createServiceClient } = await import('@/lib/supabase/server');
  const supabase = createServiceClient();

  // Decode base64 to buffer
  const buffer = Buffer.from(fileBase64, 'base64');

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

  // Detect fields in the uploaded PDF
  const { detectPdfFields } = await import('@/server/services/formTemplateService');
  let fields: Array<{ name: string; type: string; value: string }> = [];
  try {
    fields = await detectPdfFields(buffer);
  } catch (err) {
    console.warn('[formTemplates] Field detection failed:', err);
    // Non-fatal — template is stored, fields just won't be shown
  }

  revalidatePath('/settings/forms');
  return { success: true, data: { fields } };
}

// ── Check which templates are uploaded ───────────────────────────────────────

export async function getUploadedTemplates(): Promise<ActionResult<
  Record<FormTemplateType, { uploaded: boolean; updatedAt?: string }>
>> {
  await requireRole('admin', 'dispatcher');

  const { createServiceClient } = await import('@/lib/supabase/server');
  const supabase = createServiceClient();

  const { data: files } = await supabase.storage.from(BUCKET).list('', { limit: 50 });

  const formTypes: FormTemplateType[] = ['eu632', 'eu787', 'eu776', 'dosh100', 'eu215', 'eu237', 'eu943'];
  const result = {} as Record<FormTemplateType, { uploaded: boolean; updatedAt?: string }>;

  for (const formType of formTypes) {
    const file = files?.find(f => f.name === `${formType}.pdf`);
    result[formType] = {
      uploaded: !!file,
      updatedAt: file?.updated_at,
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
}): Promise<ActionResult<{ pdfBase64: string; filename: string; unfilledFields: string[] }>> {
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
        mechanicLicense: tech?.email ?? '', // CCCM license stored separately in practice
        testDate: wo.scheduledStart
          ? new Date(wo.scheduledStart).toLocaleDateString('en-US')
          : '',
        testTime: wo.scheduledStart
          ? new Date(wo.scheduledStart).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          : '',
      };
    }
  }

  // Build field mappings from our data
  const { buildFieldMappings, fillPdfForm, detectPdfFields } = await import('@/server/services/formTemplateService');
  const autoFields = buildFieldMappings(parsedData, jobData);

  // Merge with any manually provided fields
  const allFields = { ...autoFields, ...(input.additionalFields ?? {}) };

  // Detect which fields exist in the PDF
  const pdfFields = await detectPdfFields(templateBuffer);
  const pdfFieldNames = new Set(pdfFields.map(f => f.name));

  // Find fields that exist in PDF but have no value
  const unfilledFields = pdfFields
    .filter(f => !allFields[f.name] || allFields[f.name] === '')
    .map(f => f.name);

  // Fill the PDF
  const filledBuffer = await fillPdfForm(templateBuffer, allFields, input.flatten ?? false);

  const propertyName = String(parsedData.propertyName ?? 'document').replace(/\s+/g, '-').slice(0, 30);
  const filename = `${input.formType.toUpperCase()}-${propertyName}-${Date.now()}.pdf`;

  return {
    success: true,
    data: {
      pdfBase64: filledBuffer.toString('base64'),
      filename,
      unfilledFields,
    },
  };
}
