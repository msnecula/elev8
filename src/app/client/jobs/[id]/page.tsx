import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { db } from '@/server/db/client';
import {
  jobs, proposals, schedulingRequests, accounts,
  properties, activityLogs, users,
} from '@/drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatDate, formatCurrency, timeAgo } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText, Calendar, CheckCircle2, Clock,
  AlertTriangle, ChevronRight, MapPin,
} from 'lucide-react';

export const metadata: Metadata = { title: 'Job Detail' };

export default async function ClientJobDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user.accountId) notFound();

  // Fetch job — enforce account ownership
  const jobResult = await db
    .select({
      job: jobs,
      account: { name: accounts.name },
      property: {
        name: properties.name,
        address: properties.address,
        city: properties.city,
        state: properties.state,
        zip: properties.zip,
        buildingType: properties.buildingType,
      },
    })
    .from(jobs)
    .leftJoin(accounts, eq(jobs.accountId, accounts.id))
    .leftJoin(properties, eq(jobs.propertyId, properties.id))
    .where(and(eq(jobs.id, params.id), eq(jobs.accountId, user.accountId)))
    .limit(1);

  if (!jobResult[0]) notFound();
  const { job, account, property } = jobResult[0];

  // Fetch related data in parallel
  const [jobProposals, scheduling, recentActivity] = await Promise.all([
    db.select({
      id: proposals.id,
      status: proposals.status,
      title: proposals.title,
      totalAmount: proposals.totalAmount,
      version: proposals.version,
      sentAt: proposals.sentAt,
    })
    .from(proposals)
    .where(eq(proposals.jobId, params.id))
    .orderBy(desc(proposals.createdAt)),

    db.query.schedulingRequests.findFirst({
      where: eq(schedulingRequests.jobId, params.id),
      orderBy: (sr, { desc }) => [desc(sr.createdAt)],
    }),

    db.select({
      log: activityLogs,
      actor: { fullName: users.fullName },
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.actorId, users.id))
    .where(eq(activityLogs.entityId, params.id))
    .orderBy(desc(activityLogs.createdAt))
    .limit(8),
  ]);

  const activeProposal = jobProposals.find(p => ['sent', 'approved'].includes(p.status));
  const approvedProposal = jobProposals.find(p => p.status === 'approved');
  const canSchedule = job.stage === 'approved' && !scheduling;
  const hasPendingSchedule = scheduling?.status === 'pending';
  const confirmedDate = scheduling?.status === 'confirmed' ? scheduling.confirmedStartDate : null;

  // Build a clear status narrative for the client
  function getStatusMessage() {
    switch (job.stage) {
      case 'notice_received': return 'Your notice has been received and is being reviewed by our team.';
      case 'under_review': return 'Our team is reviewing your notice and preparing a proposal.';
      case 'proposal_drafted': return 'A proposal is being finalized.';
      case 'proposal_sent': return 'We have sent you a proposal. Please review and approve it to proceed.';
      case 'approved': return 'The proposal has been approved. Please request scheduling below.';
      case 'scheduled': return hasPendingSchedule
        ? 'Your scheduling request is pending confirmation from our dispatcher.'
        : confirmedDate
        ? `Work is scheduled for ${formatDate(confirmedDate, 'MMMM d, yyyy')}.`
        : 'Work has been scheduled.';
      case 'dispatched': return 'A technician has been assigned and will arrive on the scheduled date.';
      case 'in_progress': return 'Work is currently in progress.';
      case 'completed': return 'Work has been completed. Thank you for choosing Elev8 Comply.';
      case 'on_hold': return 'This job is currently on hold. Our team will be in touch.';
      case 'cancelled': return 'This job has been cancelled.';
      default: return '';
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={job.title ?? 'Job Detail'} description={account?.name}>
        <div className="flex items-center gap-2">
          <StatusBadge variant="job_stage" value={job.stage} />
          <StatusBadge variant="urgency" value={job.urgency} />
        </div>
      </PageHeader>

      {/* Status banner */}
      <div className={`rounded-lg border p-4 ${
        job.stage === 'completed' ? 'border-green-200 bg-green-50' :
        job.stage === 'proposal_sent' ? 'border-blue-200 bg-blue-50' :
        job.stage === 'on_hold' || job.stage === 'cancelled' ? 'border-orange-200 bg-orange-50' :
        'border-border bg-muted/30'
      }`}>
        <p className="text-sm font-medium">{getStatusMessage()}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">

          {/* Active proposal CTA */}
          {activeProposal && (
            <Card className={activeProposal.status === 'sent' ? 'border-blue-200' : 'border-green-200'}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {activeProposal.status === 'sent' ? 'Proposal Awaiting Your Response' : 'Approved Proposal'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{activeProposal.title}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <StatusBadge variant="proposal_status" value={activeProposal.status} />
                      {activeProposal.totalAmount && (
                        <span className="text-sm font-semibold">{formatCurrency(activeProposal.totalAmount)}</span>
                      )}
                    </div>
                  </div>
                  <Button asChild size="sm" variant={activeProposal.status === 'sent' ? 'default' : 'outline'}>
                    <Link href={`/client/proposals/${activeProposal.id}`}>
                      {activeProposal.status === 'sent' ? 'Review & Approve' : 'View Proposal'}
                      <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scheduling */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Scheduling
              </CardTitle>
            </CardHeader>
            <CardContent>
              {confirmedDate ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-semibold">Work Scheduled</span>
                  </div>
                  <p className="text-sm">
                    {formatDate(confirmedDate, 'EEEE, MMMM d, yyyy')}
                    {scheduling?.confirmedEndDate && ` · ${formatDate(confirmedDate, 'h:mm a')} – ${formatDate(scheduling.confirmedEndDate, 'h:mm a')}`}
                  </p>
                  {scheduling?.buildingAccessNotes && (
                    <p className="text-xs text-muted-foreground flex items-start gap-1">
                      <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                      {scheduling.buildingAccessNotes}
                    </p>
                  )}
                </div>
              ) : hasPendingSchedule ? (
                <div className="flex items-center gap-2 text-blue-700">
                  <Clock className="h-4 w-4" />
                  <div>
                    <p className="text-sm font-medium">Scheduling request submitted</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Preferred: {scheduling?.preferredDate1}
                      {scheduling?.preferredDate2 && `, ${scheduling.preferredDate2}`}
                    </p>
                    <p className="text-xs text-muted-foreground">Our dispatcher will confirm within 1 business day.</p>
                  </div>
                </div>
              ) : canSchedule ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Your proposal has been approved. Please request your preferred work dates.
                  </p>
                  <Button asChild size="sm">
                    <Link href={`/client/schedule/${params.id}`}>
                      <Calendar className="h-4 w-4 mr-1.5" />
                      Request Scheduling
                    </Link>
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Scheduling will be available once the proposal has been approved.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Compliance flags */}
          {(job.complianceCoordinationRequired || job.fortyEightHourRequired) && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Compliance Requirements
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {job.complianceCoordinationRequired && (
                  <p className="text-amber-800">
                    ✓ This job requires coordination with your elevator compliance company. Our team will handle this automatically.
                  </p>
                )}
                {job.fortyEightHourRequired && (
                  <p className="text-amber-800">
                    ✓ California regulations require 48-hour advance notice before work begins. We track this and send it on your behalf.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* All proposals history */}
          {jobProposals.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Proposals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {jobProposals.map(p => (
                  <Link key={p.id} href={`/client/proposals/${p.id}`}
                    className="flex items-center justify-between p-2.5 rounded border border-border hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <StatusBadge variant="proposal_status" value={p.status} />
                      <span className="text-xs text-muted-foreground">v{p.version}</span>
                      {p.totalAmount && <span className="text-sm font-medium">{formatCurrency(p.totalAmount)}</span>}
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Activity feed — filtered for client-appropriate events */}
          {recentActivity.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Recent Updates</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="relative border-l border-border ml-2 space-y-4">
                  {recentActivity
                    .filter(({ log }) => !['note_added'].includes(log.eventType)) // hide internal notes
                    .map(({ log }) => (
                      <li key={log.id} className="ml-4">
                        <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-background bg-blue-400" />
                        <p className="text-sm">{log.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(log.createdAt)}</p>
                      </li>
                    ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Job Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {property && (
                <div>
                  <p className="text-xs text-muted-foreground">Property</p>
                  <p className="font-medium">{property.name}</p>
                  <p className="text-xs text-muted-foreground">{property.address}, {property.city}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Building Type</p>
                <p className="capitalize">{job.buildingType?.replace('_', ' ') ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Urgency</p>
                <StatusBadge variant="urgency" value={job.urgency} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Job Opened</p>
                <p>{formatDate(job.createdAt)}</p>
              </div>
            </CardContent>
          </Card>

          <div className="p-4 rounded-lg border border-border bg-muted/30 text-center space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Need help?</p>
            <p className="text-xs text-muted-foreground">Contact your Elev8 Comply team for any questions about this job.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
