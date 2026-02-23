import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Sparkles,
  Settings,
  Volume2,
  Brain,
  Shield,
  Loader2,
  Trash2,
  Save,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useAssistant } from '../../contexts/AssistantContext';
import { updateProfile } from '../../services/assistantProfile';
import { getMemories, deleteMemory, clearAllMemories } from '../../services/assistantMemory';
import type { AssistantUserMemory } from '../../types/assistant';

const TABS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'voice', label: 'Voice', icon: Volume2 },
  { id: 'memory', label: 'Memory', icon: Brain },
  { id: 'security', label: 'Security', icon: Shield },
];

export default function AssistantSettingsPage() {
  const { user } = useAuth();
  const { profile, refreshProfile } = useAssistant();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'general');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && TABS.some((t) => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  if (!profile || !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Clara Assistant</h1>
          <p className="text-sm text-slate-400">Configure your personal AI assistant</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-700/50">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative ${
                isActive ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-cyan-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {activeTab === 'general' && <GeneralTab />}
      {activeTab === 'voice' && <VoiceTab />}
      {activeTab === 'memory' && <MemoryTab />}
      {activeTab === 'security' && <SecurityTab />}
    </div>
  );
}

function GeneralTab() {
  const { user } = useAuth();
  const { profile, refreshProfile } = useAssistant();
  const [saving, setSaving] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(profile?.system_prompt_override || '');

  const handleToggle = async (field: 'enabled' | 'confirm_all_writes', value: boolean) => {
    if (!user) return;
    setSaving(true);
    try {
      await updateProfile(user.id, { [field]: value });
      await refreshProfile();
    } catch { /* noop */ }
    setSaving(false);
  };

  const handleSavePrompt = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateProfile(user.id, { system_prompt_override: systemPrompt || null });
      await refreshProfile();
    } catch { /* noop */ }
    setSaving(false);
  };

  if (!profile) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <SettingsCard title="Assistant Status">
        <FullToggleRow
          label="Enable Clara"
          description="When disabled, the assistant button and panel will be hidden."
          checked={profile.enabled}
          onChange={(v) => handleToggle('enabled', v)}
          disabled={saving}
        />
      </SettingsCard>

      <SettingsCard title="Action Confirmation">
        <FullToggleRow
          label="Confirm all write operations"
          description="Require your explicit approval before Clara sends emails, creates records, updates contacts, or performs any write action."
          checked={profile.confirm_all_writes}
          onChange={(v) => handleToggle('confirm_all_writes', v)}
          disabled={saving}
        />
      </SettingsCard>

      <SettingsCard title="Custom System Prompt">
        <p className="text-xs text-slate-500 mb-3">
          Add custom instructions for Clara. This is appended to the default system prompt.
        </p>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="e.g., Always respond formally. Use metric units. Prioritize calls over emails."
          rows={4}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-cyan-500/50 resize-none"
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={handleSavePrompt}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </button>
        </div>
      </SettingsCard>
    </div>
  );
}

function VoiceTab() {
  const { user } = useAuth();
  const { profile, refreshProfile } = useAssistant();
  const [saving, setSaving] = useState(false);
  const [speechRate, setSpeechRate] = useState(profile?.speech_rate || 1.0);

  const handleToggle = async (value: boolean) => {
    if (!user) return;
    setSaving(true);
    try {
      await updateProfile(user.id, { voice_enabled: value });
      await refreshProfile();
    } catch { /* noop */ }
    setSaving(false);
  };

  const handleSaveRate = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateProfile(user.id, { speech_rate: speechRate });
      await refreshProfile();
    } catch { /* noop */ }
    setSaving(false);
  };

  if (!profile) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <SettingsCard title="Text-to-Speech">
        <FullToggleRow
          label="Enable voice responses"
          description="Clara will speak responses aloud using ElevenLabs text-to-speech."
          checked={profile.voice_enabled}
          onChange={handleToggle}
          disabled={saving}
        />
      </SettingsCard>

      {profile.voice_enabled && (
        <>
          <SettingsCard title="Voice Configuration">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Current Voice</label>
                <div className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300">
                  {profile.elevenlabs_voice_name || 'No voice selected'}
                </div>
                <p className="text-[10px] text-slate-600 mt-1">
                  Configure ElevenLabs voices in Settings &gt; AI Agents &gt; Voices
                </p>
              </div>
            </div>
          </SettingsCard>

          <SettingsCard title="Speech Rate">
            <div className="space-y-2">
              <input
                type="range"
                min={0.5}
                max={2.0}
                step={0.1}
                value={speechRate}
                onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                className="w-full accent-cyan-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>0.5x</span>
                <span className="text-cyan-400 font-medium">{speechRate.toFixed(1)}x</span>
                <span>2.0x</span>
              </div>
              <div className="flex justify-end mt-1">
                <button
                  onClick={handleSaveRate}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save
                </button>
              </div>
            </div>
          </SettingsCard>
        </>
      )}
    </div>
  );
}

