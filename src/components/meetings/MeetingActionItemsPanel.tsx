import { useState, useEffect, useCallback } from 'react';
import {
  ListChecks,
  CheckCircle2,
  XCircle,
  Undo2,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Sparkles,
  FileText,
  ArrowUpRight,
  User,
  CalendarDays,
} from 'lucide-react';
import {
  getActionItemsByMeeting,
  createTaskFromActionItem,
  bulkCreateTasksFromActionItems,
  dismissActionItem,
  restoreActionItem,
  updateActionItem,
  type MeetingActionItem,
} from '../../services/meetingActionItems';

interface MeetingActionItemsPanelProps {
  meetingTranscriptionId: string;
  currentUserId: string;
  onTaskCreated?: () => void;
}

const PRIORITY_STYLES = {
  low: 'bg-slate-700/50 text-slate-400 border-slate-600',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  high: 'bg-red-500/10 text-red-400 border-red-500/30',
};

const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High' };

export function MeetingActionItemsPanel({
  meetingTranscriptionId,
  currentUserId,
  onTaskCreated,
}: MeetingActionItemsPanelProps) {
  const [items, setItems] = useState<MeetingActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getActionItemsByMeeting(meetingTranscriptionId);
      setItems(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [meetingTranscriptionId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateTask = async (itemId: string) => {
    setProcessingIds((prev) => new Set(prev).add(itemId));
    try {
      const updated = await createTaskFromActionItem(itemId, currentUserId);
      setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
      onTaskCreated?.();
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleDismiss = async (itemId: string) => {
    setProcessingIds((prev) => new Set(prev).add(itemId));
    try {
      const updated = await dismissActionItem(itemId);
      setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleRestore = async (itemId: string) => {
    setProcessingIds((prev) => new Set(prev).add(itemId));
    try {
      const updated = await restoreActionItem(itemId);
      setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handlePriorityChange = async (itemId: string, priority: 'low' | 'medium' | 'high') => {
    try {
      const updated = await updateActionItem(itemId, { priority });
      setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
    } catch (err) {
      console.error('Failed to update priority:', err);
    }
  };

  const handleBulkCreate = async () => {
    setBulkProcessing(true);
    try {
      await bulkCreateTasksFromActionItems(meetingTranscriptionId, currentUserId);
      await loadItems();
      onTaskCreated?.();
    } finally {
      setBulkProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-400 py-4 px-3">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-6 text-slate-500 text-sm">
        No action items extracted from this meeting.
      </div>
    );
  }

  const pendingItems = items.filter((i) => i.status === 'pending');
  const createdItems = items.filter((i) => i.status === 'task_created');
  const dismissedItems = items.filter((i) => i.status === 'dismissed');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-amber-400" />
          Action Items
          <span className="text-xs text-slate-500">
            ({pendingItems.length} pending, {createdItems.length} created)
          </span>
        </h3>

        {pendingItems.length > 1 && (
          <button
            onClick={handleBulkCreate}
            disabled={bulkProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors disabled:opacity-50"
          >
            {bulkProcessing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            Create All Tasks
          </button>
        )}
      </div>

      <div className="space-y-2">
        {pendingItems.map((item) => (
          <ActionItemRow
            key={item.id}
            item={item}
            isExpanded={expandedIds.has(item.id)}
            isProcessing={processingIds.has(item.id)}
            onToggle={() => toggleExpand(item.id)}
            onCreateTask={() => handleCreateTask(item.id)}
            onDismiss={() => handleDismiss(item.id)}
            onPriorityChange={(p) => handlePriorityChange(item.id, p)}
          />
        ))}

        {createdItems.map((item) => (
          <ActionItemRow
            key={item.id}
            item={item}
            isExpanded={expandedIds.has(item.id)}
            isProcessing={false}
            onToggle={() => toggleExpand(item.id)}
          />
        ))}

        {dismissedItems.length > 0 && (
          <div className="pt-2 border-t border-slate-700/50">
            <p className="text-xs text-slate-500 mb-2">Dismissed ({dismissedItems.length})</p>
            {dismissedItems.map((item) => (
              <ActionItemRow
                key={item.id}
                item={item}
                isExpanded={expandedIds.has(item.id)}
                isProcessing={processingIds.has(item.id)}
                onToggle={() => toggleExpand(item.id)}
                onRestore={() => handleRestore(item.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ActionItemRowProps {
  item: MeetingActionItem;
  isExpanded: boolean;
  isProcessing: boolean;
  onToggle: () => void;
  onCreateTask?: () => void;
  onDismiss?: () => void;
  onRestore?: () => void;
  onPriorityChange?: (priority: 'low' | 'medium' | 'high') => void;
}

function ActionItemRow({
  item,
  isExpanded,
  isProcessing,
  onToggle,
  onCreateTask,
  onDismiss,
  onRestore,
  onPriorityChange,
}: ActionItemRowProps) {
  const isDismissed = item.status === 'dismissed';
  const isCreated = item.status === 'task_created';

  return (
    <div
      className={`rounded-lg border transition-colors ${
        isDismissed
          ? 'border-slate-700/50 bg-slate-800/30 opacity-60'
          : isCreated
          ? 'border-emerald-500/20 bg-emerald-500/5'
          : 'border-slate-700 bg-slate-800/50'
      }`}
    >
      <div className="flex items-start gap-3 p-3">
        <div className="flex-shrink-0 mt-0.5">
          {isCreated ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : isDismissed ? (
            <XCircle className="w-4 h-4 text-slate-500" />
          ) : (
            <div className="w-4 h-4 rounded border border-slate-600 bg-slate-700" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm ${isDismissed ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
            {item.description}
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                PRIORITY_STYLES[item.priority]
              }`}
            >
              {PRIORITY_LABELS[item.priority]}
            </span>

            {item.source === 'gemini_notes' && (
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                <Sparkles className="w-3 h-3" />
                Gemini Notes
              </span>
            )}
            {item.source === 'transcript_ai' && (
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                <FileText className="w-3 h-3" />
                AI Extracted
              </span>
            )}

            {item.assignee_name && (
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                <User className="w-3 h-3" />
                {item.assignee_name}
              </span>
            )}

            {item.due_date && (
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                <CalendarDays className="w-3 h-3" />
                {new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}

            {isCreated && item.contact_task && (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                <ArrowUpRight className="w-3 h-3" />
                Task: {item.contact_task.title}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {item.status === 'pending' && !isProcessing && (
            <>
              {onCreateTask && (
                <button
                  onClick={onCreateTask}
                  className="p-1 rounded hover:bg-cyan-500/20 text-cyan-400 transition-colors"
                  title="Create task"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              )}
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="p-1 rounded hover:bg-slate-600/50 text-slate-500 transition-colors"
                  title="Dismiss"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </>
          )}

          {isDismissed && onRestore && !isProcessing && (
            <button
              onClick={onRestore}
              className="p-1 rounded hover:bg-slate-600/50 text-slate-400 transition-colors"
              title="Restore"
            >
              <Undo2 className="w-4 h-4" />
            </button>
          )}

          {isProcessing && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}

          <button
            onClick={onToggle}
            className="p-1 rounded hover:bg-slate-600/50 text-slate-500 transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-700/50 space-y-2">
          {item.status === 'pending' && onPriorityChange && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Priority:</span>
              {(['low', 'medium', 'high'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => onPriorityChange(p)}
                  className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                    item.priority === p
                      ? PRIORITY_STYLES[p]
                      : 'border-slate-700 text-slate-500 hover:border-slate-600'
                  }`}
                >
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          )}

          {item.assignee_user && (
            <div className="text-xs text-slate-400">
              Assigned to: <span className="text-slate-300">{item.assignee_user.name}</span> ({item.assignee_user.email})
            </div>
          )}

          {item.raw_text && item.raw_text !== item.description && (
            <div className="text-xs text-slate-500">
              Original: <span className="italic">{item.raw_text}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
