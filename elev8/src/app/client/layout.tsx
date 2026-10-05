import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { db } from '@/server/db/client';
import { accounts } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import ClientShell from '@/components/layout/ClientShell';

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  // Non-client users should not be in the client portal
  if (user.role !== 'client') redirect('/dashboard');

  let accountName: string | undefined;
  if (user.accountId) {
    const acct = await db.query.accounts.findFirst({
      where: eq(accounts.id, user.accountId),
      columns: { name: true },
    });
    accountName = acct?.name;
  }

  return (
    <ClientShell
      fullName={user.fullName || user.email}
      email={user.email}
      accountName={accountName}
    >
      {children}
    </ClientShell>
  );
}
