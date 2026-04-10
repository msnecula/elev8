'use server';

import { requireUser, requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import {
  notices,
  jobs,
  properties,
} from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { noticeUploadSchema, updateNoticeSchema } from '@/lib/validations/notice';
import { parseNoticeWithAI } from '@/server/services/noticeParser';
import { extractPdfText } from '@/server/services/pdfExtractor';
import { assignReviewer } from '@/server/services/jobRouter';
import { logNoticeActivity, logJobActivity } from '@/server/services/activityLogger';
import { createServiceClient } from '@/lib/supabase/server';
import { generateJobTitle } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/types/api';
import { STORAGE_BUCKET_NOTICES } from '@/lib/constants';
import type { ParsedNoticeData } from '../../../drizzle/schema/notices';

export async function registerNotice(
  input: z.infer<typeof noticeUploadSchema>,
): Promise<ActionResult<{ noticeId: string }>> {
  const user = await requireUser();

  if (user.role === 'client' && input.accountId !== user.accountId) {
    return { success: false, error: 'You can only submit notices for your own account.' };
  }

  const parsed = noticeUploadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Invalid input',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { accountId, propertyId, fileName, fileSize, mimeType, filePath } = parsed.data;

  const [notice] = await db
    .insert(notices)
    .values({
      accountId,
      propertyId: propertyId ?? null,
      submittedBy: user.id,
      intakeMethod: user.role === 'client' ? 'portal_upload' : 'manual',
      status: 'received',
      filePath,
      fileName,
      fileSize,
      mimeType,
    })
    .returning({ id: notices.id });

  await logNoticeActivity(
    notice.id,
    'notice_received',
    `Notice uploaded: ${fileName}`,
    user.id,
    { fileName, accountId },
  );

  revalidatePath('/notices');
  return { success: true, data: { noticeId: notice.id } };
}

export async function triggerNoticeParsing(
  noticeId: string,
): Promise<ActionResult<{ jobId?: string }>> {
  const user = await requireUser();

  const notice = await db.query.notices.findFirst({
    where: eq(notices.id, noticeId),
  });

  if (!notice) return { success: false, error: 'Notice not found' };
  if (!notice.filePath) return { success: false, error: 'No file attached to this notice' };

  await db.update(notices).set({ status: 'parsing', updatedAt: new Date() }).where(eq(notices.id, noticeId));
  await logNoticeActivity(noticeId, 'notice_parsing_started', 'AI parsing started', user.id);

  try {
    const supabase = createServiceClient();
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(STORAGE_BUCKET_NOTICES)
      .download(notice.filePath);

    if (downloadError || !fileData) {
      throw new Error(`Could not download PDF: ${downloadError?.message}`);
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { text, error: extractError } = await extractPdfText(buffer);
    if (extractError || !text) {
      throw new Error(extractError ?? 'PDF text extraction returned empty result');
    }

    await db.update(notices).set({ rawText: text }).where(eq(notices.id, noticeId));

    const { data: parsedData, error: parseError } = await parseNoticeWithAI(text);
    if (parseError || !parsedData) {
      throw new Error(parseError ?? 'AI parsing returned no data');
    }

    const reviewerId = await assignReviewer(parsedData.urgency, parsedData.buildingType);

    let stateDeadline: Date | null = null;
    if (parsedData.stateDeadline) {
      const d = new Date(parsedData.stateDeadline);
      if (!isNaN(d.getTime())) stateDeadline = d;
    }

    await db.update(notices).set({
      status: 'parsed',
      parsedData,
      urgency: parsedData.urgency,
      assignedReviewerId: reviewerId,
      stateDeadline,
      parseError: null,
      updatedAt: new Date(),
    }).where(eq(notices.id, noticeId));

    await logNoticeActivity(
      noticeId,
      'notice_parsed',
      `AI parsing complete. Confidence: ${Math.round(parsedData.parseConfidence * 100)}%`,
      null,
      { confidence: parsedData.parseConfidence, urgency: parsedData.urgency },
    );

    const jobId = await createJobFromNotice(noticeId, notice.accountId, parsedData, reviewerId, user.id);

    revalidatePath('/notices');
    revalidatePath(`/notices/${noticeId}`);
    revalidatePath('/jobs');

    return { success: true, data: { jobId } };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error during parsing';

    await db.update(notices).set({
      status: 'parse_failed',
      parseError: errorMessage,
      updatedAt: new Date(),
    }).where(eq(notices.id, noticeId));

    await logNoticeActivity(
      noticeId,
      'notice_parse_failed',
      `Parsing failed: ${errorMessage}`,
      user.id,
    );

    return { success: false, error: errorMessage };
  }
}

async function createJobFromNotice(
  noticeId: string,
  accountId: string,
  parsedData: ParsedNoticeData,
  reviewerId: string | null,
  actorId: string,
): Promise<string> {
  let propertyId: string | null = null;
  if (parsedData.propertyAddress) {
    const prop = await db.query.properties.findFirst({
      where: eq(properties.accountId, accountId),
      columns: { id: true },
    });
    if (prop) propertyId = prop.id;
  }

  const title = generateJobTitle(
    parsedData.propertyName || parsedData.propertyAddress || 'Unknown Property',
    parsedData.workType || 'Elevator Repair',
  );

  let nextActionDate: string | null = null;
  if (parsedData.stateDeadline) {
    const deadline = new Date(parsedData.stateDeadline);
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const twoDaysBeforeDeadline = new Date(deadline.getTime() - 2 * 24 * 60 * 60 * 1000);
    const actionDate = twoDaysBeforeDeadline < sevenDaysFromNow ? twoDaysBeforeDeadline : sevenDaysFromNow;
    nextActionDate = actionDate.toISOString().split('T')[0];
  }

  const riskFlags: string[] = [];
  if (parsedData.missingInformation.length > 0) riskFlags.push('missing_info');
  if (parsedData.parseConfidence < 0.6) riskFlags.push('low_parse_confidence');
  if (parsedData.urgency === 'critical') riskFlags.push('critical_urgency');

  const validBuildingTypes = ['residential', 'commercial', 'mixed_use'] as const;
  const buildingType = validBuildingTypes.includes(parsedData.buildingType as typeof validBuildingTypes[number])
    ? (parsedData.buildingType as typeof validBuildingTypes[number])
    : null;

  const [job] = await db
    .insert(jobs)
    .values({
      noticeId,
      accountId,
      propertyId,
      assignedReviewerId: reviewerId,
      stage: 'notice_received',
      urgency: parsedData.urgency,
      title,
      nextActionDate,
      riskFlags,
      buildingType,
      requiredSkillTag: parsedData.requiredSkillTag,
      estimatedDurationHours: parsedData.estimatedDurationHours?.toString() ?? null,
      estimatedLaborHours: parsedData.estimatedLaborHours?.toString() ?? null,
      estimatedMaterialsCost: parsedData.estimatedMaterials?.toString() ?? null,
      complianceCoordinationRequired: parsedData.complianceCoordinationRequired,
      fortyEightHourRequired: parsedData.fortyEightHourRequired,
    })
    .returning({ id: jobs.id });

  await logJobActivity(job.id, 'job_created', `Job created from notice: ${title}`, actorId, { noticeId });
  if (reviewerId) {
    await logJobActivity(job.id, 'reviewer_assigned', 'Reviewer assigned automatically', null);
  }

  return job.id;
}

export async function updateNotice(
  input: z.infer<typeof updateNoticeSchema>,
): Promise<ActionResult<void>> {
  const user = await requireRole('admin', 'reviewer', 'dispatcher');

  const parsed = updateNoticeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { id, ...updates } = parsed.data;
  await db.update(notices).set({ ...updates, updatedAt: new Date() }).where(eq(notices.id, id));
  await logNoticeActivity(id, 'note_added', 'Notice details updated', user.id);
  revalidatePath(`/notices/${id}`);
  return { success: true, data: undefined };
}

export async function markNoticeReviewed(noticeId: string): Promise<ActionResult<void>> {
  const user = await requireRole('admin', 'reviewer');
  await db.update(notices).set({ status: 'reviewed', updatedAt: new Date() }).where(eq(notices.id, noticeId));
  await logNoticeActivity(noticeId, 'note_added', 'Notice marked as reviewed', user.id);
  revalidatePath(`/notices/${noticeId}`);
  revalidatePath('/notices');
  return { success: true, data: undefined };
}
