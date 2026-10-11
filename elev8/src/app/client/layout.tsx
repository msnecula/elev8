import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { db } from '@/server/db/client';
import { accounts, users } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import ClientShell from '@/components/layout/ClientShell';

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  // Non-client users should not be in the client portal
  if (user.role !== 'client') redirect('/dashboard');

  // Fetch account name + SMS consent status in one query set
  const [accountRow, userRow] = await Promise.all([
    user.accountId
      ? db.query.accounts.findFirst({
          where: eq(accounts.id, user.accountId),
          columns: { name: true },
        })
      : Promise.resolve(undefined),
    db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: { smsConsentGiven: true, phone: true },
    }),
  ]);

  return (
    <ClientShell
      fullName={user.fullName || user.email}
      email={user.email}
      accountName={accountRow?.name}
      smsConsentGiven={userRow?.smsConsentGiven ?? false}
      phone={userRow?.phone ?? undefined}
    >
      {children}
    </ClientShell>
  );
}
