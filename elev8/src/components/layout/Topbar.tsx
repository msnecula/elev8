'use client';

import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ROLE_LABELS } from '@/lib/constants';
import type { UserRole } from '@/types/auth';

interface TopbarProps {
  role: UserRole;
  pageTitle?: string;
}

export default function Topbar({ role, pageTitle }: TopbarProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      <div>
        {pageTitle && (
          <h1 className="text-lg font-semibold text-foreground">{pageTitle}</h1>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Badge variant="secondary" className="text-xs font-medium">
          {ROLE_LABELS[role]}
        </Badge>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
