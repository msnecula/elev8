'use server';

import { and, eq, gt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { notifications, users } from '@/drizzle/schema';
import { createPasswordSetupLink } from '@/server/services/userAccounts';
import { PASSWORD_RESET_SUBJECT, sendPasswordResetEmail } from '@/server/services/notificationService';
import type { ActionResult } from '@/types/api';

const RESEND_COOLDOWN_MS = 60_000;

const schema = z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email') });

/**
 * "Forgot password": emails a one-time reset link through Resend (same path as
 * invites, so it doesn't depend on Supabase's mailer). The result is the same
 * whether or not the address has an account, so this can't be used to find out
 * who is registered.
 */
export async function requestPasswordReset(input: { email: string }): Promise<ActionResult<null>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid email' };
  const { email } = parsed.data;

  const user = await db.query.users.findFirst({
    where: sql`lower(${users.email}) = ${email}`,
    columns: { id: true, email: true, fullName: true, isActive: true },
  });
  // Deactivated accounts can't sign in anyway; quietly do nothing.
  if (!user || !user.isActive) return { success: true, data: null };

  // At most one reset email a minute per account, so the form can't be used to flood an inbox.
  const recent = await db.query.notifications.findFirst({
    where: and(
      eq(notifications.userId, user.id),
      eq(notifications.subject, PASSWORD_RESET_SUBJECT),
      gt(notifications.createdAt, new Date(Date.now() - RESEND_COOLDOWN_MS)),
    ),
    columns: { id: true },
  });
  if (recent) return { success: true, data: null };

  try {
    const { url } = await createPasswordSetupLink(user.email, 'recovery');
    await sendPasswordResetEmail({ to: user.email, name: user.fullName, resetUrl: url, userId: user.id });
  } catch (err) {
    console.error('[auth] password reset email failed', err);
  }
  return { success: true, data: null };
}
