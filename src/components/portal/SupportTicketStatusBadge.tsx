import type { SupportTicketStatus } from '../../types';

const STATUS_CONFIG: Record<SupportTicketStatus, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
  in_review: { label: 'In Review', className: 'bg-cyan-100 text-cyan-700 border border-cyan-200' },
  in_progress: { label: 'In Progress', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  waiting_on_client: { label: 'Waiting on You', className: 'bg-orange-100 text-orange-700 border border-orange-200' },
  resolved: { label: 'Resolved', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  closed: { label: 'Closed', className: 'bg-gray-100 text-gray-600 border border-gray-200' },
};

interface Props {
  status: SupportTicketStatus;
  size?: 'sm' | 'md' | 'lg';
}

export function SupportTicketStatusBadge({ status, size = 'md' }: Props) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.new;
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
