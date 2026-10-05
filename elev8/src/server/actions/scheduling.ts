'use server';

import { requireUser, requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import {
  schedulingRequests, jobs, accounts, contacts, properties, workOrders, users,
} from '@/drizzle/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { logJobActivity } from '@/server/services/activityLogger';
import { sendEmail, buildSimpleEmail, sendSchedulingConfirmEmail } from '@/server/services/notificationService';
import { revalidatePath } from 'next/cache';
import { formatDate } from '@/lib/utils';
import { APP_URL } from '@/lib/constants';
import { addHours } from 'date-fns';
import type { ActionResult } from '@/types/api';

// ─── Client submits scheduling request ───────────────────────────────────────

const requestSchema = z.object({
  jobId: z.string().uuid(),
  preferredDate1: z.string().min(1, 'At least one preferred date is required'),
  preferredDate2: z.string().optional(),
  preferredDate3: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export async function requestScheduling(
  input: z.infer<typeof requestSchema>,
): Promise<ActionResult<{ requestId: string }>> {
  const user = await requireUser();

  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Invalid input',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // Verify job is approved and belongs to client's account
  const job = await db.query.jobs.findFirst({
    where: eq(jobs.id, parsed.data.jobId),
    columns: { id: true, stage: true, accountId: true, title: true },
  });

  if (!job) return { success: false, error: 'Job not found' };

  if (user.role === 'client' && job.accountId !== user.accountId) {
    return { success: false, error: 'Access denied' };
  }

  // Business rule: can only schedule after approval
  if (!['approved', 'scheduled'].includes(job.stage)) {
    return {
      success: false,
      error: 'Scheduling is only available after the proposal has been approved',
    };
  }

  // Check for existing pending request
  const existing = await db.query.schedulingRequests.findFirst({
    where: and(
      eq(schedulingRequests.jobId, parsed.data.jobId),
      eq(schedulingRequests.status, 'pending'),
    ),
    columns: { id: true },
  });

  if (existing) {
    return { success: false, error: 'A scheduling request is already pending for this job' };
  }

  const [request] = await db
    .insert(schedulingRequests)
    .values({
      jobId: parsed.data.jobId,
      requestedBy: user.id,
      status: 'pending',
      preferredDate1: parsed.data.preferredDate1,
      preferredDate2: parsed.data.preferredDate2 ?? null,
      preferredDate3: parsed.data.preferredDate3 ?? null,
      notes: parsed.data.notes ?? null,
    })
    .returning({ id: schedulingRequests.id });

  await db.update(jobs)
    .set({ stage: 'scheduled', updatedAt: new Date() })
    .where(eq(jobs.id, parsed.data.jobId));

  await logJobActivity(
    parsed.data.jobId,
    'scheduling_requested',
    `Scheduling requested by client. Preferred dates: ${parsed.data.preferredDate1}${parsed.data.preferredDate2 ? ', ' + parsed.data.preferredDate2 : ''}${parsed.data.preferredDate3 ? ', ' + parsed.data.preferredDate3 : ''}`,
    user.id,
  );

  // Notify dispatchers/admins of new scheduling request
  const jobUrl = `${APP_URL}/schedule/${parsed.data.jobId}`;
  const dispatchers = await db.query.users.findMany({
    where: inArray(users.role, ['admin', 'dispatcher']),
    columns: { email: true },
  });
  for (const dispatcher of dispatchers) {
    if (dispatcher.email) {
      await sendEmail({
        to: dispatcher.email,
        subject: `New Scheduling Request — ${job.title ?? 'Job'}`,
        html: buildSimpleEmail(
          'New Scheduling Request',
          `A client has submitted a scheduling request.\n\nJob: ${job.title ?? 'Untitled'}\nPreferred dates: ${parsed.data.preferredDate1}${parsed.data.preferredDate2 ? ', ' + parsed.data.preferredDate2 : ''}${parsed.data.preferredDate3 ? ', ' + parsed.data.preferredDate3 : ''}${parsed.data.notes ? '\nNotes: ' + parsed.data.notes : ''}\n\nReview and confirm the date: ${jobUrl}`,
        ),
        jobId: parsed.data.jobId,
      });
    }
  }

  revalidatePath(`/client/jobs/${parsed.data.jobId}`);
  revalidatePath(`/client/schedule/${parsed.data.jobId}`);
  revalidatePath('/dispatch');
  return { success: true, data: { requestId: request.id } };
}

// ─── Dispatcher confirms date ─────────────────────────────────────────────────

const confirmSchema = z.object({
  requestId: z.string().uuid(),
  confirmedStartDate: z.string().datetime({ message: 'Invalid date/time' }),
  confirmedEndDate: z.string().datetime({ message: 'Invalid date/time' }),
  buildingAccessNotes: z.string().max(1000).optional(),
  complianceCoordinationNotes: z.string().max(1000).optional(),
});

export async function confirmScheduling(
  input: z.infer<typeof confirmSchema>,
): Promise<ActionResult<void>> {
  const user = await requireRole('admin', 'dispatcher');

  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Invalid input',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const request = await db.query.schedulingRequests.findFirst({
    where: eq(schedulingRequests.id, parsed.data.requestId),
    columns: { id: true, jobId: true, status: true },
  });

  if (!request) return { success: false, error: 'Scheduling request not found' };
  if (request.status !== 'pending') {
    return { success: false, error: 'This request has already been confirmed or cancelled' };
  }

  const confirmedStart = new Date(parsed.data.confirmedStartDate);
  const confirmedEnd = new Date(parsed.data.confirmedEndDate);
  const now = new Date();

  await db.update(schedulingRequests)
    .set({
      status: 'confirmed',
      confirmedBy: user.id,
      confirmedStartDate: confirmedStart,
      confirmedEndDate: confirmedEnd,
      buildingAccessNotes: parsed.data.buildingAccessNotes ?? null,
      complianceCoordinationNotes: parsed.data.complianceCoordinationNotes ?? null,
      confirmedAt: now,
      updatedAt: now,
    })
    .where(eq(schedulingRequests.id, parsed.data.requestId));

  // Advance job stage
  await db.update(jobs)
    .set({ stage: 'scheduled', updatedAt: now })
    .where(eq(jobs.id, request.jobId));

  // Auto-calculate 48-hour deadline on any existing work order for this job
  const existingWO = await db.query.workOrders.findFirst({
    where: eq(workOrders.jobId, request.jobId),
    columns: { id: true, fortyEightHourNoticeRequired: true },
  });

  if (existingWO?.fortyEightHourNoticeRequired) {
    const deadline = addHours(confirmedStart, -48);
    await db.update(workOrders)
      .set({
        scheduledStart: confirmedStart,
        scheduledEnd: confirmedEnd,
        fortyEightHourDeadline: deadline,
        fortyEightHourStatus: 'pending',
        updatedAt: now,
      })
      .where(eq(workOrders.id, existingWO.id));
  }

  await logJobActivity(
    request.jobId,
    'date_confirmed',
    `Work date confirmed: ${formatDate(confirmedStart, 'MMM d, yyyy h:mm a')}`,
    user.id,
  );

  // Notify client via email
  const job = await db.query.jobs.findFirst({
    where: eq(jobs.id, request.jobId),
    columns: { accountId: true, title: true, complianceCoordinationRequired: true, propertyId: true },
  });

  if (job) {
    const [contact, property] = await Promise.all([
      db.query.contacts.findFirst({
        where: and(eq(contacts.accountId, job.accountId), eq(contacts.isPrimary, true)),
        columns: { email: true, fullName: true },
      }),
      job.propertyId
        ? db.query.properties.findFirst({
            where: eq(properties.id, job.propertyId),
            columns: { name: true },
          })
        : Promise.resolve(null),
    ]);

    if (contact?.email) {
      await sendSchedulingConfirmEmail({
        to: contact.email,
        clientName: contact.fullName,
        jobTitle: job.title ?? 'Elevator Compliance Job',
        propertyName: property?.name ?? 'your property',
        confirmedStart,
        confirmedEnd,
        buildingAccessNotes: parsed.data.buildingAccessNotes,
        complianceCoordinationRequired: job.complianceCoordinationRequired ?? false,
        fortyEightHourRequired: existingWO?.fortyEightHourNoticeRequired ?? false,
        jobId: request.jobId,
      });
    }
  }

  revalidatePath('/dispatch');
  revalidatePath(`/schedule/${request.jobId}`);
  revalidatePath(`/client/jobs/${request.jobId}`);
  return { success: true, data: undefined };
}

// ─── Reschedule request ───────────────────────────────────────────────────────

export async function rescheduleRequest(
  requestId: string,
  reason?: string,
): Promise<ActionResult<void>> {
  const user = await requireRole('admin', 'dispatcher');

  const request = await db.query.schedulingRequests.findFirst({
    where: eq(schedulingRequests.id, requestId),
    columns: { id: true, jobId: true },
  });

  if (!request) return { success: false, error: 'Request not found' };

  await db.update(schedulingRequests)
    .set({ status: 'rescheduled', updatedAt: new Date() })
    .where(eq(schedulingRequests.id, requestId));

  await logJobActivity(
    request.jobId,
    'scheduling_requested',
    `Scheduling marked for rescheduling${reason ? ': ' + reason : ''}`,
    user.id,
  );

  revalidatePath('/dispatch');
  return { success: true, data: undefined };
}
