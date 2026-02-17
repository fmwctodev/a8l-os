import { useState, useEffect } from 'react';
import {
  Plus,
  ArrowRight,
  Flag,
  ListTodo,
  CheckCircle2,
  UserPlus,
  Upload,
  Trash2,
  MessageSquare,
  UserCheck,
  DollarSign,
  Receipt,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import type { ProjectActivityEvent, ProjectActivityEventType } from '../../types';
import { getProjectTimeline } from '../../services/projectActivityLog';

interface Props {
  projectId: string;
}

const EVENT_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  project_created: { icon: Plus, color: 'text-emerald-400' },
  stage_changed: { icon: ArrowRight, color: 'text-cyan-400' },
  status_changed: { icon: Flag, color: 'text-amber-400' },
  task_created: { icon: ListTodo, color: 'text-blue-400' },
  task_completed: { icon: CheckCircle2, color: 'text-emerald-400' },
  task_assigned: { icon: UserPlus, color: 'text-blue-400' },
  file_uploaded: { icon: Upload, color: 'text-slate-400' },
  file_removed: { icon: Trash2, color: 'text-red-400' },
  note_added: { icon: MessageSquare, color: 'text-slate-400' },
  owner_changed: { icon: UserCheck, color: 'text-cyan-400' },
  financial_updated: { icon: DollarSign, color: 'text-emerald-400' },
  cost_added: { icon: Receipt, color: 'text-amber-400' },
  automation_triggered: { icon: Zap, color: 'text-cyan-400' },
  project_overdue: { icon: AlertTriangle, color: 'text-red-400' },
};

export function ProjectTimelineTab({ projectId }: Props) {
  const [events, setEvents] = useState<ProjectActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ProjectActivityEventType | ''>('');

  useEffect(() => {
    loadTimeline();
  }, [projectId, filter]);

  async function loadTimeline() {
    try {
      const data = await getProjectTimeline(
        projectId,
        filter ? (filter as ProjectActivityEventType) : undefined
      );
      setEvents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function timeAgo(dateStr: string): string {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(dateStr).toLocaleDateString();
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500" /></div>;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as ProjectActivityEventType | '')}
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
        >
          <option value="">All Events</option>
          <option value="stage_changed">Stage Changes</option>
          <option value="status_changed">Status Changes</option>
          <option value="task_created">Tasks Created</option>
          <option value="task_completed">Tasks Completed</option>
          <option value="note_added">Notes</option>
          <option value="file_uploaded">File Uploads</option>
          <option value="cost_added">Costs</option>
        </select>
        <span className="text-sm text-slate-400">{events.length} event{events.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-700" />
        <div className="space-y-1">
          {events.map((event) => {
            const config = EVENT_CONFIG[event.event_type] || { icon: Flag, color: 'text-slate-400' };
            const Icon = config.icon;
            return (
              <div key={event.id} className="relative flex items-start gap-4 py-3 pl-2">
                <div className={`relative z-10 w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center ${config.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-sm text-white">{event.summary}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {event.actor && (
                      <span className="text-xs text-slate-500">{event.actor.name}</span>
                    )}
                    <span className="text-xs text-slate-600">{timeAgo(event.created_at)}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {events.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-sm pl-10">No activity yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
