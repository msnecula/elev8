import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import {
  notices, jobs, workOrders, accounts, schedulingRequests,
} from '@/drizzle/schema';
import { eq, and, inArray, desc, lte } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import StatusBadge from '@/components/shared/StatusBadge';
import PageHeader from '@/components/shared/PageHeader';
import { formatDate } from '@/lib/utils';
import {
  ClipboardList, Calendar, AlertTriangle, ChevronRight,
  Clock, CheckCircle2, Eye,
} from 'lucide-react';
import { addHours } from 'date-fns';

export const metadata: Metadata = { title: 'Dispatch' };

export default async function DispatchPage() {
  await requireRole('admin', 'dispatcher');

  const now = new Date();

  const [
    pendingActionPlans,
    pendingSchedule,
    overdueNotices,
    activeWorkOrders,
  ] = await Promise.all([
    // Notices parsed but not yet reviewed — need dispatch action plan review
    db.select({
      id: notices.id,
      fileName: notices.fileName,
      urgency: notices.urgency,
      createdAt: notices.createdAt,
      accountName: accounts.name,
      parsedData: notices.parsedData,
    })
    .from(notices)
    .leftJoin(accounts, eq(notices.accountId, accounts.id))
    .where(eq(notices.status, 'parsed'))
    .orderBy(desc(notices.createdAt))
    .limit(20),

    // Scheduling requests pending confirmation
    db.select({
      id: schedulingRequests.id,
      jobId: schedulingRequests.jobId,
      preferredDate1: schedulingRequests.preferredDate1,
      notes: schedulingRequests.notes,
      createdAt: schedulingRequests.createdAt,
      jobTitle: jobs.title,
      accountName: accounts.name,
      urgency: jobs.urgency,
    })
    .from(schedulingRequests)
    .leftJoin(jobs, eq(schedulingRequests.jobId, jobs.id))
    .leftJoin(accounts, eq(jobs.accountId, accounts.id))
    .where(eq(schedulingRequests.status, 'pending'))
    .orderBy(desc(schedulingRequests.createdAt))
    .limit(10),

    // 48-hour notices approaching or overdue
    db.select({
      id: workOrders.id,
      jobId: workOrders.jobId,
      status: workOrders.status,
      fortyEightHourStatus: workOrders.fortyEightHourStatus,
      fortyEightHourDeadline: workOrders.fortyEightHourDeadline,
      scheduledStart: workOrders.scheduledStart,
      jobTitle: jobs.title,
      accountName: accounts.name,
    })
    .from(workOrders)
    .leftJoin(jobs, eq(workOrders.jobId, jobs.id))
    .leftJoin(accounts, eq(jobs.accountId, accounts.id))
    .where(
      and(
        eq(workOrders.fortyEightHourNoticeRequired, true),
        inArray(workOrders.fortyEightHourStatus, ['pending', 'overdue']),
        lte(workOrders.fortyEightHourDeadline, addHours(now, 48)),
      )
    )
    .orderBy(workOrders.fortyEightHourDeadline)
    .limit(10),

    // Active work orders
    db.select({
      id: workOrders.id,
      status: workOrders.status,
      scheduledStart: workOrders.scheduledStart,
      fortyEightHourStatus: workOrders.fortyEightHourStatus,
      jobTitle: jobs.title,
      accountName: accounts.name,
      urgency: jobs.urgency,
    })
    .from(workOrders)
    .leftJoin(jobs, eq(workOrders.jobId, jobs.id))
    .leftJoin(accounts, eq(jobs.accountId, accounts.id))
    .where(
      inArray(workOrders.status, ['draft', 'assigned', 'dispatched', 'ready', 'en_route', 'on_site'])
    )
    .orderBy(workOrders.scheduledStart)
    .limit(20),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dispatch"
        description="Action plans, scheduling, and active work orders"
      />

      {/* ── Section 1: Action Plans Pending Review ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-blue-600" />
            Action Plans Pending Dispatch Review
            {pendingActionPlans.length > 0 && (
              <Badge className="bg-blue-600 text-white ml-1">{pendingActionPlans.length}</Badge>
            )}
          </h2>
        </div>

        {pendingActionPlans.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-green-500" />
            No action plans pending review
          </div>
        ) : (
          <div className="space-y-2">
            {pendingActionPlans.map(n => {
              const parsed = n.parsedData as any;
              const deadline = parsed?.complianceDeadline;
              const propertyName = parsed?.propertyName || n.accountName || 'Unknown Property';
              const actionPlanCount = parsed?.actionPlan?.length ?? 0;

              return (
                <div key={n.id} className={`rounded-lg border p-4 flex items-center justify-between gap-4 ${
                  n.urgency === 'critical' ? 'border-red-300 bg-red-50' :
                  n.urgency === 'high' ? 'border-orange-200 bg-orange-50' :
                  'border-border bg-card'
                }`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{propertyName}</span>
                      <StatusBadge variant="urgency" value={n.urgency} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.fileName}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      {deadline && (
                        <span className="flex items-center gap-1 text-red-700 font-medium">
                          <Calendar className="h-3 w-3" />
                          Deadline: {new Date(deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                      {actionPlanCount > 0 && (
                        <span>{actionPlanCount} action step{actionPlanCount !== 1 ? 's' : ''}</span>
                      )}
                      <span>Received {formatDate(n.createdAt)}</span>
                    </div>
                  </div>
                  <Button asChild size="sm" className="shrink-0">
                    <Link href={`/dispatch/action-plan/${n.id}`}>
                      <Eye className="h-3.5 w-3.5 mr-1.5" />
                      Review & Approve
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Section 2: 48-hour notices ── */}
      {overdueNotices.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            48-Hour Notices Requiring Action
            <Badge className="bg-red-500 text-white">{overdueNotices.length}</Badge>
          </h2>
          <div className="space-y-2">
            {overdueNotices.map(wo => {
              const isOverdue = wo.fortyEightHourStatus === 'overdue';
              return (
                <Link key={wo.id} href={`/work-orders/${wo.id}`}
                  className={`flex items-center justify-between rounded-lg border p-3 hover:shadow-sm transition-all ${
                    isOverdue ? 'border-red-300 bg-red-50' : 'border-amber-200 bg-amber-50'
                  }`}>
                  <div>
                    <p className="text-sm font-medium">{wo.jobTitle ?? 'Work Order'}</p>
                    <p className="text-xs text-muted-foreground">{wo.accountName}</p>
                    {wo.fortyEightHourDeadline && (
                      <p className={`text-xs font-medium mt-0.5 ${isOverdue ? 'text-red-700' : 'text-amber-700'}`}>
                        {isOverdue ? 'OVERDUE — Dispatch Held' : `Deadline: ${formatDate(wo.fortyEightHourDeadline, 'MMM d h:mm a')}`}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Section 3: Pending scheduling ── */}
      {pendingSchedule.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-blue-600" />
            Scheduling Confirmation Needed
            <Badge variant="outline">{pendingSchedule.length}</Badge>
          </h2>
          <div className="space-y-2">
            {pendingSchedule.map(sr => (
              <Link key={sr.id} href={`/schedule/${sr.jobId}`}
                className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3 hover:shadow-sm transition-all">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{sr.jobTitle ?? 'Job'}</p>
                    {sr.urgency && <StatusBadge variant="urgency" value={sr.urgency} />}
                  </div>
                  <p className="text-xs text-muted-foreground">{sr.accountName}</p>
                  {sr.preferredDate1 && (
                    <p className="text-xs text-blue-700 mt-0.5">Preferred: {sr.preferredDate1}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-blue-700 font-medium">Confirm Date</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Section 4: Active work orders ── */}
      <section>
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Active Work Orders ({activeWorkOrders.length})
        </h2>
        {activeWorkOrders.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            No active work orders
          </div>
        ) : (
          <div className="space-y-2">
            {activeWorkOrders.map(wo => (
              <Link key={wo.id} href={`/work-orders/${wo.id}`}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3 hover:bg-muted/30 transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{wo.jobTitle ?? 'Work Order'}</p>
                    <StatusBadge variant="work_order_status" value={wo.status} />
                    {wo.urgency && <StatusBadge variant="urgency" value={wo.urgency} />}
                  </div>
                  <p className="text-xs text-muted-foreground">{wo.accountName}</p>
                  {wo.scheduledStart && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Scheduled: {formatDate(wo.scheduledStart, 'MMM d, yyyy h:mm a')}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
