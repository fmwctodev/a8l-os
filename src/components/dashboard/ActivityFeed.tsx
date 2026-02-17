import {
  UserPlus,
  MessageSquare,
  Target,
  Calendar,
  FileText,
  Bot,
  ClipboardCheck,
  Send,
  Trophy,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import type { ActivityLogEntry, ActivityFilter, EventType } from '../../services/activityLog';

interface ActivityFeedProps {
  events: ActivityLogEntry[];
  activeFilter: ActivityFilter;
  onFilterChange: (filter: ActivityFilter) => void;
  onItemClick?: (event: ActivityLogEntry) => void;
  isLoading?: boolean;
}

const filterTabs: { value: ActivityFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'mine', label: 'Mine' },
  { value: 'team', label: 'Team' },
];

const eventIcons: Record<string, typeof UserPlus> = {
  contact: UserPlus,
  conversation: MessageSquare,
  message: Send,
  opportunity: Target,
  opportunity_won: Trophy,
  opportunity_lost: XCircle,
  opportunity_stage: ArrowRight,
  appointment: Calendar,
  invoice: FileText,
  ai_agent: Bot,
  task: ClipboardCheck,
};

const eventColors: Record<string, string> = {
  contact: 'bg-cyan-500/10 text-cyan-400',
  conversation: 'bg-teal-500/10 text-teal-400',
  message: 'bg-teal-500/10 text-teal-400',
  opportunity: 'bg-amber-500/10 text-amber-400',
  appointment: 'bg-rose-500/10 text-rose-400',
  invoice: 'bg-emerald-500/10 text-emerald-400',
  ai_agent: 'bg-violet-500/10 text-violet-400',
  task: 'bg-blue-500/10 text-blue-400',
};

function getIconForEvent(eventType: EventType) {
  if (eventType.includes('opportunity_won')) return eventIcons.opportunity_won;
  if (eventType.includes('opportunity_lost')) return eventIcons.opportunity_lost;
  if (eventType.includes('opportunity_stage')) return eventIcons.opportunity_stage;
  if (eventType.includes('message')) return eventIcons.message;

  const baseType = eventType.split('_')[0];
  return eventIcons[baseType] || MessageSquare;
}

function getColorForEvent(eventType: EventType) {
  const baseType = eventType.split('_')[0];
  return eventColors[baseType] || 'bg-slate-500/10 text-slate-400';
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function ActivityFeed({
  events,
  activeFilter,
  onFilterChange,
  onItemClick,
  isLoading,
}: ActivityFeedProps) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
        <div className="flex gap-1 p-1 bg-slate-900 rounded-lg">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => onFilterChange(tab.value)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeFilter === tab.value
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-slate-700/50">
        {isLoading ? (
          <LoadingSkeleton />
        ) : events.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-slate-500">No recent activity</p>
          </div>
        ) : (
          events.map((event) => {
            const Icon = getIconForEvent(event.event_type);
            const colorClass = getColorForEvent(event.event_type);

            return (
              <button
                key={event.id}
                onClick={() => onItemClick?.(event)}
                className="w-full flex items-start gap-3 px-5 py-3 hover:bg-slate-700/30 transition-colors text-left"
              >
                <div className={`p-2 rounded-lg ${colorClass}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{event.summary}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {event.user && (
                      <span className="text-xs text-slate-500">{event.user.name}</span>
                    )}
                    {event.user && <span className="text-slate-600">·</span>}
                    <span className="text-xs text-slate-500">{formatTimeAgo(event.created_at)}</span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-5 space-y-4 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="h-8 w-8 bg-slate-700 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 bg-slate-700 rounded" />
            <div className="h-3 w-1/3 bg-slate-700 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
