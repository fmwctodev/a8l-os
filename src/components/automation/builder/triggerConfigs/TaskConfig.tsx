import type { TriggerNodeData } from '../../../../types';

type TaskMode = 'added' | 'reminder' | 'completed';

interface Props {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
  mode?: TaskMode;
}

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const TASK_TYPES = [
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'other', label: 'Other' },
];

export default function TaskConfig({ data, onUpdate, mode = 'added' }: Props) {
  const config = (data.triggerConfig ?? {}) as Record<string, unknown>;
  const assigneeFilter = (config.assigneeFilter as string) ?? '';
  const taskTypeFilter = (config.taskTypeFilter as string[]) ?? [];
  const priorityFilter = (config.priorityFilter as string[]) ?? [];
  const reminderTimingMode = (config.reminderTimingMode as string) ?? 'at_time';

  function update(patch: Record<string, unknown>) {
    onUpdate({ triggerConfig: { ...config, ...patch } });
  }

  function toggleArrayItem(key: string, items: string[], value: string) {
    const next = items.includes(value)
      ? items.filter(i => i !== value)
      : [...items, value];
    update({ [key]: next });
  }

  return (
    <div className="space-y-4">
      {(mode === 'added' || mode === 'completed') && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Assignee Filter (Optional)</label>
            <input
              value={assigneeFilter}
              onChange={e => update({ assigneeFilter: e.target.value })}
              placeholder="Filter by assignee user ID"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Task Type</label>
            <div className="flex flex-wrap gap-2">
              {TASK_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => toggleArrayItem('taskTypeFilter', taskTypeFilter, t.value)}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    taskTypeFilter.includes(t.value)
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {mode === 'added' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">Priority Filter</label>
          <div className="flex flex-wrap gap-2">
            {PRIORITIES.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => toggleArrayItem('priorityFilter', priorityFilter, p.value)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  priorityFilter.includes(p.value)
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === 'reminder' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Reminder Timing</label>
          <select
            value={reminderTimingMode}
            onChange={e => update({ reminderTimingMode: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
          >
            <option value="at_time">At reminder time</option>
            <option value="before_due">Before due date</option>
          </select>
        </div>
      )}

      <div className="p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-700">
          {mode === 'added' && 'Fires when a new task is created for a contact.'}
          {mode === 'reminder' && 'Fires when a task reminder time is reached.'}
          {mode === 'completed' && 'Fires when a task linked to a contact is marked complete.'}
        </p>
      </div>
    </div>
  );
}
