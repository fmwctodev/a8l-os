import type { ErrorSeverity } from '../../hooks/useSystemDashboardData';

interface SeverityBadgeProps {
  severity: ErrorSeverity;
}

const severityStyles: Record<ErrorSeverity, { bg: string; text: string }> = {
  info: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  warning: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
  error: { bg: 'bg-red-500/10', text: 'text-red-400' },
  critical: { bg: 'bg-red-500/20', text: 'text-red-300' },
};

const severityLabels: Record<ErrorSeverity, string> = {
  info: 'INFO',
  warning: 'WARN',
  error: 'ERROR',
  critical: 'CRIT',
};

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const styles = severityStyles[severity];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 ${styles.bg} ${styles.text} text-xs font-mono font-medium rounded`}
    >
      {severityLabels[severity]}
    </span>
  );
}
