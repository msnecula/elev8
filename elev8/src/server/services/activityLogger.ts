import 'server-only';
import { db } from '@/server/db/client';
import { activityLogs } from '@/drizzle/schema';
import type { NewActivityLog } from '../../../drizzle/schema/activity_logs';

/**
 * Writes a single immutable audit log entry.
 * actorId is null for system-generated events (AI parse, cron jobs).
 */
export async function logActivity(entry: Omit<NewActivityLog, 'id' | 'createdAt'>) {
  try {
    await db.insert(activityLogs).values(entry);
  } catch (err) {
    // Never throw from audit logging — it must not break the primary operation
    console.error('[ActivityLogger] Failed to write activity log:', err);
  }
}

export async function logJobActivity(
  jobId: string,
  eventType: NewActivityLog['eventType'],
  description: string,
  actorId?: string | null,
  metadata?: Record<string, unknown>,
) {
  await logActivity({
    entityType: 'job',
    entityId: jobId,
    eventType,
    description,
    actorId: actorId ?? null,
    metadata,
  });
}

export async function logNoticeActivity(
  noticeId: string,
  eventType: NewActivityLog['eventType'],
  description: string,
  actorId?: string | null,
  metadata?: Record<string, unknown>,
) {
  await logActivity({
    entityType: 'notice',
    entityId: noticeId,
    eventType,
    description,
    actorId: actorId ?? null,
    metadata,
  });
}

export async function logWorkOrderActivity(
  workOrderId: string,
  eventType: NewActivityLog['eventType'],
  description: string,
  actorId?: string | null,
  metadata?: Record<string, unknown>,
) {
  await logActivity({
    entityType: 'work_order',
    entityId: workOrderId,
    eventType,
    description,
    actorId: actorId ?? null,
    metadata,
  });
}
