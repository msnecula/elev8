import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { workOrders, jobs, accounts, properties, technicians, users } from '@/drizzle/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate, formatDateTime } from '@/lib/utils';
import { Truck, AlertTriangle, Clock, CheckCircle2, ChevronRight } from 'lucide-react';

export const metadata: Metadata = { title: 'Dispatch' };

export default async function DispatchPage() {
  await requireRole('admin', 'dispatcher');

  // Fetch active work orders with all joins
  const activeWorkOrders = await db
    .select({
      id: workOrders.id,
      status: workOrders.status,
      scheduledStart: workOrders.scheduledStart,
      scheduledEnd: workOrders.scheduledEnd,
      fortyEightHourStatus: workOrders.fortyEightHourStatus,
      fortyEightHourDeadline: workOrders.fortyEightHourDeadline,
      fortyEightHourNoticeRequired: workOrders.fortyEightHourNoticeRequired,
      region: workOrders.region,
      requiredSkillTag: workOrders.requiredSkillTag,
      jobTitle: jobs.title,
      jobUrgency: jobs.urgency,
      accountName: accounts.name,
      propertyCity: properties.city,
      technicianName: technicians.fullName,
      technicianPhone: technicians.phone,
    })
    .from(workOrders)
    .leftJoin(jobs, eq(workOrders.jobId, jobs.id))
    .leftJoin(accounts, eq(jobs.accountId, accounts.id))
    .leftJoin(properties, eq(jobs.propertyId, properties.id))
    .leftJoin(technicians, eq(workOrders.assignedTechnicianId, technicians.id))
    .where(
      inArray(workOrders.status, ['draft', 'assigned', 'dispatched', 'ready', 'en_route', 'on_site', 'held'])
    )
    .orderBy(desc(workOrders.scheduledStart));

  // 48-hour alerts: pending + deadline within 24 hours OR overdue
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const alertOrders = activeWorkOrders.filter((wo) => {
    if (wo.fortyEightHourStatus === 'overdue') return true;
    if (
      wo.fortyEightHourStatus === 'pending' &&
      wo.fortyEightHourDeadline &&
      new Date(wo.fortyEightHourDeadline) <= in24h
    )
      return true;
    return false;
  });

  const byStatus = (status: string) => activeWorkOrders.filter((wo) => wo.status === status);

  return (
    <div className="space-y-6">
      <PageHeader title="Dispatch" description="Work order management and 48-hour notice tracking">
        <Button asChild size="sm">
          <Link href="/work-orders">All Work Orders</Link>
        </Button>
      </PageHeader>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Active Orders" value={activeWorkOrders.length} icon={Truck} color="blue" />
        <StatCard label="48-hr Alerts" value={alertOrders.length} icon={AlertTriangle} color="red" urgent={alertOrders.length > 0} />
        <StatCard label="On Site" value={byStatus('on_site').length} icon={CheckCircle2} color="green" />
        <StatCard label="Held" value={byStatus('held').length} icon={Clock} color="orange" urgent={byStatus('held').length > 0} />
      </div>

      {/* 48-hour notice alerts */}
      {alertOrders.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-red-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              48-Hour Notice Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alertOrders.map((wo) => (
                <Link
                  key={wo.id}
                  href={`/work-orders/${wo.id}`}
                  className="flex items-center justify-between p-3 bg-white rounded-md border border-red-200 hover:bg-red-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{wo.jobTitle ?? 'Untitled Job'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {wo.accountName} · Scheduled: {wo.scheduledStart ? formatDate(wo.scheduledStart) : '—'}
                    </p>
                    {wo.fortyEightHourDeadline && (
                      <p className="text-xs text-red-600 font-medium mt-0.5">
                        Notice deadline: {formatDateTime(wo.fortyEightHourDeadline)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge variant="forty_eight_hour" value={wo.fortyEightHourStatus} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active work orders table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Active Work Orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {activeWorkOrders.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Truck}
                title="No active work orders"
                description="Work orders appear here once they are created from approved jobs."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Job</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Technician</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scheduled</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">48-Hr</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Region</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {activeWorkOrders.map((wo) => (
                    <tr key={wo.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium">{wo.jobTitle ?? 'Untitled'}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {wo.accountName}
                          {wo.propertyCity ? ` · ${wo.propertyCity}` : ''}
                        </div>
                        {wo.jobUrgency && (
                          <StatusBadge variant="urgency" value={wo.jobUrgency} className="mt-1" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge variant="work_order_status" value={wo.status} />
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {wo.technicianName ? (
                          <div>
                            <div className="font-medium">{wo.technicianName}</div>
                            {wo.technicianPhone && (
                              <div className="text-xs text-muted-foreground">{wo.technicianPhone}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600 font-medium">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {wo.scheduledStart ? formatDate(wo.scheduledStart) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge variant="forty_eight_hour" value={wo.fortyEightHourStatus} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {wo.region ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-right pr-4">
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/work-orders/${wo.id}`}>
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, color, urgent,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'red' | 'green' | 'orange';
  urgent?: boolean;
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    red: urgent ? 'bg-red-50 text-red-600 ring-1 ring-red-200' : 'bg-slate-50 text-slate-500',
    green: 'bg-green-50 text-green-600',
    orange: urgent ? 'bg-orange-50 text-orange-600 ring-1 ring-orange-200' : 'bg-slate-50 text-slate-500',
  };

  return (
    <Card className={urgent ? 'border-red-200' : ''}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${urgent ? 'text-red-600' : ''}`}>{value}</p>
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
