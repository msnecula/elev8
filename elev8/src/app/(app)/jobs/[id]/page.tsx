import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { jobs, accounts, properties, notices, activityLogs, users, workOrders, proposals } from '@/drizzle/schema';
import { eq, desc } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatCurrency, timeAgo } from '@/lib/utils';
import { FileText, Briefcase, Clock, AlertTriangle, ChevronRight, ClipboardList } from 'lucide-react';
import ActivityLogFeed from '@/components/jobs/ActivityLogFeed';

export const metadata: Metadata = { title: 'Job Detail' };

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await requireRole('admin', 'reviewer', 'dispatcher');

  const result = await db
    .select({
      job: jobs,
      account: accounts,
      property: properties,
      notice: { id: notices.id, fileName: notices.fileName, status: notices.status },
      reviewer: { id: users.id, fullName: users.fullName },
    })
    .from(jobs)
    .leftJoin(accounts, eq(jobs.accountId, accounts.id))
    .leftJoin(properties, eq(jobs.propertyId, properties.id))
    .leftJoin(notices, eq(jobs.noticeId, notices.id))
    .leftJoin(users, eq(jobs.assignedReviewerId, users.id))
    .where(eq(jobs.id, id))
    .limit(1);

  if (!result[0]) notFound();
  const { job, account, property, notice, reviewer } = result[0];

  // Fetch related records
  const [logs, linkedWorkOrders, linkedProposals] = await Promise.all([
    db
      .select({ log: activityLogs, actor: { fullName: users.fullName } })
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.actorId, users.id))
      .where(eq(activityLogs.entityId, id))
      .orderBy(desc(activityLogs.createdAt))
      .limit(50),
    db
      .select({ id: workOrders.id, status: workOrders.status, scheduledStart: workOrders.scheduledStart, fortyEightHourStatus: workOrders.fortyEightHourStatus })
      .from(workOrders)
      .where(eq(workOrders.jobId, id))
      .orderBy(desc(workOrders.createdAt)),
    db
      .select({ id: proposals.id, status: proposals.status, totalAmount: proposals.totalAmount, version: proposals.version })
      .from(proposals)
      .where(eq(proposals.jobId, id))
      .orderBy(desc(proposals.createdAt)),
  ]);

  const riskFlags = (job.riskFlags as string[]) ?? [];
  const draftProposal = job.stage === 'proposal_drafted'
    ? linkedProposals.find(p => p.status === 'draft') ?? null
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader title={job.title ?? 'Job Detail'} description={account?.name ?? ''}>
        <div className="flex items-center gap-2">
          <StatusBadge variant="job_stage" value={job.stage} />
          <StatusBadge variant="urgency" value={job.urgency} />
        </div>
      </PageHeader>

      {/* AI proposal draft ready CTA */}
      {draftProposal && (
        <div className="flex items-start sm:items-center justify-between gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-900">AI Proposal Draft Ready</p>
              <p className="text-xs text-blue-700 mt-0.5">
                Review the AI-generated proposal, adjust line items if needed, then send to the client.
                {draftProposal.totalAmount && (
                  <span className="font-semibold ml-1">Est. {formatCurrency(draftProposal.totalAmount)}</span>
                )}
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white">
            <Link href={`/proposals/${draftProposal.id}`}>Review &amp; Send →</Link>
          </Button>
        </div>
      )}

      {/* Risk flags banner */}
      {riskFlags.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="font-medium">Risk flags:</span>
          {riskFlags.map((f) => <Badge key={f} className="bg-red-100 text-red-700 border-red-200 border">{f}</Badge>)}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard label="Stage" value={<StatusBadge variant="job_stage" value={job.stage} />} />
            <SummaryCard label="Urgency" value={<StatusBadge variant="urgency" value={job.urgency} />} />
            <SummaryCard
              label="Est. Duration"
              value={job.estimatedDurationHours ? `${job.estimatedDurationHours} hrs` : '—'}
            />
            <SummaryCard
              label="Est. Materials"
              value={job.estimatedMaterialsCost ? formatCurrency(job.estimatedMaterialsCost) : '—'}
            />
          </div>

          {/* Scope notes */}
          {job.internalNotes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Internal Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{job.internalNotes}</p>
              </CardContent>
            </Card>
          )}

          {/* Work Orders */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  Work Orders
                </CardTitle>
                {(currentUser.role === 'admin' || currentUser.role === 'dispatcher') && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/work-orders/new?jobId=${id}`}>Create Work Order</Link>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {linkedWorkOrders.length === 0 ? (
                <p className="text-xs text-muted-foreground">No work orders yet.</p>
              ) : (
                <div className="space-y-2">
                  {linkedWorkOrders.map((wo) => (
                    <Link key={wo.id} href={`/work-orders/${wo.id}`}
                      className="flex items-center justify-between p-2.5 rounded border border-border hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <StatusBadge variant="work_order_status" value={wo.status} />
                        {wo.scheduledStart && (
                          <span className="text-xs text-muted-foreground">{formatDate(wo.scheduledStart)}</span>
                        )}
                        <StatusBadge variant="forty_eight_hour" value={wo.fortyEightHourStatus} />
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Proposals */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Proposals
                </CardTitle>
                {['admin', 'reviewer', 'dispatcher'].includes(currentUser.role) && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/proposals/new?jobId=${id}`}>New Proposal</Link>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {linkedProposals.length === 0 ? (
                <p className="text-xs text-muted-foreground">No proposals yet.</p>
              ) : (
                <div className="space-y-2">
                  {linkedProposals.map((p) => (
                    <Link key={p.id} href={`/proposals/${p.id}`}
                      className="flex items-center justify-between p-2.5 rounded border border-border hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <StatusBadge variant="proposal_status" value={p.status} />
                        <span className="text-xs text-muted-foreground">v{p.version}</span>
                        {p.totalAmount && (
                          <span className="text-xs font-medium">{formatCurrency(p.totalAmount)}</span>
                        )}
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity log */}
          <ActivityLogFeed logs={logs.map((l) => ({ ...l.log, actorName: l.actor?.fullName }))} />
        </div>

        {/* Right column — details */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Job Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <DetailRow label="Account" value={account?.name} />
              <DetailRow label="Property" value={property ? `${property.name}, ${property.city}` : null} />
              <DetailRow label="Building Type" value={job.buildingType} />
              <DetailRow label="Skill Required" value={job.requiredSkillTag} />
              <DetailRow label="Reviewer" value={reviewer?.fullName ?? 'Unassigned'} />
              <DetailRow label="Next Action" value={formatDate(job.nextActionDate)} />
              <DetailRow label="Created" value={formatDate(job.createdAt)} />
              {notice && (
                <div>
                  <p className="text-xs text-muted-foreground">Source Notice</p>
                  <Link href={`/notices/${notice.id}`} className="text-blue-600 hover:underline text-sm">
                    {notice.fileName ?? 'View Notice'}
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Compliance flags */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Compliance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <FlagRow
                label="48-Hour Notice"
                required={job.fortyEightHourRequired ?? false}
              />
              <FlagRow
                label="Compliance Coordination"
                required={job.complianceCoordinationRequired ?? false}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium capitalize">{value ?? '—'}</p>
    </div>
  );
}

function FlagRow({ label, required }: { label: string; required: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <span className={`text-xs font-semibold ${required ? 'text-orange-600' : 'text-green-600'}`}>
        {required ? 'Required' : 'Not Required'}
      </span>
    </div>
  );
}
