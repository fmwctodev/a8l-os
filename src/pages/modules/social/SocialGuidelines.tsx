import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  X,
  Plus,
  Check,
  Settings2,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import {
  getGuidelines,
  upsertGuidelines,
} from '../../../services/socialGuidelines';
import { getActiveBrandboardForAI } from '../../../services/socialAI';
import { GuidelineBlockEditor } from '../../../components/social-guidelines';
import type {
  TonePreferences,
  EmojiFrequency,
  PlatformTweak,
  GuidelineBlock,
} from '../../../types';

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
  const { user, isSuperAdmin } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const canEdit = isSuperAdmin;

  const [contentThemes, setContentThemes] = useState<GuidelineBlock[]>([]);
  const [imageStyle, setImageStyle] = useState<GuidelineBlock[]>([]);
  const [writingStyle, setWritingStyle] = useState<GuidelineBlock[]>([]);

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

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['tone']));

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadGuidelines();
  }, [user?.organization_id]);

  async function loadGuidelines() {
    if (!user?.organization_id) return;
    try {
      setLoading(true);
      const data = await getGuidelines(user.organization_id);
      if (data) {
        setContentThemes(Array.isArray(data.content_themes) ? data.content_themes : []);
        setImageStyle(Array.isArray(data.image_style) ? data.image_style : []);
        setWritingStyle(Array.isArray(data.writing_style) ? data.writing_style : []);
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
        setContentThemes([]);
        setImageStyle([]);
        setWritingStyle([]);
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
    if (!canEdit) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveGuidelines(), 800);
  }, [contentThemes, imageStyle, writingStyle, tone, wordsToAvoid, preferredHashtags, bannedHashtags, ctaRules, emojiFrequency, industryPositioning, visualStyles, platformTweaks, user?.organization_id, canEdit]);

  async function saveGuidelines() {
    if (!user?.organization_id || !canEdit) return;
    try {
      setSaving(true);
      await upsertGuidelines(user.organization_id, {
        content_themes: contentThemes,
        image_style: imageStyle,
        writing_style: writingStyle,
        tone_preferences: tone,
        words_to_avoid: wordsToAvoid,
        hashtag_preferences: { preferred: preferredHashtags, banned: bannedHashtags },
        cta_rules: ctaRules,
        emoji_rules: { frequency: emojiFrequency, banned: [] },
        industry_positioning: industryPositioning,
        visual_style_rules: visualStyles,
        platform_tweaks: platformTweaks,
      });
      showToast('success', 'Guidelines saved');
    } catch (error) {
      console.error('Failed to save guidelines:', error);
      showToast('warning', 'Failed to save guidelines');
    } finally {
      setSaving(false);
    }
  }

  async function handleSyncFromBrandboard() {
    if (!user?.organization_id || !canEdit) return;
    try {
      setSyncing(true);
      const brand = await getActiveBrandboardForAI(user.organization_id);
      if (brand.brand_voice) {
        const bv = brand.brand_voice;
        setTone(bv.tone_settings || DEFAULT_TONE);
        setWordsToAvoid(prev => [...new Set([...prev, ...bv.vocabulary_prohibited])]);
        setCtaRules(prev => [...new Set([...prev, ...bv.dos])]);

        if (bv.ai_system_prompt) {
          setWritingStyle(prev => {
            const existing = prev.map(b => b.content);
            if (!existing.includes(bv.ai_system_prompt!)) {
              return [...prev, { content: `<p>${bv.ai_system_prompt}</p>` }];
            }
            return prev;
          });
        }
        if (bv.dos && bv.dos.length > 0) {
          setWritingStyle(prev => {
            const dosHtml = `<p><strong>Brand Voice Guidelines:</strong></p><ul>${bv.dos.map((d: string) => `<li>${d}</li>`).join('')}</ul>`;
            return [...prev, { content: dosHtml }];
          });
        }
        if (bv.donts && bv.donts.length > 0) {
          setWritingStyle(prev => {
            const dontsHtml = `<p><strong>Things to Avoid:</strong></p><ul>${bv.donts.map((d: string) => `<li>${d}</li>`).join('')}</ul>`;
            return [...prev, { content: dontsHtml }];
          });
        }

        showToast('success', 'Synced from Brandboard');
        debouncedSave();
      } else {
        showToast('info', 'No active brand voice found');
      }
    } catch (error) {
      console.error('Sync failed:', error);
      showToast('warning', 'Failed to sync from Brandboard');
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

  function handleBlockChange(
    setter: (v: GuidelineBlock[]) => void
  ) {
    return (blocks: GuidelineBlock[]) => {
      setter(blocks);
      debouncedSave();
    };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white tracking-tight">Guidelines</h1>
        <p className="text-sm text-slate-400">
          Organization-wide instructions for the AI social manager
        </p>
      </div>

      {!canEdit && (
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-lg">
          <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <p className="text-sm text-slate-400">
            Only the System Administrator can edit guidelines. You are viewing in read-only mode.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {saving && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Saving...
            </span>
          )}
        </div>
        {canEdit && (
          <button
            onClick={handleSyncFromBrandboard}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync from Brandboard
          </button>
        )}
      </div>

      <div className="space-y-5">
        <GuidelineBlockEditor
          title="Content Themes"
          blocks={contentThemes}
          onChange={handleBlockChange(setContentThemes)}
          readOnly={!canEdit}
        />

        <GuidelineBlockEditor
          title="Image Style"
          blocks={imageStyle}
          onChange={handleBlockChange(setImageStyle)}
          readOnly={!canEdit}
        />

        <GuidelineBlockEditor
          title="Writing Style"
          blocks={writingStyle}
          onChange={handleBlockChange(setWritingStyle)}
          readOnly={!canEdit}
        />
      </div>

      <div className="border-t border-slate-700/50 pt-6">
        <button
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-300 transition-colors"
        >
          <Settings2 className="w-4 h-4" />
          Advanced Settings
          {advancedOpen ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>

        {advancedOpen && (
          <div className="mt-4 space-y-3">
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
                      disabled={!canEdit}
                      className="w-full accent-cyan-500 disabled:opacity-60"
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
              {canEdit ? (
                <TagInput
                  tags={wordsToAvoid}
                  input={wordInput}
                  onInputChange={setWordInput}
                  onAdd={() => addTag(wordsToAvoid, setWordsToAvoid, wordInput, setWordInput)}
                  onRemove={(i) => removeTag(wordsToAvoid, setWordsToAvoid, i)}
                  placeholder="Type a word and press Enter..."
                />
              ) : (
                <ReadOnlyTags tags={wordsToAvoid} emptyLabel="No words configured" />
              )}
            </CollapsibleSection>

            <CollapsibleSection
              title="Hashtag Preferences"
              expanded={expandedSections.has('hashtags')}
              onToggle={() => toggleSection('hashtags')}
            >
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-400 mb-2 block">Preferred Hashtags</label>
                  {canEdit ? (
                    <TagInput
                      tags={preferredHashtags}
                      input={hashtagInput}
                      onInputChange={setHashtagInput}
                      onAdd={() => addTag(preferredHashtags, setPreferredHashtags, hashtagInput, setHashtagInput)}
                      onRemove={(i) => removeTag(preferredHashtags, setPreferredHashtags, i)}
                      placeholder="#hashtag"
                    />
                  ) : (
                    <ReadOnlyTags tags={preferredHashtags} emptyLabel="None configured" />
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-400 mb-2 block">Banned Hashtags</label>
                  {canEdit ? (
                    <TagInput
                      tags={bannedHashtags}
                      input={bannedHashtagInput}
                      onInputChange={setBannedHashtagInput}
                      onAdd={() => addTag(bannedHashtags, setBannedHashtags, bannedHashtagInput, setBannedHashtagInput)}
                      onRemove={(i) => removeTag(bannedHashtags, setBannedHashtags, i)}
                      placeholder="#banned"
                    />
                  ) : (
                    <ReadOnlyTags tags={bannedHashtags} emptyLabel="None configured" />
                  )}
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="CTA Rules"
              expanded={expandedSections.has('cta')}
              onToggle={() => toggleSection('cta')}
            >
              {canEdit ? (
                <TagInput
                  tags={ctaRules}
                  input={ctaInput}
                  onInputChange={setCtaInput}
                  onAdd={() => addTag(ctaRules, setCtaRules, ctaInput, setCtaInput)}
                  onRemove={(i) => removeTag(ctaRules, setCtaRules, i)}
                  placeholder='e.g. "Always end LinkedIn posts with a question"'
                  fullWidth
                />
              ) : (
                <ReadOnlyTags tags={ctaRules} emptyLabel="No CTA rules configured" />
              )}
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
                      onClick={() => { if (canEdit) { setEmojiFrequency(opt.value); debouncedSave(); } }}
                      disabled={!canEdit}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        emojiFrequency === opt.value
                          ? 'bg-cyan-600 text-white'
                          : 'bg-slate-700 text-slate-400 hover:text-slate-300'
                      } disabled:cursor-default`}
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
                readOnly={!canEdit}
                placeholder="Describe your brand's industry stance, differentiators, and positioning..."
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none text-sm read-only:opacity-70 read-only:cursor-default"
              />
            </CollapsibleSection>

            <CollapsibleSection
              title="Visual Style Rules"
              expanded={expandedSections.has('visual')}
              onToggle={() => toggleSection('visual')}
            >
              {canEdit ? (
                <TagInput
                  tags={visualStyles}
                  input={visualInput}
                  onInputChange={setVisualInput}
                  onAdd={() => addTag(visualStyles, setVisualStyles, visualInput, setVisualInput)}
                  onRemove={(i) => removeTag(visualStyles, setVisualStyles, i)}
                  placeholder='e.g. "minimalist", "dark mode", "corporate blue"'
                />
              ) : (
                <ReadOnlyTags tags={visualStyles} emptyLabel="No visual styles configured" />
              )}
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
                        readOnly={!canEdit}
                        placeholder={`Custom rules for ${PLATFORM_LABELS[platform]}...`}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none text-sm read-only:opacity-70 read-only:cursor-default"
                      />
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>
          </div>
        )}
      </div>

      {canEdit && (
        <div className="flex justify-end pt-2">
          <button
            onClick={saveGuidelines}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save Guidelines
          </button>
        </div>
      )}
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

function ReadOnlyTags({ tags, emptyLabel }: { tags: string[]; emptyLabel: string }) {
  if (tags.length === 0) {
    return <p className="text-sm text-slate-500 italic">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag, i) => (
        <span
          key={i}
          className="inline-flex items-center px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-sm"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
