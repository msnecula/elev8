'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';
import { markFortyEightHourSent } from '@/server/actions/workOrders';
import { formatDate, isWithinHours, isOverdue } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';

interface FortyEightHourPanelProps {
  workOrderId: string;
  required: boolean;
  status: string;
  deadline: Date | string | null;
  sentAt: Date | string | null;
  scheduledStart: Date | string | null;
}

export default function FortyEightHourPanel({
  workOrderId, required, status, deadline, sentAt, scheduledStart,
}: FortyEightHourPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!required) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <CheckCircle2 className="h-4 w-4" />
        <span>48-hour notice not required for this job</span>
      </div>
    );
  }

  const isDeadlineOverdue = deadline ? isOverdue(deadline) : false;
  const isDeadlineNear = deadline ? isWithinHours(deadline, 24) : false;
  const isSent = status === 'sent';

  function handleMarkSent() {
    startTransition(async () => {
      const result = await markFortyEightHourSent({ workOrderId });
      if (result.success) {
        toast.success('48-hour notice marked as sent');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">48-Hour Notice Status</span>
        <StatusBadge variant="forty_eight_hour" value={status} />
      </div>

      {scheduledStart && (
        <div className="text-sm">
          <p className="text-xs text-muted-foreground">Work scheduled for</p>
          <p className="font-medium">{formatDate(scheduledStart, 'EEEE, MMM d, yyyy \'at\' h:mm a')}</p>
        </div>
      )}

      {deadline && (
        <div className={`rounded-lg border p-3 ${
          isDeadlineOverdue && !isSent
            ? 'border-red-300 bg-red-50'
            : isDeadlineNear && !isSent
            ? 'border-amber-300 bg-amber-50'
            : 'border-border bg-muted/30'
        }`}>
          <div className="flex items-start gap-2">
            {isDeadlineOverdue && !isSent
              ? <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
              : isDeadlineNear && !isSent
              ? <Clock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              : <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
            <div>
              <p className={`text-sm font-medium ${
                isDeadlineOverdue && !isSent ? 'text-red-800' :
                isDeadlineNear && !isSent ? 'text-amber-800' : ''
              }`}>
                {isDeadlineOverdue && !isSent
                  ? 'Notice deadline has PASSED'
                  : isDeadlineNear && !isSent
                  ? 'Notice deadline approaching'
                  : 'Notice deadline'}
              </p>
              <p className={`text-xs mt-0.5 ${
                isDeadlineOverdue && !isSent ? 'text-red-700' :
                isDeadlineNear && !isSent ? 'text-amber-700' : 'text-muted-foreground'
              }`}>
                {formatDate(deadline, 'EEEE, MMM d, yyyy \'at\' h:mm a')}
              </p>
            </div>
          </div>
        </div>
      )}

      {isSent && sentAt && (
        <div className="flex items-center gap-2 text-green-700 text-sm">
          <CheckCircle2 className="h-4 w-4" />
          <span>Notice sent on {formatDate(sentAt, 'MMM d, yyyy \'at\' h:mm a')}</span>
        </div>
      )}

      {!isSent && status !== 'not_required' && (
        <Button
          size="sm"
          onClick={handleMarkSent}
          disabled={isPending}
          className={isDeadlineOverdue ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
          variant={isDeadlineOverdue ? 'default' : 'outline'}
        >
          {isPending
            ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Marking…</>
            : <><CheckCircle2 className="h-4 w-4 mr-1.5" />Mark Notice as Sent</>}
        </Button>
      )}
    </div>
  );
}
