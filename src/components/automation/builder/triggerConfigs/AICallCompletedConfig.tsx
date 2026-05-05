import type { TriggerNodeData } from '../../../../types';
import { PhoneCall } from 'lucide-react';

interface Props {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
}

const OUTCOMES = [
  { value: 'qualified', label: 'Qualified', help: 'Assistant marked the lead as qualified' },
  { value: 'not_qualified', label: 'Not Qualified', help: 'Assistant ruled the lead out' },
  { value: 'transferred', label: 'Transferred to Human', help: 'Hand-off to a human agent occurred' },
  { value: 'voicemail_left', label: 'Voicemail Left', help: 'Hit voicemail; assistant left a message' },
  { value: 'no_answer', label: 'No Answer', help: 'Contact did not pick up' },
  { value: 'hung_up', label: 'Hung Up Early', help: 'Contact ended call before assistant goal' },
  { value: 'completed', label: 'Completed', help: 'Goal achieved (any outcome above implies this)' },
];

/**
 * AICallCompletedConfig — filter for `ai_call_completed` events emitted by vapi-webhook.
 * Lets the workflow branch on outcome (qualified, transferred, voicemail, etc.) and
 * minimum call duration so flaky 5-second calls don't fire downstream actions.
 */
export default function AICallCompletedConfig({ data, onUpdate }: Props) {
  const config = (data.triggerConfig ?? {}) as Record<string, unknown>;
  const outcomes = (config.outcomes as string[]) ?? [];
  const minDuration = config.minDurationSeconds as number | undefined;
  const requireQualified = (config.requireQualified as boolean) ?? false;
  const assistantIds = (config.assistantIds as string[]) ?? [];

  function update(patch: Record<string, unknown>) {
    onUpdate({ triggerConfig: { ...config, ...patch } });
  }

  function toggleOutcome(value: string) {
    const next = outcomes.includes(value)
      ? outcomes.filter(o => o !== value)
      : [...outcomes, value];
    update({ outcomes: next });
  }

  return (
    <div className="space-y-4">
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-2.5 flex items-start gap-2">
        <PhoneCall className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-purple-800">
          Fires when a Vapi voice call ends. Use this to follow up qualified leads, retry no-answers,
          or notify a human when the assistant escalates.
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">Trigger only when outcome is</label>
        <div className="flex flex-wrap gap-2">
          {OUTCOMES.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => toggleOutcome(o.value)}
              title={o.help}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                outcomes.includes(o.value)
                  ? 'bg-purple-50 border-purple-300 text-purple-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {outcomes.length === 0 && (
          <p className="text-xs text-gray-500 mt-1">Leave empty to fire on any outcome.</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Minimum call duration (seconds)</label>
        <input
          type="number"
          min={0}
          value={minDuration ?? ''}
          onChange={e => update({ minDurationSeconds: e.target.value ? parseInt(e.target.value, 10) : undefined })}
          placeholder="Any (0)"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20"
        />
        <p className="text-xs text-gray-500 mt-1">
          Skip very short calls (e.g. accidental hangups) by setting a 30s floor.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={requireQualified}
          onChange={e => update({ requireQualified: e.target.checked })}
          className="rounded border-gray-300"
        />
        <span className="text-gray-700 text-xs">Require <code className="px-1 py-0.5 bg-gray-100 rounded">qualified=true</code> in assistant outcome</span>
      </label>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Filter to specific assistant IDs (optional)</label>
        <input
          type="text"
          value={assistantIds.join(', ')}
          onChange={e => update({ assistantIds: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
          placeholder="Leave empty for all assistants"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20"
        />
        <p className="text-xs text-gray-500 mt-1">Comma-separated UUIDs of vapi_assistants rows.</p>
      </div>
    </div>
  );
}
