import { Activity, Database, Server, Cog, Plug, Bot } from 'lucide-react';
import type { ServiceHealth } from '../../hooks/useSystemDashboardData';
import { StatusBadge } from './StatusBadge';

interface ServiceHealthCardProps {
  service: ServiceHealth;
  onClick?: () => void;
}

const serviceIcons: Record<string, typeof Activity> = {
  API: Server,
  'Auth Service': Activity,
  Database: Database,
  'Queue Workers': Cog,
  Integrations: Plug,
  'AI Services': Bot,
};

export function ServiceHealthCard({ service, onClick }: ServiceHealthCardProps) {
  const Icon = serviceIcons[service.name] || Activity;

  const statusBg = {
    healthy: 'bg-emerald-500/10',
    degraded: 'bg-amber-500/10',
    critical: 'bg-red-500/10',
    disconnected: 'bg-slate-500/10',
  }[service.status];

  const iconColor = {
    healthy: 'text-emerald-400',
    degraded: 'text-amber-400',
    critical: 'text-red-400',
    disconnected: 'text-slate-400',
  }[service.status];

  const Wrapper = onClick ? 'button' : 'div';
  const wrapperClass = onClick
    ? 'w-full text-left bg-slate-800 rounded-xl border border-slate-700 p-4 transition-colors hover:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/40'
    : 'bg-slate-800 rounded-xl border border-slate-700 p-4';

  return (
    <Wrapper onClick={onClick} className={wrapperClass}>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${statusBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <StatusBadge status={service.status} />
      </div>
      <h4 className="text-sm font-medium text-white mb-2">{service.name}</h4>
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
    </Wrapper>
  );
}
