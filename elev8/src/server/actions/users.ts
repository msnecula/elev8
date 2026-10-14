'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, ne } from 'drizzle-orm';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { users, accounts, technicians } from '@/drizzle/schema';
import { adminUserSchema, type AdminUserInput } from '@/lib/validation/users';
import {
  createPasswordSetupLink,
  updateAuthUser,
  upsertTechnicianProfile,
  deactivateTechnicianProfile,
} from '@/server/services/userAccounts';
import { sendInviteEmail } from '@/server/services/notificationService';
import type { ActionResult } from '@/types/api';

function revalidateUserPages(userId?: string) {
  revalidatePath('/settings');
  revalidatePath('/settings/technicians');
  if (userId) revalidatePath(`/settings/users/${userId}`);
}

async function accountName(accountId: string | null): Promise<string | undefined> {
  if (!accountId) return undefined;
  const account = await db.query.accounts.findFirst({
    where: eq(accounts.id, accountId),
    columns: { name: true },
  });
  return account?.name;
}

function firstIssue(error: { issues: Array<{ message: string }> }): string {
  return error.issues[0]?.message ?? 'Invalid input';
}

// ── Create a user and email them an invitation ────────────────────────────────

export async function createUser(
  input: AdminUserInput,
): Promise<ActionResult<{ userId: string; inviteSent: boolean }>> {
  await requireRole('admin');

  const parsed = adminUserSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };
  const v = parsed.data;

  const accountId = v.role === 'client' ? v.accountId ?? null : null;
  const company = await accountName(accountId);
  if (accountId && !company) return { success: false, error: 'Company account not found' };

  const existing = await db.query.users.findFirst({
    where: eq(users.email, v.email),
    columns: { id: true },
  });
  if (existing) return { success: false, error: 'A user with this email already exists' };

  let link: { url: string; authUserId: string };
  try {
    link = await createPasswordSetupLink(v.email, 'invite', {
      full_name: v.fullName,
      role: v.role,
      account_id: accountId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not create the user';
    return {
      success: false,
      error: /already|registered|exists/i.test(message)
        ? 'A user with this email already exists'
        : message,
    };
  }

  const userId = link.authUserId;
  const profile = {
    email: v.email,
    fullName: v.fullName,
    role: v.role,
    accountId,
    phone: v.phone ?? null,
    isActive: true,
  };
  await db
    .insert(users)
    .values({ id: userId, ...profile })
    .onConflictDoUpdate({ target: users.id, set: { ...profile, updatedAt: new Date() } });

  if (v.role === 'technician') {
    await upsertTechnicianProfile(userId, {
      fullName: v.fullName,
      email: v.email,
      phone: v.phone ?? null,
      isActive: true,
      cccmLicense: v.cccmLicense ?? null,
      qeiNumber: v.qeiNumber ?? null,
    });
  }

  const sent = await sendInviteEmail({
    to: v.email,
    inviteeName: v.fullName,
    role: v.role,
    accountName: company,
    inviteUrl: link.url,
    userId,
  });

  revalidateUserPages();
  return { success: true, data: { userId, inviteSent: sent.success } };
}

// ── Edit any user's profile, email, role and licenses ─────────────────────────

export async function updateUser(
  userId: string,
  input: AdminUserInput,
): Promise<ActionResult<null>> {
  const admin = await requireRole('admin');

  const parsed = adminUserSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };
  const v = parsed.data;

  const existing = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { email: true, role: true, isActive: true },
  });
  if (!existing) return { success: false, error: 'User not found' };

  if (userId === admin.id && v.role !== 'admin') {
    return { success: false, error: "You can't remove your own admin role" };
  }

  const accountId = v.role === 'client' ? v.accountId ?? null : null;
  if (accountId && !(await accountName(accountId))) {
    return { success: false, error: 'Company account not found' };
  }

  const emailChanged = v.email !== existing.email.toLowerCase();
  if (emailChanged) {
    const taken = await db.query.users.findFirst({
      where: and(eq(users.email, v.email), ne(users.id, userId)),
      columns: { id: true },
    });
    if (taken) return { success: false, error: 'Another user already has this email' };
  }

  try {
    await updateAuthUser(userId, {
      email: emailChanged ? v.email : undefined,
      metadata: { full_name: v.fullName, role: v.role, account_id: accountId },
    });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not update login details' };
  }

  await db
    .update(users)
    .set({
      email: v.email,
      fullName: v.fullName,
      role: v.role,
      accountId,
      phone: v.phone ?? null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  if (v.role === 'technician') {
    await upsertTechnicianProfile(userId, {
      fullName: v.fullName,
      email: v.email,
      phone: v.phone ?? null,
      isActive: existing.isActive,
      cccmLicense: v.cccmLicense ?? null,
      qeiNumber: v.qeiNumber ?? null,
    });
  } else if (existing.role === 'technician') {
    await deactivateTechnicianProfile(userId);
  }

  revalidateUserPages(userId);
  return { success: true, data: null };
}

// ── Deactivate / reactivate (users are never deleted: jobs and forms keep their name) ──

export async function setUserActive(
  userId: string,
  active: boolean,
): Promise<ActionResult<null>> {
  const admin = await requireRole('admin');
  if (userId === admin.id && !active) {
    return { success: false, error: "You can't deactivate your own account" };
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { role: true },
  });
  if (!existing) return { success: false, error: 'User not found' };

  try {
    await updateAuthUser(userId, { active });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not update sign-in access' };
  }

  await db.update(users).set({ isActive: active, updatedAt: new Date() }).where(eq(users.id, userId));
  if (existing.role === 'technician') {
    await db
      .update(technicians)
      .set({ isActive: active, updatedAt: new Date() })
      .where(eq(technicians.userId, userId));
  }

  revalidateUserPages(userId);
  return { success: true, data: null };
}

// ── Email a fresh "set your password" link ────────────────────────────────────

export async function resendInvite(userId: string): Promise<ActionResult<null>> {
  await requireRole('admin');

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { email: true, fullName: true, role: true, accountId: true, isActive: true },
  });
  if (!user) return { success: false, error: 'User not found' };
  if (!user.isActive) return { success: false, error: 'Reactivate this user before sending an invite' };

  let url: string;
  try {
    ({ url } = await createPasswordSetupLink(user.email, 'recovery'));
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not create a sign-in link' };
  }

  const sent = await sendInviteEmail({
    to: user.email,
    inviteeName: user.fullName,
    role: user.role,
    accountName: await accountName(user.accountId),
    inviteUrl: url,
    isReminder: true,
    userId,
  });
  if (!sent.success) return { success: false, error: sent.error ?? 'The email could not be sent' };

  return { success: true, data: null };
}
