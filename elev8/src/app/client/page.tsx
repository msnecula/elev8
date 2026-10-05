import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { db } from '@/server/db/client';
import {
  jobs, proposals, accounts, properties, schedulingRequests,
} from '@/drizzle/schema';
import { eq, desc, and, inArray } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatCurrency } from '@/lib/utils';
import { ChevronRight, FileText, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'My Jobs' };

export default async function ClientHomePage() {
  const user = await requireUser();
  if (!user.accountId) redirect('/login');

  const account = await db.query.accounts.findFirst({
    where: eq(accounts.id, user.accountId),
    columns: { name: true },
  });

  const myJobs = await db
    .select({
      job: jobs,
      property: { name: properties.name, city: properties.city },
    })
    .from(jobs)
    .leftJoin(properties, eq(jobs.propertyId, properties.id))
    .where(eq(jobs.accountId, user.accountId))
    .orderBy(desc(jobs.createdAt))
    .limit(50);

  // Get sent proposals awaiting approval
  const jobIds = myJobs.map(j => j.job.id);
  const pendingProposals = jobIds.length > 0
    ? await db.select({ id: proposals.id, jobId: proposals.jobId, totalAmount: proposals.totalAmount })
        .from(proposals)
        .where(and(
          inArray(proposals.jobId, jobIds),
          eq(proposals.status, 'sent'),
        ))
    : [];

  // Get pending scheduling requests
  const pendingScheduling = jobIds.length > 0
    ? await db.select({ jobId: schedulingRequests.jobId })
        .from(schedulingRequests)
        .where(and(
          inArray(schedulingRequests.jobId, jobIds),
          eq(schedulingRequests.status, 'pending'),
        ))
    : [];

  // Stats
  const activeJobs = myJobs.filter(j => !['completed', 'cancelled'].includes(j.job.stage));
  const completedJobs = myJobs.filter(j => j.job.stage === 'completed');
  const jobsNeedingAction = myJobs.filter(j =>
    j.job.stage === 'approved' ||
    pendingProposals.some(p => p.jobId === j.job.id)
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back${user.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}`}
        description={account?.name ?? 'Your elevator compliance dashboard'}
      />

      {/* Action required banner */}
      {jobsNeedingAction.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                {jobsNeedingAction.length === 1
                  ? '1 job needs your attention'
                  : `${jobsNeedingAction.length} jobs need your attention`}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {pendingProposals.length > 0 && `${pendingProposals.length} proposal${pendingProposals.length > 1 ? 's' : ''} awaiting approval. `}
                {myJobs.filter(j => j.job.stage === 'approved').length > 0 && 'Some jobs are ready for scheduling.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard label="Active Jobs" value={activeJobs.length} color="blue" />
        <SummaryCard label="Awaiting Approval" value={pendingProposals.length} color={pendingProposals.length > 0 ? 'amber' : 'slate'} />
        <SummaryCard label="Pending Schedule" value={pendingScheduling.length} color={pendingScheduling.length > 0 ? 'amber' : 'slate'} />
        <SummaryCard label="Completed" value={completedJobs.length} color="green" />
      </div>

      {/* Proposals needing action */}
      {pendingProposals.length > 0 && (
        <Card className="border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              Proposals Awaiting Your Approval
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingProposals.map(proposal => {
              const job = myJobs.find(j => j.job.id === proposal.jobId);
              return (
                <Link key={proposal.id} href={`/client/proposals/${proposal.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{job?.job.title ?? 'Job Proposal'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(proposal.totalAmount)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-blue-700 font-medium">Review Now</span>
                    <ChevronRight className="h-4 w-4 text-blue-600" />
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Jobs list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">All Jobs</CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link href="/client/notices/new">
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Upload Notice
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {myJobs.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No jobs yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Upload an Order to Comply notice to get started.</p>
              <Button asChild size="sm" className="mt-4">
                <Link href="/client/notices/new">Upload Notice</Link>
              </Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  {['Job', 'Stage', 'Urgency', 'Last Updated', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {myJobs.map(({ job, property }) => {
                  const hasPendingProposal = pendingProposals.some(p => p.jobId === job.id);
                  return (
                    <tr key={job.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium">{job.title ?? 'Untitled Job'}</div>
                        {property?.name && (
                          <div className="text-xs text-muted-foreground mt-0.5">{property.name}, {property.city}</div>
                        )}
                        {hasPendingProposal && (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium mt-1">
                            <AlertCircle className="h-3 w-3" /> Action required
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge variant="job_stage" value={job.stage} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge variant="urgency" value={job.urgency} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(job.updatedAt)}
                      </td>
                      <td className="px-4 py-2 pr-4">
                        <Link href={`/client/jobs/${job.id}`} className="flex justify-end text-muted-foreground hover:text-foreground">
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label, value, color,
}: {
  label: string;
  value: number;
  color: 'blue' | 'amber' | 'green' | 'slate';
}) {
  const styles = {
    blue: 'bg-blue-50 border-blue-100',
    amber: value > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100',
    green: 'bg-green-50 border-green-100',
    slate: 'bg-slate-50 border-slate-100',
  };
  const textStyles = {
    blue: 'text-blue-700',
    amber: value > 0 ? 'text-amber-700' : 'text-slate-500',
    green: 'text-green-700',
    slate: 'text-slate-500',
  };

  return (
    <div className={`rounded-lg border p-4 ${styles[color]}`}>
      <p className={`text-2xl font-bold ${textStyles[color]}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
