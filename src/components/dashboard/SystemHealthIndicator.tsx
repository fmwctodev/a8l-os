interface SystemHealthIndicatorProps {
  label: string;
  status: 'connected' | 'degraded' | 'disconnected';
  onClick?: () => void;
}

const statusConfig = {
  connected: {
    dot: 'bg-emerald-400',
    text: 'text-emerald-400',
    label: 'Connected',
  },
  degraded: {
    dot: 'bg-amber-400',
    text: 'text-amber-400',
    label: 'Degraded',
  },
  disconnected: {
    dot: 'bg-slate-500',
    text: 'text-slate-500',
    label: 'Not connected',
  },
};

export function SystemHealthIndicator({ label, status, onClick }: SystemHealthIndicatorProps) {
  const config = statusConfig[status];

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
    >
      <span className={`h-2 w-2 rounded-full ${config.dot}`} />
      <div className="text-left">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className={`text-xs ${config.text}`}>{config.label}</p>
      </div>
    </button>
  );
}
