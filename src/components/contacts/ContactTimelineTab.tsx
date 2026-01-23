import { getTimelineEventLabel } from '../../services/contactTimeline';
import type { ContactTimelineEvent } from '../../types';
import {
  UserPlus,
  Edit,
  GitMerge,
  MessageSquare,
  CheckSquare,
  Tag,
  History,
} from 'lucide-react';

interface ContactTimelineTabProps {
  timeline: ContactTimelineEvent[];
}

export function ContactTimelineTab({ timeline }: ContactTimelineTabProps) {
  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'created':
        return <UserPlus className="w-4 h-4" />;
      case 'updated':
        return <Edit className="w-4 h-4" />;
      case 'merged':
        return <GitMerge className="w-4 h-4" />;
      case 'note_added':
      case 'note_updated':
      case 'note_deleted':
        return <MessageSquare className="w-4 h-4" />;
      case 'task_created':
      case 'task_completed':
      case 'task_updated':
      case 'task_deleted':
        return <CheckSquare className="w-4 h-4" />;
      case 'tag_added':
      case 'tag_removed':
        return <Tag className="w-4 h-4" />;
      default:
        return <History className="w-4 h-4" />;
    }
  };

  const getEventColor = (eventType: string): string => {
    switch (eventType) {
      case 'created':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'updated':
        return 'bg-cyan-500/20 text-cyan-400';
      case 'merged':
        return 'bg-amber-500/20 text-amber-400';
      case 'note_added':
      case 'note_updated':
        return 'bg-blue-500/20 text-blue-400';
      case 'note_deleted':
        return 'bg-red-500/20 text-red-400';
      case 'task_completed':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'task_created':
      case 'task_updated':
        return 'bg-teal-500/20 text-teal-400';
      case 'task_deleted':
        return 'bg-red-500/20 text-red-400';
      case 'tag_added':
        return 'bg-cyan-500/20 text-cyan-400';
      case 'tag_removed':
        return 'bg-slate-500/20 text-slate-400';
      default:
        return 'bg-slate-500/20 text-slate-400';
    }
  };

  const formatRelativeTime = (date: string): string => {
    const now = new Date();
    const eventDate = new Date(date);
    const diffMs = now.getTime() - eventDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return eventDate.toLocaleDateString();
  };

  if (timeline.length === 0) {
    return (
      <div className="text-center py-8">
        <History className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">No activity recorded yet</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-800" />

      <div className="space-y-4">
        {timeline.map((event) => (
          <div key={event.id} className="relative pl-10">
            <div
              className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center ${getEventColor(
                event.event_type
              )}`}
            >
              {getEventIcon(event.event_type)}
            </div>

            <div className="bg-slate-800/30 rounded-lg p-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-white">{getTimelineEventLabel(event)}</p>
                  {event.user && (
                    <p className="text-xs text-slate-500 mt-0.5">by {event.user.name}</p>
                  )}
                </div>
                <span className="text-xs text-slate-500 flex-shrink-0">
                  {formatRelativeTime(event.created_at)}
                </span>
              </div>

              {event.event_type === 'updated' && event.event_data.changed_fields && (
                <div className="mt-2 text-xs text-slate-400">
                  Changed:{' '}
                  {(event.event_data.changed_fields as string[])
                    .map((f) => f.replace(/_/g, ' '))
                    .join(', ')}
                </div>
              )}

              {event.event_type === 'merged' && event.event_data.merged_contact_name && (
                <div className="mt-2 text-xs text-slate-400">
                  Merged contact: {event.event_data.merged_contact_name as string}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
