import { useEffect, useState } from 'react';
import { PhoneCall, AlertCircle, Sparkles } from 'lucide-react';
import type { ActionNodeData } from '../../../../types';
import { useAuth } from '../../../../contexts/AuthContext';
import { supabase } from '../../../../lib/supabase';

interface VapiAssistantRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  vapi_assistant_id: string | null;
}

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

/**
 * StartAiCallConfig — places an outbound voice call from a Vapi assistant
 * to {{contact.phone}}. The engine handler routes to vapi-tool-gateway
 * which calls Vapi's `/call` API. Voice DND is enforced server-side
 * by canSendOnChannel('voice', contact).
 */
export default function StartAiCallConfig({ data, onUpdate }: Props) {
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
      .select('id, name, slug, status, vapi_assistant_id')
      .eq('org_id', orgId)
      .neq('status', 'archived')
      .order('name', { ascending: true })
      .then(({ data: rows, error }) => {
        if (error) {
          console.error('Failed to load Vapi assistants:', error);
          setAssistants([]);
        } else {
          setAssistants(rows ?? []);
        }
        setLoading(false);
      });
  }, [orgId]);

  return (
    <div className="space-y-3">
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-2.5 flex items-start gap-2">
        <PhoneCall className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-purple-800">
          Places an outbound voice call from a Vapi assistant to <code className="px-1 py-0.5 bg-white/70 rounded">{'{{contact.phone}}'}</code>.
          Calls are gated by voice-DND and the contact's TCPA consent record.
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Vapi assistant</label>
        <select
          value={cfg.assistant_id ?? ''}
          onChange={e => set('assistant_id', e.target.value || undefined)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          disabled={loading}
        >
          <option value="">{loading ? 'Loading…' : 'Select an assistant…'}</option>
          {assistants.map(a => (
            <option key={a.id} value={a.id} disabled={a.status !== 'published' || !a.vapi_assistant_id}>
              {a.name}
              {a.status !== 'published' ? ' (draft — publish first)' : ''}
              {a.status === 'published' && !a.vapi_assistant_id ? ' (not synced)' : ''}
            </option>
          ))}
        </select>
        {!loading && assistants.length === 0 && (
          <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            No assistants configured — create one in the AI Agents page.
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Call goal / context (optional)</label>
        <textarea
          value={cfg.call_goal ?? ''}
          onChange={e => set('call_goal', e.target.value)}
          rows={3}
          placeholder="Confirm appointment for {{appointment.date}} and answer any pre-call questions."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none"
        />
        <p className="text-xs text-gray-500 mt-1">
          Injected into the assistant's system prompt as variable <code className="px-1 py-0.5 bg-gray-100 rounded">{'{{call_goal}}'}</code>.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Max duration (seconds)</label>
          <input
            type="number"
            min={30}
            max={3600}
            value={cfg.max_duration_seconds ?? 600}
            onChange={e => set('max_duration_seconds', parseInt(e.target.value, 10) || 600)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Ring timeout (seconds)</label>
          <input
            type="number"
            min={10}
            max={60}
            value={cfg.ring_timeout_seconds ?? 25}
            onChange={e => set('ring_timeout_seconds', parseInt(e.target.value, 10) || 25)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">If no answer</label>
        <select
          value={cfg.fallback_action ?? 'voicemail'}
          onChange={e => set('fallback_action', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20"
        >
          <option value="voicemail">Drop AI voicemail</option>
          <option value="retry_in_15min">Retry in 15 minutes</option>
          <option value="retry_in_1hour">Retry in 1 hour</option>
          <option value="continue_workflow">Continue workflow (no retry)</option>
          <option value="stop_workflow">Stop workflow</option>
        </select>
      </div>

      <div className="text-xs text-gray-500 border-t border-gray-200 pt-3 flex items-start gap-2">
        <Sparkles className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
        <div>
          The call outcome is emitted as <code className="px-1 py-0.5 bg-gray-100 rounded">ai_call_completed</code> —
          you can branch on it in a downstream workflow.
        </div>
      </div>
    </div>
  );
}
