import 'server-only';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { db } from '@/server/db/client';
import { users } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import type { UserRole, SessionUser } from '@/types/auth';

export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  // Read role + accountId from the users table — single source of truth
  // (user_metadata in JWTs can be stale or missing for admin accounts)
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { role: true, accountId: true, fullName: true },
  });

  // If the user row is missing from the DB (e.g. seed didn't run or UUID mismatch),
  // fall back to JWT metadata so the session isn't bricked.
  // Run scripts/fix-demo-user.mjs to repair the DB state.
  return {
    id: user.id,
    email: user.email!,
    role: ((dbUser?.role ?? user.user_metadata?.role) as UserRole) ?? 'client',
    fullName: dbUser?.fullName || (user.user_metadata?.full_name ?? ''),
    accountId: dbUser?.accountId ?? (user.user_metadata?.account_id as string | null) ?? null,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export async function requireRole(...roles: UserRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect('/dashboard');
  return user;
}

export function isInternalStaff(role: UserRole): boolean {
  return ['admin', 'reviewer', 'dispatcher'].includes(role);
}

export function canManageJobs(role: UserRole): boolean {
  return ['admin', 'reviewer'].includes(role);
}

export function canDispatch(role: UserRole): boolean {
  return ['admin', 'dispatcher'].includes(role);
}

export function isAdmin(role: UserRole): boolean {
  return role === 'admin';
}
