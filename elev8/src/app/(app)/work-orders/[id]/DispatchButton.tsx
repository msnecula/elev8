'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';
import { dispatchWorkOrder } from '@/server/actions/dispatch';
import { Send, Loader2, AlertTriangle } from 'lucide-react';

interface DispatchButtonProps {
  workOrderId: string;
  fortyEightHourRequired: boolean;
  fortyEightHourStatus: string;
}

export default function DispatchButton({
  workOrderId,
  fortyEightHourRequired,
  fortyEightHourStatus,
}: DispatchButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isBlocked =
    fortyEightHourRequired && fortyEightHourStatus === 'overdue';

  function handleDispatch() {
    startTransition(async () => {
      const result = await dispatchWorkOrder(workOrderId);
      if (result.success) {
        toast.success('Dispatched — technician notified by SMS');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (isBlocked) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-red-800">Dispatch is held</p>
          <p className="text-red-700 text-xs mt-0.5">
            The 48-hour notice deadline has passed. Mark the notice as sent before dispatching.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Button
      onClick={handleDispatch}
      disabled={isPending}
      className="w-full"
    >
      {isPending ? (
        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Dispatching…</>
      ) : (
        <><Send className="mr-2 h-4 w-4" />Dispatch to Technician</>
      )}
    </Button>
  );
}
