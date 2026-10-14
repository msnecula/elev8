import 'server-only';
import { db } from '@/server/db/client';
import { technicians } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { createServiceClient } from '@/lib/supabase/server';
import { APP_URL } from '@/lib/constants';
import type { EmailLinkType } from '@/lib/validation/users';
import type { UserRole } from '@/types/auth';

// Long enough to be permanent; Supabase has no "ban forever" value.
const DEACTIVATED_BAN_DURATION = '876000h';

/** The shared client or a transaction, so callers can group writes. */
export type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Creates a one-time sign-in link that ends on /reset-password, where the person
 * sets their password. 'invite' also creates the Supabase Auth user (without
 * Supabase sending its own email); 'recovery' is for users who already exist.
 * We email the link ourselves so it goes through Resend with our template.
 */
export async function createPasswordSetupLink(
  email: string,
  type: EmailLinkType,
  metadata?: { full_name: string; role: UserRole; account_id: string | null },
): Promise<{ url: string; authUserId: string }> {
  const supabase = createServiceClient();
  const { data, error } = type === 'invite'
    ? await supabase.auth.admin.generateLink({ type: 'invite', email, options: { data: metadata } })
    : await supabase.auth.admin.generateLink({ type: 'recovery', email });

  if (error || !data.properties?.hashed_token) {
    throw new Error(error?.message ?? 'Could not create a sign-in link');
  }

  // Lands on /invite, whose Continue button spends the token (see that page for why).
  const url = new URL('/invite', APP_URL);
  url.searchParams.set('token_hash', data.properties.hashed_token);
  url.searchParams.set('type', type);
  return { url: url.toString(), authUserId: data.user.id };
}

/** Keeps the Supabase Auth record (used for login and route guards) in step with our users row. */
export async function updateAuthUser(
  userId: string,
  changes: {
    email?: string;
    metadata?: Partial<{ full_name: string; role: UserRole; account_id: string | null }>;
    active?: boolean;
  },
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ...(changes.email ? { email: changes.email, email_confirm: true } : {}),
    ...(changes.metadata ? { user_metadata: changes.metadata } : {}),
    ...(changes.active === undefined
      ? {}
      : { ban_duration: changes.active ? 'none' : DEACTIVATED_BAN_DURATION }),
  });
  if (error) throw new Error(error.message);
}

/** Undo a just-created Supabase Auth user when the rest of "Add User" fails. */
export async function deleteAuthUser(userId: string): Promise<void> {
  const { error } = await createServiceClient().auth.admin.deleteUser(userId);
  if (error) console.error('[users] Could not roll back auth user', userId, error.message);
}

/**
 * Creates or updates the technicians row for a user. Work orders reference this
 * row, so it is never deleted — only marked inactive.
 */
export async function upsertTechnicianProfile(
  userId: string,
  profile: {
    fullName: string;
    email: string;
    phone: string | null;
    isActive: boolean;
    cccmLicense?: string | null;
    qeiNumber?: string | null;
  },
  executor: DbExecutor = db,
): Promise<void> {
  const values = { ...profile, updatedAt: new Date() };
  await executor
    .insert(technicians)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: technicians.userId, set: values });
}

export async function deactivateTechnicianProfile(
  userId: string,
  executor: DbExecutor = db,
): Promise<void> {
  await executor
    .update(technicians)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(technicians.userId, userId));
}
