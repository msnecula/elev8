import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { accounts, technicians, users } from '@/drizzle/schema';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ROLE_LABELS } from '@/lib/constants';
import { ArrowLeft } from 'lucide-react';
import UserForm from '../UserForm';
import UserAccessActions from '../UserAccessActions';

export const metadata: Metadata = { title: 'Edit User' };

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireRole('admin');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [user, tech, allAccounts] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, id),
      columns: {
        id: true, fullName: true, email: true, role: true, phone: true,
        accountId: true, isActive: true, createdAt: true,
      },
    }),
    db.query.technicians.findFirst({
      where: eq(technicians.userId, id),
      columns: { cccmLicense: true, qeiNumber: true },
    }),
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts)
      .where(eq(accounts.isActive, true))
      .orderBy(accounts.name),
  ]);
  if (!user) notFound();

  const isSelf = user.id === admin.id;

  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>

      <PageHeader title={user.fullName} description={user.email}>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="capitalize">{ROLE_LABELS[user.role]}</Badge>
          <Badge variant={user.isActive ? 'outline' : 'destructive'}>
            {user.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Name, sign-in email, role, phone and license numbers.</CardDescription>
        </CardHeader>
        <CardContent>
          <UserForm
            accounts={allAccounts}
            isSelf={isSelf}
            user={{
              id: user.id,
              fullName: user.fullName,
              email: user.email,
              role: user.role,
              phone: user.phone ?? '',
              accountId: user.accountId ?? '',
              cccmLicense: tech?.cccmLicense ?? '',
              qeiNumber: tech?.qeiNumber ?? '',
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Access</CardTitle>
          <CardDescription>
            {user.isActive
              ? 'Email a new "set your password" link if they never accepted their invite or are locked out.'
              : 'This user is deactivated and cannot sign in. Reactivate them to restore access.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserAccessActions
            userId={user.id}
            fullName={user.fullName}
            email={user.email}
            isActive={user.isActive}
            isSelf={isSelf}
          />
        </CardContent>
      </Card>
    </div>
  );
}
