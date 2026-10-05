import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { workOrders, jobs, accounts, technicians } from '@/drizzle/schema';
import { eq, desc } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { formatDate } from '@/lib/utils';
import { ClipboardList, ChevronRight } from 'lucide-react';

export const metadata: Metadata = { title: 'Work Orders' };

export default async function WorkOrdersPage() {
  await requireRole('admin', 'dispatcher');

  const rows = await db
    .select({
      id: workOrders.id,
      status: workOrders.status,
      scheduledStart: workOrders.scheduledStart,
      fortyEightHourStatus: workOrders.fortyEightHourStatus,
      region: workOrders.region,
      requiredSkillTag: workOrders.requiredSkillTag,
      jobTitle: jobs.title,
      jobUrgency: jobs.urgency,
      accountName: accounts.name,
      technicianName: technicians.fullName,
      createdAt: workOrders.createdAt,
    })
    .from(workOrders)
    .leftJoin(jobs, eq(workOrders.jobId, jobs.id))
    .leftJoin(accounts, eq(jobs.accountId, accounts.id))
    .leftJoin(technicians, eq(workOrders.assignedTechnicianId, technicians.id))
    .orderBy(desc(workOrders.createdAt))
    .limit(200);

  return (
    <div>
      <PageHeader title="Work Orders" description="All dispatch work orders" />

      {rows.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No work orders yet" description="Work orders are created from approved, scheduled jobs." />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                {['Job', 'Status', 'Technician', 'Scheduled', '48-Hr', 'Region', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((wo) => (
                <tr key={wo.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{wo.jobTitle ?? 'Untitled'}</div>
                    <div className="text-xs text-muted-foreground">{wo.accountName}</div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge variant="work_order_status" value={wo.status} /></td>
                  <td className="px-4 py-3 text-sm">{wo.technicianName ?? <span className="text-amber-600 font-medium text-xs">Unassigned</span>}</td>
                  <td className="px-4 py-3 text-xs">{wo.scheduledStart ? formatDate(wo.scheduledStart) : '—'}</td>
                  <td className="px-4 py-3"><StatusBadge variant="forty_eight_hour" value={wo.fortyEightHourStatus} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{wo.region ?? '—'}</td>
                  <td className="px-4 py-2 pr-4">
                    <Link href={`/work-orders/${wo.id}`} className="flex items-center justify-end text-muted-foreground hover:text-foreground">
                      <ChevronRight className="h-4 w-4" />
                    </Link>
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
