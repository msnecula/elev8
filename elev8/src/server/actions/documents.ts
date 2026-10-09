'use server';

import { requireRole, requireUser } from '@/lib/auth';
import { db } from '@/server/db/client';
import { notices, jobs, workOrders, accounts, properties, documents } from '@/drizzle/schema';
import { eq, desc } from 'drizzle-orm';
import type { EU632Data, AdvanceNoticeData, EU787Data } from '@/server/services/formGenerator';
import type { ParsedNoticeData } from '@/server/services/noticeParser';
import type { ActionResult } from '@/types/api';
import { createServiceClient } from '@/lib/supabase/server';
import type { DocumentType } from '@/drizzle/schema/documents';

const DOCUMENTS_BUCKET = 'documents';

// Company info — in production these come from settings
const COMPANY_INFO = {
  name: process.env.COMPANY_NAME ?? 'Elev8 Comply',
  cqccLicense: process.env.COMPANY_CQCC_LICENSE ?? 'CQCC-XXXXX',
  address: process.env.COMPANY_ADDRESS ?? '',
  phone: process.env.COMPANY_PHONE ?? '',
  email: process.env.COMPANY_EMAIL ?? '',
};

/**
 * Saves a generated PDF to Supabase Storage and records it in the document vault.
 * Returns the storage path on success; logs and continues on failure (non-fatal).
 */
