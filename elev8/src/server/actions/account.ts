'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { requireRole, requireUser } from '@/lib/auth';
import { db } from '@/server/db/client';
import { users, technicians } from '@/drizzle/schema';
import {
  ownProfileSchema,
  ownLicensesSchema,
  type OwnProfileInput,
  type OwnLicensesInput,
} from '@/lib/validation/users';
import { updateAuthUser, upsertTechnicianProfile } from '@/server/services/userAccounts';
import type { ActionResult } from '@/types/api';

// Email and role are admin-only; users change their name and phone here.
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
