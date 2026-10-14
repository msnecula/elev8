import type { Metadata } from 'next';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { accounts } from '@/drizzle/schema';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { USER_ROLES } from '@/lib/validation/users';
import type { UserRole } from '@/types/auth';
import { ArrowLeft } from 'lucide-react';
import UserForm from '../UserForm';

export const metadata: Metadata = { title: 'Add User' };

export default async function NewUserPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; from?: string }>;
}) {
  await requireRole('admin');
  const { role, from } = await searchParams;
  const defaultRole = USER_ROLES.includes(role as UserRole) ? (role as UserRole) : undefined;
  const back = from === 'technicians'
    ? { href: '/settings/technicians', label: 'Back to Technician Licenses' }
    : { href: '/settings', label: 'Back to Settings' };

  const allAccounts = await db
    .select({ id: accounts.id, name: accounts.name })
    .from(accounts)
    .where(eq(accounts.isActive, true))
    .orderBy(accounts.name);

  return (
    <div className="space-y-6">
      <Link href={back.href} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        {back.label}
      </Link>
      <PageHeader
        title="Add User"
        description="They'll get an email invitation with a link to set their password and sign in."
      />
      <Card>
        <CardContent className="pt-6">
          <UserForm
            accounts={allAccounts}
            defaultRole={defaultRole}
            returnTo={from === 'technicians' ? '/settings/technicians' : undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}
