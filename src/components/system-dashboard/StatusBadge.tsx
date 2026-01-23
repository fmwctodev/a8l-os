import type { ServiceStatus, ErrorSeverity } from '../../hooks/useSystemDashboardData';

interface StatusBadgeProps {
  status: ServiceStatus | ErrorSeverity;
  label?: string;
  size?: 'sm' | 'md';
}

const statusColors: Record<ServiceStatus | ErrorSeverity, { bg: string; text: string; dot: string }> = {
  healthy: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  degraded: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' },
  critical: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
  disconnected: { bg: 'bg-slate-500/10', text: 'text-slate-400', dot: 'bg-slate-400' },
  info: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400' },
  warning: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' },
  error: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
};

const statusLabels: Record<ServiceStatus | ErrorSeverity, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  critical: 'Critical',
  disconnected: 'Disconnected',
  info: 'Info',
  warning: 'Warning',
  error: 'Error',
};

export function StatusBadge({ status, label, size = 'sm' }: StatusBadgeProps) {
  const colors = statusColors[status];
  const displayLabel = label || statusLabels[status];

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${colors.bg} ${colors.text} ${sizeClasses[size]} rounded-full font-medium`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {displayLabel}
    </span>
  );
}
