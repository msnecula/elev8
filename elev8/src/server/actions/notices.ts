'use server';

import { requireUser, requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import {
  notices,
  jobs,
  properties,
  proposals,
  accounts,
  contacts,
  users,
} from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
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
import { STORAGE_BUCKET_NOTICES, PROPOSAL_EXPIRY_DAYS } from '@/lib/constants';
import type { ParsedNoticeData } from '../../../drizzle/schema/notices';
import { generateProposalWithAI } from '@/server/services/proposalGenerator';
import { sendProposalDraftReadyEmail } from '@/server/services/notificationService';
import { addDays } from 'date-fns';

// ─── Register notice ──────────────────────────────────────────────────────────

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

// ─── Trigger parsing (authenticated — from UI) ────────────────────────────────

export async function triggerNoticeParsing(
  noticeId: string,
): Promise<ActionResult<{ jobId?: string }>> {
  const user = await requireUser();
  try {
    const jobId = await _parseNotice(noticeId, user.id);
    return { success: true, data: { jobId } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Parsing failed' };
  }
}

// ─── Background parsing (no auth — called from webhook after() callback) ──────

export async function parseNoticeBackground(noticeId: string): Promise<void> {
  try {
    await _parseNotice(noticeId, null);
  } catch (err) {
    console.error('[notices] Background parse failed:', noticeId, err);
  }
}

// ─── Core parse logic (shared by both callers) ────────────────────────────────

async function _parseNotice(noticeId: string, actorId: string | null): Promise<string | undefined> {
  const notice = await db.query.notices.findFirst({ where: eq(notices.id, noticeId) });
  if (!notice) throw new Error('Notice not found');

  // Accept email notices (rawText only) or file notices (filePath) — must have one
  if (!notice.filePath && !notice.rawText) {
    throw new Error('No file or text content attached to this notice');
  }

  await db.update(notices)
    .set({ status: 'parsing', updatedAt: new Date() })
    .where(eq(notices.id, noticeId));
  await logNoticeActivity(noticeId, 'notice_parsing_started', 'AI parsing started', actorId);

  try {
    // ── Get text content ──────────────────────────────────────────────────────
    let text = notice.rawText ?? '';

    if (!text && notice.filePath) {
      // Download the PDF and extract text
      const supabase = createServiceClient();
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(STORAGE_BUCKET_NOTICES)
        .download(notice.filePath);

      if (downloadError || !fileData) {
        throw new Error(`Could not download PDF: ${downloadError?.message}`);
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { text: extractedText, error: extractError } = await extractPdfText(
        buffer,
        notice.mimeType ?? 'application/pdf',
      );
      if (extractError || !extractedText) {
        throw new Error(extractError ?? 'PDF text extraction returned empty result');
      }

      text = extractedText;
      await db.update(notices).set({ rawText: text }).where(eq(notices.id, noticeId));
    }

    // ── AI parse ──────────────────────────────────────────────────────────────
    const { data: parsedData, error: parseError } = await parseNoticeWithAI(text);
    if (parseError || !parsedData) {
      throw new Error(parseError ?? 'AI parsing returned no data');
    }

    const reviewerId = await assignReviewer(parsedData.urgency, parsedData.buildingType);

    let stateDeadline: Date | null = null;
    if (parsedData.complianceDeadline) {
      const d = new Date(parsedData.complianceDeadline);
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

    // ── Create job ────────────────────────────────────────────────────────────
    const jobId = await createJobFromNotice(noticeId, notice.accountId, parsedData, reviewerId, actorId);

    // ── Auto-generate AI proposal draft (non-fatal) ───────────────────────────
    await autoGenerateProposalDraft(jobId, notice.accountId, reviewerId, parsedData);

    revalidatePath('/notices');
    revalidatePath(`/notices/${noticeId}`);
    revalidatePath('/jobs');

    return jobId;
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
      actorId,
    );

    throw err; // re-throw so callers know it failed
  }
}

// ─── Auto-generate AI proposal draft ─────────────────────────────────────────

async function autoGenerateProposalDraft(
  jobId: string,
  accountId: string,
  reviewerId: string | null,
  parsedData: ParsedNoticeData,
): Promise<void> {
  try {
    // Fetch job + account + property for AI context
    const jobResult = await db
      .select({ job: jobs, account: accounts, property: properties })
      .from(jobs)
      .leftJoin(accounts, eq(jobs.accountId, accounts.id))
      .leftJoin(properties, eq(jobs.propertyId, properties.id))
      .where(eq(jobs.id, jobId))
      .limit(1);

    if (!jobResult[0]) throw new Error('Job not found for proposal generation');
    const { job, account, property } = jobResult[0];

    // Primary contact for client name in proposal body
    const contact = await db.query.contacts.findFirst({
      where: and(eq(contacts.accountId, accountId), eq(contacts.isPrimary, true)),
      columns: { fullName: true },
    });

    // Generate proposal with AI
    const { data, error } = await generateProposalWithAI({
      clientName: contact?.fullName ?? account?.name ?? 'Valued Client',
      propertyName: property?.name ?? (parsedData.propertyName as string | undefined) ?? 'Your Property',
      propertyAddress: property?.address ?? (parsedData.propertyAddress as string | undefined) ?? '',
      buildingType: job.buildingType ?? (parsedData.buildingType as string | undefined) ?? 'commercial',
      requiredWorkSummary: (parsedData.requiredWorkSummary as string | undefined) ?? job.title ?? '',
      detailedScope: (parsedData.detailedScope as string | undefined) ?? '',
      violationItems: (parsedData.violationItems as string[]) ?? [],
      workType: (parsedData.workType as string | undefined) ?? job.requiredSkillTag ?? '',
      requiredSkillTag: job.requiredSkillTag ?? '',
      estimatedDurationHours: job.estimatedDurationHours ? Number(job.estimatedDurationHours) : null,
      estimatedLaborHours: job.estimatedLaborHours ? Number(job.estimatedLaborHours) : null,
      estimatedMaterials: job.estimatedMaterialsCost ? Number(job.estimatedMaterialsCost) : null,
      fortyEightHourRequired: job.fortyEightHourRequired ?? false,
      complianceCoordinationRequired: job.complianceCoordinationRequired ?? false,
    });

    if (error || !data) throw new Error(error ?? 'AI proposal generation returned no data');

    // Insert the draft proposal
    const [proposal] = await db
      .insert(proposals)
      .values({
        jobId,
        templateId: null,
        draftedBy: reviewerId,
        status: 'draft',
        title: data.title,
        body: data.body,
        lineItems: data.lineItems,
        totalAmount: data.totalAmount.toString(),
        version: 1,
        expiresAt: addDays(new Date(), PROPOSAL_EXPIRY_DAYS),
      })
      .returning({ id: proposals.id });

    // Advance job stage to proposal_drafted
    await db.update(jobs)
      .set({ stage: 'proposal_drafted', updatedAt: new Date() })
      .where(eq(jobs.id, jobId));

    await logJobActivity(
      jobId,
      'proposal_drafted',
      `AI proposal draft created: "${data.title}"`,
      null,
    );

    // ── Notify reviewer (or fallback to any admin) ─────────────────────────
    let notifyEmail: string | null = null;
    let notifyName = 'Team';

    if (reviewerId) {
      const reviewer = await db.query.users.findFirst({
        where: eq(users.id, reviewerId),
        columns: { email: true, fullName: true },
      });
      if (reviewer) {
        notifyEmail = reviewer.email;
        notifyName = reviewer.fullName ?? 'Reviewer';
      }
    }

    // Fall back to first admin in the system
    if (!notifyEmail) {
      const admin = await db.query.users.findFirst({
        where: eq(users.role, 'admin'),
        columns: { email: true, fullName: true },
      });
      if (admin) {
        notifyEmail = admin.email;
        notifyName = admin.fullName ?? 'Admin';
      }
    }

    if (notifyEmail) {
      await sendProposalDraftReadyEmail({
        to: notifyEmail,
        reviewerName: notifyName,
        propertyName: property?.name ?? (parsedData.propertyName as string | undefined) ?? 'Unknown Property',
        accountName: account?.name ?? 'Unknown Account',
        urgency: parsedData.urgency ?? 'standard',
        estimatedTotal: data.totalAmount,
        proposalId: proposal.id,
        jobId,
      });
    }
  } catch (err) {
    // Non-fatal — job was already created, only proposal draft generation failed
    console.error('[notices] autoGenerateProposalDraft failed for job', jobId, ':', err);
  }
}

// ─── Create job from notice (private) ────────────────────────────────────────

async function createJobFromNotice(
  noticeId: string,
  accountId: string,
  parsedData: ParsedNoticeData,
  reviewerId: string | null,
  actorId: string | null,
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

// ─── Update notice ────────────────────────────────────────────────────────────

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

// ─── Mark notice reviewed ─────────────────────────────────────────────────────

export async function markNoticeReviewed(noticeId: string): Promise<ActionResult<void>> {
  const user = await requireRole('admin', 'reviewer');
  await db.update(notices).set({ status: 'reviewed', updatedAt: new Date() }).where(eq(notices.id, noticeId));
  await logNoticeActivity(noticeId, 'note_added', 'Notice marked as reviewed', user.id);
  revalidatePath(`/notices/${noticeId}`);
  revalidatePath('/notices');
  return { success: true, data: undefined };
}
