'use server';

import { requireUser, requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import {
  proposals, jobs, notices, properties, accounts,
  contacts, proposalTemplates,
} from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import {
  createProposalSchema,
  updateProposalSchema,
  approveProposalSchema,
  rejectProposalSchema,
  requestRevisionSchema,
} from '@/lib/validations/proposal';
import { z } from 'zod';
import { generateProposalWithAI } from '@/server/services/proposalGenerator';
import { logJobActivity } from '@/server/services/activityLogger';
import { sendEmail, buildSimpleEmail, sendProposalEmail, sendApprovalConfirmEmail } from '@/server/services/notificationService';
import { revalidatePath } from 'next/cache';
import { formatCurrency } from '@/lib/utils';
import { APP_URL } from '@/lib/constants';
import type { ActionResult } from '@/types/api';
import { addDays } from 'date-fns';
import { PROPOSAL_EXPIRY_DAYS } from '@/lib/constants';

// ─── Generate AI proposal draft ───────────────────────────────────────────────

export async function generateAIProposal(
  jobId: string,
  templateId?: string,
): Promise<ActionResult<{ title: string; body: string; lineItems: unknown[]; totalAmount: number }>> {
  await requireRole('admin', 'reviewer');

  // Fetch everything needed for the AI prompt
  const jobResult = await db
    .select({
      job: jobs,
      account: accounts,
      property: properties,
      notice: notices,
    })
    .from(jobs)
    .leftJoin(accounts, eq(jobs.accountId, accounts.id))
    .leftJoin(properties, eq(jobs.propertyId, properties.id))
    .leftJoin(notices, eq(jobs.noticeId, notices.id))
    .where(eq(jobs.id, jobId))
    .limit(1);

  if (!jobResult[0]) return { success: false, error: 'Job not found' };
  const { job, account, property, notice } = jobResult[0];

  // Get primary contact name
  const contact = await db.query.contacts.findFirst({
    where: and(eq(contacts.accountId, job.accountId), eq(contacts.isPrimary, true)),
    columns: { fullName: true },
  });

  // Get template body if specified
  let templateBody: string | undefined;
  if (templateId) {
    const tmpl = await db.query.proposalTemplates.findFirst({
      where: eq(proposalTemplates.id, templateId),
      columns: { bodyTemplate: true },
    });
    templateBody = tmpl?.bodyTemplate;
  }

  const parsed = notice?.parsedData as Record<string, unknown> | null;

  const { data, error } = await generateProposalWithAI({
    clientName: contact?.fullName ?? account?.name ?? 'Valued Client',
    propertyName: property?.name ?? parsed?.propertyName as string ?? 'Your Property',
    propertyAddress: property?.address ?? parsed?.propertyAddress as string ?? '',
    buildingType: job.buildingType ?? parsed?.buildingType as string ?? 'commercial',
    requiredWorkSummary: parsed?.requiredWorkSummary as string ?? job.title ?? '',
    detailedScope: parsed?.detailedScope as string ?? '',
    violationItems: (parsed?.violationItems as string[]) ?? [],
    workType: parsed?.workType as string ?? job.requiredSkillTag ?? '',
    requiredSkillTag: job.requiredSkillTag ?? '',
    estimatedDurationHours: job.estimatedDurationHours ? Number(job.estimatedDurationHours) : null,
    estimatedLaborHours: job.estimatedLaborHours ? Number(job.estimatedLaborHours) : null,
    estimatedMaterials: job.estimatedMaterialsCost ? Number(job.estimatedMaterialsCost) : null,
    fortyEightHourRequired: job.fortyEightHourRequired ?? false,
    complianceCoordinationRequired: job.complianceCoordinationRequired ?? false,
    templateBody,
  });

  if (error || !data) return { success: false, error: error ?? 'Generation failed' };
  return { success: true, data };
}

// ─── Create proposal ──────────────────────────────────────────────────────────

export async function createProposal(
  input: z.infer<typeof createProposalSchema>,
): Promise<ActionResult<{ proposalId: string }>> {
  const user = await requireRole('admin', 'reviewer');

  const parsed = createProposalSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input', fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const { jobId, templateId, title, body, lineItems, totalAmount } = parsed.data;

  const [proposal] = await db
    .insert(proposals)
    .values({
      jobId,
      templateId: templateId ?? null,
      draftedBy: user.id,
      status: 'draft',
      title,
      body,
      lineItems,
      totalAmount: totalAmount.toString(),
      version: 1,
      expiresAt: addDays(new Date(), PROPOSAL_EXPIRY_DAYS),
    })
    .returning({ id: proposals.id });

  // Advance job to proposal_drafted stage
  await db.update(jobs)
    .set({ stage: 'proposal_drafted', updatedAt: new Date() })
    .where(eq(jobs.id, jobId));

  await logJobActivity(jobId, 'proposal_drafted', `Proposal drafted: "${title}"`, user.id);

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath('/jobs');
  return { success: true, data: { proposalId: proposal.id } };
}

// ─── Update proposal ──────────────────────────────────────────────────────────

export async function updateProposal(
  input: z.infer<typeof updateProposalSchema>,
): Promise<ActionResult<void>> {
  await requireRole('admin', 'reviewer');

  const parsed = updateProposalSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const { id, ...updates } = parsed.data;

  // Recalculate total from line items if provided
  if (updates.lineItems) {
    const items = updates.lineItems as Array<{ quantity: number; unitPrice: number }>;
    updates.totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  }

  await db.update(proposals).set({ ...updates, updatedAt: new Date() }).where(eq(proposals.id, id));

  revalidatePath(`/proposals/${id}`);
  return { success: true, data: undefined };
}

// ─── Send proposal to client ──────────────────────────────────────────────────

export async function sendProposal(proposalId: string): Promise<ActionResult<void>> {
  const user = await requireRole('admin', 'reviewer');

  const proposal = await db.query.proposals.findFirst({
    where: eq(proposals.id, proposalId),
  });
  if (!proposal) return { success: false, error: 'Proposal not found' };
  if (proposal.status !== 'draft' && proposal.status !== 'revision_requested') {
    return { success: false, error: 'Only draft or revision-requested proposals can be sent' };
  }

  // Get job + account + contact email
  const jobResult = await db
    .select({ job: jobs, account: accounts })
    .from(jobs)
    .leftJoin(accounts, eq(jobs.accountId, accounts.id))
    .where(eq(jobs.id, proposal.jobId))
    .limit(1);

  if (!jobResult[0]) return { success: false, error: 'Job not found' };
  const { job, account } = jobResult[0];

  const contact = await db.query.contacts.findFirst({
    where: and(eq(contacts.accountId, job.accountId), eq(contacts.isPrimary, true)),
    columns: { email: true, fullName: true },
  });

  const clientEmail = contact?.email ?? account?.email;
  if (!clientEmail) return { success: false, error: 'No client email found for this account' };

  // Mark as sent
  await db.update(proposals).set({
    status: 'sent',
    sentAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(proposals.id, proposalId));

  await db.update(jobs).set({ stage: 'proposal_sent', updatedAt: new Date() }).where(eq(jobs.id, proposal.jobId));

  // Send email using typed template
  const contactName = contact?.fullName ?? account?.name ?? 'Valued Client';
  const propertyName = property ? `${property.name}, ${property.city}` : account?.name ?? '';

  await sendProposalEmail({
    to: clientEmail,
    clientName: contactName,
    jobTitle: proposal.title,
    propertyName,
    proposalBody: proposal.body,
    totalAmount: Number(proposal.totalAmount ?? 0),
    proposalId,
    expiresAt: proposal.expiresAt,
    version: proposal.version ?? 1,
    jobId: proposal.jobId,
  });

  await logJobActivity(proposal.jobId, 'proposal_sent', `Proposal sent to ${clientEmail}`, user.id);

  revalidatePath(`/proposals/${proposalId}`);
  revalidatePath(`/jobs/${proposal.jobId}`);
  return { success: true, data: undefined };
}

// ─── Approve proposal (client action) ────────────────────────────────────────

export async function approveProposal(
  input: z.infer<typeof approveProposalSchema>,
): Promise<ActionResult<void>> {
  const user = await requireUser();

  const parsed = approveProposalSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const proposal = await db.query.proposals.findFirst({
    where: eq(proposals.id, parsed.data.proposalId),
  });
  if (!proposal) return { success: false, error: 'Proposal not found' };

  // Business rule: can only approve a sent proposal
  if (proposal.status !== 'sent') {
    return { success: false, error: 'Only sent proposals can be approved' };
  }

  // Business rule: clients can only approve proposals for their own account
  if (user.role === 'client') {
    const job = await db.query.jobs.findFirst({
      where: eq(jobs.id, proposal.jobId),
      columns: { accountId: true },
    });
    if (job?.accountId !== user.accountId) {
      return { success: false, error: 'You can only approve proposals for your account' };
    }
  }

  await db.update(proposals).set({
    status: 'approved',
    approvedBy: user.id,
    approvedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(proposals.id, proposal.id));

  await db.update(jobs).set({ stage: 'approved', updatedAt: new Date() }).where(eq(jobs.id, proposal.jobId));

  await logJobActivity(proposal.jobId, 'proposal_approved', 'Proposal approved by client', user.id);

  // Send confirmation email to client
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, proposal.jobId), columns: { accountId: true, title: true } });
  const contact = job ? await db.query.contacts.findFirst({
    where: and(eq(contacts.accountId, job.accountId), eq(contacts.isPrimary, true)),
    columns: { email: true },
  }) : null;

  if (contact?.email) {
    await sendEmail({
      to: contact.email,
      subject: `Proposal Approved — ${proposal.title}`,
      html: buildSimpleEmail(
        'Your proposal has been approved',
        `Thank you for approving the proposal for "${job?.title ?? proposal.title}".\n\nOur team will be in touch shortly to schedule the work.\n\nIf you have any questions, please contact us.`,
      ),
      jobId: proposal.jobId,
    });
  }

  revalidatePath(`/proposals/${proposal.id}`);
  revalidatePath(`/jobs/${proposal.jobId}`);
  revalidatePath(`/client/proposals/${proposal.id}`);
  revalidatePath('/client/jobs');
  return { success: true, data: undefined };
}

