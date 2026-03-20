import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Upload, Copy, Archive, Play, AlertTriangle,
  FileText, Cpu, Volume2, Wrench, Radio, History, Loader2,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getAssistant, createAssistant, updateAssistant, publishAssistant,
  getAssistantVersions, duplicateAssistant, deleteAssistant,
  verifyAssistantExistsOnVapi,
} from '../../../services/vapiAssistants';
import { hasSmsNumberForAssistant } from '../../../services/vapiNumbers';
import { listTools } from '../../../services/vapiTools';
import type { VapiAssistant, VapiAssistantVersion } from '../../../services/vapiAssistants';
import type { VapiTool } from '../../../services/vapiTools';
import { VoiceTabPanel } from '../../../components/voice-ai/VoiceTabPanel';
import { ModelTabPanel } from '../../../components/voice-ai/ModelTabPanel';

const editorTabs = [
  { key: 'basics', label: 'Basics', icon: FileText },
  { key: 'model', label: 'Model', icon: Cpu },
  { key: 'voice', label: 'Voice', icon: Volume2 },
  { key: 'tools', label: 'Tools', icon: Wrench },
  { key: 'channels', label: 'Channels', icon: Radio },
  { key: 'publish', label: 'Publish', icon: Upload },
];

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 60);
}

export function VapiAssistantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, hasPermission } = useAuth();
  const isNew = id === 'new';

  const canEdit = hasPermission('ai_agents.voice.edit');
  const canPublish = hasPermission('ai_agents.voice.publish');

  const [tab, setTab] = useState(searchParams.get('tab') || 'basics');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [versions, setVersions] = useState<VapiAssistantVersion[]>([]);
  const [tools, setTools] = useState<VapiTool[]>([]);
  const [enabledToolIds, setEnabledToolIds] = useState<Set<string>>(new Set());
  const [smsReady, setSmsReady] = useState(false);
  const [publishNotes, setPublishNotes] = useState('');

  const [form, setForm] = useState({
    name: '',
    slug: '',
    first_message: 'Hello! How can I help you today?',
    system_prompt: '',
    llm_provider: 'anthropic',
    llm_model: 'claude-sonnet-4-20250514',
    transcriber_provider: 'deepgram',
    transcriber_model: 'nova-2',
    voice_provider: 'elevenlabs',
    voice_id: '',
    channel_modes: ['voice'] as string[],
  });

  const [originalStatus, setOriginalStatus] = useState<string>('draft');
  const [vapiAssistantId, setVapiAssistantId] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      return;
    }
    loadAssistant();
  }, [id]);

  useEffect(() => {
    if (user?.organization_id) {
      listTools(user.organization_id).then(setTools).catch(console.error);
    }
  }, [user?.organization_id]);

  const loadAssistant = async () => {
    if (!id || id === 'new') return;
    setLoading(true);
    try {
      const assistant = await getAssistant(id);
      if (!assistant) {
        navigate('/ai-agents/voice/assistants');
        return;
      }

      if (assistant.vapi_assistant_id) {
        const existsOnVapi = await verifyAssistantExistsOnVapi(assistant.vapi_assistant_id);
        if (!existsOnVapi) {
          await deleteAssistant(id);
          navigate('/ai-agents/voice/assistants?removed=vapi', { replace: true });
          return;
        }
      }

      setForm({
        name: assistant.name,
        slug: assistant.slug,
        first_message: assistant.first_message,
        system_prompt: assistant.system_prompt,
        llm_provider: assistant.llm_provider,
        llm_model: assistant.llm_model,
        transcriber_provider: assistant.transcriber_provider,
        transcriber_model: assistant.transcriber_model,
        voice_provider: assistant.voice_provider,
        voice_id: assistant.voice_id || '',
        channel_modes: assistant.channel_modes || ['voice'],
      });
      setOriginalStatus(assistant.status);
      setVapiAssistantId(assistant.vapi_assistant_id);

      const vers = await getAssistantVersions(id);
      setVersions(vers);

      if (assistant.channel_modes?.includes('sms')) {
        const ready = await hasSmsNumberForAssistant(id);
        setSmsReady(ready);
      }
    } catch (e) {
      console.error('Failed to load assistant:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.organization_id || !user?.id) return;
    setSaving(true);
    try {
      if (isNew) {
        const created = await createAssistant(user.organization_id, form, user.id);
        navigate(`/ai-agents/voice/assistants/${created.id}`, { replace: true });
      } else if (id) {
        await updateAssistant(id, form);
        await loadAssistant();
      }
    } catch (e) {
      console.error('Failed to save:', e);
      alert(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!id || isNew || !user?.id) return;

    if (form.channel_modes.includes('sms') && !smsReady) {
      alert('SMS mode requires a 10DLC-approved Twilio number imported into Vapi. Please add one in the Numbers tab first.');
      return;
    }

    setPublishing(true);
    try {
      await updateAssistant(id, form);
      await publishAssistant(id, user.id, publishNotes || undefined);
      setPublishNotes('');
      await loadAssistant();
    } catch (e) {
      console.error('Failed to publish:', e);
      alert(e instanceof Error ? e.message : 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  };

  const handleDuplicate = async () => {
    if (!id || isNew || !user?.id) return;
    try {
      const copy = await duplicateAssistant(id, user.id);
      navigate(`/ai-agents/voice/assistants/${copy.id}`);
    } catch (e) {
      console.error('Failed to duplicate:', e);
    }
  };

  const toggleChannel = (channel: string) => {
    setForm(prev => {
      const modes = prev.channel_modes.includes(channel)
        ? prev.channel_modes.filter(m => m !== channel)
        : [...prev.channel_modes, channel];
      return { ...prev, channel_modes: modes.length > 0 ? modes : ['voice'] };
    });
  };

  const toggleToolId = (toolId: string) => {
    setEnabledToolIds(prev => {
      const next = new Set(prev);
      if (next.has(toolId)) next.delete(toolId);
      else next.add(toolId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/ai-agents/voice/assistants')}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-white">
              {isNew ? 'New Assistant' : form.name || 'Untitled'}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              {!isNew && (
                <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${
                  originalStatus === 'published'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : originalStatus === 'archived'
                    ? 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                  {originalStatus}
                </span>
              )}
              {vapiAssistantId && (
                <span className="text-xs text-slate-500">Vapi: {vapiAssistantId.substring(0, 12)}...</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isNew && canEdit && (
            <button
              onClick={handleDuplicate}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              Duplicate
            </button>
          )}
          {canEdit && (
            <button
              onClick={handleSave}
              disabled={saving || !form.name}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Draft
            </button>
          )}
          {!isNew && canPublish && (
            <button
              onClick={handlePublish}
              disabled={publishing || !form.name}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Publish
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-700 mb-6 overflow-x-auto">
        {editorTabs.map(t => {
          const Icon = t.icon;
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? 'text-cyan-400 border-cyan-500'
                  : 'text-slate-400 border-transparent hover:text-slate-300 hover:border-slate-600'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        {tab === 'basics' && (
          <div className="space-y-5 max-w-2xl">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => {
                  const name = e.target.value;
                  setForm(prev => ({
                    ...prev,
                    name,
                    slug: isNew ? generateSlug(name) : prev.slug,
                  }));
                }}
                placeholder="My Voice Assistant"
                className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Slug</label>
              <input
                type="text"
                value={form.slug}
                onChange={e => setForm(prev => ({ ...prev, slug: e.target.value }))}
                placeholder="my-voice-assistant"
                className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              <p className="text-xs text-slate-500 mt-1">URL-friendly identifier. Must be unique within your organization.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">First Message</label>
              <textarea
                value={form.first_message}
                onChange={e => setForm(prev => ({ ...prev, first_message: e.target.value }))}
                rows={2}
                placeholder="Hello! How can I help you today?"
                className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
              />
              <p className="text-xs text-slate-500 mt-1">The greeting message the assistant speaks when a call or session starts.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">System Prompt</label>
              <textarea
                value={form.system_prompt}
                onChange={e => setForm(prev => ({ ...prev, system_prompt: e.target.value }))}
                rows={10}
                placeholder="You are a helpful assistant for Acme Corp. Your job is to..."
                className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-y font-mono"
              />
              <p className="text-xs text-slate-500 mt-1">
                Instructions for how the assistant should behave. Use {'{{contact.first_name}}'}, {'{{contact.email}}'} for merge fields.
              </p>
            </div>
          </div>
        )}

        {tab === 'model' && (
          <ModelTabPanel
            llmProvider={form.llm_provider}
            llmModel={form.llm_model}
            transcriberProvider={form.transcriber_provider}
            transcriberModel={form.transcriber_model}
            onLlmProviderChange={v => setForm(prev => ({ ...prev, llm_provider: v }))}
            onLlmModelChange={v => setForm(prev => ({ ...prev, llm_model: v }))}
            onTranscriberProviderChange={v => setForm(prev => ({ ...prev, transcriber_provider: v }))}
            onTranscriberModelChange={v => setForm(prev => ({ ...prev, transcriber_model: v }))}
          />
        )}

        {tab === 'voice' && (
          <VoiceTabPanel
            voiceProvider={form.voice_provider}
            voiceId={form.voice_id}
            onProviderChange={v => setForm(prev => ({ ...prev, voice_provider: v }))}
            onVoiceChange={v => setForm(prev => ({ ...prev, voice_id: v }))}
          />
        )}

        {tab === 'tools' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400 mb-4">
              Enable tools that this assistant can invoke during conversations. System tools are available to all assistants.
            </p>
            {tools.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">No tools available.</p>
            ) : (
              <div className="space-y-2">
                {tools.map(tool => (
                  <div
                    key={tool.id}
                    className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-700 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{tool.tool_name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          tool.is_system
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-slate-700 text-slate-400'
                        }`}>
                          {tool.is_system ? 'System' : 'Custom'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{tool.description}</p>
                    </div>
                    <label className="flex items-center cursor-pointer ml-4">
                      <input
                        type="checkbox"
                        checked={enabledToolIds.has(tool.id)}
                        onChange={() => toggleToolId(tool.id)}
                        className="sr-only"
                      />
                      <div className={`w-9 h-5 rounded-full transition-colors ${
                        enabledToolIds.has(tool.id) ? 'bg-cyan-600' : 'bg-slate-600'
                      }`}>
                        <div className={`w-4 h-4 rounded-full bg-white transform transition-transform mt-0.5 ${
                          enabledToolIds.has(tool.id) ? 'translate-x-4.5 ml-[18px]' : 'translate-x-0.5 ml-0.5'
                        }`} />
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'channels' && (
          <div className="space-y-4 max-w-2xl">
            <p className="text-sm text-slate-400 mb-4">
              Choose which communication channels this assistant supports.
            </p>

            {[
              { key: 'voice', label: 'Voice Calls', desc: 'Handle inbound and outbound phone calls', icon: '🎙' },
              { key: 'sms', label: 'SMS', desc: 'Text message conversations', icon: '💬' },
              { key: 'webchat', label: 'Web Chat', desc: 'Website chat and voice widget', icon: '🌐' },
            ].map(channel => (
              <div
                key={channel.key}
                className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-700 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{channel.icon}</span>
                  <div>
                    <div className="text-sm font-medium text-white">{channel.label}</div>
                    <div className="text-xs text-slate-500">{channel.desc}</div>
                  </div>
                </div>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.channel_modes.includes(channel.key)}
                    onChange={() => toggleChannel(channel.key)}
                    className="sr-only"
                  />
                  <div className={`w-9 h-5 rounded-full transition-colors ${
                    form.channel_modes.includes(channel.key) ? 'bg-cyan-600' : 'bg-slate-600'
                  }`}>
                    <div className={`w-4 h-4 rounded-full bg-white transform transition-transform mt-0.5 ${
                      form.channel_modes.includes(channel.key) ? 'ml-[18px]' : 'ml-0.5'
                    }`} />
                  </div>
                </label>
              </div>
            ))}

            {form.channel_modes.includes('sms') && !isNew && !smsReady && (
              <div className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-amber-400">SMS requires a 10DLC-approved Twilio number</div>
                  <p className="text-xs text-slate-400 mt-1">
                    To publish with SMS enabled, you must first import a 10DLC-approved Twilio number in the Numbers tab and bind it to this assistant. Vapi free numbers do not support SMS.
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Note: SMS sessions must be initiated by the customer. Outbound first-contact SMS is not permitted.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'publish' && (
          <div className="space-y-6 max-w-2xl">
            <div className="flex items-center gap-3 p-4 bg-slate-900/50 border border-slate-700 rounded-lg">
              <div className={`p-2 rounded-full ${
                originalStatus === 'published' ? 'bg-emerald-500/10' : 'bg-amber-500/10'
              }`}>
                {originalStatus === 'published' ? (
                  <Play className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Upload className="w-5 h-5 text-amber-400" />
                )}
              </div>
              <div>
                <div className="text-sm font-medium text-white">
                  Status: <span className={originalStatus === 'published' ? 'text-emerald-400' : 'text-amber-400'}>{originalStatus}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {originalStatus === 'published'
                    ? 'This assistant is live on Vapi. Publishing again will update the live version.'
                    : 'This assistant is in draft mode. Publish to create it on Vapi and make it available.'}
                </p>
              </div>
            </div>

            {!isNew && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Publish Notes (optional)</label>
                  <textarea
                    value={publishNotes}
                    onChange={e => setPublishNotes(e.target.value)}
                    rows={2}
                    placeholder="Describe what changed in this version..."
                    className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
                  />
                </div>

                {canPublish && (
                  <button
                    onClick={handlePublish}
                    disabled={publishing || !form.name}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {originalStatus === 'published' ? 'Publish Update' : 'Publish to Vapi'}
                  </button>
                )}
              </>
            )}

            {versions.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-white flex items-center gap-2 mb-3">
                  <History className="w-4 h-4 text-slate-400" />
                  Version History
                </h3>
                <div className="space-y-2">
                  {versions.map(v => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-700 rounded-lg"
                    >
                      <div>
                        <div className="text-sm font-medium text-white">
                          Version {v.version_number}
                        </div>
                        <div className="text-xs text-slate-500">
                          {v.notes || 'No notes'} &middot; {new Date(v.created_at).toLocaleString()}
                        </div>
                      </div>
                      {v.created_by && (
                        <span className="text-xs text-slate-500">
                          by {v.created_by.name}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
