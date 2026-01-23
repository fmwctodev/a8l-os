import { useState, useEffect } from 'react';
import { X, Loader2, Activity, Calendar, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { getUserActivity } from '../../../services/users';
import type { User, AuditLog } from '../../../types';

interface StaffActivityModalProps {
  member: User;
  onClose: () => void;
}

const ENTITY_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'user', label: 'User' },
  { value: 'contact', label: 'Contact' },
  { value: 'conversation', label: 'Conversation' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'opportunity', label: 'Opportunity' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'department', label: 'Department' },
];

const ACTION_TYPES = [
  { value: '', label: 'All Actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'staff.invite', label: 'Staff Invite' },
  { value: 'staff.disable', label: 'Staff Disable' },
  { value: 'staff.enable', label: 'Staff Enable' },
  { value: 'staff.password_reset.initiated', label: 'Password Reset' },
];

export function StaffActivityModal({ member, onClose }: StaffActivityModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [activities, setActivities] = useState<AuditLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    entityType: '',
    action: '',
    startDate: '',
    endDate: '',
  });
  const [page, setPage] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    loadActivity();
  }, [member.id, filters, page]);

  const loadActivity = async () => {
    setIsLoading(true);
    try {
      const { data, count } = await getUserActivity(member.id, {
        limit: pageSize,
        offset: page * pageSize,
        entityType: filters.entityType || undefined,
        action: filters.action || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      });
      setActivities(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Failed to load activity:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionColor = (action: string) => {
    if (action.includes('create') || action.includes('invite')) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
    if (action.includes('delete') || action.includes('disable')) {
      return 'bg-red-500/10 text-red-400 border-red-500/20';
    }
    if (action.includes('update') || action.includes('enable')) {
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    }
    return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  };

  const formatJsonDiff = (before: Record<string, unknown> | null, after: Record<string, unknown> | null) => {
    if (!before && !after) return null;

    const changes: { key: string; before: unknown; after: unknown }[] = [];
    const allKeys = new Set([
      ...Object.keys(before || {}),
      ...Object.keys(after || {}),
    ]);

    allKeys.forEach((key) => {
      const beforeVal = before?.[key];
      const afterVal = after?.[key];
      if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
        changes.push({ key, before: beforeVal, after: afterVal });
      }
    });

    return changes;
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-800 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="border-b border-slate-800 p-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Activity Log</h2>
              <p className="text-sm text-slate-400">{member.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-800 flex-shrink-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Entity Type
              </label>
              <select
                value={filters.entityType}
                onChange={(e) => {
                  setFilters({ ...filters, entityType: e.target.value });
                  setPage(0);
                }}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {ENTITY_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Action
              </label>
              <select
                value={filters.action}
                onChange={(e) => {
                  setFilters({ ...filters, action: e.target.value });
                  setPage(0);
                }}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {ACTION_TYPES.map((action) => (
                  <option key={action.value} value={action.value}>
                    {action.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => {
                  setFilters({ ...filters, startDate: e.target.value });
                  setPage(0);
                }}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => {
                  setFilters({ ...filters, endDate: e.target.value });
                  setPage(0);
                }}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="w-12 h-12 text-slate-600 mb-3" />
              <p className="text-slate-400">No activity found</p>
              <p className="text-sm text-slate-500 mt-1">
                Try adjusting your filters or date range
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {activities.map((activity) => {
                const isExpanded = expandedId === activity.id;
                const changes = formatJsonDiff(activity.before_state, activity.after_state);

                return (
                  <div key={activity.id} className="p-4 hover:bg-slate-800/30 transition-colors">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : activity.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                          <span
                            className={`text-xs px-2 py-1 rounded-full border ${getActionColor(
                              activity.action
                            )}`}
                          >
                            {activity.action}
                          </span>
                          <span className="text-sm text-slate-300 capitalize">
                            {activity.entity_type}
                          </span>
                          {activity.entity_id && (
                            <span className="text-xs text-slate-500 font-mono">
                              {activity.entity_id.slice(0, 8)}...
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Calendar className="w-3 h-3" />
                          {formatTimestamp(activity.timestamp)}
                        </div>
                      </div>
                    </button>

                    {isExpanded && changes && changes.length > 0 && (
                      <div className="mt-4 ml-7 bg-slate-800/50 rounded-lg p-4">
                        <h4 className="text-xs font-medium text-slate-400 mb-3">
                          Changes Made
                        </h4>
                        <div className="space-y-2">
                          {changes.map((change, idx) => (
                            <div
                              key={idx}
                              className="grid grid-cols-3 gap-2 text-xs"
                            >
                              <div className="text-slate-400 font-medium">
                                {change.key}
                              </div>
                              <div className="text-red-400/70 font-mono truncate">
                                {change.before !== undefined
                                  ? JSON.stringify(change.before)
                                  : '(none)'}
                              </div>
                              <div className="text-emerald-400/70 font-mono truncate">
                                {change.after !== undefined
                                  ? JSON.stringify(change.after)
                                  : '(none)'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {isExpanded && (!changes || changes.length === 0) && (
                      <div className="mt-4 ml-7 bg-slate-800/50 rounded-lg p-4">
                        <p className="text-xs text-slate-500">
                          No detailed changes available for this entry
                        </p>
                        {activity.after_state && (
                          <pre className="mt-2 text-xs text-slate-400 overflow-auto max-h-40">
                            {JSON.stringify(activity.after_state, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="border-t border-slate-800 p-4 flex items-center justify-between flex-shrink-0">
            <p className="text-sm text-slate-400">
              Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalCount)} of{' '}
              {totalCount} entries
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Previous
              </button>
              <span className="text-sm text-slate-400">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
