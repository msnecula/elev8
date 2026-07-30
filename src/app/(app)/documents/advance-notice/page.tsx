import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { notices, accounts, properties, workOrders, jobs } from '@/drizzle/schema';
import { eq, desc } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AdvanceNoticeForm from './AdvanceNoticeForm';
import type { ParsedNoticeData } from '@/server/services/noticeParser';

export const metadata: Metadata = { title: 'Generate 48-Hour Advance Notice' };

export default async function AdvanceNoticePage({
  searchParams,
}: {
  searchParams: Promise<{ noticeId?: string; workOrderId?: string }>;
}) {
  const params = await searchParams;
  await requireRole('admin', 'dispatcher');

  const noticeId = params.noticeId;
  const workOrderId = params.workOrderId;

  if (!noticeId && !workOrderId) redirect('/documents');

  let notice: any = null;
  let workOrder: any = null;
  let account: any = null;
  let property: any = null;

  if (workOrderId) {
    const woResult = await db
      .select({ wo: workOrders, job: jobs, account: accounts, property: properties })
      .from(workOrders)
      .leftJoin(jobs, eq(workOrders.jobId, jobs.id))
      .leftJoin(accounts, eq(jobs.accountId, accounts.id))
      .leftJoin(properties, eq(jobs.propertyId, properties.id))
      .where(eq(workOrders.id, workOrderId))
      .limit(1);

    if (woResult[0]) {
      workOrder = woResult[0].wo;
      account = woResult[0].account;
      property = woResult[0].property;

      if (woResult[0].job?.noticeId) {
        notice = await db.query.notices.findFirst({ where: eq(notices.id, woResult[0].job.noticeId) });
      }
    }
  } else if (noticeId) {
    const result = await db
      .select({ notice: notices, account: accounts, property: properties })
      .from(notices)
      .leftJoin(accounts, eq(notices.accountId, accounts.id))
      .leftJoin(properties, eq(notices.propertyId, properties.id))
      .where(eq(notices.id, noticeId))
      .limit(1);

    if (result[0]) {
      notice = result[0].notice;
      account = result[0].account;
      property = result[0].property;
    }
  }

  const parsed = notice?.parsedData as ParsedNoticeData | null;

  // Get work orders for this notice's job if available
  const availableWorkOrders = workOrderId ? [] : await db
    .select({ id: workOrders.id, scheduledStart: workOrders.scheduledStart, status: workOrders.status })
    .from(workOrders)
    .leftJoin(jobs, eq(workOrders.jobId, jobs.id))
    .where(notice?.id ? eq(jobs.noticeId, notice.id) : eq(workOrders.id, 'none'))
    .orderBy(desc(workOrders.scheduledStart))
    .limit(5);

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Generate 48-Hour Advance Notice"
        description="Written notification required before elevator work begins in California"
      />

      <Card className="border-amber-200 bg-amber-50/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-amber-800">Legal Requirement</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-amber-800 space-y-1">
          <p>California elevator regulations require <strong>48-hour advance written notice</strong> before most elevator work begins.</p>
          <p>This notice must be sent to: the Cal/OSHA district office, the building owner/property manager, and any compliance coordination company.</p>
          <p className="font-medium">Retain proof of delivery. Send before work commences — not on the day of.</p>
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Pre-Filled Information</CardTitle>
        </CardHeader>
        <CardContent className="text-sm grid grid-cols-2 gap-3">
          <div><p className="text-xs text-muted-foreground">Property</p><p className="font-medium">{parsed?.propertyName || account?.name}</p></div>
          <div><p className="text-xs text-muted-foreground">Address</p><p>{parsed?.propertyAddress || property?.address}</p></div>
          <div><p className="text-xs text-muted-foreground">State ID</p><p className="font-bold text-blue-700">{parsed?.equipmentId || '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">Elevator Type</p><p className="capitalize">{parsed?.elevatorType || '—'}</p></div>
          {workOrder?.scheduledStart && (
            <div>
              <p className="text-xs text-muted-foreground">Scheduled Work Date</p>
              <p className="font-medium text-green-700">
                {new Date(workOrder.scheduledStart).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <AdvanceNoticeForm
        noticeId={noticeId ?? notice?.id}
        workOrderId={workOrderId ?? null}
        parsedData={parsed}
        scheduledStart={workOrder?.scheduledStart?.toString() ?? null}
        natureOfWork={parsed?.requiredWorkSummary ?? ''}
      />
    </div>
  );
}
