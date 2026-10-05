import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { notices, accounts, properties } from '@/drizzle/schema';
import { desc, eq } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { formatDate, timeAgo } from '@/lib/utils';
import { Plus, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = { title: 'Notices' };

export default async function NoticesPage() {
  await requireRole('admin', 'reviewer', 'dispatcher');

  const allNotices = await db
    .select({
      id: notices.id,
      status: notices.status,
      urgency: notices.urgency,
      fileName: notices.fileName,
      intakeMethod: notices.intakeMethod,
      stateDeadline: notices.stateDeadline,
      createdAt: notices.createdAt,
      accountName: accounts.name,
      propertyName: properties.name,
      propertyCity: properties.city,
    })
    .from(notices)
    .leftJoin(accounts, eq(notices.accountId, accounts.id))
    .leftJoin(properties, eq(notices.propertyId, properties.id))
    .orderBy(desc(notices.createdAt))
    .limit(200);

  const pendingReview = allNotices.filter(
    (n) => n.status === 'parsed' || n.status === 'review_pending',
  ).length;

  return (
    <div>
      <PageHeader
        title="Notices"
        description="All received Order to Comply notices"
      >
        {pendingReview > 0 && (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 border">
            {pendingReview} pending review
          </Badge>
        )}
        <Button asChild size="sm">
          <Link href="/notices/new">
            <Plus className="h-4 w-4 mr-1.5" />
            New Notice
          </Link>
        </Button>
      </PageHeader>

      {allNotices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No notices yet"
          description="Notices will appear here when clients upload them or you add them manually."
          action={
            <Button asChild size="sm">
              <Link href="/notices/new">Add First Notice</Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account / Property</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">File</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Urgency</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">State Deadline</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Received</th>
              </tr>
            </thead>
            <tbody>
              {allNotices.map((notice) => (
                <tr
                  key={notice.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link href={`/notices/${notice.id}`} className="block hover:text-blue-600">
                      <div className="font-medium text-foreground">
                        {notice.accountName ?? '—'}
                      </div>
                      {notice.propertyName && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {notice.propertyName}
                          {notice.propertyCity ? `, ${notice.propertyCity}` : ''}
                        </div>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate max-w-[160px] text-xs">
                        {notice.fileName ?? 'Unnamed'}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground/70 mt-0.5 capitalize">
                      {notice.intakeMethod?.replace('_', ' ')}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge variant="notice_status" value={notice.status} />
                  </td>
                  <td className="px-4 py-3">
                    {notice.urgency ? (
                      <StatusBadge variant="urgency" value={notice.urgency} />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {notice.stateDeadline ? (
                      <span
                        className={
                          new Date(notice.stateDeadline) < new Date()
                            ? 'text-red-600 font-medium text-xs'
                            : 'text-xs'
                        }
                      >
                        {formatDate(notice.stateDeadline)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {timeAgo(notice.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
