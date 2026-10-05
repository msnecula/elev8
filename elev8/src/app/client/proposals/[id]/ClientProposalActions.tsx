'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/lib/toast';
import { approveProposal, rejectProposal, requestRevision } from '@/server/actions/proposals';
import { CheckCircle2, XCircle, RefreshCw, Loader2 } from 'lucide-react';

export default function ClientProposalActions({
  proposalId,
  status,
}: {
  proposalId: string;
  status: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [view, setView] = useState<'idle' | 'revision' | 'reject'>('idle');
  const [revisionNotes, setRevisionNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  if (status === 'approved') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center space-y-1">
        <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto" />
        <p className="text-sm font-semibold text-green-800">Proposal Approved</p>
        <p className="text-xs text-green-700">Our team will contact you to schedule the work.</p>
      </div>
    );
  }

  if (status === 'revision_requested') {
    return (
      <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
        <p className="text-sm font-medium text-orange-800">Changes Requested</p>
        <p className="text-xs text-orange-700 mt-1">Our team is reviewing your feedback and will send an updated proposal.</p>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-muted-foreground">This proposal has been declined.</p>
      </div>
    );
  }

  if (status !== 'sent') return null;

  function act(fn: () => Promise<{ success: boolean; error?: string }>) {
    startTransition(async () => {
      const r = await fn();
      if (r.success) router.refresh();
      else toast.error(r.error ?? 'Action failed');
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <h3 className="text-sm font-semibold">Your Response</h3>

      {view === 'idle' && (
        <div className="space-y-2">
          <Button className="w-full bg-green-600 hover:bg-green-700 text-white" size="sm" disabled={isPending}
            onClick={() => act(async () => {
              const r = await approveProposal({ proposalId });
              if (r.success) toast.success('Proposal approved! We\'ll be in touch to schedule.');
              return r;
            })}>
            {isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
            Approve Proposal
          </Button>
          <Button variant="outline" className="w-full" size="sm" onClick={() => setView('revision')}>
            <RefreshCw className="h-4 w-4 mr-1.5" />Request Changes
          </Button>
          <Button variant="outline" className="w-full text-destructive border-destructive/30 hover:bg-destructive/5" size="sm"
            onClick={() => setView('reject')}>
            <XCircle className="h-4 w-4 mr-1.5" />Decline
          </Button>
        </div>
      )}

      {view === 'revision' && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Describe what you'd like changed:</p>
          <Textarea rows={4} placeholder="e.g. Please break out the parts cost separately…"
            value={revisionNotes} onChange={e => setRevisionNotes(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" disabled={isPending || revisionNotes.trim().length < 10}
              onClick={() => act(async () => {
                const r = await requestRevision({ proposalId, revisionNotes });
                if (r.success) toast.success('Request sent — we\'ll revise and resend.');
                setView('idle');
                return r;
              })}>
              {isPending ? 'Sending…' : 'Send Request'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setView('idle'); setRevisionNotes(''); }}>Cancel</Button>
          </div>
        </div>
      )}

      {view === 'reject' && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Reason for declining (optional):</p>
          <Textarea rows={3} placeholder="Optional reason…"
            value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={isPending}
              onClick={() => act(async () => {
                const r = await rejectProposal({ proposalId, reason: rejectReason || undefined });
                if (r.success) toast.success('Proposal declined');
                setView('idle');
                return r;
              })}>
              {isPending ? 'Declining…' : 'Confirm Decline'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setView('idle'); setRejectReason(''); }}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
