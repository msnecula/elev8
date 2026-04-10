import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import AppShell from '@/components/layout/AppShell';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  // Clients must use the /client portal, not the internal app
  if (user.role === 'client') redirect('/client');

  return (
    <AppShell
      role={user.role}
      fullName={user.fullName || user.email}
      email={user.email}
    >
      {children}
    </AppShell>
  );
}
