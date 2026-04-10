import 'server-only';
import { db } from '@/server/db/client';
import { notifications } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { render } from '@react-email/render';
import { EMAIL_FROM } from '@/lib/resend';
import { formatDate, formatCurrency } from '@/lib/utils';
import { APP_URL } from '@/lib/constants';

// ─── Core send helpers ────────────────────────────────────────────────────────

export async function sendEmail({
  to, subject, html, jobId, userId,
}: {
  to: string;
  subject: string;
  html: string;
  jobId?: string;
  userId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const [notification] = await db.insert(notifications).values({
    userId: userId ?? null,
    jobId: jobId ?? null,
    type: 'email',
    channel: to,
    subject,
    body: html,
    status: 'pending',
  }).returning({ id: notifications.id });

  try {
    const { resend } = await import('@/lib/resend');
    const result = await resend.emails.send({ from: EMAIL_FROM, to, subject, html });

    if (result.error) {
      await db.update(notifications)
        .set({ status: 'failed', error: result.error.message })
        .where(eq(notifications.id, notification.id));
      return { success: false, error: result.error.message };
    }

    await db.update(notifications)
      .set({ status: 'sent', sentAt: new Date() })
      .where(eq(notifications.id, notification.id));
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await db.update(notifications)
      .set({ status: 'failed', error: message })
      .where(eq(notifications.id, notification.id));
    console.error('[Email] Send failed:', message);
    return { success: false, error: message };
  }
}

export async function sendSMS({
  to, body, jobId, userId,
}: {
  to: string;
  body: string;
  jobId?: string;
  userId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const [notification] = await db.insert(notifications).values({
    userId: userId ?? null,
    jobId: jobId ?? null,
    type: 'sms',
    channel: to,
    body,
    status: 'pending',
  }).returning({ id: notifications.id });

  try {
    const { twilioClient, TWILIO_FROM } = await import('@/lib/twilio');
    await twilioClient.messages.create({ from: TWILIO_FROM, to, body });
    await db.update(notifications)
      .set({ status: 'sent', sentAt: new Date() })
      .where(eq(notifications.id, notification.id));
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await db.update(notifications)
      .set({ status: 'failed', error: message })
      .where(eq(notifications.id, notification.id));
    console.error('[SMS] Send failed:', message);
    return { success: false, error: message };
  }
}

// Simple HTML builder for quick non-template emails
export function buildSimpleEmail(subject: string, bodyText: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;color:#111827;">
<div style="border-bottom:2px solid #2563eb;padding-bottom:16px;margin-bottom:32px;">
  <strong style="font-size:18px;color:#2563eb;">Elev8 Comply</strong>
</div>
<h2 style="margin-top:0;font-size:18px;">${subject}</h2>
<div style="font-size:15px;line-height:1.6;white-space:pre-line;">${bodyText}</div>
<div style="margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
  This email was sent by Elev8 Comply.
</div></body></html>`;
}

// ─── Typed notification senders ───────────────────────────────────────────────

export async function sendProposalEmail({
  to, clientName, jobTitle, propertyName, proposalBody,
  totalAmount, proposalId, expiresAt, version, jobId,
}: {
  to: string;
  clientName: string;
  jobTitle: string;
  propertyName: string;
  proposalBody: string;
  totalAmount: number | string;
  proposalId: string;
  expiresAt: Date | string | null;
  version: number;
  jobId: string;
}) {
  const { ProposalEmail } = await import('@/emails/ProposalEmail');
  const html = await render(ProposalEmail({
    clientName,
    jobTitle,
    propertyName,
    proposalBody,
    totalAmount: formatCurrency(totalAmount),
    proposalUrl: `${APP_URL}/client/proposals/${proposalId}`,
    expiresDate: expiresAt ? formatDate(expiresAt) : '30 days',
    version,
  }));

  return sendEmail({
    to,
    subject: `Proposal Ready for Review — ${jobTitle}`,
    html,
    jobId,
  });
}

export async function sendApprovalConfirmEmail({
  to, clientName, jobTitle, propertyName,
  totalAmount, jobId,
}: {
  to: string;
  clientName: string;
  jobTitle: string;
  propertyName: string;
  totalAmount: number | string;
  jobId: string;
}) {
  const { ApprovalConfirmEmail } = await import('@/emails/ApprovalConfirmEmail');
  const html = await render(ApprovalConfirmEmail({
    clientName,
    jobTitle,
    propertyName,
    totalAmount: formatCurrency(totalAmount),
    jobUrl: `${APP_URL}/client/jobs/${jobId}`,
    nextStep: 'scheduling',
  }));

  return sendEmail({
    to,
    subject: `Proposal Approved — ${jobTitle}`,
    html,
    jobId,
  });
}

export async function sendSchedulingConfirmEmail({
  to, clientName, jobTitle, propertyName,
  confirmedStart, confirmedEnd, buildingAccessNotes,
  complianceCoordinationRequired, fortyEightHourRequired, jobId,
}: {
  to: string;
  clientName: string;
  jobTitle: string;
  propertyName: string;
  confirmedStart: Date | string;
  confirmedEnd: Date | string | null;
  buildingAccessNotes?: string;
  complianceCoordinationRequired: boolean;
  fortyEightHourRequired: boolean;
  jobId: string;
}) {
  const { SchedulingEmail } = await import('@/emails/SchedulingEmail');
  const html = await render(SchedulingEmail({
    clientName,
    jobTitle,
    propertyName,
    confirmedDate: formatDate(confirmedStart, 'EEEE, MMMM d, yyyy'),
    confirmedTimeRange: `${formatDate(confirmedStart, 'h:mm a')}${confirmedEnd ? ` – ${formatDate(confirmedEnd, 'h:mm a')}` : ''}`,
    buildingAccessNotes,
    complianceCoordinationRequired,
    fortyEightHourRequired,
    jobUrl: `${APP_URL}/client/jobs/${jobId}`,
  }));

  return sendEmail({
    to,
    subject: `Work Date Confirmed — ${jobTitle}`,
    html,
    jobId,
  });
}

export async function sendFortyEightHourAlert({
  to, recipientName, jobTitle, propertyName, propertyAddress,
  scheduledStart, deadline, isOverdue, workOrderId, jobId,
}: {
  to: string;
  recipientName: string;
  jobTitle: string;
  propertyName: string;
  propertyAddress: string;
  scheduledStart: Date | string;
  deadline: Date | string;
  isOverdue: boolean;
  workOrderId: string;
  jobId: string;
}) {
  const { FortyEightHourAlertEmail } = await import('@/emails/FortyEightHourNoticeEmail');
  const html = await render(FortyEightHourAlertEmail({
    recipientName,
    jobTitle,
    propertyName,
    propertyAddress,
    scheduledDate: formatDate(scheduledStart, 'EEEE, MMMM d, yyyy h:mm a'),
    deadlineDate: formatDate(deadline, 'EEEE, MMMM d, yyyy h:mm a'),
    isOverdue,
    workOrderUrl: `${APP_URL}/work-orders/${workOrderId}`,
  }));

  return sendEmail({
    to,
    subject: isOverdue
      ? `OVERDUE: 48-Hour Notice — ${jobTitle}`
      : `ACTION REQUIRED: 48-Hour Notice Deadline — ${jobTitle}`,
    html,
    jobId,
  });
}

export async function sendDispatchEmail({
  to, technicianName, packet, scheduledStart, scheduledEnd,
  workOrderId, jobId,
}: {
  to: string;
  technicianName: string;
  packet: Record<string, unknown>;
  scheduledStart: Date | string;
  scheduledEnd: Date | string | null;
  workOrderId: string;
  jobId: string;
}) {
  const { DispatchAlertEmail } = await import('@/emails/DispatchAlertEmail');
  const html = await render(DispatchAlertEmail({
    technicianName,
    jobTitle: packet.propertyName as string ?? 'Elevator Job',
    propertyName: packet.propertyName as string ?? '',
    propertyAddress: packet.propertyAddress as string ?? '',
    scheduledDate: formatDate(scheduledStart, 'EEEE, MMMM d, yyyy'),
    scheduledTimeRange: `${formatDate(scheduledStart, 'h:mm a')}${scheduledEnd ? ` – ${formatDate(scheduledEnd, 'h:mm a')}` : ''}`,
    contactName: packet.contactName as string ?? '',
    contactPhone: packet.contactPhone as string ?? '',
    buildingAccessNotes: packet.buildingAccessNotes as string ?? '',
    requiredScope: packet.requiredScope as string ?? '',
    violationItems: (packet.violationItems as string[]) ?? [],
    specialInstructions: packet.specialInstructions as string ?? '',
    workOrderUrl: `${APP_URL}/technician/${workOrderId}`,
  }));

  return sendEmail({
    to,
    subject: `Dispatch: ${formatDate(scheduledStart, 'MMM d')} — ${packet.propertyName ?? 'Job'}`,
    html,
    jobId,
  });
}

export async function sendInviteEmail({
  to, inviteeName, accountName, inviteUrl,
}: {
  to: string;
  inviteeName: string;
  accountName: string;
  inviteUrl: string;
}) {
  const { InviteEmail } = await import('@/emails/InviteEmail');
  const html = await render(InviteEmail({ inviteeName, accountName, inviteUrl }));

  return sendEmail({
    to,
    subject: `You're invited to Elev8 Comply — ${accountName}`,
    html,
  });
}
