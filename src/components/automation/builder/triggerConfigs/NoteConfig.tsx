import type { TriggerNodeData } from '../../../../types';

interface Props {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
  isChanged?: boolean;
}

const VISIBILITY_OPTIONS = [
  { value: 'any', label: 'Any Visibility' },
  { value: 'internal', label: 'Internal Only' },
  { value: 'client', label: 'Client-Facing Only' },
];

export default function NoteConfig({ data, onUpdate, isChanged }: Props) {
  const config = (data.triggerConfig ?? {}) as Record<string, unknown>;
  const visibilityFilter = (config.visibilityFilter as string) ?? 'any';
  const authorFilter = (config.authorFilter as string) ?? '';

  function update(patch: Record<string, unknown>) {
    onUpdate({ triggerConfig: { ...config, ...patch } });
  }

  return (
    <div className="space-y-4">
      {!isChanged && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Note Visibility</label>
          <select
            value={visibilityFilter}
            onChange={e => update({ visibilityFilter: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
          >
            {VISIBILITY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Author Filter (Optional)</label>
        <input
          value={authorFilter}
          onChange={e => update({ authorFilter: e.target.value })}
          placeholder="Filter by author user ID"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        />
        <p className="text-xs text-gray-400 mt-1">Leave empty to trigger for any author</p>
      </div>

      <div className="p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-700">
          {isChanged
            ? 'Fires when an existing note on a contact is edited.'
            : 'Fires when a new note is added to a contact.'}
        </p>
      </div>
    </div>
  );
}
