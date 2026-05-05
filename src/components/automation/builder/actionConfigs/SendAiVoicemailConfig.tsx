import { useEffect, useState } from 'react';
import { Voicemail, AlertCircle } from 'lucide-react';
import type { ActionNodeData } from '../../../../types';
import { useAuth } from '../../../../contexts/AuthContext';
import { supabase } from '../../../../lib/supabase';

interface VapiAssistantRow {
  id: string;
  name: string;
  status: string;
  vapi_assistant_id: string | null;
}

interface Props {
  data: ActionNodeData;
  onUpdate: (u: Partial<ActionNodeData>) => void;
}

/**
 * SendAiVoicemailConfig — drops a voicemail rendered by a Vapi assistant
 * (text → TTS) without ringing the contact. Engine handler calls
 * vapi-tool-gateway in voicemail-only mode.
 */
export default function SendAiVoicemailConfig({ data, onUpdate }: Props) {
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
      .select('id, name, status, vapi_assistant_id')
      .eq('org_id', orgId)
      .eq('status', 'published')
      .order('name', { ascending: true })
      .then(({ data: rows, error }) => {
        if (!error && rows) setAssistants(rows);
        setLoading(false);
      });
  }, [orgId]);

  const message = (cfg.voicemail_text as string) ?? '';
  const wordCount = message.trim().split(/\s+/).filter(Boolean).length;
  const estimatedSeconds = Math.ceil((wordCount / 150) * 60); // ~150 wpm

  return (
    <div className="space-y-3">
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-2.5 flex items-start gap-2">
        <Voicemail className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-orange-800">
          Drops a Vapi-rendered voicemail directly to {`{{contact.phone}}`}'s voicemail box without making the phone ring.
          Use for time-shifted nudges where a real call would be intrusive.
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Voice (Vapi assistant)</label>
        <select
          value={cfg.assistant_id ?? ''}
          onChange={e => set('assistant_id', e.target.value || undefined)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          disabled={loading}
        >
          <option value="">{loading ? 'Loading…' : 'Select a voice…'}</option>
          {assistants.map(a => (
            <option key={a.id} value={a.id} disabled={!a.vapi_assistant_id}>
              {a.name}
              {!a.vapi_assistant_id ? ' (not synced)' : ''}
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
        <label className="block text-xs font-medium text-gray-700 mb-1">Voicemail script</label>
        <textarea
          value={message}
          onChange={e => set('voicemail_text', e.target.value)}
          rows={5}
          placeholder='Hi {{contact.first_name}}, this is Alex from Autom8ion Lab. I saw you were interested in our capability statement — call me back when you have a minute. My number is 813-320-9652. Thanks!'
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
        />
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-gray-500">
            {wordCount} word{wordCount === 1 ? '' : 's'} · ~{estimatedSeconds}s spoken
          </span>
          {estimatedSeconds > 30 && (
            <span className="text-xs text-amber-700">
              Voicemails &gt;30s may be cut off by carrier
            </span>
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">From number</label>
        <select
          value={cfg.from_number_mode ?? 'org_default'}
          onChange={e => set('from_number_mode', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        >
          <option value="org_default">Organization default voice number</option>
          <option value="contact_owner">Contact owner's number</option>
          <option value="specific">Specific number…</option>
        </select>
        {cfg.from_number_mode === 'specific' && (
          <input
            type="text"
            value={cfg.from_number ?? ''}
            onChange={e => set('from_number', e.target.value)}
            placeholder="+18133209652"
            className="mt-2 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          />
        )}
      </div>
    </div>
  );
}