// ─── Reject proposal (client action) ─────────────────────────────────────────

export async function rejectProposal(
  input: z.infer<typeof rejectProposalSchema>,
): Promise<ActionResult<void>> {
  const user = await requireUser();

  const parsed = rejectProposalSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const proposal = await db.query.proposals.findFirst({
    where: eq(proposals.id, parsed.data.proposalId),
  });
  if (!proposal) return { success: false, error: 'Proposal not found' };
  if (proposal.status !== 'sent') return { success: false, error: 'Only sent proposals can be rejected' };

  if (user.role === 'client') {
    const job = await db.query.jobs.findFirst({ where: eq(jobs.id, proposal.jobId), columns: { accountId: true } });
    if (job?.accountId !== user.accountId) return { success: false, error: 'Access denied' };
  }

  await db.update(proposals).set({
    status: 'rejected',
    rejectedAt: new Date(),
    revisionNotes: parsed.data.reason ?? null,
    updatedAt: new Date(),
  }).where(eq(proposals.id, proposal.id));

  await logJobActivity(proposal.jobId, 'proposal_rejected',
    `Proposal rejected${parsed.data.reason ? `: ${parsed.data.reason}` : ''}`, user.id);

  revalidatePath(`/proposals/${proposal.id}`);
  revalidatePath(`/jobs/${proposal.jobId}`);
  revalidatePath(`/client/proposals/${proposal.id}`);
  return { success: true, data: undefined };
}

