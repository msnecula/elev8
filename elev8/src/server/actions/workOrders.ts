'use server';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { technicians, workOrders } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/types/api';
import { logWorkOrderActivity } from '@/server/services/activityLogger';

const updateStatusSchema = z.object({
  workOrderId: z.string().uuid(),
  status: z.enum(['draft','assigned','dispatched','ready','en_route','on_site','completed','held','cancelled']),
  completionNotes: z.string().optional(),
  completionPhotos: z.array(z.string()).optional(),
});

// The field steps a technician may set, each only from the step before it.
const TECHNICIAN_TRANSITIONS: Record<string, string> = {
  dispatched: 'ready',
  ready: 'en_route',
  en_route: 'on_site',
  on_site: 'completed',
};

export async function updateWorkOrderStatus(
  input: z.infer<typeof updateStatusSchema>
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole('admin', 'dispatcher', 'technician');
  const parsed = updateStatusSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const { workOrderId, status, completionNotes, completionPhotos } = parsed.data;

  if (user.role === 'technician') {
    const [workOrder, tech] = await Promise.all([
      db.query.workOrders.findFirst({
        where: eq(workOrders.id, workOrderId),
        columns: { status: true, assignedTechnicianId: true },
      }),
      db.query.technicians.findFirst({
        where: eq(technicians.userId, user.id),
        columns: { id: true },
      }),
    ]);
    if (!workOrder || !tech || workOrder.assignedTechnicianId !== tech.id) {
      return { success: false, error: 'This work order is not assigned to you' };
    }
    if (TECHNICIAN_TRANSITIONS[workOrder.status] !== status) {
      return { success: false, error: 'That status change isn’t available — refresh the page' };
    }
  }

  const updateData: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };

  if (status === 'completed') {
    updateData.completedAt = new Date();
    if (completionNotes) updateData.completionNotes = completionNotes;
    if (completionPhotos) updateData.completionPhotos = completionPhotos;
  }

  await db.update(workOrders).set(updateData as never).where(eq(workOrders.id, workOrderId));

  await logWorkOrderActivity(
    workOrderId,
    'technician_status_updated',
    `Status updated to ${status}`,
    user.id,
    { status }
  );

  return { success: true, data: { id: workOrderId } };
}

const workOrderIdSchema = z.object({ workOrderId: z.string().uuid() });

/** Where a held work order goes back to: Assigned if it has a technician, else Draft. */
function statusAfterHold(assignedTechnicianId: string | null) {
  return assignedTechnicianId ? 'assigned' as const : 'draft' as const;
}

export async function markFortyEightHourSent(
  input: z.infer<typeof workOrderIdSchema>
): Promise<ActionResult<void>> {
  const user = await requireRole('admin', 'dispatcher');
  const parsed = workOrderIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input' };
  const { workOrderId } = parsed.data;

  const workOrder = await db.query.workOrders.findFirst({
    where: eq(workOrders.id, workOrderId),
    columns: { status: true, fortyEightHourStatus: true, assignedTechnicianId: true },
  });
  if (!workOrder) return { success: false, error: 'Work order not found' };

  // The sweep put this work order on hold only because the notice was late; once
  // the notice is sent, that hold no longer applies.
  const releaseAutoHold = workOrder.status === 'held' && workOrder.fortyEightHourStatus === 'overdue';

  await db.update(workOrders).set({
    fortyEightHourStatus: 'sent',
    fortyEightHourSentAt: new Date(),
    fortyEightHourSentBy: user.id,
    ...(releaseAutoHold ? { status: statusAfterHold(workOrder.assignedTechnicianId) } : {}),
    updatedAt: new Date(),
  }).where(eq(workOrders.id, workOrderId));

  await logWorkOrderActivity(
    workOrderId,
    'forty_eight_hour_sent',
    releaseAutoHold
      ? '48-hour notice marked as sent — hold released'
      : '48-hour notice marked as sent',
    user.id
  );

  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath('/dispatch');
  return { success: true, data: undefined };
}

export async function releaseWorkOrderHold(
  input: z.infer<typeof workOrderIdSchema>
): Promise<ActionResult<void>> {
  const user = await requireRole('admin', 'dispatcher');
  const parsed = workOrderIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input' };
  const { workOrderId } = parsed.data;

  const workOrder = await db.query.workOrders.findFirst({
    where: eq(workOrders.id, workOrderId),
    columns: {
      status: true, assignedTechnicianId: true,
      fortyEightHourNoticeRequired: true, fortyEightHourStatus: true,
    },
  });
  if (!workOrder) return { success: false, error: 'Work order not found' };
  if (workOrder.status !== 'held') return { success: false, error: 'This work order is not on hold' };
  if (workOrder.fortyEightHourNoticeRequired && workOrder.fortyEightHourStatus === 'overdue') {
    return { success: false, error: 'Send the 48-hour notice and click "Mark Notice as Sent" first' };
  }

  const next = statusAfterHold(workOrder.assignedTechnicianId);
  await db.update(workOrders)
    .set({ status: next, updatedAt: new Date() })
    .where(eq(workOrders.id, workOrderId));

  await logWorkOrderActivity(
    workOrderId,
    'technician_status_updated',
    `Hold released — status back to ${next}`,
    user.id,
    { status: next },
  );

  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath('/dispatch');
  return { success: true, data: undefined };
}
