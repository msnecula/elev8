'use server';

import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import {
  workOrders, jobs, technicians, schedulingRequests,
  accounts, properties, contacts, notices,
} from '@/drizzle/schema';
import { eq, and, arrayContains } from 'drizzle-orm';
import { z } from 'zod';
import {
  createWorkOrderSchema,
  assignTechnicianSchema,
} from '@/lib/validations/workOrder';
import { logJobActivity, logWorkOrderActivity } from '@/server/services/activityLogger';
import { sendEmail, sendSMS, buildSimpleEmail } from '@/server/services/notificationService';
import { revalidatePath } from 'next/cache';
import { formatDate } from '@/lib/utils';
import { addHours } from 'date-fns';
import { FORTY_EIGHT_HOUR_REQUIRED_HOURS } from '@/lib/constants';
import type { ActionResult } from '@/types/api';
import type { DispatchPacket } from '../../../drizzle/schema/work_orders';

// ─── Create work order ────────────────────────────────────────────────────────

export async function createWorkOrder(
  input: z.infer<typeof createWorkOrderSchema>,
): Promise<ActionResult<{ workOrderId: string }>> {
  const user = await requireRole('admin', 'dispatcher');

  const parsed = createWorkOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Invalid input',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const {
    jobId, schedulingRequestId, scheduledStart, scheduledEnd,
    region, requiredSkillTag, dispatchNotes, fortyEightHourNoticeRequired,
  } = parsed.data;

  // Fetch job details to build dispatch packet
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

  // Get primary contact
  const contact = await db.query.contacts.findFirst({
    where: and(
      eq(contacts.accountId, job.accountId),
      eq(contacts.isPrimary, true),
    ),
    columns: { fullName: true, phone: true },
  });

  // Get scheduling request access notes
  let buildingAccessNotes = '';
  let complianceNotes = '';
  if (schedulingRequestId) {
    const sr = await db.query.schedulingRequests.findFirst({
      where: eq(schedulingRequests.id, schedulingRequestId),
      columns: { buildingAccessNotes: true, complianceCoordinationNotes: true },
    });
    buildingAccessNotes = sr?.buildingAccessNotes ?? '';
    complianceNotes = sr?.complianceCoordinationNotes ?? '';
  }

  // Build dispatch packet
  const parsedNotice = notice?.parsedData as Record<string, unknown> | null;
  const dispatchPacket: DispatchPacket = {
    propertyName: property?.name ?? parsedNotice?.propertyName as string ?? 'Unknown Property',
    propertyAddress: property
      ? `${property.address}, ${property.city}, ${property.state} ${property.zip ?? ''}`.trim()
      : parsedNotice?.propertyAddress as string ?? '',
    buildingType: job.buildingType ?? parsedNotice?.buildingType as string ?? '',
    elevatorCount: property?.elevatorCount ?? 1,
    contactName: contact?.fullName ?? account?.name ?? '',
    contactPhone: contact?.phone ?? account?.phone ?? '',
    buildingAccessNotes,
    requiredScope: parsedNotice?.requiredWorkSummary as string ?? job.title ?? '',
    violationItems: (parsedNotice?.violationItems as string[]) ?? [],
    specialInstructions: dispatchNotes ?? '',
    complianceNotes,
    requiredSkillTag: requiredSkillTag ?? job.requiredSkillTag ?? '',
  };

  // Calculate 48-hour deadline
  const start = new Date(scheduledStart);
  const fortyEightHourDeadline = fortyEightHourNoticeRequired
    ? addHours(start, -FORTY_EIGHT_HOUR_REQUIRED_HOURS)
    : null;

  const [workOrder] = await db
    .insert(workOrders)
    .values({
      jobId,
      schedulingRequestId: schedulingRequestId ?? null,
      createdBy: user.id,
      status: 'draft',
      scheduledStart: start,
      scheduledEnd: new Date(scheduledEnd),
      region,
      requiredSkillTag,
      dispatchNotes: dispatchNotes ?? null,
      dispatchPacket: JSON.stringify(dispatchPacket),
      fortyEightHourNoticeRequired,
      fortyEightHourDeadline,
      fortyEightHourStatus: fortyEightHourNoticeRequired ? 'pending' : 'not_required',
    })
    .returning({ id: workOrders.id });

  // Advance job stage
  await db.update(jobs)
    .set({ stage: 'dispatched', updatedAt: new Date() })
    .where(eq(jobs.id, jobId));

  await logJobActivity(
    jobId,
    'work_order_created',
    `Work order created for ${formatDate(start, 'MMM d, yyyy')}`,
    user.id,
  );

  revalidatePath('/dispatch');
  revalidatePath('/work-orders');
  revalidatePath(`/jobs/${jobId}`);
  return { success: true, data: { workOrderId: workOrder.id } };
}

// ─── Assign technician ────────────────────────────────────────────────────────

