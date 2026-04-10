'use server';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { workOrders } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { ActionResult } from '@/types/api';
import { logWorkOrderActivity } from '@/server/services/activityLogger';

const updateStatusSchema = z.object({
  workOrderId: z.string().uuid(),
  status: z.enum(['draft','assigned','dispatched','ready','en_route','on_site','completed','held','cancelled']),
  completionNotes: z.string().optional(),
  completionPhotos: z.array(z.string()).optional(),
});

export async function updateWorkOrderStatus(
  input: z.infer<typeof updateStatusSchema>
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole('admin', 'dispatcher', 'technician');
  const parsed = updateStatusSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const { workOrderId, status, completionNotes, completionPhotos } = parsed.data;

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

const mark48Schema = z.object({ workOrderId: z.string().uuid() });

export async function markFortyEightHourSent(
  input: z.infer<typeof mark48Schema>
): Promise<ActionResult<void>> {
  const user = await requireRole('admin', 'dispatcher');
  const parsed = mark48Schema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  await db.update(workOrders).set({
    fortyEightHourStatus: 'sent',
    fortyEightHourSentAt: new Date(),
    fortyEightHourSentBy: user.id,
    updatedAt: new Date(),
  }).where(eq(workOrders.id, parsed.data.workOrderId));

  await logWorkOrderActivity(
    parsed.data.workOrderId,
    'forty_eight_hour_sent',
    '48-hour notice marked as sent',
    user.id
  );

  return { success: true, data: undefined };
}
