import 'server-only';
import { db } from '@/server/db/client';
import { workOrders, jobs, accounts, properties, users } from '@/drizzle/schema';
import { eq, and, lte, inArray, lt } from 'drizzle-orm';
import { sendFortyEightHourAlert, sendSMS } from './notificationService';
import { logWorkOrderActivity } from './activityLogger';
import { addHours } from 'date-fns';
import { FORTY_EIGHT_HOUR_ALERT_THRESHOLD_HOURS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';

/**
 * Sweeps all pending 48-hour notices and:
 * 1. Marks overdue ones as 'overdue' and sets work order to 'held'
 * 2. Sends alert emails + SMS to admins/dispatchers for notices within 24 hours
 * 3. Sends escalation email + SMS to admins/dispatchers for newly-overdue notices
 *
 * Called by: /api/cron/48hour-sweep (protected by CRON_SECRET)
 * Run every: 30 minutes via Vercel Cron
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

  // ── Fetch staff once ────────────────────────────────────────────────────────
  const staffMembers = await db.query.users.findMany({
    where: and(
      inArray(users.role, ['admin', 'dispatcher']),
      eq(users.isActive, true),
    ),
    columns: { email: true, fullName: true, phone: true },
  });

  // ── 1. Mark overdue: deadline has passed, notice not sent ──────────────────
  const overdueOrders = await db
    .select({
      wo: workOrders,
      jobId: jobs.id,
      jobTitle: jobs.title,
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
        lt(workOrders.fortyEightHourDeadline, now),
      )
    );

  for (const { wo, jobId, jobTitle, propertyName, propertyAddress } of overdueOrders) {
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

      // Escalation email + SMS to all admins/dispatchers
      for (const staff of staffMembers) {
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
          errors.push(`Overdue email to ${staff.email}: ${err instanceof Error ? err.message : 'unknown'}`);
        }

        // SMS escalation to staff with phone numbers
        if (staff.phone) {
          try {
            const dateStr = wo.scheduledStart
              ? formatDate(wo.scheduledStart, 'MMM d \'at\' h:mm a')
              : 'TBD';
            await sendSMS({
              to: staff.phone,
              body: `🚨 ELEV8 COMPLY — 48HR NOTICE OVERDUE\n${propertyName ?? jobTitle ?? 'Job'} on ${dateStr} is now HELD. Mark notice sent before dispatching.\nelev8comply.com/work-orders/${wo.id}`,
              jobId: wo.jobId,
            });
            alertsSent++;
          } catch (err) {
            errors.push(`Overdue SMS to ${staff.phone}: ${err instanceof Error ? err.message : 'unknown'}`);
          }
        }
      }
    } catch (err) {
      errors.push(`WO ${wo.id}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  // ── 2. Alert: deadline within threshold, notice not sent ───────────────────
  const nearDeadlineOrders = await db
    .select({
      wo: workOrders,
      jobTitle: jobs.title,
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

  for (const { wo, jobTitle, propertyName, propertyAddress } of nearDeadlineOrders) {
    const hoursLeft = wo.fortyEightHourDeadline
      ? Math.max(0, Math.round((new Date(wo.fortyEightHourDeadline).getTime() - now.getTime()) / 3_600_000))
      : 0;

    for (const staff of staffMembers) {
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
        errors.push(`Alert email to ${staff.email}: ${err instanceof Error ? err.message : 'unknown'}`);
      }

      // SMS warning to staff with phone numbers
      if (staff.phone) {
        try {
          const dateStr = wo.scheduledStart
            ? formatDate(wo.scheduledStart, 'MMM d')
            : 'TBD';
          const urgency = hoursLeft <= 4 ? '⚠️ URGENT' : '⚠️';
          await sendSMS({
            to: staff.phone,
            body: `${urgency} ELEV8 COMPLY — 48HR NOTICE DUE IN ${hoursLeft}H\n${propertyName ?? jobTitle ?? 'Job'} on ${dateStr}. Send building notice now.\nelev8comply.com/work-orders/${wo.id}`,
            jobId: wo.jobId,
          });
          alertsSent++;
        } catch (err) {
          errors.push(`Alert SMS to ${staff.phone}: ${err instanceof Error ? err.message : 'unknown'}`);
        }
      }
    }
  }

  return { marked_overdue: markedOverdue, alerts_sent: alertsSent, errors };
}
