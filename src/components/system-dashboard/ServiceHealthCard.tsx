import { Activity, Database, Server, Cog, Plug, Bot, type LucideIcon } from 'lucide-react';
import type { ServiceHealth, ServiceStatus } from '../../hooks/useSystemDashboardData';
import { StatusBadge } from './StatusBadge';

type ConnectivityStatus = 'connected' | 'degraded' | 'disconnected';

interface ServiceHealthCardProps {
  service?: ServiceHealth;
  title?: string;
  icon?: LucideIcon;
  status?: ConnectivityStatus;
  description?: string;
  onClick?: () => void;
  isLoading?: boolean;
}

const serviceIcons: Record<string, typeof Activity> = {
  API: Server,
  'Auth Service': Activity,
  Database: Database,
  'Queue Workers': Cog,
  Integrations: Plug,
  'AI Services': Bot,
};

const connectivityToServiceStatus: Record<ConnectivityStatus, ServiceStatus> = {
  connected: 'healthy',
  degraded: 'degraded',
  disconnected: 'disconnected',
};

const connectivityLabels: Record<ConnectivityStatus, string> = {
  connected: 'Connected',
  degraded: 'Degraded',
  disconnected: 'Not connected',
};

export function ServiceHealthCard({
  service,
  title,
  icon: CustomIcon,
  status: connectivityStatus,
  description,
  onClick,
  isLoading,
}: ServiceHealthCardProps) {
  const isSimpleMode = !service && title;

  const displayStatus = isSimpleMode
    ? connectivityToServiceStatus[connectivityStatus || 'disconnected']
    : service?.status || 'disconnected';

  const Icon = isSimpleMode
    ? (CustomIcon || Activity)
    : (serviceIcons[service?.name || ''] || Activity);

  const displayTitle = isSimpleMode ? title : service?.name;

  const statusBg = {
    healthy: 'bg-emerald-500/10',
    degraded: 'bg-amber-500/10',
    critical: 'bg-red-500/10',
    disconnected: 'bg-slate-500/10',
  }[displayStatus];

  const iconColor = {
    healthy: 'text-emerald-400',
    degraded: 'text-amber-400',
    critical: 'text-red-400',
    disconnected: 'text-slate-400',
  }[displayStatus];

  const Wrapper = onClick ? 'button' : 'div';
  const wrapperClass = onClick
    ? 'w-full text-left bg-slate-800 rounded-xl border border-slate-700 p-4 transition-colors hover:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/40'
    : 'bg-slate-800 rounded-xl border border-slate-700 p-4';

  if (isLoading) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 animate-pulse">
        <div className="flex items-start justify-between mb-3">
          <div className="w-9 h-9 bg-slate-700 rounded-lg" />
          <div className="w-20 h-5 bg-slate-700 rounded-full" />
        </div>
        <div className="w-24 h-4 bg-slate-700 rounded mb-2" />
        <div className="w-full h-3 bg-slate-700 rounded" />
      </div>
    );
  }

  if (isSimpleMode) {
    return (
      <Wrapper onClick={onClick} className={wrapperClass}>
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2 rounded-lg ${statusBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            connectivityStatus === 'connected'
              ? 'bg-emerald-500/10 text-emerald-400'
              : connectivityStatus === 'degraded'
              ? 'bg-amber-500/10 text-amber-400'
              : 'bg-slate-500/10 text-slate-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              connectivityStatus === 'connected'
                ? 'bg-emerald-400'
                : connectivityStatus === 'degraded'
                ? 'bg-amber-400'
                : 'bg-slate-400'
            }`} />
            {connectivityLabels[connectivityStatus || 'disconnected']}
          </div>
        </div>
        <h4 className="text-sm font-medium text-white mb-1">{displayTitle}</h4>
        {description && (
          <p className="text-xs text-slate-400">{description}</p>
        )}
      </Wrapper>
    );
  }

  return (
    <Wrapper onClick={onClick} className={wrapperClass}>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${statusBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <StatusBadge status={displayStatus} />
      </div>
      <h4 className="text-sm font-medium text-white mb-2">{displayTitle}</h4>
      {service && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Uptime</span>
            <span className="text-slate-300">{service.uptime}%</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Latency</span>
            <span className="text-slate-300">{service.latency}ms</span>
          </div>
          {service.lastIncident && (
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Last incident</span>
              <span className="text-slate-300">
                {new Date(service.lastIncident).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          )}
        </div>
      )}
    </Wrapper>
  );
}
