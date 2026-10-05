'use client';

import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import type { UserRole } from '@/types/auth';
import { Menu, X } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    const close = () => setSidebarOpen(false);
    window.addEventListener('popstate', close);
    return () => window.removeEventListener('popstate', close);
  }, []);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar — hidden on mobile, always visible on md+ */}
      <div className="hidden md:flex md:shrink-0">
        <Sidebar
          role={role}
          fullName={fullName}
          email={email}
          alertCount={alertCount}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex md:hidden transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="relative flex">
          <Sidebar
            role={role}
            fullName={fullName}
            email={email}
            alertCount={alertCount}
            onNavigate={() => setSidebarOpen(false)}
          />
          {/* Close button */}
          <button
            className="absolute top-4 right-[-48px] flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5 text-gray-700" />
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Mobile topbar with hamburger */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 md:hidden">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted transition-colors"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center">
                <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7M3 7l9-4 9 4M3 7h18" />
                </svg>
              </div>
              <span className="font-bold text-sm text-foreground">{APP_NAME}</span>
            </div>
          </div>
        </header>

        {/* Desktop topbar */}
        <div className="hidden md:block">
          <Topbar role={role} pageTitle={pageTitle} />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 md:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
