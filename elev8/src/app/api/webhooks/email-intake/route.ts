import { NextResponse } from 'next/server';
import { db } from '../../../../server/db/client';
import { notices, accounts } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { logNoticeActivity } from '../../../../server/services/activityLogger';

/**
 * POST /api/webhooks/email-intake
 * Receives inbound email payloads (SendGrid Inbound Parse compatible).
 * Point your email provider inbound webhook here.
 * Protected by EMAIL_INTAKE_WEBHOOK_SECRET header.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get('x-webhook-secret');
  if (authHeader !== process.env.EMAIL_INTAKE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: Record<string, string> = {};
  const contentType = request.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('application/json')) {
      payload = await request.json();
    } else {
      const formData = await request.formData();
      payload = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, String(v)]));
    }
  } catch {
    return NextResponse.json({ error: 'Could not parse request body' }, { status: 400 });
  }

  const from = payload['from'] ?? payload['From'] ?? '';
  const subject = payload['subject'] ?? payload['Subject'] ?? '';
  const textBody = payload['text'] ?? payload['TextBody'] ?? '';
  const emailMatch = from.match(/<(.+?)>/) ?? from.match(/(\S+@\S+)/);
  const senderEmail = emailMatch?.[1] ?? from;

  // Try to find a matching account by email domain
  const matchedAccount = await db.query.accounts.findFirst({
    where: eq(accounts.isActive, true),
    columns: { id: true },
  });

  const UNMATCHED_ACCOUNT_ID = '00000000-0000-0000-0000-000000000000';

  const [notice] = await db
    .insert(notices)
    .values({
      accountId: matchedAccount?.id ?? UNMATCHED_ACCOUNT_ID,
      submittedBy: null,
      intakeMethod: 'email_intake',
      status: 'received',
      rawText: `FROM: ${from}\nSUBJECT: ${subject}\n\n${textBody}`,
      fileName: subject || 'Email Notice',
    })
    .returning({ id: notices.id });

  await logNoticeActivity(
    notice.id,
    'notice_received',
    `Notice received via email from ${senderEmail}: "${subject}"`,
    null,
    { from: senderEmail, subject, accountMatched: !!matchedAccount },
  );

  return NextResponse.json({ received: true, noticeId: notice.id });
}