// ─── Request revision (client action) ────────────────────────────────────────

export async function requestRevision(
  input: z.infer<typeof requestRevisionSchema>,
): Promise<ActionResult<void>> {
  const user = await requireUser();

  const parsed = requestRevisionSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const proposal = await db.query.proposals.findFirst({
    where: eq(proposals.id, parsed.data.proposalId),
  });
  if (!proposal) return { success: false, error: 'Proposal not found' };
  if (proposal.status !== 'sent') return { success: false, error: 'Only sent proposals can have revisions requested' };

  if (user.role === 'client') {
    const job = await db.query.jobs.findFirst({ where: eq(jobs.id, proposal.jobId), columns: { accountId: true } });
    if (job?.accountId !== user.accountId) return { success: false, error: 'Access denied' };
  }

  await db.update(proposals).set({
    status: 'revision_requested',
    revisionNotes: parsed.data.revisionNotes,
    version: (proposal.version ?? 1) + 1,
    updatedAt: new Date(),
  }).where(eq(proposals.id, proposal.id));

  await db.update(jobs).set({ stage: 'under_review', updatedAt: new Date() }).where(eq(jobs.id, proposal.jobId));

  await logJobActivity(proposal.jobId, 'revision_requested',
    `Revision requested: ${parsed.data.revisionNotes}`, user.id);

  revalidatePath(`/proposals/${proposal.id}`);
  revalidatePath(`/jobs/${proposal.jobId}`);
  revalidatePath(`/client/proposals/${proposal.id}`);
  return { success: true, data: undefined };
}

// ─── AI generate via API route ────────────────────────────────────────────────

export async function generateProposalViaAction(
  jobId: string,
  templateId?: string,
): Promise<ActionResult<{ title: string; body: string; lineItems: unknown[]; totalAmount: number }>> {
  return generateAIProposal(jobId, templateId);
}
