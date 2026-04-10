import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { jobs, schedulingRequests, accounts, properties, users } from '@/drizzle/schema';
import { eq, desc } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import { CheckCircle2, Clock, Calendar } from 'lucide-react';
import ConfirmDateForm from '@/components/scheduling/ConfirmDateForm';

export const metadata: Metadata = { title: 'Scheduling' };

export default async function SchedulingPage({ params }: { params: { id: string } }) {
  await requireRole('admin', 'dispatcher');

  // params.id is the jobId
  const jobResult = await db
    .select({
      job: jobs,
      account: { name: accounts.name },
      property: { name: properties.name, city: properties.city },
    })
    .from(jobs)
    .leftJoin(accounts, eq(jobs.accountId, accounts.id))
    .leftJoin(properties, eq(jobs.propertyId, properties.id))
    .where(eq(jobs.id, params.id))
    .limit(1);

  if (!jobResult[0]) notFound();
  const { job, account, property } = jobResult[0];

  const requests = await db
    .select({
      request: schedulingRequests,
      requestedBy: { fullName: users.fullName },
    })
    .from(schedulingRequests)
    .leftJoin(users, eq(schedulingRequests.requestedBy, users.id))
    .where(eq(schedulingRequests.jobId, params.id))
    .orderBy(desc(schedulingRequests.createdAt));

  const pendingRequest = requests.find(r => r.request.status === 'pending');
  const confirmedRequest = requests.find(r => r.request.status === 'confirmed');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scheduling"
        description={`${account?.name ?? ''} — ${job.title ?? property?.name ?? 'Job'}`}
      >
        <StatusBadge variant="job_stage" value={job.stage} />
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Confirm date form */}
          {pendingRequest && !confirmedRequest && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  Pending — Confirm Work Date
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ConfirmDateForm
                  requestId={pendingRequest.request.id}
                  preferredDate1={pendingRequest.request.preferredDate1}
                  preferredDate2={pendingRequest.request.preferredDate2}
                  preferredDate3={pendingRequest.request.preferredDate3}
                  notes={pendingRequest.request.notes}
                  complianceRequired={job.complianceCoordinationRequired ?? false}
                />
              </CardContent>
            </Card>
          )}

          {/* Already confirmed */}
          {confirmedRequest && (
            <Card className="border-green-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Date Confirmed
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Confirmed Start</p>
                  <p className="font-semibold">{formatDate(confirmedRequest.request.confirmedStartDate, 'EEEE, MMMM d, yyyy h:mm a')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Confirmed End</p>
                  <p>{formatDate(confirmedRequest.request.confirmedEndDate, 'h:mm a')}</p>
                </div>
                {confirmedRequest.request.buildingAccessNotes && (
                  <div>
                    <p className="text-xs text-muted-foreground">Building Access</p>
                    <p>{confirmedRequest.request.buildingAccessNotes}</p>
                  </div>
                )}
                {confirmedRequest.request.complianceCoordinationNotes && (
                  <div>
                    <p className="text-xs text-muted-foreground">Compliance Notes</p>
                    <p>{confirmedRequest.request.complianceCoordinationNotes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* No request yet */}
          {!pendingRequest && !confirmedRequest && (
            <Card>
              <CardContent className="py-10 text-center">
                <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No scheduling request has been submitted by the client yet.</p>
                <p className="text-xs text-muted-foreground mt-1">The client can submit preferred dates after proposal approval.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column — request history */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Job Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Stage</p>
                <StatusBadge variant="job_stage" value={job.stage} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Urgency</p>
                <StatusBadge variant="urgency" value={job.urgency} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Compliance Coord.</p>
                <p className={job.complianceCoordinationRequired ? 'text-orange-600 font-medium' : 'text-muted-foreground'}>
                  {job.complianceCoordinationRequired ? 'Required' : 'Not required'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">48-Hour Notice</p>
                <p className={job.fortyEightHourRequired ? 'text-orange-600 font-medium' : 'text-muted-foreground'}>
                  {job.fortyEightHourRequired ? 'Required' : 'Not required'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Request history */}
          {requests.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Request History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {requests.map(({ request, requestedBy }) => (
                  <div key={request.id} className="p-2.5 rounded border border-border text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <StatusBadge variant="job_stage" value={request.status === 'confirmed' ? 'scheduled' : 'notice_received'} />
                      <span className="text-muted-foreground">{formatDate(request.createdAt)}</span>
                    </div>
                    <p className="text-muted-foreground">By: {requestedBy?.fullName ?? 'Client'}</p>
                    {request.preferredDate1 && <p>1st pref: {request.preferredDate1}</p>}
                    {request.confirmedStartDate && (
                      <p className="text-green-700 font-medium">
                        Confirmed: {formatDate(request.confirmedStartDate, 'MMM d, yyyy h:mm a')}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
