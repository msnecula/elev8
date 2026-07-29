'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/lib/toast';
import { CheckCircle2, Loader2, Send, AlertTriangle } from 'lucide-react';
import type { ParsedNoticeData } from '@/server/services/noticeParser';

interface ActionPlanApproveFormProps {
  noticeId: string;
  jobId: string | null;
  parsedData: ParsedNoticeData;
}

export default function ActionPlanApproveForm({
  noticeId,
  jobId,
  parsedData,
}: ActionPlanApproveFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [approved, setApproved] = useState(false);

  function handleApprove() {
    startTransition(async () => {
      try {
        const { markNoticeReviewed } = await import('@/server/actions/notices');
        const result = await markNoticeReviewed(noticeId);

        if (!result.success) {
          toast.error(result.error ?? 'Failed to approve action plan');
          return;
        }

        setApproved(true);
        toast.success('Action Plan approved — ready to create work order');

        // Navigate to create work order if job exists
        if (jobId) {
          setTimeout(() => {
            router.push(`/work-orders/new?jobId=${jobId}`);
          }, 1500);
        } else {
          router.push('/dispatch');
        }
      } catch (err) {
        toast.error('Failed to approve action plan');
      }
    });
  }

  if (approved) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-5 text-center space-y-2">
        <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto" />
        <p className="font-semibold text-green-800">Action Plan Approved</p>
        <p className="text-sm text-green-700">Redirecting to create work order…</p>
      </div>
    );
  }

  const criticalSteps = parsedData.actionPlan?.filter(s => s.priority === 'critical') ?? [];
  const hasNotificationStep = parsedData.actionPlan?.some(s => s.requiresNotification) ?? false;

  return (
    <div className="rounded-lg border-2 border-blue-200 bg-blue-50/50 p-5 space-y-4">
      <h3 className="font-semibold text-blue-900">Dispatch Review Checklist</h3>

      {/* Pre-approve checklist */}
      <div className="space-y-2 text-sm">
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" className="mt-0.5" />
          <span>Verified property name and address match the original document</span>
        </label>
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" className="mt-0.5" />
          <span>Confirmed compliance deadline is correct</span>
        </label>
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" className="mt-0.5" />
          <span>Verified all safety tests listed match the document</span>
        </label>
        {hasNotificationStep && (
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" className="mt-0.5" />
            <span className="font-medium text-red-800">
              Confirmed advance notification requirements ({parsedData.advanceNotificationHours ?? 48}-hour notice)
            </span>
          </label>
        )}
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" className="mt-0.5" />
          <span>Action Plan steps are accurate and complete</span>
        </label>
      </div>

      {/* Warnings */}
      {criticalSteps.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 space-y-1">
          <p className="font-semibold flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            {criticalSteps.length} Critical Step{criticalSteps.length > 1 ? 's' : ''} Require Immediate Action:
          </p>
          {criticalSteps.map(s => (
            <p key={s.stepNumber}>• Step {s.stepNumber}: {s.title}</p>
          ))}
        </div>
      )}

      {/* Dispatcher notes */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Additional Notes for Technician <span className="text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          value={dispatchNotes}
          onChange={e => setDispatchNotes(e.target.value)}
          placeholder="Any additional instructions or context for the field technician…"
          rows={3}
          className="text-sm"
        />
      </div>

      {/* Approve button */}
      <Button
        onClick={handleApprove}
        disabled={isPending}
        className="w-full bg-green-600 hover:bg-green-700 text-white"
        size="lg"
      >
        {isPending
          ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Approving…</>
          : <><CheckCircle2 className="h-4 w-4 mr-2" />Approve Action Plan & Create Work Order</>}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Approving confirms you have reviewed the AI-generated plan against the original document.
      </p>
    </div>
  );
}
