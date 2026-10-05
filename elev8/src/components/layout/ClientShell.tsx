'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Briefcase, Upload, LogOut, Home } from 'lucide-react';

const CLIENT_NAV = [
  { label: 'Overview', href: '/client', icon: Home, exact: true },
  { label: 'My Jobs', href: '/client/jobs', icon: Briefcase },
  { label: 'Upload Notice', href: '/client/notices/new', icon: Upload },
];

interface ClientShellProps {
  children: React.ReactNode;
  fullName: string;
  email: string;
  accountName?: string;
}

export default function ClientShell({
  children,
  fullName,
  email,
  accountName,
}: ClientShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top navigation bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7M3 7l9-4 9 4" />
                </svg>
              </div>
              <div>
                <span className="font-bold text-slate-800">{APP_NAME}</span>
                {accountName && (
                  <span className="ml-2 text-xs text-slate-500 hidden sm:inline">
                    — {accountName}
                  </span>
                )}
              </div>
            </div>

            {/* Nav links */}
            <nav className="hidden sm:flex items-center gap-1">
              {CLIENT_NAV.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* User + sign out */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600 hidden sm:block">{fullName}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-slate-500 hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Sign out</span>
              </Button>
            </div>
          </div>

          {/* Mobile nav */}
          <nav className="flex sm:hidden gap-1 pb-2 overflow-x-auto">
            {CLIENT_NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap',
                    active ? 'bg-blue-50 text-blue-700' : 'text-slate-600',
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
