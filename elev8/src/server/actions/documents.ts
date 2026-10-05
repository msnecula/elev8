'use server';

import { requireRole, requireUser } from '@/lib/auth';
import { db } from '@/server/db/client';
import { notices, jobs, workOrders, technicians, users, accounts, properties } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import type { EU632Data, AdvanceNoticeData, EU787Data } from '@/server/services/formGenerator';
import type { ParsedNoticeData } from '@/server/services/noticeParser';
import { formatDate } from '@/lib/utils';
import type { ActionResult } from '@/types/api';

// Company info — in production these come from settings
const COMPANY_INFO = {
  name: process.env.COMPANY_NAME ?? 'Elev8 Comply',
  cqccLicense: process.env.COMPANY_CQCC_LICENSE ?? 'CQCC-XXXXX',
  address: process.env.COMPANY_ADDRESS ?? '',
  phone: process.env.COMPANY_PHONE ?? '',
  email: process.env.COMPANY_EMAIL ?? '',
};

/**
 * Generates an EU-632 from a notice + technician completion data.
 * Returns a base64-encoded PDF.
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
  await requireRole('admin', 'dispatcher');

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
 */
export async function generate48HourNotice(input: {
  workOrderId: string;
  recipientName: string;
  recipientCompany: string;
  recipientAddress: string;
  mechanicName: string;
  mechanicLicenseNumber: string;
  contactName: string;
  contactPhone: string;
}): Promise<ActionResult<{ pdfBase64: string; filename: string }>> {
  await requireRole('admin', 'dispatcher');

  const woResult = await db
    .select({
      wo: workOrders,
      job: jobs,
      account: accounts,
      property: properties,
    })
    .from(workOrders)
    .leftJoin(jobs, eq(workOrders.jobId, jobs.id))
    .leftJoin(accounts, eq(jobs.accountId, accounts.id))
    .leftJoin(properties, eq(jobs.propertyId, properties.id))
    .where(eq(workOrders.id, input.workOrderId))
    .limit(1);

  if (!woResult[0]) return { success: false, error: 'Work order not found' };
  const { wo, job, account, property } = woResult[0];

  const notice = job?.noticeId
    ? await db.query.notices.findFirst({ where: eq(notices.id, job.noticeId) })
    : null;
  const parsed = notice?.parsedData as unknown as ParsedNoticeData | null;

  const packet = wo.dispatchPacket ? JSON.parse(wo.dispatchPacket as string) : null;

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
    scheduledWorkDate: wo.scheduledStart
      ? new Date(wo.scheduledStart).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : '',
    scheduledWorkTime: wo.scheduledStart
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
  await requireRole('admin', 'dispatcher');

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
    group: 'IV', // Default — dispatcher can adjust
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

  return {
    success: true,
    data: {
      pdfBase64: pdfBuffer.toString('base64'),
      filename,
    },
  };
}
