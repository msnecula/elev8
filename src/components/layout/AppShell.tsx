import Sidebar from './Sidebar';
import Topbar from './Topbar';
import type { UserRole } from '@/types/auth';

interface AppShellProps {
  children: React.ReactNode;
  role: UserRole;
  fullName: string;
  email: string;
  alertCount?: number;
  pageTitle?: string;
}

export default function AppShell({
  children,
  role,
  fullName,
  email,
  alertCount,
  pageTitle,
}: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar role={role} fullName={fullName} email={email} alertCount={alertCount} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar role={role} pageTitle={pageTitle} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
