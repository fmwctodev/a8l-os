import type { LucideIcon } from 'lucide-react';
import type { ServiceStatus } from '../../hooks/useSystemDashboardData';

interface SystemStatCardProps {
  title: string;
  value: string | number;
  sublabel?: string;
  icon: LucideIcon;
  status?: ServiceStatus;
  trend?: 'up' | 'down' | 'stable';
  onClick?: () => void;
  isLoading?: boolean;
}

const statusStyles: Record<ServiceStatus, { bg: string; text: string; border: string }> = {
  healthy: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
  },
  degraded: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
  },
  critical: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
  },
  disconnected: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    border: 'border-slate-500/20',
  },
};

export function SystemStatCard({
  title,
  value,
  sublabel,
  icon: Icon,
  status = 'healthy',
  trend,
  onClick,
  isLoading,
}: SystemStatCardProps) {
  const styles = statusStyles[status];

  if (isLoading) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-3">
            <div className="h-4 w-24 bg-slate-700 rounded" />
            <div className="h-8 w-8 bg-slate-700 rounded" />
          </div>
          <div className="h-8 w-16 bg-slate-700 rounded mb-2" />
          <div className="h-3 w-20 bg-slate-700 rounded" />
        </div>
      </div>
    );
  }

  const Wrapper = onClick ? 'button' : 'div';
  const wrapperProps = onClick
    ? {
        onClick,
        className: `w-full text-left bg-slate-800 rounded-xl border ${styles.border} border-slate-700 p-5 transition-colors hover:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/40`,
      }
    : {
        className: `bg-slate-800 rounded-xl border ${styles.border} border-slate-700 p-5`,
      };

  return (
    <Wrapper {...(wrapperProps as any)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-400">{title}</span>
        <div className={`p-2 rounded-lg ${styles.bg}`}>
          <Icon className={`h-5 w-5 ${styles.text}`} />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-white">{value}</span>
        {trend && (
          <span
            className={`text-sm font-medium ${
              trend === 'down' ? 'text-emerald-400' : trend === 'up' ? 'text-red-400' : 'text-slate-400'
            }`}
          >
            {trend === 'down' ? '↓' : trend === 'up' ? '↑' : '→'}
          </span>
        )}
      </div>
      {sublabel && <p className="mt-1 text-sm text-slate-500">{sublabel}</p>}
    </Wrapper>
  );
}
