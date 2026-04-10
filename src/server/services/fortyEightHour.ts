import 'server-only';
import { db } from '@/server/db/client';
import { workOrders, jobs, accounts, properties, users } from '@/drizzle/schema';
import { eq, and, lte, inArray, lt } from 'drizzle-orm';
import { sendFortyEightHourAlert } from './notificationService';
import { logWorkOrderActivity } from './activityLogger';
import { addHours } from 'date-fns';
import { FORTY_EIGHT_HOUR_ALERT_THRESHOLD_HOURS } from '@/lib/constants';

/**
 * Sweeps all pending 48-hour notices and:
 * 1. Marks overdue ones as 'overdue' and sets work order to 'held'
 * 2. Sends alert emails to admins/dispatchers for notices within 24 hours
 *
 * Called by: /api/cron/48hour-sweep (protected by CRON_SECRET)
 * Run every: 30 minutes via Vercel Cron or similar
 */
export async function sweepFortyEightHourNotices(): Promise<{
  marked_overdue: number;
  alerts_sent: number;
  errors: string[];
}> {
  const now = new Date();
  const alertThreshold = addHours(now, FORTY_EIGHT_HOUR_ALERT_THRESHOLD_HOURS);

  let markedOverdue = 0;
  let alertsSent = 0;
  const errors: string[] = [];

  // ── 1. Mark overdue: deadline has passed, notice not sent ──────────────────
  const overdueOrders = await db
    .select({
      wo: workOrders,
      jobId: jobs.id,
      jobTitle: jobs.title,
    })
    .from(workOrders)
    .leftJoin(jobs, eq(workOrders.jobId, jobs.id))
    .where(
      and(
        eq(workOrders.fortyEightHourNoticeRequired, true),
        eq(workOrders.fortyEightHourStatus, 'pending'),
        lt(workOrders.fortyEightHourDeadline, now),
      )
    );

  for (const { wo, jobId, jobTitle } of overdueOrders) {
    try {
      await db.update(workOrders)
        .set({
          fortyEightHourStatus: 'overdue',
          status: 'held',          // Hold dispatch automatically
          updatedAt: now,
        })
        .where(eq(workOrders.id, wo.id));

      await logWorkOrderActivity(
        wo.id,
        'forty_eight_hour_overdue',
        '48-hour notice deadline passed — work order placed on HOLD',
        null,
      );

      markedOverdue++;
    } catch (err) {
      errors.push(`WO ${wo.id}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  // ── 2. Alert: deadline within threshold, notice not sent ───────────────────
  const nearDeadlineOrders = await db
    .select({
      wo: workOrders,
      jobTitle: jobs.title,
      accountId: jobs.accountId,
      propertyName: properties.name,
      propertyAddress: properties.address,
    })
    .from(workOrders)
    .leftJoin(jobs, eq(workOrders.jobId, jobs.id))
    .leftJoin(properties, eq(jobs.propertyId, properties.id))
    .where(
      and(
        eq(workOrders.fortyEightHourNoticeRequired, true),
        eq(workOrders.fortyEightHourStatus, 'pending'),
        lte(workOrders.fortyEightHourDeadline, alertThreshold),
      )
    );

  if (nearDeadlineOrders.length > 0) {
    // Get all admin + dispatcher emails
    const staffEmails = await db.query.users.findMany({
      where: and(
        inArray(users.role, ['admin', 'dispatcher']),
        eq(users.isActive, true),
      ),
      columns: { email: true, fullName: true },
    });

    for (const { wo, jobTitle, propertyName, propertyAddress } of nearDeadlineOrders) {
      for (const staff of staffEmails) {
        try {
          await sendFortyEightHourAlert({
            to: staff.email,
            recipientName: staff.fullName,
            jobTitle: jobTitle ?? 'Elevator Job',
            propertyName: propertyName ?? '',
            propertyAddress: propertyAddress ?? '',
            scheduledStart: wo.scheduledStart ?? now,
            deadline: wo.fortyEightHourDeadline ?? now,
            isOverdue: false,
            workOrderId: wo.id,
            jobId: wo.jobId,
          });
          alertsSent++;
        } catch (err) {
          errors.push(`Alert to ${staff.email}: ${err instanceof Error ? err.message : 'unknown'}`);
        }
      }
    }
  }

  // ── 3. Alert for newly-overdue (send escalation email) ─────────────────────
  for (const { wo, jobTitle, propertyName, propertyAddress } of overdueOrders) {
    const staffEmails = await db.query.users.findMany({
      where: and(
        inArray(users.role, ['admin', 'dispatcher']),
        eq(users.isActive, true),
      ),
      columns: { email: true, fullName: true },
    });

    for (const staff of staffEmails) {
      try {
        await sendFortyEightHourAlert({
          to: staff.email,
          recipientName: staff.fullName,
          jobTitle: jobTitle ?? 'Elevator Job',
          propertyName: propertyName ?? '',
          propertyAddress: propertyAddress ?? '',
          scheduledStart: wo.scheduledStart ?? now,
          deadline: wo.fortyEightHourDeadline ?? now,
          isOverdue: true,
          workOrderId: wo.id,
          jobId: wo.jobId,
        });
        alertsSent++;
      } catch (err) {
        errors.push(`Overdue alert: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }
  }

  return { marked_overdue: markedOverdue, alerts_sent: alertsSent, errors };
}
