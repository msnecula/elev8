import { NextResponse } from 'next/server';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { users } from '@/drizzle/schema';
import { verifyEmailChangeToken } from '@/lib/emailChangeToken';
import { applyEmailChange, emailChangeSecret } from '@/server/services/userAccounts';

// Submitted by the "Confirm" button on /confirm-email (a POST, so mail-scanner
// prefetches can't trigger it). Works without being signed in: holding the link
// sent to the new address is the proof.
export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const done = (status: string) => NextResponse.redirect(`${origin}/confirm-email?status=${status}`, 303);

  const token = (await request.formData()).get('token');
  if (typeof token !== 'string') return done('invalid');

  const result = verifyEmailChangeToken(token, emailChangeSecret());
  if (!result.ok) return done(result.reason === 'expired' ? 'expired' : 'invalid');
  const { userId, fromEmail, toEmail } = result.claims;

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { email: true, isActive: true },
  });
  if (!user || !user.isActive) return done('invalid');
  if (user.email.toLowerCase() === toEmail) return done('done');
  // Only valid while the account still has the address it was issued for.
  if (user.email.toLowerCase() !== fromEmail.toLowerCase()) return done('invalid');

  const taken = await db.query.users.findFirst({
    where: and(eq(users.email, toEmail), ne(users.id, userId)),
    columns: { id: true },
  });
  if (taken) return done('taken');

  try {
    await applyEmailChange(userId, toEmail);
  } catch (err) {
    console.error('[account] email change failed', err);
    return done('failed');
  }
  return done('done');
}
