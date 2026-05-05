import { useEffect, useState } from 'react';
import { ArrowRightLeft, AlertCircle } from 'lucide-react';
import type { ActionNodeData } from '../../../../types';
import { useAuth } from '../../../../contexts/AuthContext';
import { supabase } from '../../../../lib/supabase';

interface VapiAssistantRow {
  id: string;
  name: string;
  status: string;
  vapi_assistant_id: string | null;
  channel_modes: unknown;
}

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

/**
 * TransferToAiAgentConfig — hands an active conversation OR call off to a
 * Vapi assistant. For calls: server invokes vapi-tool-gateway's transfer endpoint.
 * For chat conversations: assistant takes over message_received events.
 */
export default function TransferToAiAgentConfig({ data, onUpdate }: Props) {
  const cfg = (data.config as Record<string, any>) ?? {};
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });
  const { user } = useAuth();
  const orgId = user?.organization_id ?? null;

  const [assistants, setAssistants] = useState<VapiAssistantRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    supabase
      .from('vapi_assistants')
      .select('id, name, status, vapi_assistant_id, channel_modes')
      .eq('org_id', orgId)
      .eq('status', 'published')
      .order('name', { ascending: true })
      .then(({ data: rows, error }) => {
        if (!error && rows) setAssistants(rows);
        setLoading(false);
      });
  }, [orgId]);

  return (
    <div className="space-y-3">
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 flex items-start gap-2">
        <ArrowRightLeft className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-800">
          Transfers the active conversation or live call to the selected Vapi assistant.
          Useful for routing qualified leads to a closer assistant or escalating a chat to voice.
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Transfer mode</label>
        <select
          value={cfg.transfer_mode ?? 'auto'}
          onChange={e => set('transfer_mode', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="auto">Auto (use the conversation's active channel)</option>
          <option value="voice">Voice call (Vapi initiates outbound)</option>
          <option value="conversation">Conversation (chat handoff)</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Target Vapi assistant</label>
        <select
          value={cfg.target_assistant_id ?? ''}
          onChange={e => set('target_assistant_id', e.target.value || undefined)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          disabled={loading}
        >
          <option value="">{loading ? 'Loading…' : 'Select an assistant…'}</option>
          {assistants.map(a => (
            <option key={a.id} value={a.id} disabled={!a.vapi_assistant_id}>
              {a.name}
              {!a.vapi_assistant_id ? ' (not synced to Vapi)' : ''}
            </option>
          ))}
        </select>
        {!loading && assistants.length === 0 && (
          <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            No published assistants — publish one in AI Agents first.
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Handoff context (optional)</label>
        <textarea
          value={cfg.handoff_context ?? ''}
          onChange={e => set('handoff_context', e.target.value)}
          rows={3}
          placeholder="Lead is interested in our enterprise SOC plan. They mentioned a 2026-Q3 budget cycle."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
        />
        <p className="text-xs text-gray-500 mt-1">
          Provided to the receiving assistant as opening context. Supports merge fields.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={cfg.notify_human_owner ?? false}
          onChange={e => set('notify_human_owner', e.target.checked)}
          className="rounded border-gray-300"
        />
        <span className="text-gray-700 text-xs">Also notify contact's owner that AI is handling this thread</span>
      </label>
    </div>
  );
}
