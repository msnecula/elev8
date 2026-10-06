import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { db } from '@/server/db/client';
import { jobs, accounts, proposals, notices } from '@/drizzle/schema';
import { desc, eq, and, notInArray, count } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import {
  Briefcase, AlertTriangle, FileText, Clock,
  Plus, ArrowRight, XCircle, TrendingUp,
} from 'lucide-react';
import { JOB_STAGE_LABELS } from '@/lib/constants';

export const metadata: Metadata = { title: 'Dashboard — Elev8 Comply' };

const TERMINAL_STAGES = ['completed', 'cancelled'] as const;

const PIPELINE_STAGES = [
  'notice_received',
  'under_review',
  'proposal_drafted',
  'proposal_sent',
  'approved',
  'scheduled',
  'in_progress',
] as const;

const STAGE_COLORS: Record<string, string> = {
  notice_received: 'bg-slate-400',
  under_review: 'bg-blue-400',
  proposal_drafted: 'bg-purple-500',
  proposal_sent: 'bg-indigo-500',
  approved: 'bg-green-500',
  scheduled: 'bg-teal-500',
  in_progress: 'bg-cyan-500',
};

export default async function DashboardPage() {
  const user = await requireUser();

  // Role-based redirect — only admin/reviewer get the full dashboard
  if (user.role === 'dispatcher') redirect('/jobs');
  if (user.role === 'technician') redirect('/technician');
  if (user.role === 'client') redirect('/client');

  const today = new Date().toISOString().split('T')[0];

  const [activeJobRows, stageCountRows, draftProposalResult, recentJobs, recentNotices] =
    await Promise.all([
      // Lightweight fetch of active jobs — all metrics derived from this
      db
        .select({ urgency: jobs.urgency, nextActionDate: jobs.nextActionDate })
        .from(jobs)
        .where(notInArray(jobs.stage, [...TERMINAL_STAGES])),

      // Stage breakdown (active jobs only)
      db
        .select({ stage: jobs.stage, total: count() })
        .from(jobs)
        .where(notInArray(jobs.stage, [...TERMINAL_STAGES]))
        .groupBy(jobs.stage),

      // Draft proposals waiting for someone to review + send
      db
        .select({ cnt: count() })
        .from(proposals)
        .leftJoin(jobs, eq(proposals.jobId, jobs.id))
        .where(and(eq(proposals.status, 'draft'), eq(jobs.stage, 'proposal_drafted'))),

      // Recent 10 jobs — main table
      db
        .select({
          id: jobs.id,
          title: jobs.title,
          stage: jobs.stage,
          urgency: jobs.urgency,
          createdAt: jobs.createdAt,
          nextActionDate: jobs.nextActionDate,
          accountName: accounts.name,
        })
        .from(jobs)
        .leftJoin(accounts, eq(jobs.accountId, accounts.id))
        .orderBy(desc(jobs.createdAt))
        .limit(10),

      // Recent 6 notices
      db
        .select({
          id: notices.id,
          fileName: notices.fileName,
          status: notices.status,
          createdAt: notices.createdAt,
          intakeMethod: notices.intakeMethod,
        })
        .from(notices)
        .orderBy(desc(notices.createdAt))
        .limit(6),
    ]);

  // ── Derive metrics ──────────────────────────────────────────────────────────
  const totalActive = activeJobRows.length;
  const criticalCount = activeJobRows.filter((j) => j.urgency === 'critical').length;
  const overdueCount = activeJobRows.filter(
    (j) => j.nextActionDate && j.nextActionDate < today,
  ).length;
  const draftProposals = Number(draftProposalResult[0]?.cnt ?? 0);
  const parseFailedCount = recentNotices.filter((n) => n.status === 'parse_failed').length;

  // Stage map for the pipeline bars
  const stageMap = Object.fromEntries(stageCountRows.map((r) => [r.stage, Number(r.total)]));
  const pipelineMax = Math.max(...PIPELINE_STAGES.map((s) => stageMap[s] ?? 0), 1);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Pipeline health at a glance">
        <Button asChild size="sm">
          <Link href="/notices/new">
            <Plus className="h-4 w-4 mr-1.5" />
            New Notice
          </Link>
        </Button>
      </PageHeader>

      {/* ── Stat cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Jobs"
          value={totalActive}
          icon={<Briefcase className="h-5 w-5 text-blue-600" />}
          bg="bg-blue-50 border-blue-100"
          href="/jobs"
        />
        <StatCard
          label="Critical"
          value={criticalCount}
          icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
          bg={criticalCount > 0 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-200'}
          valueClass={criticalCount > 0 ? 'text-red-700' : undefined}
          href="/jobs"
        />
        <StatCard
          label="Proposals to Review"
          value={draftProposals}
          icon={<FileText className="h-5 w-5 text-purple-600" />}
          bg={draftProposals > 0 ? 'bg-purple-50 border-purple-100' : 'bg-slate-50 border-slate-200'}
          valueClass={draftProposals > 0 ? 'text-purple-700' : undefined}
          href="/jobs"
        />
        <StatCard
          label="Overdue Actions"
          value={overdueCount}
          icon={<Clock className="h-5 w-5 text-orange-500" />}
          bg={overdueCount > 0 ? 'bg-orange-50 border-orange-100' : 'bg-slate-50 border-slate-200'}
          valueClass={overdueCount > 0 ? 'text-orange-700' : undefined}
          href="/jobs"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Pipeline breakdown ────────────────────────────────────────────── */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Active Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {PIPELINE_STAGES.map((stage) => {
              const cnt = stageMap[stage] ?? 0;
              const pct = Math.round((cnt / pipelineMax) * 100);
              return (
                <div key={stage} className="flex items-center gap-3">
                  <div className="w-36 text-xs text-muted-foreground truncate shrink-0">
                    {JOB_STAGE_LABELS[stage] ?? stage}
                  </div>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${STAGE_COLORS[stage] ?? 'bg-blue-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-6 text-xs font-semibold text-right tabular-nums shrink-0">
                    {cnt > 0 ? cnt : <span className="text-muted-foreground">0</span>}
                  </div>
                </div>
              );
            })}
            {totalActive === 0 && (
              <p className="text-xs text-muted-foreground pt-1">No active jobs in the pipeline.</p>
            )}
          </CardContent>
        </Card>

        {/* ── Recent Notices ────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Recent Notices</CardTitle>
              <Link href="/notices" className="text-xs text-blue-600 hover:underline">
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {parseFailedCount > 0 && (
              <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2.5 py-1.5 mb-1">
                <XCircle className="h-3.5 w-3.5 shrink-0" />
                {parseFailedCount} parse failure{parseFailedCount !== 1 ? 's' : ''} — needs attention
              </div>
            )}
            {recentNotices.length === 0 ? (
              <p className="text-xs text-muted-foreground">No notices yet.</p>
            ) : (
              recentNotices.map((n) => (
                <Link
                  key={n.id}
                  href={`/notices/${n.id}`}
                  className="flex items-center justify-between p-2 rounded border border-border hover:bg-muted/40 transition-colors gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{n.fileName ?? 'Notice'}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(n.createdAt)}</p>
                  </div>
                  <StatusBadge
                    variant="notice_status"
                    value={n.status ?? 'received'}
                    className="shrink-0"
                  />
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Jobs table ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Recent Jobs</CardTitle>
            <Link
              href="/jobs"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {recentJobs.length === 0 ? (
            <p className="text-xs text-muted-foreground px-4 py-3">No jobs yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {['Job', 'Account', 'Stage', 'Urgency', 'Next Action', 'Created', ''].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((job) => {
                  const isOverdue =
                    job.nextActionDate && job.nextActionDate < today &&
                    !TERMINAL_STAGES.includes(job.stage as typeof TERMINAL_STAGES[number]);
                  return (
                    <tr
                      key={job.id}
                      className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${
                        job.urgency === 'critical' ? 'bg-red-50/40' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5 font-medium max-w-[180px]">
                        <span className="truncate block">{job.title ?? 'Untitled'}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {job.accountName ?? '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge variant="job_stage" value={job.stage} />
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge variant="urgency" value={job.urgency} />
                      </td>
                      <td className={`px-4 py-2.5 text-xs ${isOverdue ? 'text-orange-600 font-semibold' : 'text-muted-foreground'}`}>
                        {job.nextActionDate ? formatDate(job.nextActionDate) : '—'}
                        {isOverdue && <span className="ml-1 text-orange-500">⚠</span>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {formatDate(job.createdAt)}
                      </td>
                      <td className="px-4 py-2">
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  bg,
  valueClass,
  href,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  bg: string;
  valueClass?: string;
  href: string;
}) {
  return (
    <Link href={href} className="block group">
      <div
        className={`rounded-lg border p-4 hover:shadow-sm transition-all ${bg}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-3xl font-bold tabular-nums ${valueClass ?? 'text-foreground'}`}>
              {value}
            </p>
          </div>
          <div className="mt-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
            {icon}
          </div>
        </div>
      </div>
    </Link>
  );
}
