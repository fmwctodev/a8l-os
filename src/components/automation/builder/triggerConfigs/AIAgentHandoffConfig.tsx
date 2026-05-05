import type { TriggerNodeData } from '../../../../types';
import { ArrowRightLeft } from 'lucide-react';

interface Props {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
}

const REASONS = [
  { value: 'qualified_lead', label: 'Qualified Lead' },
  { value: 'complex_question', label: 'Complex Question' },
  { value: 'angry_customer', label: 'Angry / Frustrated' },
  { value: 'requested_human', label: 'Customer Asked for Human' },
  { value: 'pricing_negotiation', label: 'Pricing Negotiation' },
  { value: 'technical_issue', label: 'Technical Issue' },
  { value: 'other', label: 'Other / Unclassified' },
];

/**
 * AIAgentHandoffConfig — filter for `ai_agent_handoff_requested` events emitted by
 * vapi-webhook when the assistant decides (via transferCall tool or assistant logic)
 * that a human needs to take over. Use to instantly notify the right team member.
 */
export default function AIAgentHandoffConfig({ data, onUpdate }: Props) {
  const config = (data.triggerConfig ?? {}) as Record<string, unknown>;
  const reasons = (config.reasons as string[]) ?? [];
  const channel = (config.channel as string) ?? 'any';

  function update(patch: Record<string, unknown>) {
    onUpdate({ triggerConfig: { ...config, ...patch } });
  }

  function toggleReason(value: string) {
    const next = reasons.includes(value)
      ? reasons.filter(r => r !== value)
      : [...reasons, value];
    update({ reasons: next });
  }

  return (
    <div className="space-y-4">
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 flex items-start gap-2">
        <ArrowRightLeft className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-800">
          Fires when a Vapi assistant escalates a conversation or call to a human. Use to instantly
          notify the contact owner or assign a high-priority task.
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">Trigger only on these handoff reasons</label>
        <div className="flex flex-wrap gap-2">
          {REASONS.map(r => (
            <button
              key={r.value}
              type="button"
              onClick={() => toggleReason(r.value)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                reasons.includes(r.value)
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {reasons.length === 0 && (
          <p className="text-xs text-gray-500 mt-1">Leave empty to fire on any handoff reason.</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Channel filter</label>
        <select
          value={channel}
          onChange={e => update({ channel: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="any">Any channel</option>
          <option value="voice">Voice calls only</option>
          <option value="conversation">Chat conversations only</option>
        </select>
      </div>
    </div>
  );
}
