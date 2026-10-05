import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { jobs, accounts, properties, users, proposals } from '@/drizzle/schema';
import { desc, eq } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { formatDate } from '@/lib/utils';
import { Briefcase, AlertTriangle } from 'lucide-react';

export const metadata: Metadata = { title: 'Jobs' };

export default async function JobsPage() {
  await requireRole('admin', 'reviewer', 'dispatcher');

  // Proposals with client revision requests
  const revisionJobs = await db
    .select({
      jobId: proposals.jobId,
      proposalId: proposals.id,
      revisionNotes: proposals.revisionNotes,
      jobTitle: jobs.title,
      accountName: accounts.name,
    })
    .from(proposals)
    .leftJoin(jobs, eq(proposals.jobId, jobs.id))
    .leftJoin(accounts, eq(jobs.accountId, accounts.id))
    .where(eq(proposals.status, 'revision_requested'))
    .orderBy(desc(proposals.updatedAt))
    .limit(10);

  const allJobs = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      stage: jobs.stage,
      urgency: jobs.urgency,
      nextActionDate: jobs.nextActionDate,
      riskFlags: jobs.riskFlags,
      fortyEightHourRequired: jobs.fortyEightHourRequired,
      complianceCoordinationRequired: jobs.complianceCoordinationRequired,
      createdAt: jobs.createdAt,
      accountName: accounts.name,
      propertyName: properties.name,
      reviewerName: users.fullName,
    })
    .from(jobs)
    .leftJoin(accounts, eq(jobs.accountId, accounts.id))
    .leftJoin(properties, eq(jobs.propertyId, properties.id))
    .leftJoin(users, eq(jobs.assignedReviewerId, users.id))
    .orderBy(desc(jobs.createdAt))
    .limit(200);

  const activeCount = allJobs.filter((j) => !['completed', 'cancelled'].includes(j.stage)).length;
  const criticalCount = allJobs.filter((j) => j.urgency === 'critical').length;

  return (
    <div>
      <PageHeader title="Jobs" description="All elevator compliance jobs">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{activeCount} active</span>
          {criticalCount > 0 && (
            <span className="flex items-center gap-1 text-red-600 font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              {criticalCount} critical
            </span>
          )}
        </div>
      </PageHeader>

      {/* Revision requests banner */}
      {revisionJobs.length > 0 && (
        <div className="mt-6 rounded-lg border border-purple-200 bg-purple-50 p-4 space-y-2">
          <p className="text-sm font-semibold text-purple-800">
            ✏️ {revisionJobs.length} Proposal{revisionJobs.length !== 1 ? 's' : ''} — Client Requested Changes
          </p>
          <div className="space-y-1.5">
            {revisionJobs.map(r => (
              <div key={r.proposalId} className="flex items-center justify-between text-sm bg-white rounded border border-purple-200 px-3 py-2 gap-3">
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{r.jobTitle ?? 'Job'}</span>
                  <span className="text-xs text-muted-foreground ml-2">{r.accountName}</span>
                  {r.revisionNotes && (
                    <p className="text-xs text-purple-700 mt-0.5 truncate">"{r.revisionNotes}"</p>
                  )}
                </div>
                <Link href={`/proposals/${r.proposalId}`} className="text-xs text-purple-700 font-medium hover:underline shrink-0">
                  Review & Revise →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        {allJobs.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No jobs yet"
            description="Jobs are created automatically when a notice is parsed, or you can create one manually."
          />
        ) : (
          <div className="rounded-lg border border-border overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  {['Job', 'Account / Property', 'Stage', 'Urgency', 'Reviewer', 'Created', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allJobs.map((job) => {
                  const riskFlags = (job.riskFlags as string[]) ?? [];
                  const isCritical = job.urgency === 'critical';
                  const hasRisk = riskFlags.length > 0;
                  return (
                    <tr
                      key={job.id}
                      className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${
                        isCritical ? 'bg-red-50/40' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{job.title ?? 'Untitled Job'}</div>
                        {hasRisk && (
                          <div className="flex gap-1 mt-0.5 flex-wrap">
                            {riskFlags.slice(0, 2).map((flag) => (
                              <span key={flag} className="text-xs bg-red-100 text-red-700 rounded px-1.5 py-0.5 capitalize">
                                {flag.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">{job.accountName ?? '—'}</div>
                        {job.propertyName && (
                          <div className="text-xs text-muted-foreground">{job.propertyName}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge variant="job_stage" value={job.stage} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge variant="urgency" value={job.urgency} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {job.reviewerName ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(job.createdAt)}
                      </td>
                      <td className="px-4 py-2 pr-4">
                        <Link
                          href={`/jobs/${job.id}`}
                          className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