async function saveToVault({
  pdfBuffer,
  filename,
  accountId,
  propertyId,
  noticeId,
  jobId,
  documentType,
  generatedBy,
}: {
  pdfBuffer: Buffer;
  filename: string;
  accountId: string;
  propertyId?: string | null;
  noticeId?: string | null;
  jobId?: string | null;
  documentType: DocumentType;
  generatedBy?: string | null;
}): Promise<void> {
  try {
    const supabase = createServiceClient();
    const storageKey = `${accountId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${filename}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(storageKey, pdfBuffer, { contentType: 'application/pdf', upsert: false });

    if (uploadError || !uploadData) {
      console.error('[documents] Storage upload failed:', uploadError?.message);
      return;
    }

    await db.insert(documents).values({
      accountId,
      propertyId: propertyId ?? null,
      noticeId: noticeId ?? null,
      jobId: jobId ?? null,
      documentType,
      storageBucket: DOCUMENTS_BUCKET,
      storagePath: uploadData.path,
      fileName: filename,
      mimeType: 'application/pdf',
      fileSizeBytes: pdfBuffer.length,
      generatedBy: generatedBy ?? null,
    });
  } catch (err) {
    // Non-fatal — PDF is still returned to the user even if vault save fails
    console.error('[documents] Vault save error:', err);
  }
}

/**
 * Generates a signed download URL for a document in the vault.
 * Expires in 1 hour.
 */
export async function getDocumentDownloadUrl(
  documentId: string,
): Promise<ActionResult<{ url: string; fileName: string }>> {
  await requireUser();

  const doc = await db.query.documents.findFirst({
    where: (docs, { eq: eqFn }) => eqFn(docs.id, documentId),
  });
  if (!doc) return { success: false, error: 'Document not found' };

  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(doc.storageBucket)
    .createSignedUrl(doc.storagePath, 3600); // 1-hour expiry

  if (error || !data?.signedUrl) {
    return { success: false, error: 'Could not generate download link' };
  }

  return { success: true, data: { url: data.signedUrl, fileName: doc.fileName } };
}

/**
 * Fetches all documents in the vault for the current account,
 * optionally filtered by propertyId or noticeId.
 */
export async function getDocumentVault(filters?: {
  propertyId?: string;
  noticeId?: string;
  jobId?: string;
}): Promise<ActionResult<Array<{
  id: string;
  documentType: DocumentType;
  fileName: string;
  fileSizeBytes: number | null;
  createdAt: Date;
  propertyId: string | null;
  noticeId: string | null;
  jobId: string | null;
}>>> {
  const user = await requireUser();
  if (!user.accountId) return { success: false, error: 'No account associated with this user.' };

  const accountId = user.accountId;
  const rows = await db.query.documents.findMany({
    where: (docs, { eq: eqFn }) => eqFn(docs.accountId, accountId),
    orderBy: [desc(documents.createdAt)],
    limit: 200,
    columns: {
      id: true,
      documentType: true,
      fileName: true,
      fileSizeBytes: true,
      createdAt: true,
      propertyId: true,
      noticeId: true,
      jobId: true,
    },
  });

  const filtered = rows.filter((r) => {
    if (filters?.propertyId && r.propertyId !== filters.propertyId) return false;
    if (filters?.noticeId && r.noticeId !== filters.noticeId) return false;
    if (filters?.jobId && r.jobId !== filters.jobId) return false;
    return true;
  });

  return { success: true, data: filtered };
}

// ─── Form generators ──────────────────────────────────────────────────────────

/**
 * Generates an EU-632 from a notice + technician completion data.
 * Returns a base64-encoded PDF and saves to the document vault.
 */
export async function generateEU632(input: {
  noticeId: string;
  requirements: Array<{
    reqNumber: string;
    solution: string;
    cccmNumber: string;
  }>;
  cccmName: string;
  cccmLicenseExpiry: string;
  signerName: string;
  signerTitle: string;
  signerPhone: string;
  signerOfficeLocation: string;
}): Promise<ActionResult<{ pdfBase64: string; filename: string }>> {
  const user = await requireRole('admin', 'dispatcher');

  const notice = await db.query.notices.findFirst({
    where: eq(notices.id, input.noticeId),
  });
  if (!notice) return { success: false, error: 'Notice not found' };

  const parsed = notice.parsedData as unknown as ParsedNoticeData | null;

  const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

  const eu632Data: EU632Data = {
    propertyAddress: parsed?.propertyAddress ?? '',
    city: parsed?.propertyAddress?.split(',')[1]?.trim() ?? '',
    zip: parsed?.propertyAddress?.match(/\d{5}/)?.[0] ?? '',
    inspectionDate: parsed?.inspectionDate ?? '',
    stateId: parsed?.equipmentId ?? '',
    requirements: input.requirements,
    cccmName: input.cccmName,
    cccmLicenseExpiry: input.cccmLicenseExpiry,
    cccmSignatureDate: today,
    signerName: input.signerName,
    signerTitle: input.signerTitle,
    signerPhone: input.signerPhone,
    signerCompany: COMPANY_INFO.name,
    signerOfficeLocation: input.signerOfficeLocation || COMPANY_INFO.address,
    signerDate: today,
  };

  const { generateEU632PDF } = await import('@/server/services/formGenerator');
  const pdfBuffer = await generateEU632PDF(eu632Data);

  const filename = `EU632-${(parsed?.propertyName ?? 'property').replace(/\s+/g, '-')}-${Date.now()}.pdf`;

  // Save to document vault (non-blocking, non-fatal)
  await saveToVault({
    pdfBuffer,
    filename,
    accountId: notice.accountId,
    propertyId: notice.propertyId,
    noticeId: notice.id,
    documentType: 'eu632',
    generatedBy: user?.id ?? null,
  });

  return {
    success: true,
    data: {
      pdfBase64: pdfBuffer.toString('base64'),
      filename,
    },
  };
}

/**
 * Generates a 48-Hour Advance Notice Letter from a job/work order.
 * Returns a base64-encoded PDF and saves to the document vault.
 */
export async function generate48HourNotice(input: {
  workOrderId?: string;
  noticeId?: string;
  recipientName: string;
  recipientCompany: string;
  recipientAddress: string;
  mechanicName: string;
  mechanicLicenseNumber: string;
  contactName: string;
  contactPhone: string;
}): Promise<ActionResult<{ pdfBase64: string; filename: string }>> {
  const user = await requireRole('admin', 'dispatcher');

  if (!input.workOrderId && !input.noticeId) {
    return { success: false, error: 'Either a work order ID or notice ID is required.' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let wo: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let job: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let account: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let property: any = null;
  let parsed: ParsedNoticeData | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let packet: any = null;
  let resolvedNoticeId: string | null = null;

  if (input.workOrderId) {
    const woResult = await db
      .select({ wo: workOrders, job: jobs, account: accounts, property: properties })
      .from(workOrders)
      .leftJoin(jobs, eq(workOrders.jobId, jobs.id))
      .leftJoin(accounts, eq(jobs.accountId, accounts.id))
      .leftJoin(properties, eq(jobs.propertyId, properties.id))
      .where(eq(workOrders.id, input.workOrderId))
      .limit(1);

    if (!woResult[0]) return { success: false, error: 'Work order not found.' };
    wo       = woResult[0].wo;
    job      = woResult[0].job;
    account  = woResult[0].account;
    property = woResult[0].property;

    const linkedNotice = job?.noticeId
      ? await db.query.notices.findFirst({ where: eq(notices.id, job.noticeId) })
      : null;
    parsed = linkedNotice?.parsedData as unknown as ParsedNoticeData | null;
    resolvedNoticeId = linkedNotice?.id ?? null;
    packet = wo.dispatchPacket ? JSON.parse(wo.dispatchPacket as string) : null;
  } else {
    const noticeResult = await db
      .select({ notice: notices, account: accounts, property: properties })
      .from(notices)
      .leftJoin(accounts, eq(notices.accountId, accounts.id))
      .leftJoin(properties, eq(notices.propertyId, properties.id))
      .where(eq(notices.id, input.noticeId!))
      .limit(1);

    if (!noticeResult[0]) return { success: false, error: 'Notice not found.' };
    account  = noticeResult[0].account;
    property = noticeResult[0].property;
    parsed   = noticeResult[0].notice?.parsedData as unknown as ParsedNoticeData | null;
    resolvedNoticeId = input.noticeId ?? null;
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const noticeData: AdvanceNoticeData = {
    date: today,
    recipientName: input.recipientName,
    recipientCompany: input.recipientCompany,
    recipientAddress: input.recipientAddress,
    propertyName: property?.name ?? account?.name ?? parsed?.propertyName ?? 'Property',
    propertyAddress: property?.address
      ? `${property.address}, ${property.city}, ${property.state}`
      : parsed?.propertyAddress ?? '',
    stateId: parsed?.equipmentId ?? packet?.stateId ?? '',
    elevatorDescription: `${parsed?.elevatorType ?? 'Elevator'} — ${parsed?.equipmentId ?? ''}`.trim(),
    scheduledWorkDate: wo?.scheduledStart
      ? new Date(wo.scheduledStart).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : '',
    scheduledWorkTime: wo?.scheduledStart
      ? new Date(wo.scheduledStart).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : '',
    natureOfWork: parsed?.requiredWorkSummary ?? job?.title ?? '',
    cqccName: COMPANY_INFO.name,
    cqccLicenseNumber: COMPANY_INFO.cqccLicense,
    mechanicName: input.mechanicName,
    mechanicLicenseNumber: input.mechanicLicenseNumber,
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    noticeHours: 48,
  };

  const { generate48HourNoticePDF } = await import('@/server/services/formGenerator');
  const pdfBuffer = await generate48HourNoticePDF(noticeData);

  const filename = `48hr-Notice-${(noticeData.propertyName).replace(/\s+/g, '-')}-${Date.now()}.pdf`;

  // Save to document vault
  await saveToVault({
    pdfBuffer,
    filename,
    accountId: account?.id ?? '',
    propertyId: property?.id ?? null,
    noticeId: resolvedNoticeId,
    jobId: job?.id ?? null,
    documentType: 'advance_notice_48hr',
    generatedBy: user?.id ?? null,
  });

  return {
    success: true,
    data: {
      pdfBase64: pdfBuffer.toString('base64'),
      filename,
    },
  };
}

/**
 * Generates EU-787 Test Notification Form.
 * Returns a base64-encoded PDF and saves to the document vault.
 */
export async function generateEU787(input: {
  noticeId: string;
  testType: 'Annual' | '5-Year' | 'Both';
  testDate: string;
  testTime: string;
  mechanicName: string;
  mechanicLicenseNumber: string;
  mechanicLicenseExpiry: string;
  districtOffice: string;
  isRescheduled?: boolean;
}): Promise<ActionResult<{ pdfBase64: string; filename: string }>> {
  const user = await requireRole('admin', 'dispatcher');

  const notice = await db.query.notices.findFirst({
    where: eq(notices.id, input.noticeId),
  });
  if (!notice) return { success: false, error: 'Notice not found' };

  const account = await db.query.accounts.findFirst({
    where: eq(accounts.id, notice.accountId),
  });

  const prop = notice.propertyId
    ? await db.query.properties.findFirst({ where: eq(properties.id, notice.propertyId) })
    : null;

  const parsed = notice.parsedData as unknown as ParsedNoticeData | null;

  const eu787Data: EU787Data = {
    stateId: parsed?.equipmentId ?? parsed?.serialNumber ?? '',
    propertyAddress: prop?.address ?? parsed?.propertyAddress ?? '',
    city: prop?.city ?? '',
    zip: prop?.zip ?? '',
    unitCount: parsed?.unitsAffected ?? 1,
    group: 'IV',
    driveType: parsed?.elevatorType ?? parsed?.requiredSkillTag ?? '',
    testType: input.testType,
    testDate: input.testDate,
    testTime: input.testTime,
    mechanicName: input.mechanicName,
    mechanicLicenseNumber: input.mechanicLicenseNumber,
    mechanicLicenseExpiry: input.mechanicLicenseExpiry,
    isRescheduled: input.isRescheduled ?? false,
    districtOffice: input.districtOffice,
  };

  const { generateEU787PDF } = await import('@/server/services/formGenerator');
  const pdfBuffer = await generateEU787PDF(eu787Data);

  const filename = `EU787-${(parsed?.propertyName ?? 'property').replace(/\s+/g, '-')}-${Date.now()}.pdf`;

  // Save to document vault
  await saveToVault({
    pdfBuffer,
    filename,
    accountId: notice.accountId,
    propertyId: notice.propertyId,
    noticeId: notice.id,
    documentType: 'eu787',
    generatedBy: user?.id ?? null,
  });

  return {
    success: true,
    data: {
      pdfBase64: pdfBuffer.toString('base64'),
      filename,
    },
  };
}
