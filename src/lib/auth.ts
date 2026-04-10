import 'server-only';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import type { UserRole, SessionUser } from '@/types/auth';

export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  return {
    id: user.id,
    email: user.email!,
    role: (user.user_metadata?.role as UserRole) ?? 'client',
    fullName: user.user_metadata?.full_name ?? '',
    accountId: user.user_metadata?.account_id ?? null,
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
