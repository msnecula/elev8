import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { workOrders, jobs, accounts, properties, technicians } from '@/drizzle/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { formatDate } from '@/lib/utils';
import { ClipboardList, ChevronRight, MapPin, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = { title: 'My Work' };

export default async function TechnicianPage() {
  const currentUser = await requireRole('technician');

  const tech = await db.query.technicians.findFirst({
    where: eq(technicians.userId, currentUser.id),
    columns: { id: true, fullName: true },
  });

  if (!tech) {
    return (
      <div>
        <PageHeader title="My Work" />
        <EmptyState
          icon={ClipboardList}
          title="Technician profile not set up"
          description="Contact your dispatcher to get your technician profile configured."
        />
      </div>
    );
  }

  // Active work orders
  const active = await db
    .select({
      id: workOrders.id,
      status: workOrders.status,
      scheduledStart: workOrders.scheduledStart,
      scheduledEnd: workOrders.scheduledEnd,
      fortyEightHourStatus: workOrders.fortyEightHourStatus,
      requiredSkillTag: workOrders.requiredSkillTag,
      jobTitle: jobs.title,
      jobUrgency: jobs.urgency,
      accountName: accounts.name,
      propertyName: properties.name,
      propertyCity: properties.city,
      propertyAddress: properties.address,
    })
    .from(workOrders)
    .leftJoin(jobs, eq(workOrders.jobId, jobs.id))
    .leftJoin(accounts, eq(jobs.accountId, accounts.id))
    .leftJoin(properties, eq(jobs.propertyId, properties.id))
    .where(
      and(
        eq(workOrders.assignedTechnicianId, tech.id),
        inArray(workOrders.status, ['assigned', 'dispatched', 'ready', 'en_route', 'on_site']),
      )
    )
    .orderBy(workOrders.scheduledStart);

  // Recently completed
  const completed = await db
    .select({
      id: workOrders.id,
      status: workOrders.status,
      completedAt: workOrders.completedAt,
      jobTitle: jobs.title,
      accountName: accounts.name,
    })
    .from(workOrders)
    .leftJoin(jobs, eq(workOrders.jobId, jobs.id))
    .leftJoin(accounts, eq(jobs.accountId, accounts.id))
    .where(
      and(
        eq(workOrders.assignedTechnicianId, tech.id),
        eq(workOrders.status, 'completed'),
      )
    )
    .orderBy(desc(workOrders.completedAt))
    .limit(5);

  const STATUS_COLORS: Record<string, string> = {
    assigned: 'border-blue-200 bg-blue-50',
    dispatched: 'border-indigo-200 bg-indigo-50',
    ready: 'border-teal-200 bg-teal-50',
    en_route: 'border-cyan-200 bg-cyan-50',
    on_site: 'border-blue-300 bg-blue-100',
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Work Orders"
        description={`Welcome, ${tech.fullName}`}
      />

      {/* Active orders */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Active Work Orders ({active.length})
        </h2>

        {active.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No active work orders"
            description="You have no assigned work at this time. Check back later."
          />
        ) : (
          <div className="space-y-3">
            {active.map(wo => (
              <Link
                key={wo.id}
                href={`/technician/${wo.id}`}
                className={`block rounded-lg border p-4 hover:shadow-sm transition-all ${
                  STATUS_COLORS[wo.status] ?? 'border-border bg-card'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground">{wo.jobTitle ?? 'Work Order'}</h3>
                      {wo.jobUrgency === 'critical' && (
                        <Badge className="bg-red-100 text-red-700 border-red-200 border text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />Critical
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{wo.accountName}</p>
                    {(wo.propertyName || wo.propertyCity) && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {wo.propertyName}{wo.propertyCity ? `, ${wo.propertyCity}` : ''}
                      </p>
                    )}
                    {wo.scheduledStart && (
                      <div className="mt-2">
                        <span className="text-xs font-semibold text-blue-700 bg-blue-100 rounded px-2 py-0.5">
                          📅 {formatDate(wo.scheduledStart, 'EEEE, MMM d')} at {formatDate(wo.scheduledStart, 'h:mm a')}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <StatusBadge variant="work_order_status" value={wo.status} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent completions */}
      {completed.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Recently Completed
          </h2>
          <div className="space-y-2">
            {completed.map(wo => (
              <Link
                key={wo.id}
                href={`/technician/${wo.id}`}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{wo.jobTitle ?? 'Work Order'}</p>
                  <p className="text-xs text-muted-foreground">{wo.accountName}</p>
                  {wo.completedAt && (
                    <p className="text-xs text-green-600 mt-0.5">
                      ✓ Completed {formatDate(wo.completedAt, 'MMM d, h:mm a')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge variant="work_order_status" value={wo.status} />
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
