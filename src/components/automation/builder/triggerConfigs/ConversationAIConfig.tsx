import type { TriggerNodeData } from '../../../../types';

interface Props {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
}

const AI_EVENTS = [
  { value: 'intent_detected', label: 'Intent Detected' },
  { value: 'sentiment_changed', label: 'Sentiment Changed' },
  { value: 'lead_qualified', label: 'Lead Qualified' },
  { value: 'booking_intent', label: 'Booking Intent' },
  { value: 'escalation_needed', label: 'Escalation Needed' },
  { value: 'custom', label: 'Custom AI Event' },
];

export default function ConversationAIConfig({ data, onUpdate }: Props) {
  const config = (data.triggerConfig ?? {}) as Record<string, unknown>;
  const eventName = (config.eventName as string) ?? '';
  const classificationFilter = (config.classificationFilter as string) ?? '';
  const confidenceThreshold = (config.confidenceThreshold as number) ?? 70;

  function update(patch: Record<string, unknown>) {
    onUpdate({ triggerConfig: { ...config, ...patch } });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">AI Event Name</label>
        <select
          value={eventName}
          onChange={e => update({ eventName: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        >
          <option value="">Select an AI event...</option>
          {AI_EVENTS.map(e => (
            <option key={e.value} value={e.value}>{e.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Classification Filter (Optional)</label>
        <input
          value={classificationFilter}
          onChange={e => update({ classificationFilter: e.target.value })}
          placeholder="e.g. positive, negative, interested"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Confidence Threshold: {confidenceThreshold}%
        </label>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={confidenceThreshold}
          onChange={e => update({ confidenceThreshold: parseInt(e.target.value) })}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      <div className="p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-700">
          Triggers when Conversation AI detects the specified event with at least {confidenceThreshold}% confidence.
        </p>
      </div>
    </div>
  );
}
