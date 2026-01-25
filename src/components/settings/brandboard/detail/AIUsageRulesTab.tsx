import { useState } from 'react';
import { Plus, X, Save, Shield, Ban, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { updateBrandKitAIRules } from '../../../../services/brandboard';
import type { BrandKitWithVersion, AIFallbackBehavior } from '../../../../types';

interface AIUsageRulesTabProps {
  kit: BrandKitWithVersion;
  onUpdate: () => void;
  canManage: boolean;
}

interface CheckboxProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
}

function Checkbox({ label, description, checked, onChange, disabled }: CheckboxProps) {
  return (
    <label className={`flex items-start gap-3 p-4 bg-slate-900/50 rounded-lg border border-slate-700 cursor-pointer transition-colors ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-slate-600'}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-800 disabled:cursor-not-allowed"
      />
      <div>
        <span className="text-sm font-medium text-white">{label}</span>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
    </label>
  );
}

export function AIUsageRulesTab({ kit, onUpdate, canManage }: AIUsageRulesTabProps) {
  const { user } = useAuth();
  const v = kit.latest_version;

  const [aiEnforceVoice, setAiEnforceVoice] = useState(v?.ai_enforce_voice ?? true);
  const [aiEnforceTerminology, setAiEnforceTerminology] = useState(v?.ai_enforce_terminology ?? false);
  const [aiAvoidRestricted, setAiAvoidRestricted] = useState(v?.ai_avoid_restricted ?? true);
  const [aiForbiddenTopics, setAiForbiddenTopics] = useState<string[]>(v?.ai_forbidden_topics || []);
  const [aiForbiddenClaims, setAiForbiddenClaims] = useState<string[]>(v?.ai_forbidden_claims || []);
  const [aiForbiddenPhrases, setAiForbiddenPhrases] = useState<string[]>(v?.ai_forbidden_phrases || []);
  const [aiFallbackBehavior, setAiFallbackBehavior] = useState<AIFallbackBehavior>(v?.ai_fallback_behavior || 'ask_human');

  const [newTopic, setNewTopic] = useState('');
  const [newClaim, setNewClaim] = useState('');
  const [newPhrase, setNewPhrase] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const isEditable = kit.status === 'draft' && canManage;

  const handleCheckboxChange = (setter: (value: boolean) => void, value: boolean) => {
    setter(value);
    setHasChanges(true);
  };

  const handleAddTopic = () => {
    if (!newTopic.trim()) return;
    setAiForbiddenTopics((prev) => [...prev, newTopic.trim()]);
    setNewTopic('');
    setHasChanges(true);
  };

  const handleRemoveTopic = (index: number) => {
    setAiForbiddenTopics((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleAddClaim = () => {
    if (!newClaim.trim()) return;
    setAiForbiddenClaims((prev) => [...prev, newClaim.trim()]);
    setNewClaim('');
    setHasChanges(true);
  };

  const handleRemoveClaim = (index: number) => {
    setAiForbiddenClaims((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleAddPhrase = () => {
    if (!newPhrase.trim()) return;
    setAiForbiddenPhrases((prev) => [...prev, newPhrase.trim()]);
    setNewPhrase('');
    setHasChanges(true);
  };

  const handleRemovePhrase = (index: number) => {
    setAiForbiddenPhrases((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleFallbackChange = (value: AIFallbackBehavior) => {
    setAiFallbackBehavior(value);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await updateBrandKitAIRules(kit.id, {
        ai_enforce_voice: aiEnforceVoice,
        ai_enforce_terminology: aiEnforceTerminology,
        ai_avoid_restricted: aiAvoidRestricted,
        ai_forbidden_topics: aiForbiddenTopics,
        ai_forbidden_claims: aiForbiddenClaims,
        ai_forbidden_phrases: aiForbiddenPhrases,
        ai_fallback_behavior: aiFallbackBehavior,
      }, user.id);
      setHasChanges(false);
      onUpdate();
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-cyan-500/20 rounded-lg">
            <Shield className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">AI Enforcement Rules</h2>
            <p className="text-sm text-slate-400">Control how AI respects your brand guidelines</p>
          </div>
        </div>

        <div className="space-y-3">
          <Checkbox
            label="Enforce brand voice in AI outputs"
            description="AI will match tone, formality, and style defined in Brand Voice settings"
            checked={aiEnforceVoice}
            onChange={(v) => handleCheckboxChange(setAiEnforceVoice, v)}
            disabled={!isEditable}
          />
          <Checkbox
            label="Enforce approved terminology only"
            description="AI will only use vocabulary and phrases from your approved list"
            checked={aiEnforceTerminology}
            onChange={(v) => handleCheckboxChange(setAiEnforceTerminology, v)}
            disabled={!isEditable}
          />
          <Checkbox
            label="Automatically avoid restricted content"
            description="AI will filter out forbidden topics, claims, and phrases"
            checked={aiAvoidRestricted}
            onChange={(v) => handleCheckboxChange(setAiAvoidRestricted, v)}
            disabled={!isEditable}
          />
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-red-500/20 rounded-lg">
            <Ban className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Forbidden Content</h2>
            <p className="text-sm text-slate-400">Topics, claims, and phrases AI should never use</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Forbidden Topics</label>
            <div className="space-y-2 mb-3">
              {aiForbiddenTopics.map((topic, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <span className="text-sm text-red-300 flex-1">{topic}</span>
                  {isEditable && (
                    <button onClick={() => handleRemoveTopic(idx)} className="text-red-400 hover:text-red-300">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {isEditable && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTopic()}
                  placeholder="Add topic..."
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  onClick={handleAddTopic}
                  className="px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Forbidden Claims</label>
            <div className="space-y-2 mb-3">
              {aiForbiddenClaims.map((claim, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <span className="text-sm text-red-300 flex-1">{claim}</span>
                  {isEditable && (
                    <button onClick={() => handleRemoveClaim(idx)} className="text-red-400 hover:text-red-300">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {isEditable && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newClaim}
                  onChange={(e) => setNewClaim(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddClaim()}
                  placeholder="Add claim..."
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  onClick={handleAddClaim}
                  className="px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Forbidden Phrases</label>
            <div className="space-y-2 mb-3">
              {aiForbiddenPhrases.map((phrase, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <span className="text-sm text-red-300 flex-1">{phrase}</span>
                  {isEditable && (
                    <button onClick={() => handleRemovePhrase(idx)} className="text-red-400 hover:text-red-300">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {isEditable && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPhrase}
                  onChange={(e) => setNewPhrase(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPhrase()}
                  placeholder="Add phrase..."
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  onClick={handleAddPhrase}
                  className="px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">AI Fallback Behavior</h2>
            <p className="text-sm text-slate-400">What should AI do when it can't follow brand rules?</p>
          </div>
        </div>

        <div className="space-y-3">
          <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${aiFallbackBehavior === 'ask_human' ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-slate-900/50 border-slate-700'} ${!isEditable ? 'opacity-60 cursor-not-allowed' : 'hover:border-slate-600'}`}>
            <input
              type="radio"
              name="fallback"
              checked={aiFallbackBehavior === 'ask_human'}
              onChange={() => handleFallbackChange('ask_human')}
              disabled={!isEditable}
              className="mt-1 w-4 h-4 border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-800"
            />
            <div>
              <span className="text-sm font-medium text-white">Ask for human approval</span>
              <p className="text-xs text-slate-400 mt-0.5">Flag content for human review before sending</p>
            </div>
          </label>

          <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${aiFallbackBehavior === 'neutral_copy' ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-slate-900/50 border-slate-700'} ${!isEditable ? 'opacity-60 cursor-not-allowed' : 'hover:border-slate-600'}`}>
            <input
              type="radio"
              name="fallback"
              checked={aiFallbackBehavior === 'neutral_copy'}
              onChange={() => handleFallbackChange('neutral_copy')}
              disabled={!isEditable}
              className="mt-1 w-4 h-4 border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-800"
            />
            <div>
              <span className="text-sm font-medium text-white">Generate neutral copy</span>
              <p className="text-xs text-slate-400 mt-0.5">Fall back to generic, brand-safe content</p>
            </div>
          </label>

          <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${aiFallbackBehavior === 'skip' ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-slate-900/50 border-slate-700'} ${!isEditable ? 'opacity-60 cursor-not-allowed' : 'hover:border-slate-600'}`}>
            <input
              type="radio"
              name="fallback"
              checked={aiFallbackBehavior === 'skip'}
              onChange={() => handleFallbackChange('skip')}
              disabled={!isEditable}
              className="mt-1 w-4 h-4 border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-800"
            />
            <div>
              <span className="text-sm font-medium text-white">Skip generation entirely</span>
              <p className="text-xs text-slate-400 mt-0.5">Don't generate any content if rules can't be followed</p>
            </div>
          </label>
        </div>
      </div>

      {hasChanges && isEditable && (
        <div className="flex justify-end sticky bottom-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-600 text-white text-sm font-medium rounded-lg hover:from-cyan-600 hover:to-teal-700 transition-all disabled:opacity-50 shadow-lg shadow-cyan-500/20"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save AI Rules'}
          </button>
        </div>
      )}
    </div>
  );
}
