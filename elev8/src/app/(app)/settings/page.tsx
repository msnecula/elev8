import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { accounts, users } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ROLE_LABELS } from '@/lib/constants';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileText, ExternalLink, ShieldCheck, UserPlus, ChevronRight } from 'lucide-react';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  await requireRole('admin');

  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      isActive: users.isActive,
      accountName: accounts.name,
    })
    .from(users)
    .leftJoin(accounts, eq(users.accountId, accounts.id))
    .orderBy(users.role, users.fullName);

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" description="Manage users and system configuration" />

      {/* Form Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Official Cal/OSHA Form Templates
            </span>
            <Button asChild size="sm" variant="outline">
              <Link href="/settings/forms">
                Manage Form Templates
                <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
              </Link>
            </Button>
          </CardTitle>
          <CardDescription>
            Upload official PDFs from dir.ca.gov so the system can auto-fill EU-632, EU-787, DOSH-100, and other Cal/OSHA forms.
            When the state releases a new form version, upload the updated PDF here.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Technician Licenses */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Technician Licenses
            </span>
            <Button asChild size="sm" variant="outline">
              <Link href="/settings/technicians">
                Manage Licenses
                <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
              </Link>
            </Button>
          </CardTitle>
          <CardDescription>
            Each technician&apos;s CCCM license and QEI numbers. These auto-populate on Cal/OSHA forms
            based on who is assigned to the job.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* All users */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>All Users</span>
            <Button asChild size="sm">
              <Link href="/settings/users/new">
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                Add User
              </Link>
            </Button>
          </CardTitle>
          <CardDescription>
            {allUsers.length} users in the system. Click a user to edit their profile, role or access.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  {['Name', 'Email', 'Role', 'Status', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allUsers.map(u => {
                  const href = `/settings/users/${u.id}`;
                  return (
                    <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">
                        <Link href={href} className="hover:underline">{u.fullName}</Link>
                        {u.role === 'client' && u.accountName && (
                          <p className="text-xs text-muted-foreground font-normal">{u.accountName}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-xs capitalize">
                          {ROLE_LABELS[u.role]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${u.isActive ? 'text-green-600' : 'text-red-500'}`}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={href}
                          aria-label={`Edit ${u.fullName}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                        >
                          Edit
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
