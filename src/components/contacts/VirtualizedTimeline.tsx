import { useState, useRef, useEffect, useCallback } from 'react';
import {
  UserPlus,
  Edit,
  GitMerge,
  MessageSquare,
  CheckSquare,
  Tag,
  History,
  Mail,
  Phone,
  Calendar,
  Briefcase,
  DollarSign,
  Zap,
  Bot,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import type { AggregatedTimelineEvent } from '../../services/contactTimeline';
import { getTimelineEventLabel } from '../../services/contactTimeline';

interface VirtualizedTimelineProps {
  events: AggregatedTimelineEvent[];
  isLoading?: boolean;
}

type CategoryFilter = 'all' | AggregatedTimelineEvent['event_category'];

const ITEM_HEIGHT = 80;
const BUFFER_SIZE = 5;

export function VirtualizedTimeline({ events, isLoading }: VirtualizedTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  const filteredEvents = categoryFilter === 'all'
    ? events
    : events.filter((e) => e.event_category === categoryFilter);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const toggleExpand = (eventId: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const totalHeight = filteredEvents.length * ITEM_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_SIZE);
  const endIndex = Math.min(
    filteredEvents.length,
    Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + BUFFER_SIZE
  );

  const visibleEvents = filteredEvents.slice(startIndex, endIndex);
  const offsetY = startIndex * ITEM_HEIGHT;

  const getEventIcon = (event: AggregatedTimelineEvent) => {
    switch (event.event_category) {
      case 'message':
        return event.event_data.channel === 'email' ? Mail : MessageSquare;
      case 'call':
        return Phone;
      case 'appointment':
        return Calendar;
      case 'opportunity':
        return Briefcase;
      case 'payment':
        return DollarSign;
      case 'automation':
        return Zap;
      case 'ai':
        return Bot;
      default:
        switch (event.event_type) {
          case 'created':
            return UserPlus;
          case 'updated':
            return Edit;
          case 'merged':
            return GitMerge;
          case 'task_created':
          case 'task_completed':
          case 'task_updated':
            return CheckSquare;
          case 'tag_added':
          case 'tag_removed':
            return Tag;
          default:
            return History;
        }
    }
  };

  const getEventColor = (event: AggregatedTimelineEvent): string => {
    switch (event.event_category) {
      case 'message':
        return 'bg-blue-500/20 text-blue-400';
      case 'call':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'appointment':
        return 'bg-cyan-500/20 text-cyan-400';
      case 'opportunity':
        return 'bg-amber-500/20 text-amber-400';
      case 'payment':
        return 'bg-green-500/20 text-green-400';
      case 'automation':
        return 'bg-purple-500/20 text-purple-400';
      case 'ai':
        return 'bg-pink-500/20 text-pink-400';
      default:
        if (event.event_type === 'created') return 'bg-emerald-500/20 text-emerald-400';
        if (event.event_type.includes('deleted')) return 'bg-red-500/20 text-red-400';
        if (event.event_type.includes('completed')) return 'bg-emerald-500/20 text-emerald-400';
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

  const categoryOptions: { value: CategoryFilter; label: string; color: string }[] = [
    { value: 'all', label: 'All Activity', color: 'text-white' },
    { value: 'contact', label: 'Contact', color: 'text-slate-400' },
    { value: 'message', label: 'Messages', color: 'text-blue-400' },
    { value: 'call', label: 'Calls', color: 'text-emerald-400' },
    { value: 'appointment', label: 'Appointments', color: 'text-cyan-400' },
    { value: 'opportunity', label: 'Opportunities', color: 'text-amber-400' },
    { value: 'payment', label: 'Payments', color: 'text-green-400' },
    { value: 'automation', label: 'Automation', color: 'text-purple-400' },
    { value: 'ai', label: 'AI Actions', color: 'text-pink-400' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <History className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">No activity recorded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors text-sm"
        >
          <Filter className="w-4 h-4" />
          Filter
          {categoryFilter !== 'all' && (
            <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-xs">1</span>
          )}
        </button>
        <span className="text-sm text-slate-500">{filteredEvents.length} events</span>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-2 p-3 bg-slate-800/50 rounded-lg">
          {categoryOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setCategoryFilter(option.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                categoryFilter === option.value
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600 border border-transparent'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="relative overflow-auto max-h-[600px]"
        style={{ contain: 'strict' }}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div
            className="absolute left-4 top-0 bottom-0 w-px bg-slate-800"
            style={{ height: totalHeight }}
          />

          <div style={{ transform: `translateY(${offsetY}px)` }}>
            {visibleEvents.map((event, index) => {
              const Icon = getEventIcon(event);
              const isExpanded = expandedEvents.has(event.id);
              const hasDetails =
                event.event_data &&
                Object.keys(event.event_data).length > 0 &&
                !['changed_fields', 'updated_by', 'created_by'].every(
                  (k) => !event.event_data[k] || (event.event_data[k] as string[])?.length === 0
                );

              return (
                <div
                  key={event.id}
                  className="relative pl-10"
                  style={{ height: isExpanded ? 'auto' : ITEM_HEIGHT, minHeight: ITEM_HEIGHT }}
                >
                  <div
                    className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center ${getEventColor(
                      event
                    )}`}
                    style={{ top: 8 }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div
                    className={`bg-slate-800/30 rounded-lg p-3 ${
                      hasDetails ? 'cursor-pointer hover:bg-slate-800/50' : ''
                    } transition-colors`}
                    onClick={() => hasDetails && toggleExpand(event.id)}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">
                          {getTimelineEventLabel(event)}
                        </p>
                        {event.user && (
                          <p className="text-xs text-slate-500 mt-0.5">by {event.user.name}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 flex-shrink-0">
                          {formatRelativeTime(event.created_at)}
                        </span>
                        {hasDetails && (
                          isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                          )
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-1">
                        {Object.entries(event.event_data).map(([key, value]) => {
                          if (!value || (Array.isArray(value) && value.length === 0)) return null;
                          const displayKey = key.replace(/_/g, ' ');
                          const displayValue = Array.isArray(value)
                            ? value.join(', ')
                            : typeof value === 'object'
                            ? JSON.stringify(value)
                            : String(value);

                          return (
                            <div key={key} className="flex gap-2 text-xs">
                              <span className="text-slate-500 capitalize">{displayKey}:</span>
                              <span className="text-slate-300">{displayValue}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