function MemoryTab() {
  const { user } = useAuth();
  const [memories, setMemories] = useState<AssistantUserMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getMemories(user.id)
      .then(setMemories)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const handleDelete = async (id: string) => {
    try {
      await deleteMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch { /* noop */ }
  };

  const handleClearAll = async () => {
    if (!user) return;
    setClearing(true);
    try {
      await clearAllMemories(user.id);
      setMemories([]);
      setShowClearConfirm(false);
    } catch { /* noop */ }
    setClearing(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <SettingsCard title={`Learned Memories (${memories.length})`}>
        <p className="text-xs text-slate-500 mb-3">
          Clara remembers your preferences, communication style, and frequently used patterns.
          These memories help personalize responses.
        </p>

        {memories.length === 0 ? (
          <div className="text-center py-6">
            <Brain className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500">No memories stored yet</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
            {memories.map((mem) => (
              <div
                key={mem.id}
                className="flex items-start gap-3 px-3 py-2 bg-slate-800/50 rounded-lg group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-300 font-medium">{mem.memory_key}</span>
                    <span className="px-1.5 py-0.5 bg-slate-700 rounded text-[9px] text-slate-500">
                      {mem.category}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                    {typeof mem.memory_value === 'string' ? mem.memory_value : JSON.stringify(mem.memory_value)}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(mem.id)}
                  className="p-1 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {memories.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-700/50">
            {showClearConfirm ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearAll}
                  disabled={clearing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 border border-red-500/30 rounded-lg text-xs text-red-400 hover:bg-red-600/30 transition-colors disabled:opacity-50"
                >
                  {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Confirm clear all
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-400 hover:text-slate-300 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear all memories
              </button>
            )}
          </div>
        )}
      </SettingsCard>
    </div>
  );
}

function SecurityTab() {
  return (
    <div className="space-y-6 max-w-2xl">
      <SettingsCard title="Data & Privacy">
        <div className="space-y-3">
          <InfoRow label="Thread data" value="Stored in your Supabase database with RLS" />
          <InfoRow label="Voice recordings" value="Sent to OpenAI Whisper for transcription, not stored" />
          <InfoRow label="TTS audio" value="Generated via ElevenLabs API, not stored" />
          <InfoRow label="Email/Calendar access" value="Uses your connected Google OAuth credentials" />
          <InfoRow label="Memory" value="Encrypted at rest in Supabase, per-user isolation" />
        </div>
      </SettingsCard>

      <SettingsCard title="Permissions">
        <p className="text-xs text-slate-500">
          Clara can only access data and perform actions that you have permissions for in the
          system. All actions are logged and auditable from the Activity tab.
        </p>
      </SettingsCard>
    </div>
  );
}

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
      <h3 className="text-sm font-medium text-white mb-3">{title}</h3>
      {children}
    </div>
  );
}

function FullToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-start gap-4 py-1">
      <div className="flex-1">
        <p className="text-sm text-slate-200">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 mt-0.5 ${
          checked ? 'bg-cyan-600' : 'bg-slate-700'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4.5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-slate-400 w-36 flex-shrink-0">{label}</span>
      <span className="text-xs text-slate-500">{value}</span>
    </div>
  );
}
