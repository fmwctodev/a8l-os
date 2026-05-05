import type { TriggerNodeData } from '../../../../types';
import { Voicemail } from 'lucide-react';

interface Props {
  data: TriggerNodeData;
  onUpdate: (updates: Partial<TriggerNodeData>) => void;
}

/**
 * AIVoicemailReceivedConfig — filter for `ai_voicemail_received` events emitted by
 * vapi-webhook when the Vapi assistant routes an inbound call to voicemail or when
 * the contact themselves leaves a voicemail. Workflows can branch on transcription
 * keywords or sentiment.
 */
export default function AIVoicemailReceivedConfig({ data, onUpdate }: Props) {
  const config = (data.triggerConfig ?? {}) as Record<string, unknown>;
  const keywords = (config.keywords as string[]) ?? [];
  const minDuration = config.minDurationSeconds as number | undefined;
  const sentiment = (config.sentiment as string) ?? 'any';

  function update(patch: Record<string, unknown>) {
    onUpdate({ triggerConfig: { ...config, ...patch } });
  }

  return (
    <div className="space-y-4">
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-2.5 flex items-start gap-2">
        <Voicemail className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-orange-800">
          Fires when a Vapi-handled inbound call reaches voicemail, or when a contact leaves a voicemail
          on a Vapi-managed line. Transcript is available in the workflow context.
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Match keywords in transcript (optional)</label>
        <input
          type="text"
          value={keywords.join(', ')}
          onChange={e => update({ keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
          placeholder='e.g. "interested", "callback", "urgent"'
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        />
        <p className="text-xs text-gray-500 mt-1">Comma-separated. Trigger fires if ANY keyword appears (case-insensitive).</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Minimum voicemail duration (seconds)</label>
        <input
          type="number"
          min={0}
          value={minDuration ?? ''}
          onChange={e => update({ minDurationSeconds: e.target.value ? parseInt(e.target.value, 10) : undefined })}
          placeholder="Any (0)"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        />
        <p className="text-xs text-gray-500 mt-1">
          Skip empty/silent voicemails by setting a 5s floor.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Sentiment filter</label>
        <select
          value={sentiment}
          onChange={e => update({ sentiment: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        >
          <option value="any">Any sentiment</option>
          <option value="positive">Positive only</option>
          <option value="neutral">Neutral or better</option>
          <option value="negative">Negative only (flag for follow-up)</option>
        </select>
      </div>
    </div>
  );
}
