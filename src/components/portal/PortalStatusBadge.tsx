import type { ProjectChangeRequestStatus } from '../../types';

const STATUS_CONFIG: Record<ProjectChangeRequestStatus, { label: string; className: string }> = {
  submitted: { label: 'Submitted', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
  under_review: { label: 'Under Review', className: 'bg-cyan-100 text-cyan-700 border border-cyan-200' },
  needs_more_info: { label: 'Needs Info', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  quoted_awaiting_approval: { label: 'Awaiting Approval', className: 'bg-orange-100 text-orange-700 border border-orange-200' },
  approved: { label: 'Approved', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700 border border-red-200' },
  scheduled: { label: 'Scheduled', className: 'bg-blue-100 text-blue-600 border border-blue-200' },
  in_progress: { label: 'In Progress', className: 'bg-cyan-100 text-cyan-700 border border-cyan-200' },
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-600 border border-gray-200' },
};

interface Props {
  status: ProjectChangeRequestStatus;
  size?: 'sm' | 'md' | 'lg';
}

export function PortalStatusBadge({ status, size = 'md' }: Props) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.submitted;
  const sizeClass =
    size === 'sm' ? 'text-xs px-2 py-0.5' :
    size === 'lg' ? 'text-sm px-3 py-1 font-semibold' :
    'text-xs px-2.5 py-1';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${config.className}`}>
      {config.label}
    </span>
  );
}
