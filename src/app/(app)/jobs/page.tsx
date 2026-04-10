import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { jobs, accounts, properties, users } from '@/drizzle/schema';
import { desc, eq } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { formatDate } from '@/lib/utils';
import { Briefcase, AlertTriangle } from 'lucide-react';

export const metadata: Metadata = { title: 'Jobs' };

export default async function JobsPage() {
  await requireRole('admin', 'reviewer', 'dispatcher');

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
      propertyCity: properties.city,
      reviewerName: users.fullName,
    })
    .from(jobs)
    .leftJoin(accounts, eq(jobs.accountId, accounts.id))
    .leftJoin(properties, eq(jobs.propertyId, properties.id))
    .leftJoin(users, eq(jobs.assignedReviewerId, users.id))
    .orderBy(desc(jobs.createdAt))
    .limit(200);

  // Compute summary counts
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
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Job</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stage</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Urgency</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reviewer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Flags</th>
              </tr>
            </thead>
            <tbody>
              {allJobs.map((job) => {
                const flags = (job.riskFlags as string[]) ?? [];
                const isOverdue = job.nextActionDate && new Date(job.nextActionDate) < new Date();

                return (
                  <tr
                    key={job.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link href={`/jobs/${job.id}`} className="block hover:text-blue-600">
                        <div className="font-medium text-foreground">
                          {job.title ?? 'Untitled Job'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {job.accountName ?? '—'}
                          {job.propertyCity ? ` · ${job.propertyCity}` : ''}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge variant="job_stage" value={job.stage} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge variant="urgency" value={job.urgency} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {job.reviewerName ?? 'Unassigned'}
                    </td>
                    <td className="px-4 py-3">
                      {job.nextActionDate ? (
                        <span className={`text-xs ${isOverdue ? 'text-red-600 font-semibold' : 'text-foreground'}`}>
                          {isOverdue ? '⚠ ' : ''}{formatDate(job.nextActionDate)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        {job.fortyEightHourRequired && (
                          <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 rounded px-1.5 py-0.5">48hr</span>
                        )}
                        {job.complianceCoordinationRequired && (
                          <span className="text-xs bg-purple-100 text-purple-700 border border-purple-200 rounded px-1.5 py-0.5">Compliance</span>
                        )}
                        {flags.map((f) => (
                          <span key={f} className="text-xs bg-red-100 text-red-700 border border-red-200 rounded px-1.5 py-0.5">{f}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
