import 'server-only';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { db } from '@/server/db/client';
import { users } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import type { UserRole, SessionUser } from '@/types/auth';

type SessionState =
  | { status: 'signed-in'; user: SessionUser }
  | { status: 'signed-out' }
  | { status: 'deactivated' };

async function loadSession(): Promise<SessionState> {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { status: 'signed-out' };

  // Read role + accountId from the users table — single source of truth
  // (user_metadata in JWTs can be stale or missing for admin accounts)
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { role: true, accountId: true, fullName: true, isActive: true },
  });

  // Deactivated by an admin: an existing session no longer counts. (New sign-ins
  // and token refreshes are already blocked by the Supabase ban set in setUserActive.)
  if (dbUser && !dbUser.isActive) return { status: 'deactivated' };

  // If the user row is missing from the DB (e.g. seed didn't run or UUID mismatch),
  // fall back to JWT metadata so the session isn't bricked.
  // Run scripts/fix-demo-user.mjs to repair the DB state.
  return {
    status: 'signed-in',
    user: {
      id: user.id,
      email: user.email!,
      role: ((dbUser?.role ?? user.user_metadata?.role) as UserRole) ?? 'client',
      fullName: dbUser?.fullName || (user.user_metadata?.full_name ?? ''),
      accountId: dbUser?.accountId ?? (user.user_metadata?.account_id as string | null) ?? null,
    },
  };
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await loadSession();
  return session.status === 'signed-in' ? session.user : null;
}

export async function requireUser(): Promise<SessionUser> {
  const session = await loadSession();
  // The login page signs the leftover session out when it sees this error.
  if (session.status === 'deactivated') redirect('/login?error=account_deactivated');
  if (session.status === 'signed-out') redirect('/login');
  return session.user;
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
