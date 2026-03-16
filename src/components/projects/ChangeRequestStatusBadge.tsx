import type { ProjectChangeRequestStatus } from '../../types';

const STATUS_CONFIG: Record<
  ProjectChangeRequestStatus,
  { label: string; className: string }
> = {
  submitted: {
    label: 'Submitted',
    className: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  },
  under_review: {
    label: 'Under Review',
    className: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
  },
  needs_more_info: {
    label: 'Needs Info',
    className: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  },
  quoted_awaiting_approval: {
    label: 'Awaiting Approval',
    className: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  },
  approved: {
    label: 'Approved',
    className: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-red-500/20 text-red-400 border border-red-500/30',
  },
  scheduled: {
    label: 'Scheduled',
    className: 'bg-blue-500/20 text-blue-300 border border-blue-400/30',
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30',
  },
  completed: {
    label: 'Completed',
    className: 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
  },
};

interface Props {
  status: ProjectChangeRequestStatus;
  size?: 'sm' | 'md';
}

export function ChangeRequestStatusBadge({ status, size = 'md' }: Props) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.submitted;
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${config.className}`}>
      {config.label}
    </span>
  );
}
