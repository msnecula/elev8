'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/lib/toast';
import { sendProposal, approveProposal, rejectProposal, requestRevision } from '@/server/actions/proposals';
import { Send, CheckCircle2, XCircle, RefreshCw, Loader2 } from 'lucide-react';
import type { UserRole } from '@/types/auth';

interface ProposalActionsProps {
  proposalId: string;
  status: string;
  userRole: UserRole;
  jobId: string;
}

export default function ProposalActions({ proposalId, status, userRole, jobId }: ProposalActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showRevision, setShowRevision] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const isInternal = ['admin', 'reviewer', 'dispatcher'].includes(userRole);
  const isClient = userRole === 'client';

  function act(fn: () => Promise<{ success: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (result.success) {
        router.refresh();
      } else {
        toast.error(result.error ?? 'Action failed');
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <h3 className="text-sm font-semibold">Actions</h3>

      {/* INTERNAL: Send */}
      {isInternal && ['draft', 'revision_requested'].includes(status) && (
        <Button className="w-full" size="sm" disabled={isPending}
          onClick={() => act(async () => {
            const r = await sendProposal(proposalId);
            if (r.success) toast.success('Proposal sent to client');
            return r;
          })}>
          {isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
          Send to Client
        </Button>
      )}

      {/* CLIENT: Approve */}
      {isClient && status === 'sent' && (
        <Button className="w-full bg-green-600 hover:bg-green-700 text-white" size="sm" disabled={isPending}
          onClick={() => act(async () => {
            const r = await approveProposal({ proposalId });
            if (r.success) toast.success('Proposal approved! Our team will be in touch.');
            return r;
          })}>
          {isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
          Approve Proposal
        </Button>
      )}

      {/* CLIENT: Request revision */}
      {isClient && status === 'sent' && !showRevision && !showReject && (
        <Button variant="outline" className="w-full" size="sm"
          onClick={() => setShowRevision(true)}>
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Request Changes
        </Button>
      )}

      {isClient && showRevision && (
        <div className="space-y-2">
          <Textarea
            placeholder="Describe what needs to change…"
            value={revisionNotes}
            onChange={e => setRevisionNotes(e.target.value)}
            rows={3}
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={isPending || revisionNotes.trim().length < 10}
              onClick={() => act(async () => {
                const r = await requestRevision({ proposalId, revisionNotes });
                if (r.success) toast.success('Revision request sent');
                setShowRevision(false);
                return r;
              })}>
              {isPending ? 'Sending…' : 'Submit Request'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowRevision(false); setRevisionNotes(''); }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* CLIENT: Reject */}
      {isClient && status === 'sent' && !showReject && !showRevision && (
        <Button variant="outline" className="w-full text-destructive border-destructive/30 hover:bg-destructive/10" size="sm"
          onClick={() => setShowReject(true)}>
          <XCircle className="h-4 w-4 mr-1.5" />
          Decline
        </Button>
      )}

      {isClient && showReject && (
        <div className="space-y-2">
          <Textarea
            placeholder="Reason for declining (optional)…"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            rows={2}
          />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={isPending}
              onClick={() => act(async () => {
                const r = await rejectProposal({ proposalId, reason: rejectReason || undefined });
                if (r.success) toast.success('Proposal declined');
                setShowReject(false);
                return r;
              })}>
              {isPending ? 'Declining…' : 'Confirm Decline'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowReject(false); setRejectReason(''); }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Status messages */}
      {status === 'approved' && (
        <div className="flex items-center gap-2 text-green-700 text-sm">
          <CheckCircle2 className="h-4 w-4" />
          <span>Approved — scheduling can now be requested.</span>
        </div>
      )}
      {status === 'expired' && (
        <p className="text-sm text-muted-foreground">This proposal has expired.</p>
      )}
    </div>
  );
}
