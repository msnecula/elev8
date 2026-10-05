import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { jobs, accounts, properties, schedulingRequests } from '@/drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CreateWorkOrderForm from '@/components/dispatch/CreateWorkOrderForm';

export const metadata: Metadata = { title: 'Create Work Order' };

export default async function NewWorkOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>
}) {
  const params = await searchParams;
  await requireRole('admin', 'dispatcher');

  if (!params.jobId) redirect('/work-orders');

  const jobResult = await db
    .select({
      job: jobs,
      account: { name: accounts.name },
      property: { name: properties.name, city: properties.city },
    })
    .from(jobs)
    .leftJoin(accounts, eq(jobs.accountId, accounts.id))
    .leftJoin(properties, eq(jobs.propertyId, properties.id))
    .where(eq(jobs.id, params.jobId))
    .limit(1);

  if (!jobResult[0]) redirect('/work-orders');
  const { job, account, property } = jobResult[0];

  // Get confirmed scheduling request if one exists
  const confirmedSchedule = await db.query.schedulingRequests.findFirst({
    where: and(
      eq(schedulingRequests.jobId, params.jobId),
      eq(schedulingRequests.status, 'confirmed'),
    ),
    orderBy: (sr, { desc }) => [desc(sr.createdAt)],
  });

  return (
    <div>
      <PageHeader
        title="Create Work Order"
        description={`${account?.name ?? ''} — ${job.title ?? property?.name ?? 'Job'}`}
      />

      {confirmedSchedule?.confirmedStartDate && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
          <p className="font-medium text-green-800">Confirmed schedule detected</p>
          <p className="text-green-700 mt-0.5">
            Client confirmed dates have been pre-filled from the scheduling request.
          </p>
        </div>
      )}

      <Card className="max-w-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Work Order Details</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateWorkOrderForm
            jobId={job.id}
            schedulingRequestId={confirmedSchedule?.id}
            defaultSkillTag={job.requiredSkillTag ?? undefined}
            fortyEightHourRequired={job.fortyEightHourRequired ?? false}
            confirmedStart={confirmedSchedule?.confirmedStartDate?.toString()}
            confirmedEnd={confirmedSchedule?.confirmedEndDate?.toString()}
          />
        </CardContent>
      </Card>
    </div>
  );
}
