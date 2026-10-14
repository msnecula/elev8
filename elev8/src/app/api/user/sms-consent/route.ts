import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/server/db/client';
import { users } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { sendSmsWelcome } from '@/server/services/notificationService';

/**
 * POST /api/user/sms-consent
 * Save SMS opt-in for the currently logged-in user.
 * Body: { phone: string }
 *
 * Sets sms_consent_given = true, records the phone number and timestamp,
 * and clears any prior revocation.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let phone = '';
  try {
    const body = await request.json() as { phone?: string };
    phone = (body.phone ?? '').replace(/\D/g, '');
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!phone.match(/^\d{10}$/)) {
    return NextResponse.json(
      { error: 'Please provide a valid 10-digit US mobile number.' },
      { status: 422 },
    );
  }

  const formattedPhone = `+1${phone}`;

  try {
    await db
      .update(users)
      .set({
        smsConsentGiven: true,
        smsConsentGivenAt: new Date(),
        smsPhone: formattedPhone,
        smsConsentRevokedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Confirm the opt-in by text (rate-limited per number); a failed send doesn't undo consent.
    try {
      await sendSmsWelcome({ to: formattedPhone, userId: user.id });
    } catch (err) {
      console.error('[sms-consent] welcome SMS failed (non-fatal):', err instanceof Error ? err.message : err);
    }

    return NextResponse.json({ success: true, phone: formattedPhone });
  } catch (err) {
    console.error('[sms-consent] Failed to save consent:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to save consent' }, { status: 500 });
  }
}

/**
 * DELETE /api/user/sms-consent
 * Revoke SMS consent for the currently logged-in user.
 *
 * Sets sms_consent_given = false and records the revocation timestamp.
 * The phone number is kept for audit purposes.
 */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await db
      .update(users)
      .set({
        smsConsentGiven: false,
        smsConsentRevokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[sms-consent] Failed to revoke consent:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to revoke consent' }, { status: 500 });
  }
}