export async function assignTechnician(
  input: z.infer<typeof assignTechnicianSchema>,
): Promise<ActionResult<void>> {
  const user = await requireRole('admin', 'dispatcher');

  const parsed = assignTechnicianSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const { workOrderId, technicianId } = parsed.data;

  // Verify technician is active and available
  const tech = await db.query.technicians.findFirst({
    where: eq(technicians.id, technicianId),
    columns: { id: true, fullName: true, phone: true, isActive: true, isAvailable: true },
  });

  if (!tech) return { success: false, error: 'Technician not found' };
  if (!tech.isActive) return { success: false, error: 'Technician is not active' };

  const workOrder = await db.query.workOrders.findFirst({
    where: eq(workOrders.id, workOrderId),
    columns: { id: true, jobId: true, scheduledStart: true, status: true },
  });

  if (!workOrder) return { success: false, error: 'Work order not found' };

  await db.update(workOrders)
    .set({
      assignedTechnicianId: technicianId,
      status: 'assigned',
      updatedAt: new Date(),
    })
    .where(eq(workOrders.id, workOrderId));

  await logWorkOrderActivity(
    workOrderId,
    'technician_assigned',
    `Technician assigned: ${tech.fullName}`,
    user.id,
    { technicianId, technicianName: tech.fullName },
  );

  await logJobActivity(
    workOrder.jobId,
    'technician_assigned',
    `Technician assigned: ${tech.fullName}`,
    user.id,
  );

  // SMS notification to technician
  if (tech.phone) {
    const dateStr = workOrder.scheduledStart
      ? formatDate(workOrder.scheduledStart, 'EEEE, MMM d \'at\' h:mm a')
      : 'TBD';
    await sendSMS({
      to: tech.phone,
      body: `Elev8 Comply: You have been assigned a new job on ${dateStr}. Log in to view your work order details.`,
      jobId: workOrder.jobId,
    });
  }

  revalidatePath('/dispatch');
  revalidatePath(`/work-orders/${workOrderId}`);
  return { success: true, data: undefined };
}

// ─── Dispatch work order (send to technician) ─────────────────────────────────

export async function dispatchWorkOrder(
  workOrderId: string,
): Promise<ActionResult<void>> {
  const user = await requireRole('admin', 'dispatcher');

  const workOrder = await db.query.workOrders.findFirst({
    where: eq(workOrders.id, workOrderId),
    columns: {
      id: true, jobId: true, assignedTechnicianId: true,
      scheduledStart: true, fortyEightHourNoticeRequired: true,
      fortyEightHourStatus: true,
    },
  });

  if (!workOrder) return { success: false, error: 'Work order not found' };
  if (!workOrder.assignedTechnicianId) {
    return { success: false, error: 'Cannot dispatch: no technician assigned' };
  }

  // Business rule: hold dispatch if 48-hr notice is required but not sent
  if (
    workOrder.fortyEightHourNoticeRequired &&
    workOrder.fortyEightHourStatus === 'overdue'
  ) {
    return {
      success: false,
      error: 'Cannot dispatch: 48-hour notice is overdue. Mark the notice as sent before dispatching.',
    };
  }

  await db.update(workOrders)
    .set({ status: 'dispatched', updatedAt: new Date() })
    .where(eq(workOrders.id, workOrderId));

  await db.update(jobs)
    .set({ stage: 'dispatched', updatedAt: new Date() })
    .where(eq(jobs.id, workOrder.jobId));

  // SMS to technician
  const tech = workOrder.assignedTechnicianId
    ? await db.query.technicians.findFirst({
        where: eq(technicians.id, workOrder.assignedTechnicianId),
        columns: { fullName: true, phone: true },
      })
    : null;

  if (tech?.phone) {
    const dateStr = workOrder.scheduledStart
      ? formatDate(workOrder.scheduledStart, 'EEEE, MMM d \'at\' h:mm a')
      : 'today';
    await sendSMS({
      to: tech.phone,
      body: `Elev8 Comply DISPATCH: You are dispatched for ${dateStr}. Open the app for your full dispatch packet.`,
      jobId: workOrder.jobId,
    });
  }

  await logWorkOrderActivity(
    workOrderId,
    'work_order_dispatched',
    `Work order dispatched to ${tech?.fullName ?? 'technician'}`,
    user.id,
  );

  revalidatePath('/dispatch');
  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath(`/jobs/${workOrder.jobId}`);
  return { success: true, data: undefined };
}

// ─── Find matching technicians for a job ─────────────────────────────────────

export async function findMatchingTechnicians(
  skillTag: string,
  region: string,
): Promise<ActionResult<Array<{
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  skillTags: string[];
  regions: string[];
  isAvailable: boolean;
  matchScore: number;
}>>> {
  await requireRole('admin', 'dispatcher');

  const allTechs = await db.query.technicians.findMany({
    where: eq(technicians.isActive, true),
    columns: {
      id: true, fullName: true, email: true, phone: true,
      skillTags: true, regions: true, isAvailable: true,
    },
  });

  // Score each technician: skill match (2pts) + region match (2pts) + available (1pt)
  const scored = allTechs.map(tech => {
    let score = 0;
    const skills = tech.skillTags as string[];
    const regions = tech.regions as string[];

    if (skills.includes(skillTag)) score += 2;
    if (regions.includes(region)) score += 2;
    if (tech.isAvailable) score += 1;

    return { ...tech, skillTags: skills, regions, matchScore: score };
  });

  // Sort by match score descending
  scored.sort((a, b) => b.matchScore - a.matchScore);

  return { success: true, data: scored };
}
