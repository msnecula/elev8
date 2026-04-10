'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/constants';
import type { UserRole } from '@/types/auth';
import {
  FileText, Briefcase, Truck, ClipboardList,
  Settings, LogOut, Bell, Calendar,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
  matchPrefix?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Notices', href: '/notices', icon: FileText, roles: ['admin', 'reviewer', 'dispatcher'], matchPrefix: true },
  { label: 'Jobs', href: '/jobs', icon: Briefcase, roles: ['admin', 'reviewer', 'dispatcher'], matchPrefix: true },
  { label: 'Dispatch', href: '/dispatch', icon: Truck, roles: ['admin', 'dispatcher'] },
  { label: 'Work Orders', href: '/work-orders', icon: ClipboardList, roles: ['admin', 'dispatcher'], matchPrefix: true },
  { label: 'My Work', href: '/technician', icon: ClipboardList, roles: ['technician'], matchPrefix: true },
  { label: 'Settings', href: '/settings', icon: Settings, roles: ['admin'] },
];

interface SidebarProps {
  role: UserRole;
  fullName: string;
  email: string;
  alertCount?: number;
}

export default function Sidebar({ role, fullName, email, alertCount = 0 }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(role));

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  function isActive(item: NavItem) {
    if (item.matchPrefix) return pathname.startsWith(item.href);
    return pathname === item.href;
  }

  const initials = fullName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-4">
        <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
          <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7M3 7l9-4 9 4M3 7h18" />
          </svg>
        </div>
        <span className="font-bold text-foreground tracking-tight">{APP_NAME}</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {visibleItems.map(item => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <item.icon className={cn('h-4 w-4 shrink-0', active ? 'text-blue-600' : '')} />
              <span className="flex-1">{item.label}</span>
              {item.label === 'Notices' && alertCount > 0 && (
                <Badge className="bg-red-500 text-white text-xs h-5 px-1.5 min-w-[20px] flex items-center justify-center">
                  {alertCount > 99 ? '99+' : alertCount}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-border p-3 space-y-1">
        <div className="flex items-center gap-3 rounded-md px-3 py-2">
          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-blue-700">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{fullName}</p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
