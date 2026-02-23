import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BookOpen,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  X,
  Plus,
  Check,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import {
  getGuidelines,
  upsertGuidelines,
} from '../../../services/socialGuidelines';
import { getActiveBrandboardForAI } from '../../../services/socialAI';
import type {
  SocialGuideline,
  TonePreferences,
  EmojiFrequency,
  PlatformTweak,
} from '../../../types';

type Scope = 'personal' | 'workspace';

const PLATFORMS = ['linkedin', 'facebook', 'instagram', 'google_business'] as const;
const PLATFORM_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  instagram: 'Instagram',
  google_business: 'Google Business',
};

const EMOJI_OPTIONS: { value: EmojiFrequency; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'heavy', label: 'Heavy' },
];

const DEFAULT_TONE: TonePreferences = { formality: 50, friendliness: 50, energy: 50, confidence: 50 };

export function SocialGuidelines() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [scope, setScope] = useState<Scope>('personal');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [tone, setTone] = useState<TonePreferences>(DEFAULT_TONE);
  const [wordsToAvoid, setWordsToAvoid] = useState<string[]>([]);
  const [wordInput, setWordInput] = useState('');
  const [preferredHashtags, setPreferredHashtags] = useState<string[]>([]);
  const [bannedHashtags, setBannedHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const [bannedHashtagInput, setBannedHashtagInput] = useState('');
  const [ctaRules, setCtaRules] = useState<string[]>([]);
  const [ctaInput, setCtaInput] = useState('');
  const [emojiFrequency, setEmojiFrequency] = useState<EmojiFrequency>('minimal');
  const [industryPositioning, setIndustryPositioning] = useState('');
  const [visualStyles, setVisualStyles] = useState<string[]>([]);
  const [visualInput, setVisualInput] = useState('');
  const [platformTweaks, setPlatformTweaks] = useState<Record<string, PlatformTweak>>({});
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['tone']));

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userId = scope === 'personal' ? (user?.id || null) : null;

  useEffect(() => {
    loadGuidelines();
  }, [user?.organization_id, scope]);

  async function loadGuidelines() {
    if (!user?.organization_id) return;
    try {
      setLoading(true);
      const data = await getGuidelines(user.organization_id, userId);
      if (data) {
        setTone(data.tone_preferences || DEFAULT_TONE);
        setWordsToAvoid(data.words_to_avoid || []);
        const hp = data.hashtag_preferences || { preferred: [], banned: [] };
        setPreferredHashtags(hp.preferred || []);
        setBannedHashtags(hp.banned || []);
        setCtaRules(data.cta_rules || []);
        const er = data.emoji_rules || { frequency: 'minimal', banned: [] };
        setEmojiFrequency(er.frequency || 'minimal');
        setIndustryPositioning(data.industry_positioning || '');
        setVisualStyles(Array.isArray(data.visual_style_rules) ? data.visual_style_rules : []);
        setPlatformTweaks(data.platform_tweaks || {});
      } else {
        setTone(DEFAULT_TONE);
        setWordsToAvoid([]);
        setPreferredHashtags([]);
        setBannedHashtags([]);
        setCtaRules([]);
        setEmojiFrequency('minimal');
        setIndustryPositioning('');
        setVisualStyles([]);
        setPlatformTweaks({});
      }
    } catch (error) {
      console.error('Failed to load guidelines:', error);
    } finally {
      setLoading(false);
    }
  }

  const debouncedSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveGuidelines(), 800);
  }, [tone, wordsToAvoid, preferredHashtags, bannedHashtags, ctaRules, emojiFrequency, industryPositioning, visualStyles, platformTweaks, user?.organization_id, userId]);

  async function saveGuidelines() {
    if (!user?.organization_id) return;
    try {
      setSaving(true);
      await upsertGuidelines(user.organization_id, userId, {
        tone_preferences: tone,
        words_to_avoid: wordsToAvoid,
        hashtag_preferences: { preferred: preferredHashtags, banned: bannedHashtags },
        cta_rules: ctaRules,
        emoji_rules: { frequency: emojiFrequency, banned: [] },
        industry_positioning: industryPositioning,
        visual_style_rules: visualStyles,
        platform_tweaks: platformTweaks,
      });
      addToast('Guidelines saved', 'success');
    } catch (error) {
      console.error('Failed to save guidelines:', error);
      addToast('Failed to save guidelines', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleSyncFromBrandboard() {
    if (!user?.organization_id) return;
    try {
      setSyncing(true);
      const brand = await getActiveBrandboardForAI(user.organization_id);
      if (brand.brand_voice) {
        const bv = brand.brand_voice;
        setTone(bv.tone_settings || DEFAULT_TONE);
        setWordsToAvoid(prev => [...new Set([...prev, ...bv.vocabulary_prohibited])]);
        setCtaRules(prev => [...new Set([...prev, ...bv.dos])]);
        addToast('Synced from Brandboard', 'success');
        debouncedSave();
      } else {
        addToast('No active brand voice found', 'info');
      }
    } catch (error) {
      console.error('Sync failed:', error);
      addToast('Failed to sync from Brandboard', 'error');
    } finally {
      setSyncing(false);
    }
  }

  function toggleSection(key: string) {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function handleToneChange(key: keyof TonePreferences, value: number) {
    setTone(prev => ({ ...prev, [key]: value }));
    debouncedSave();
  }

  function addTag(
    list: string[],
    setList: (v: string[]) => void,
    input: string,
    setInput: (v: string) => void
  ) {
    const trimmed = input.trim();
    if (!trimmed || list.includes(trimmed)) return;
    setList([...list, trimmed]);
    setInput('');
    debouncedSave();
  }

  function removeTag(list: string[], setList: (v: string[]) => void, index: number) {
    setList(list.filter((_, i) => i !== index));
    debouncedSave();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-800 border border-slate-700 rounded-lg p-1">
            <button
              onClick={() => setScope('personal')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                scope === 'personal' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              My Preferences
            </button>
            <button
              onClick={() => setScope('workspace')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                scope === 'workspace' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Workspace Defaults
            </button>
          </div>
          {saving && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Saving...
            </span>
          )}
        </div>
        <button
          onClick={handleSyncFromBrandboard}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sync from Brandboard
        </button>
      </div>

      <div className="space-y-3">
        <CollapsibleSection
          title="Tone Preferences"
          expanded={expandedSections.has('tone')}
          onToggle={() => toggleSection('tone')}
        >
          <div className="space-y-4">
            {(['formality', 'friendliness', 'energy', 'confidence'] as const).map((key) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-300 capitalize">{key}</label>
                  <span className="text-sm text-slate-500">{tone[key]}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={tone[key]}
                  onChange={(e) => handleToneChange(key, parseInt(e.target.value))}
                  className="w-full accent-cyan-500"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{key === 'formality' ? 'Casual' : key === 'friendliness' ? 'Reserved' : key === 'energy' ? 'Calm' : 'Humble'}</span>
                  <span>{key === 'formality' ? 'Formal' : key === 'friendliness' ? 'Warm' : key === 'energy' ? 'Energetic' : 'Confident'}</span>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Words to Avoid"
          expanded={expandedSections.has('words')}
          onToggle={() => toggleSection('words')}
        >
          <TagInput
            tags={wordsToAvoid}
            input={wordInput}
            onInputChange={setWordInput}
            onAdd={() => addTag(wordsToAvoid, setWordsToAvoid, wordInput, setWordInput)}
            onRemove={(i) => removeTag(wordsToAvoid, setWordsToAvoid, i)}
            placeholder="Type a word and press Enter..."
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Hashtag Preferences"
          expanded={expandedSections.has('hashtags')}
          onToggle={() => toggleSection('hashtags')}
        >
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-400 mb-2 block">Preferred Hashtags</label>
              <TagInput
                tags={preferredHashtags}
                input={hashtagInput}
                onInputChange={setHashtagInput}
                onAdd={() => addTag(preferredHashtags, setPreferredHashtags, hashtagInput, setHashtagInput)}
                onRemove={(i) => removeTag(preferredHashtags, setPreferredHashtags, i)}
                placeholder="#hashtag"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-400 mb-2 block">Banned Hashtags</label>
              <TagInput
                tags={bannedHashtags}
                input={bannedHashtagInput}
                onInputChange={setBannedHashtagInput}
                onAdd={() => addTag(bannedHashtags, setBannedHashtags, bannedHashtagInput, setBannedHashtagInput)}
                onRemove={(i) => removeTag(bannedHashtags, setBannedHashtags, i)}
                placeholder="#banned"
              />
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="CTA Rules"
          expanded={expandedSections.has('cta')}
          onToggle={() => toggleSection('cta')}
        >
          <TagInput
            tags={ctaRules}
            input={ctaInput}
            onInputChange={setCtaInput}
            onAdd={() => addTag(ctaRules, setCtaRules, ctaInput, setCtaInput)}
            onRemove={(i) => removeTag(ctaRules, setCtaRules, i)}
            placeholder='e.g. "Always end LinkedIn posts with a question"'
            fullWidth
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Emoji Rules"
          expanded={expandedSections.has('emoji')}
          onToggle={() => toggleSection('emoji')}
        >
          <div>
            <label className="text-sm font-medium text-slate-400 mb-2 block">Frequency</label>
            <div className="flex gap-2">
              {EMOJI_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setEmojiFrequency(opt.value); debouncedSave(); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    emojiFrequency === opt.value
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Industry Positioning"
          expanded={expandedSections.has('industry')}
          onToggle={() => toggleSection('industry')}
        >
          <textarea
            value={industryPositioning}
            onChange={(e) => { setIndustryPositioning(e.target.value); debouncedSave(); }}
            rows={4}
            placeholder="Describe your brand's industry stance, differentiators, and positioning..."
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none text-sm"
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Visual Style Rules"
          expanded={expandedSections.has('visual')}
          onToggle={() => toggleSection('visual')}
        >
          <TagInput
            tags={visualStyles}
            input={visualInput}
            onInputChange={setVisualInput}
            onAdd={() => addTag(visualStyles, setVisualStyles, visualInput, setVisualInput)}
            onRemove={(i) => removeTag(visualStyles, setVisualStyles, i)}
            placeholder='e.g. "minimalist", "dark mode", "corporate blue"'
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Platform-Specific Tweaks"
          expanded={expandedSections.has('platform')}
          onToggle={() => toggleSection('platform')}
        >
          <div className="space-y-4">
            {PLATFORMS.map((platform) => {
              const tweak = platformTweaks[platform] || {};
              return (
                <div key={platform} className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">{PLATFORM_LABELS[platform]}</label>
                  <textarea
                    value={tweak.additional_rules || ''}
                    onChange={(e) => {
                      setPlatformTweaks(prev => ({
                        ...prev,
                        [platform]: { ...prev[platform], additional_rules: e.target.value },
                      }));
                      debouncedSave();
                    }}
                    rows={2}
                    placeholder={`Custom rules for ${PLATFORM_LABELS[platform]}...`}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none text-sm"
                  />
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={saveGuidelines}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm font-medium disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save Guidelines
        </button>
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-750 transition-colors"
      >
        <span className="text-sm font-semibold text-white">{title}</span>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
      </button>
      {expanded && (
        <div className="px-5 pb-5 pt-0">
          {children}
        </div>
      )}
    </div>
  );
}

function TagInput({
  tags,
  input,
  onInputChange,
  onAdd,
  onRemove,
  placeholder,
  fullWidth,
}: {
  tags: string[];
  input: string;
  onInputChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  placeholder: string;
  fullWidth?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAdd(); } }}
          placeholder={placeholder}
          className={`bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm ${fullWidth ? 'flex-1' : 'w-64'}`}
        />
        <button
          onClick={onAdd}
          className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-400 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-sm"
            >
              {tag}
              <button
                onClick={() => onRemove(i)}
                className="text-slate-500 hover:text-red-400 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
