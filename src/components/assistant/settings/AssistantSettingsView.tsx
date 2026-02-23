import { useState } from 'react';
import { Settings, Volume2, Shield, Brain, ExternalLink, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useAssistant } from '../../../contexts/AssistantContext';
import { updateProfile } from '../../../services/assistantProfile';
import { clearAllMemories } from '../../../services/assistantMemory';

export function AssistantSettingsView() {
  const { user } = useAuth();
  const { profile, refreshProfile } = useAssistant();
  const [saving, setSaving] = useState(false);
  const [clearingMemory, setClearingMemory] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!profile || !user) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
      </div>
    );
  }

  const handleToggle = async (
    field: 'enabled' | 'voice_enabled' | 'confirm_all_writes',
    value: boolean
  ) => {
    setSaving(true);
    try {
      await updateProfile(user.id, { [field]: value });
      await refreshProfile();
    } catch { /* noop */ }
    setSaving(false);
  };

  const handleClearMemory = async () => {
    setClearingMemory(true);
    try {
      await clearAllMemories(user.id);
      setShowConfirm(false);
    } catch { /* noop */ }
    setClearingMemory(false);
  };

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 min-h-0 scrollbar-thin">
      <Section icon={Settings} title="General">
        <ToggleRow
          label="Clara enabled"
          description="Show Clara FAB and allow interactions"
          checked={profile.enabled}
          onChange={(v) => handleToggle('enabled', v)}
          disabled={saving}
        />
        <ToggleRow
          label="Confirm all writes"
          description="Require approval before any create/update/send"
          checked={profile.confirm_all_writes}
          onChange={(v) => handleToggle('confirm_all_writes', v)}
          disabled={saving}
        />
      </Section>

      <Section icon={Volume2} title="Voice">
        <ToggleRow
          label="Voice responses"
          description="Enable text-to-speech with ElevenLabs"
          checked={profile.voice_enabled}
          onChange={(v) => handleToggle('voice_enabled', v)}
          disabled={saving}
        />
        {profile.voice_enabled && (
          <div className="mt-2 px-2 py-1.5 bg-slate-800/50 rounded">
            <p className="text-[10px] text-slate-500">
              Voice: {profile.elevenlabs_voice_name || 'Not configured'}
            </p>
            <p className="text-[10px] text-slate-500">
              Rate: {profile.speech_rate}x
            </p>
          </div>
        )}
      </Section>

      <Section icon={Brain} title="Memory">
        <p className="text-[10px] text-slate-500 mb-2">
          Clara learns your preferences over time. You can clear all learned data.
        </p>
        {showConfirm ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearMemory}
              disabled={clearingMemory}
              className="flex items-center gap-1 px-2.5 py-1 bg-red-600/20 border border-red-500/30 rounded text-[10px] text-red-400 hover:bg-red-600/30 transition-colors"
            >
              {clearingMemory ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Confirm clear
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="px-2.5 py-1 text-[10px] text-slate-500 hover:text-slate-300"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-400 hover:text-slate-300 transition-colors"
          >
            <Trash2 className="w-3 h-3" /> Clear all memory
          </button>
        )}
      </Section>

      <Section icon={Shield} title="Advanced">
        <a
          href="/settings/assistant"
          className="flex items-center gap-1.5 text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <ExternalLink className="w-3 h-3" /> Open full settings page
        </a>
      </Section>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Settings;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-[11px] text-slate-300 font-medium">{title}</span>
      </div>
      <div className="ml-5">{children}</div>
    </div>
  );
}

function ToggleRow({
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
    <label className="flex items-start gap-3 py-1.5 cursor-pointer group">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors flex-shrink-0 mt-0.5 ${
          checked ? 'bg-cyan-600' : 'bg-slate-700'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-3.5' : 'translate-x-0.5'
          }`}
        />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-slate-300 group-hover:text-white transition-colors">{label}</p>
        <p className="text-[9px] text-slate-600">{description}</p>
      </div>
    </label>
  );
}
