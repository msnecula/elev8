import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { db } from '@/server/db/client';
import { jobs, schedulingRequests, properties } from '@/drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Calendar, MapPin, AlertTriangle } from 'lucide-react';
import SchedulingRequestForm from '@/components/scheduling/SchedulingRequestForm';

export const metadata: Metadata = { title: 'Request Scheduling' };

export default async function ClientSchedulePage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user.accountId) redirect('/client');

  // params.id is the jobId
  const job = await db.query.jobs.findFirst({
    where: and(eq(jobs.id, params.id), eq(jobs.accountId, user.accountId)),
    columns: {
      id: true, title: true, stage: true, urgency: true,
      complianceCoordinationRequired: true, fortyEightHourRequired: true,
    },
  });

  if (!job) notFound();

  // Must be approved to schedule
  if (!['approved', 'scheduled', 'dispatched', 'in_progress', 'completed'].includes(job.stage)) {
    redirect(`/client/jobs/${params.id}`);
  }

  // Get existing scheduling requests for this job
  const requests = await db
    .select()
    .from(schedulingRequests)
    .where(eq(schedulingRequests.jobId, params.id))
    .orderBy(desc(schedulingRequests.createdAt));

  const confirmedRequest = requests.find(r => r.status === 'confirmed');
  const pendingRequest = requests.find(r => r.status === 'pending');

  return (
    <div className="space-y-6">
      <PageHeader title="Schedule Your Job" description={job.title ?? 'Elevator Compliance Work'}>
        <StatusBadge variant="job_stage" value={job.stage} />
      </PageHeader>

      {/* Confirmed date banner */}
      {confirmedRequest?.confirmedStartDate && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-green-800">Work Date Confirmed</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-green-700 font-medium uppercase tracking-wide">Date & Time</p>
              <p className="text-green-900 font-semibold mt-0.5">
                {formatDate(confirmedRequest.confirmedStartDate, 'EEEE, MMMM d, yyyy')}
              </p>
              <p className="text-green-800">
                {formatDate(confirmedRequest.confirmedStartDate, 'h:mm a')}
                {confirmedRequest.confirmedEndDate && ` – ${formatDate(confirmedRequest.confirmedEndDate, 'h:mm a')}`}
              </p>
            </div>
            {confirmedRequest.buildingAccessNotes && (
              <div>
                <p className="text-xs text-green-700 font-medium uppercase tracking-wide flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Access Notes
                </p>
                <p className="text-green-900 mt-0.5">{confirmedRequest.buildingAccessNotes}</p>
              </div>
            )}
          </div>
          {confirmedRequest.complianceCoordinationNotes && (
            <div className="pt-2 border-t border-green-200">
              <p className="text-xs text-green-700 font-medium uppercase tracking-wide">Compliance Notes</p>
              <p className="text-sm text-green-900 mt-0.5">{confirmedRequest.complianceCoordinationNotes}</p>
            </div>
          )}
        </div>
      )}

      {/* Compliance flags */}
      {(job.complianceCoordinationRequired || job.fortyEightHourRequired) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-1.5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-800">Important Notes</p>
          </div>
          {job.complianceCoordinationRequired && (
            <p className="text-sm text-amber-700">
              • This job requires coordination with your compliance company. Our team will handle this once a date is confirmed.
            </p>
          )}
          {job.fortyEightHourRequired && (
            <p className="text-sm text-amber-700">
              • California regulations require a 48-hour advance notice before work begins. This will be sent automatically once your date is confirmed.
            </p>
          )}
        </div>
      )}

      {/* Pending request status */}
      {pendingRequest && !confirmedRequest && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-800">Scheduling Request Submitted</p>
                <p className="text-sm text-blue-700 mt-0.5">
                  Our dispatcher is reviewing your preferred dates. You'll receive an email once a date is confirmed.
                </p>
                <div className="mt-2 space-y-0.5 text-xs text-blue-600">
                  {pendingRequest.preferredDate1 && <p>Preferred 1: {formatDate(pendingRequest.preferredDate1)}</p>}
                  {pendingRequest.preferredDate2 && <p>Preferred 2: {formatDate(pendingRequest.preferredDate2)}</p>}
                  {pendingRequest.preferredDate3 && <p>Preferred 3: {formatDate(pendingRequest.preferredDate3)}</p>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Show form if no confirmed/pending request */}
      {!confirmedRequest && !pendingRequest && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Request Scheduling</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-5">
              Provide up to three preferred dates. Our dispatcher will confirm the final date within 1 business day.
            </p>
            <SchedulingRequestForm jobId={params.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
