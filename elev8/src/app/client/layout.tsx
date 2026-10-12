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

  // Fetch account name separately — never crashes
  const accountRow = user.accountId
    ? await db.query.accounts.findFirst({
        where: eq(accounts.id, user.accountId),
        columns: { name: true },
      })
    : undefined;

  // SMS consent columns require migration 05 (05_sms_consent.sql).
  // Default smsConsentGiven=true so the modal is suppressed if the migration
  // hasn't been run yet — prevents a crash on every client page.
  let smsConsentGiven = true;
  let phone: string | undefined;
  try {
    const userRow = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: { smsConsentGiven: true, phone: true },
    });
    smsConsentGiven = userRow?.smsConsentGiven ?? true;
    phone = userRow?.phone ?? undefined;
  } catch {
    // Migration 05 not yet applied — safe defaults used above
  }

  return (
    <ClientShell
      fullName={user.fullName || user.email}
      email={user.email}
      accountName={accountRow?.name}
      smsConsentGiven={smsConsentGiven}
      phone={phone}
    >
      {children}
    </ClientShell>
  );
}
