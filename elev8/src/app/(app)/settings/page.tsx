import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { accounts, users } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ROLE_LABELS } from '@/lib/constants';
import InviteClientForm from './InviteClientForm';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileText, ExternalLink } from 'lucide-react';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const currentUser = await requireRole('admin');

  const [allAccounts, clientUsers] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts)
      .where(eq(accounts.isActive, true))
      .orderBy(accounts.name),
    db.select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      isActive: users.isActive,
      accountId: users.accountId,
    })
    .from(users)
    .orderBy(users.role, users.fullName),
  ]);

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

      {/* Invite client */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite Client</CardTitle>
          <CardDescription>
            Create a client portal account and send an invitation email with a magic link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteClientForm accounts={allAccounts} />
        </CardContent>
      </Card>

      {/* All users */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Users</CardTitle>
          <CardDescription>{clientUsers.length} users in the system</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                {['Name', 'Email', 'Role', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clientUsers.map(u => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{u.fullName}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
