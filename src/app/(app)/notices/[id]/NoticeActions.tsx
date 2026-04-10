'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';
import { triggerNoticeParsing, markNoticeReviewed } from '@/server/actions/notices';
import { Brain, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import type { UserRole } from '@/types/auth';

interface NoticeActionsProps {
  noticeId: string;
  currentStatus: string;
  userRole: UserRole;
  hasFile: boolean;
}

export default function NoticeActions({ noticeId, currentStatus, userRole, hasFile }: NoticeActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const canParse = userRole !== 'client' && hasFile && ['received', 'parse_failed'].includes(currentStatus);
  const canReParse = userRole !== 'client' && hasFile && currentStatus === 'parsed';
  const canMarkReviewed = (userRole === 'admin' || userRole === 'reviewer') && currentStatus === 'parsed';

  function handleParse() {
    startTransition(async () => {
      const result = await triggerNoticeParsing(noticeId);
      if (result.success) {
        toast.success('Parsing complete', { description: result.data.jobId ? 'Job created automatically.' : 'Notice parsed.' });
        router.refresh();
      } else {
        toast.error('Parsing failed', { description: result.error });
      }
    });
  }

  function handleMarkReviewed() {
    startTransition(async () => {
      const result = await markNoticeReviewed(noticeId);
      if (result.success) {
        toast.success('Notice marked as reviewed');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {canParse && (
        <Button onClick={handleParse} disabled={isPending} size="sm">
          {isPending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Parsing…</> : <><Brain className="h-4 w-4 mr-1.5" />Parse with AI</>}
        </Button>
      )}
      {canReParse && (
        <Button onClick={handleParse} disabled={isPending} size="sm" variant="outline">
          {isPending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Re-parsing…</> : <><RefreshCw className="h-4 w-4 mr-1.5" />Re-Parse</>}
        </Button>
      )}
      {canMarkReviewed && (
        <Button onClick={handleMarkReviewed} disabled={isPending} size="sm" variant="outline"
          className="text-green-700 border-green-300 hover:bg-green-50">
          <CheckCircle2 className="h-4 w-4 mr-1.5" />Mark Reviewed
        </Button>
      )}
    </div>
  );
}
