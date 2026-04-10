import { NextResponse } from 'next/server';
import { db } from '@/server/db/client';
import { notifications } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  // Verify shared secret
  const signature = request.headers.get('x-twilio-signature') ?? '';
  if (process.env.NODE_ENV === 'production' && !signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  let body: Record<string, string> = {};
  try {
    const formData = await request.formData();
    body = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, String(v)]));
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const messageStatus = body['MessageStatus'];
  const to = body['To'];
  const errorCode = body['ErrorCode'];
  const errorMessage = body['ErrorMessage'];

  const statusMap: Record<string, 'sent' | 'failed'> = {
    delivered: 'sent', sent: 'sent', failed: 'failed', undelivered: 'failed',
  };

  const notifStatus = statusMap[messageStatus];
  if (notifStatus && to) {
    await db.update(notifications)
      .set({
        status: notifStatus,
        sentAt: notifStatus === 'sent' ? new Date() : undefined,
        error: notifStatus === 'failed' ? `${errorCode}: ${errorMessage}` : null,
      } as never)
      .where(eq(notifications.channel, to));
  }

  return NextResponse.json({ received: true });
}
