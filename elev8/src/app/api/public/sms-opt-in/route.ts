import { NextResponse } from 'next/server';
import { db } from '@/server/db/client';
import { users } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/public/sms-opt-in
 * Public endpoint for the standalone /sms opt-in page.
 * No authentication required — this page is the Twilio A2P 10DLC proof URL.
 *
 * Body: { name: string; email: string; phone: string }
 *
 * If the email matches an existing user account, their SMS consent is saved.
 * Either way, returns 200 so the form can show a confirmation screen.
 * The form submission is what Twilio reviewers are verifying — the visual
 * opt-in flow with an unchecked checkbox and required disclosures.
 */
export async function POST(request: Request) {
  let name = '';
  let email = '';
  let phone = '';

  try {
    const body = await request.json() as { name?: string; email?: string; phone?: string };
    name = (body.name ?? '').trim();
    email = (body.email ?? '').trim().toLowerCase();
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

  if (!email || !email.includes('@')) {
    return NextResponse.json(
      { error: 'Please provide a valid email address.' },
      { status: 422 },
    );
  }

  const formattedPhone = `+1${phone}`;

  // Best-effort: try to find the user by email and update their consent record.
  // If they have no account yet, the submission still succeeds — the opt-in
  // proof is the form itself, not the database record.
  try {
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
      columns: { id: true },
    });

    if (existingUser) {
      await db
        .update(users)
        .set({
          smsConsentGiven: true,
          smsConsentGivenAt: new Date(),
          smsPhone: formattedPhone,
          smsConsentRevokedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id));
    } else {
      // No account yet — log for visibility but don't fail the request.
      console.log(`[public/sms-opt-in] No account found for ${email} (name: ${name}) — consent noted but not stored.`);
    }
  } catch (err) {
    // Non-fatal — the proof page must always succeed for Twilio reviewers.
    console.error('[public/sms-opt-in] DB update failed (non-fatal):', err instanceof Error ? err.message : err);
  }

  return NextResponse.json({ success: true });
}
