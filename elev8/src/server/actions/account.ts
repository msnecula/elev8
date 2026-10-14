'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, ne } from 'drizzle-orm';
import { requireRole, requireUser } from '@/lib/auth';
import { db } from '@/server/db/client';
import { users, technicians } from '@/drizzle/schema';
import {
  ownProfileSchema,
  ownLicensesSchema,
  emailChangeSchema,
  type OwnProfileInput,
  type OwnLicensesInput,
  type EmailChangeInput,
} from '@/lib/validation/users';
import { createEmailChangeToken } from '@/lib/emailChangeToken';
import { APP_URL } from '@/lib/constants';
import { emailChangeSecret, updateAuthUser, upsertTechnicianProfile } from '@/server/services/userAccounts';
import { sendEmailChangeEmails } from '@/server/services/notificationService';
import type { ActionResult } from '@/types/api';

// Name and phone. Role stays admin-only; email changes go through requestEmailChange.
export async function updateMyProfile(input: OwnProfileInput): Promise<ActionResult<null>> {
  const user = await requireUser();

  const parsed = ownProfileSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const { fullName, phone } = parsed.data;

  await db
    .update(users)
    .set({ fullName, phone: phone ?? null, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  await db
    .update(technicians)
    .set({ fullName, phone: phone ?? null, updatedAt: new Date() })
    .where(eq(technicians.userId, user.id));

  try {
    await updateAuthUser(user.id, { metadata: { full_name: fullName } });
  } catch {
    // The users table is the source of truth for names; the auth copy is cosmetic.
  }

  revalidatePath('/', 'layout');
  return { success: true, data: null };
}

// Emails a confirmation link to the new address; nothing changes until it's clicked.
export async function requestEmailChange(input: EmailChangeInput): Promise<ActionResult<null>> {
  const user = await requireUser();

  const parsed = emailChangeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid email' };
  const toEmail = parsed.data.newEmail;

  const row = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { email: true, fullName: true },
  });
  if (!row) return { success: false, error: 'Your user profile is missing — ask an admin to fix it' };
  if (toEmail === row.email.toLowerCase()) return { success: false, error: 'That is already your email' };

  const taken = await db.query.users.findFirst({
    where: and(eq(users.email, toEmail), ne(users.id, user.id)),
    columns: { id: true },
  });
  if (taken) return { success: false, error: 'Another account already uses that email' };

  const token = createEmailChangeToken(
    { userId: user.id, fromEmail: row.email, toEmail },
    emailChangeSecret(),
  );
  const confirmUrl = new URL('/confirm-email', APP_URL);
  confirmUrl.searchParams.set('token', token);

  const sent = await sendEmailChangeEmails({
    userId: user.id,
    name: row.fullName,
    fromEmail: row.email,
    toEmail,
    confirmUrl: confirmUrl.toString(),
  });
  if (!sent.success) return { success: false, error: 'The confirmation email could not be sent. Please try again.' };

  return { success: true, data: null };
}

export async function updateMyLicenses(input: OwnLicensesInput): Promise<ActionResult<null>> {
  const user = await requireRole('technician');

  const parsed = ownLicensesSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const row = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { fullName: true, email: true, phone: true, isActive: true },
  });
  if (!row) return { success: false, error: 'Your user profile is missing — ask an admin to fix it' };

  await upsertTechnicianProfile(user.id, {
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    isActive: row.isActive,
    cccmLicense: parsed.data.cccmLicense ?? null,
    qeiNumber: parsed.data.qeiNumber ?? null,
  });

  revalidatePath('/account');
  revalidatePath('/settings/technicians');
  return { success: true, data: null };
}
