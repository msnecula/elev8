'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';
import type { UserRole } from '@/types/auth';
import { CheckCircle2, Truck, MapPin, Clock, Loader2 } from 'lucide-react';

interface WorkOrderActionsProps {
  workOrderId: string;
  currentStatus: string;
  fortyEightHourStatus: string;
  fortyEightHourRequired: boolean;
  userRole: UserRole;
  technicianId: string | null;
  currentUserId: string;
}

const TECH_TRANSITIONS: Record<string, { label: string; next: string; icon: React.ComponentType<{ className?: string }> }> = {
  dispatched: { label: 'Mark Ready',  next: 'ready',     icon: CheckCircle2 },
  ready:      { label: 'En Route',    next: 'en_route',  icon: Truck },
  en_route:   { label: 'On Site',     next: 'on_site',   icon: MapPin },
  on_site:    { label: 'Complete Job',next: 'completed', icon: CheckCircle2 },
};

export default function WorkOrderActions({
  workOrderId, currentStatus, userRole, technicianId,
}: WorkOrderActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showComplete, setShowComplete] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');

  const isTechnician = userRole === 'technician';
  const isDispatcher = userRole === 'admin' || userRole === 'dispatcher';
  const transition = TECH_TRANSITIONS[currentStatus];

  const showTechActions = isTechnician && transition && currentStatus !== 'completed';
  const showDispatcherHold = isDispatcher && ['dispatched','assigned','ready','en_route'].includes(currentStatus);

  if (!showTechActions && !showDispatcherHold) return null;

  function updateStatus(newStatus: string, notes?: string) {
    startTransition(async () => {
      const { updateWorkOrderStatus } = await import('@/server/actions/workOrders');
      const result = await updateWorkOrderStatus({
        workOrderId,
        status: newStatus as never,
        completionNotes: notes,
      });
      if (result.success) {
        toast.success(`Status updated to ${newStatus.replace('_', ' ')}`);
        setShowComplete(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <h3 className="text-sm font-semibold">Actions</h3>

      <div className="flex flex-wrap gap-2">
        {/* Technician transitions */}
        {isTechnician && transition && currentStatus !== 'on_site' && (
          <Button size="sm" onClick={() => updateStatus(transition.next)} disabled={isPending}>
            <transition.icon className="h-4 w-4 mr-1.5" />
            {transition.label}
          </Button>
        )}

        {/* Complete job — shows inline form */}
        {isTechnician && currentStatus === 'on_site' && !showComplete && (
          <Button
            size="sm"
            onClick={() => setShowComplete(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            Complete Job
          </Button>
        )}

        {/* Dispatcher hold */}
        {showDispatcherHold && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateStatus('held')}
            disabled={isPending}
            className="text-orange-600 border-orange-300 hover:bg-orange-50"
          >
            <Clock className="h-4 w-4 mr-1.5" />
            Hold
          </Button>
        )}
      </div>

      {/* Completion form */}
      {showComplete && (
        <div className="mt-2 p-4 border border-border rounded-lg bg-muted/30 space-y-3">
          <p className="text-sm font-medium">Complete Work Order</p>
          <textarea
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Describe the work completed, any issues encountered, or follow-up items…"
            value={completionNotes}
            onChange={e => setCompletionNotes(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => updateStatus('completed', completionNotes)}
              disabled={isPending || !completionNotes.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              {isPending
                ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving…</>
                : 'Confirm Completion'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setShowComplete(false); setCompletionNotes(''); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {currentStatus === 'completed' && (
        <div className="flex items-center gap-2 text-green-700 text-sm">
          <CheckCircle2 className="h-4 w-4" />
          <span>This work order is complete.</span>
        </div>
      )}
    </div>
  );
}
