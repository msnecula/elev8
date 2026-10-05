import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { notices, jobs, accounts, properties } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, FileText, ExternalLink } from 'lucide-react';
import ParsedDataPanel from '@/app/(app)/notices/[id]/ParsedDataPanel';
import ActionPlanApproveForm from './ActionPlanApproveForm';
import type { ParsedNoticeData } from '@/server/services/noticeParser';

export const metadata: Metadata = { title: 'Review Action Plan' };

export default async function ActionPlanReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole('admin', 'dispatcher');

  const result = await db
    .select({
      notice: notices,
      account: { name: accounts.name },
      property: { name: properties.name, address: properties.address },
      job: { id: jobs.id, stage: jobs.stage, title: jobs.title },
    })
    .from(notices)
    .leftJoin(accounts, eq(notices.accountId, accounts.id))
    .leftJoin(properties, eq(notices.propertyId, properties.id))
    .leftJoin(jobs, eq(jobs.noticeId, notices.id))
    .where(eq(notices.id, id))
    .limit(1);

  if (!result[0]) notFound();
  const { notice, account, property, job } = result[0];

  if (!notice.parsedData) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-muted-foreground">This notice has not been parsed yet.</p>
        <Button asChild variant="outline">
          <Link href={`/notices/${id}`}>View Notice</Link>
        </Button>
      </div>
    );
  }

  const parsedData = notice.parsedData as unknown as ParsedNoticeData;
  const confidence = (parsedData as any).parseConfidence ?? 0.8;

  const viewPdfUrl = notice.filePath
    ? `/api/uploads/sign?path=${encodeURIComponent(notice.filePath)}&bucket=notices&redirect=true`
    : null;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dispatch"><ChevronLeft className="h-4 w-4 mr-1" />Dispatch</Link>
          </Button>
          <div>
            <h1 className="font-semibold">{parsedData.propertyName || account?.name || 'Action Plan Review'}</h1>
            <p className="text-xs text-muted-foreground">{parsedData.propertyAddress || property?.address}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
            Pending Dispatch Review
          </Badge>
          {viewPdfUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={viewPdfUrl} target="_blank" rel="noopener noreferrer">
                <FileText className="h-4 w-4 mr-1.5" />
                Open PDF
                <ExternalLink className="h-3 w-3 ml-1.5" />
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Review banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 shrink-0">
        <p className="text-sm text-amber-800">
          <strong>Dispatch Review:</strong> Verify all AI-extracted details against the original PDF before approving and sending to a technician.
        </p>
      </div>

      {/* Two-column body */}
      <div className="flex-1 overflow-hidden grid grid-cols-2">
        {/* Left: PDF viewer */}
        <div className="border-r border-border flex flex-col overflow-hidden">
          <div className="px-4 py-2 bg-muted/40 border-b border-border shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Original Document — {notice.fileName}
            </p>
          </div>
          {viewPdfUrl ? (
            <iframe src={viewPdfUrl} className="flex-1 w-full" title="Notice Document" />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              No document attached
            </div>
          )}
        </div>

        {/* Right: Action plan + approve */}
        <div className="overflow-y-auto">
          <div className="px-4 py-2 bg-muted/40 border-b border-border sticky top-0 z-10">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              AI-Generated Action Plan
            </p>
          </div>
          <div className="p-5 space-y-5">
            <ParsedDataPanel data={parsedData} confidence={confidence} />
            <ActionPlanApproveForm
              noticeId={id}
              jobId={job?.id ?? null}
              parsedData={parsedData}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
