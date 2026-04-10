import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { notices, accounts, properties, users, jobs } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatFileSize, timeAgo } from '@/lib/utils';
import { FileText, Briefcase, AlertCircle, ChevronRight } from 'lucide-react';
import ParsedDataPanel from './ParsedDataPanel';
import NoticeActions from './NoticeActions';

export const metadata: Metadata = { title: 'Notice Detail' };

export default async function NoticeDetailPage({ params }: { params: { id: string } }) {
  const currentUser = await requireRole('admin', 'reviewer', 'dispatcher');

  const result = await db
    .select({
      notice: notices,
      account: accounts,
      property: properties,
      reviewer: { id: users.id, fullName: users.fullName, email: users.email },
    })
    .from(notices)
    .leftJoin(accounts, eq(notices.accountId, accounts.id))
    .leftJoin(properties, eq(notices.propertyId, properties.id))
    .leftJoin(users, eq(notices.assignedReviewerId, users.id))
    .where(eq(notices.id, params.id))
    .limit(1);

  if (!result[0]) notFound();
  const { notice: n, account, property, reviewer } = result[0];

  const linkedJobs = await db
    .select({ id: jobs.id, title: jobs.title, stage: jobs.stage, urgency: jobs.urgency })
    .from(jobs)
    .where(eq(jobs.noticeId, params.id));

  return (
    <div className="space-y-6">
      <PageHeader title={account?.name ?? 'Notice Detail'} description={`Received ${timeAgo(n.createdAt)}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge variant="notice_status" value={n.status} />
          {n.urgency && <StatusBadge variant="urgency" value={n.urgency} />}
          <NoticeActions
            noticeId={n.id}
            currentStatus={n.status}
            userRole={currentUser.role}
            hasFile={!!n.filePath}
          />
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* File info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Uploaded Document
              </CardTitle>
            </CardHeader>
            <CardContent>
              {n.filePath ? (
                <div className="flex items-center justify-between p-3 rounded-md bg-muted/50 border border-border">
                  <div>
                    <p className="text-sm font-medium">{n.fileName ?? 'Document'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {n.mimeType} {n.fileSize ? `· ${formatFileSize(n.fileSize)}` : ''}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <a href={`/api/uploads/sign?path=${encodeURIComponent(n.filePath)}&bucket=notices`} target="_blank" rel="noopener noreferrer">
                      View PDF
                    </a>
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No file attached.</p>
              )}
            </CardContent>
          </Card>

          {n.parsedData && <ParsedDataPanel data={n.parsedData} />}

          {n.parseError && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2 text-red-700">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Parse Error</p>
                    <p className="text-xs mt-1">{n.parseError}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {n.rawText && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Raw Extracted Text</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 rounded p-3 max-h-64 overflow-y-auto">
                  {n.rawText}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Account</p><p className="font-medium">{account?.name ?? '—'}</p></div>
              <div><p className="text-xs text-muted-foreground">Property</p><p className="font-medium">{property ? `${property.name}, ${property.city}` : '—'}</p></div>
              <div><p className="text-xs text-muted-foreground">Intake Method</p><p className="capitalize">{n.intakeMethod?.replace('_', ' ') ?? '—'}</p></div>
              <div>
                <p className="text-xs text-muted-foreground">State Deadline</p>
                <p className={n.stateDeadline && new Date(n.stateDeadline) < new Date() ? 'text-red-600 font-medium' : ''}>
                  {formatDate(n.stateDeadline)}
                </p>
              </div>
              <div><p className="text-xs text-muted-foreground">Assigned Reviewer</p><p>{reviewer?.fullName ?? 'Unassigned'}</p></div>
              <div><p className="text-xs text-muted-foreground">Received</p><p>{formatDate(n.createdAt, 'MMM d, yyyy h:mm a')}</p></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                Linked Jobs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {linkedJobs.length === 0 ? (
                <p className="text-xs text-muted-foreground">No jobs linked yet.</p>
              ) : (
                <div className="space-y-2">
                  {linkedJobs.map((job) => (
                    <Link key={job.id} href={`/jobs/${job.id}`}
                      className="flex items-center justify-between p-2 rounded border border-border hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="text-xs font-medium truncate">{job.title ?? 'Untitled Job'}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <StatusBadge variant="job_stage" value={job.stage} />
                        </div>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
