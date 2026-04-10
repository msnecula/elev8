import { cn } from '@/lib/utils';
import {
  JOB_STAGE_LABELS,
  URGENCY_LABELS,
  WORK_ORDER_STATUS_LABELS,
  NOTICE_STATUS_LABELS,
  PROPOSAL_STATUS_LABELS,
} from '@/lib/constants';

type BadgeVariant =
  | 'job_stage'
  | 'urgency'
  | 'work_order_status'
  | 'notice_status'
  | 'proposal_status'
  | 'forty_eight_hour';

interface StatusBadgeProps {
  value: string;
  variant: BadgeVariant;
  className?: string;
}

function getStyles(variant: BadgeVariant, value: string): string {
  switch (variant) {
    case 'urgency':
      return {
        critical: 'bg-red-100 text-red-800 border-red-200',
        high: 'bg-orange-100 text-orange-800 border-orange-200',
        medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        low: 'bg-green-100 text-green-800 border-green-200',
      }[value] ?? 'bg-slate-100 text-slate-700 border-slate-200';

    case 'job_stage':
      return {
        notice_received: 'bg-slate-100 text-slate-700 border-slate-200',
        under_review: 'bg-blue-100 text-blue-800 border-blue-200',
        proposal_drafted: 'bg-purple-100 text-purple-800 border-purple-200',
        proposal_sent: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        approved: 'bg-green-100 text-green-800 border-green-200',
        scheduled: 'bg-teal-100 text-teal-800 border-teal-200',
        dispatched: 'bg-cyan-100 text-cyan-800 border-cyan-200',
        in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
        completed: 'bg-green-100 text-green-800 border-green-200',
        cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
        on_hold: 'bg-orange-100 text-orange-800 border-orange-200',
      }[value] ?? 'bg-slate-100 text-slate-700 border-slate-200';

    case 'work_order_status':
      return {
        draft: 'bg-slate-100 text-slate-600 border-slate-200',
        assigned: 'bg-blue-100 text-blue-800 border-blue-200',
        dispatched: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        ready: 'bg-teal-100 text-teal-800 border-teal-200',
        en_route: 'bg-cyan-100 text-cyan-800 border-cyan-200',
        on_site: 'bg-blue-100 text-blue-800 border-blue-200',
        completed: 'bg-green-100 text-green-800 border-green-200',
        held: 'bg-red-100 text-red-800 border-red-200',
        cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
      }[value] ?? 'bg-slate-100 text-slate-700 border-slate-200';

    case 'notice_status':
      return {
        received: 'bg-slate-100 text-slate-700 border-slate-200',
        parsing: 'bg-blue-100 text-blue-700 border-blue-200',
        parsed: 'bg-green-100 text-green-700 border-green-200',
        parse_failed: 'bg-red-100 text-red-700 border-red-200',
        review_pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        reviewed: 'bg-teal-100 text-teal-700 border-teal-200',
      }[value] ?? 'bg-slate-100 text-slate-700 border-slate-200';

    case 'proposal_status':
      return {
        draft: 'bg-slate-100 text-slate-600 border-slate-200',
        sent: 'bg-blue-100 text-blue-800 border-blue-200',
        approved: 'bg-green-100 text-green-800 border-green-200',
        rejected: 'bg-red-100 text-red-800 border-red-200',
        revision_requested: 'bg-orange-100 text-orange-800 border-orange-200',
        expired: 'bg-slate-100 text-slate-500 border-slate-200',
      }[value] ?? 'bg-slate-100 text-slate-700 border-slate-200';

    case 'forty_eight_hour':
      return {
        not_required: 'bg-slate-100 text-slate-500 border-slate-200',
        pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        sent: 'bg-green-100 text-green-800 border-green-200',
        overdue: 'bg-red-100 text-red-800 border-red-200',
      }[value] ?? 'bg-slate-100 text-slate-700 border-slate-200';

    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

function getLabel(variant: BadgeVariant, value: string): string {
  switch (variant) {
    case 'job_stage': return JOB_STAGE_LABELS[value] ?? value;
    case 'urgency': return URGENCY_LABELS[value] ?? value;
    case 'work_order_status': return WORK_ORDER_STATUS_LABELS[value] ?? value;
    case 'notice_status': return NOTICE_STATUS_LABELS[value] ?? value;
    case 'proposal_status': return PROPOSAL_STATUS_LABELS[value] ?? value;
    case 'forty_eight_hour':
      return { not_required: 'Not Required', pending: 'Pending', sent: 'Sent', overdue: 'OVERDUE' }[value] ?? value;
    default: return value;
  }
}

export default function StatusBadge({ value, variant, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        getStyles(variant, value),
        className,
      )}
    >
      {getLabel(variant, value)}
    </span>
  );
}
