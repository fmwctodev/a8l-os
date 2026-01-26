import { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Scissors,
  RefreshCw,
  Flame,
  Megaphone,
  Hash,
  Globe,
  Loader2,
  Check,
  Undo2,
  Wand2,
  Repeat2,
  Palette,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  generateQuickSuggestion,
  generateNewContent,
  repurposeContent,
  getActiveBrandboardForAI,
  getOrganizationLocation,
} from '../../services/socialAI';
import { shouldShowLocalizeOption, getOrganizationLocationString } from '../../utils/socialAIHelpers';
import type {
  SocialProvider,
  SocialAIActionType,
  AIToneOption,
  AIContentLength,
  AIGenerateObjective,
  AIRepurposeAction,
  AISuggestionResult,
  AIGenerateNewResult,
  AIRepurposeResult,
  ActiveBrandboardForAI,
  Organization,
  AI_OBJECTIVE_LABELS,
  AI_TONE_LABELS,
  AI_LENGTH_LABELS,
  AI_REPURPOSE_ACTION_LABELS,
} from '../../types';

type TabId = 'suggestions' | 'generate' | 'repurpose' | 'brand_voice';

interface AIContentAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  onApply: (newContent: string) => void;
  platforms: SocialProvider[];
  activePlatform?: SocialProvider | 'all';
  postId?: string;
  onContentHistoryPush?: (content: string) => void;
}

const QUICK_ACTIONS: Array<{
  id: SocialAIActionType;
  label: string;
  description: string;
  icon: typeof Sparkles;
}> = [
  { id: 'improve_engagement', label: 'Improve engagement', description: 'Add hooks and questions', icon: Sparkles },
  { id: 'shorten', label: 'Shorten', description: 'Make it more concise', icon: Scissors },
  { id: 'rewrite_tone', label: 'Rewrite tone', description: 'Change the voice', icon: RefreshCw },
  { id: 'make_promotional', label: 'Make promotional', description: 'Drive action', icon: Flame },
  { id: 'add_cta', label: 'Add CTA', description: 'Strong call-to-action', icon: Megaphone },
  { id: 'optimize_hashtags', label: 'Optimize hashtags', description: 'Better reach', icon: Hash },
];

const OBJECTIVE_OPTIONS: { value: AIGenerateObjective; label: string }[] = [
  { value: 'promote_offer', label: 'Promote an Offer' },
  { value: 'announce_update', label: 'Announce an Update' },
  { value: 'educational', label: 'Educational Content' },
  { value: 'engagement', label: 'Drive Engagement' },
  { value: 'testimonial', label: 'Share a Testimonial' },
];

const TONE_OPTIONS: { value: AIToneOption; label: string }[] = [
  { value: 'brandboard_default', label: 'Brandboard Default' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'bold', label: 'Bold' },
];

const LENGTH_OPTIONS: { value: AIContentLength; label: string; estimate: string }[] = [
  { value: 'short', label: 'Short', estimate: '< 100 chars' },
  { value: 'medium', label: 'Medium', estimate: '100-250 chars' },
  { value: 'long', label: 'Long', estimate: '250+ chars' },
];

const REPURPOSE_ACTIONS: { value: AIRepurposeAction; label: string; description: string }[] = [
  { value: 'shorten_post', label: 'Shorten to Brief Post', description: 'Condense into a quick update' },
  { value: 'carousel_captions', label: 'Create Carousel Captions', description: 'Split into slide captions' },
  { value: 'proposal_highlights', label: 'Extract Highlights', description: 'Pull out key points' },
];

export function AIContentAssistant({
  isOpen,
  onClose,
  content,
  onApply,
  platforms,
  activePlatform = 'all',
  postId,
  onContentHistoryPush,
}: AIContentAssistantProps) {
  const { user } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<TabId>('suggestions');
  const [isLoading, setIsLoading] = useState(false);
  const [currentAction, setCurrentAction] = useState<SocialAIActionType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [suggestionResult, setSuggestionResult] = useState<AISuggestionResult | null>(null);
  const [generateResult, setGenerateResult] = useState<AIGenerateNewResult | null>(null);
  const [repurposeResult, setRepurposeResult] = useState<AIRepurposeResult | null>(null);

  const [brandboard, setBrandboard] = useState<ActiveBrandboardForAI | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [toneOverride, setToneOverride] = useState<AIToneOption>('brandboard_default');

  const [generateObjective, setGenerateObjective] = useState<AIGenerateObjective>('engagement');
  const [generateTone, setGenerateTone] = useState<AIToneOption>('brandboard_default');
  const [generateLength, setGenerateLength] = useState<AIContentLength>('medium');
  const [customPrompt, setCustomPrompt] = useState('');

  const [repurposeAction, setRepurposeAction] = useState<AIRepurposeAction>('shorten_post');
  const [selectedVariation, setSelectedVariation] = useState(0);

  useEffect(() => {
    if (isOpen && user?.organization_id) {
      loadBrandboardAndLocation();
    }
  }, [isOpen, user?.organization_id]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  async function loadBrandboardAndLocation() {
    if (!user?.organization_id) return;
    try {
      const [brandboardData, locationData] = await Promise.all([
        getActiveBrandboardForAI(user.organization_id),
        getOrganizationLocation(user.organization_id),
      ]);
      setBrandboard(brandboardData);
      if (locationData) {
        setOrganization({
          id: user.organization_id,
          name: '',
          created_at: '',
          business_city: locationData.city,
          business_state: locationData.state,
          business_country: locationData.country,
        });
      }
    } catch (err) {
      console.error('Failed to load brandboard:', err);
    }
  }

  async function handleQuickAction(actionType: SocialAIActionType) {
    if (!content.trim()) {
      setError('Please enter some content first');
      return;
    }

    setIsLoading(true);
    setCurrentAction(actionType);
    setError(null);
    setSuggestionResult(null);

    try {
      const platform = activePlatform === 'all' ? (platforms[0] || 'facebook') : activePlatform;
      const locationContext = actionType === 'localize'
        ? getOrganizationLocationString(organization)
        : undefined;

      const result = await generateQuickSuggestion({
        content,
        action_type: actionType,
        platform,
        post_id: postId,
        brand_voice_id: brandboard?.brand_voice?.id,
        location_context: locationContext,
        tone_override: toneOverride !== 'brandboard_default' ? toneOverride : undefined,
      });

      setSuggestionResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate suggestion');
    } finally {
      setIsLoading(false);
      setCurrentAction(null);
    }
  }

  async function handleGenerateNew() {
    setIsLoading(true);
    setError(null);
    setGenerateResult(null);

    try {
      const result = await generateNewContent({
        objective: generateObjective,
        tone: generateTone,
        length: generateLength,
        platforms: platforms.length > 0 ? platforms : ['facebook'],
        custom_prompt: customPrompt || undefined,
        brand_voice_id: brandboard?.brand_voice?.id,
        post_id: postId,
      });

      setGenerateResult(result);
      setSelectedVariation(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate content');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRepurpose() {
    if (!content.trim()) {
      setError('Please enter some content to repurpose');
      return;
    }

    setIsLoading(true);
    setError(null);
    setRepurposeResult(null);

    try {
      const platform = activePlatform === 'all' ? (platforms[0] || 'facebook') : activePlatform;

      const result = await repurposeContent({
        source_type: 'current_content',
        source_content: content,
        action: repurposeAction,
        target_platform: platform,
        brand_voice_id: brandboard?.brand_voice?.id,
        post_id: postId,
      });

      setRepurposeResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to repurpose content');
    } finally {
      setIsLoading(false);
    }
  }

  function handleApplySuggestion() {
    if (suggestionResult) {
      onContentHistoryPush?.(content);
      onApply(suggestionResult.suggested);
      setSuggestionResult(null);
      onClose();
    }
  }

  function handleApplyGenerated() {
    if (generateResult && generateResult.variations[selectedVariation]) {
      onContentHistoryPush?.(content);
      onApply(generateResult.variations[selectedVariation].content);
      setGenerateResult(null);
      onClose();
    }
  }

  function handleApplyRepurposed() {
    if (repurposeResult) {
      onContentHistoryPush?.(content);
      onApply(repurposeResult.content);
      setRepurposeResult(null);
      onClose();
    }
  }

  if (!isOpen) return null;

  const showLocalizeAction = shouldShowLocalizeOption(organization);

  return (
    <div
      ref={panelRef}
      className="absolute top-full left-0 mt-2 w-[420px] bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-teal-50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-r from-blue-500 to-teal-500 rounded-lg">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-medium text-gray-900">AI Content Assistant</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="flex border-b border-gray-100">
        {[
          { id: 'suggestions' as TabId, label: 'Suggestions', icon: Sparkles },
          { id: 'generate' as TabId, label: 'Generate', icon: Wand2 },
          { id: 'repurpose' as TabId, label: 'Repurpose', icon: Repeat2 },
          { id: 'brand_voice' as TabId, label: 'Brand Voice', icon: Palette },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setError(null);
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {error && (
          <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {activeTab === 'suggestions' && (
          <SuggestionsTab
            onAction={handleQuickAction}
            isLoading={isLoading}
            currentAction={currentAction}
            result={suggestionResult}
            onApply={handleApplySuggestion}
            onDismiss={() => setSuggestionResult(null)}
            showLocalize={showLocalizeAction}
            toneOverride={toneOverride}
            onToneChange={setToneOverride}
          />
        )}

        {activeTab === 'generate' && (
          <GenerateTab
            objective={generateObjective}
            onObjectiveChange={setGenerateObjective}
            tone={generateTone}
            onToneChange={setGenerateTone}
            length={generateLength}
            onLengthChange={setGenerateLength}
            customPrompt={customPrompt}
            onCustomPromptChange={setCustomPrompt}
            onGenerate={handleGenerateNew}
            isLoading={isLoading}
            result={generateResult}
            selectedVariation={selectedVariation}
            onSelectVariation={setSelectedVariation}
            onApply={handleApplyGenerated}
            brandboardName={brandboard?.brand_voice?.name}
          />
        )}

        {activeTab === 'repurpose' && (
          <RepurposeTab
            action={repurposeAction}
            onActionChange={setRepurposeAction}
            onRepurpose={handleRepurpose}
            isLoading={isLoading}
            result={repurposeResult}
            onApply={handleApplyRepurposed}
            hasContent={!!content.trim()}
          />
        )}

        {activeTab === 'brand_voice' && (
          <BrandVoiceTab brandboard={brandboard} />
        )}
      </div>
    </div>
  );
}

function SuggestionsTab({
  onAction,
  isLoading,
  currentAction,
  result,
  onApply,
  onDismiss,
  showLocalize,
  toneOverride,
  onToneChange,
}: {
  onAction: (action: SocialAIActionType) => void;
  isLoading: boolean;
  currentAction: SocialAIActionType | null;
  result: AISuggestionResult | null;
  onApply: () => void;
  onDismiss: () => void;
  showLocalize: boolean;
  toneOverride: AIToneOption;
  onToneChange: (tone: AIToneOption) => void;
}) {
  const actions = showLocalize
    ? [...QUICK_ACTIONS, { id: 'localize' as SocialAIActionType, label: 'Localize', description: 'Adapt for local audience', icon: Globe }]
    : QUICK_ACTIONS;

  if (result) {
    return (
      <div className="p-4 space-y-4">
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Original</div>
          <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600 line-clamp-3">
            {result.original}
          </div>
          <div className="text-xs text-gray-400 mt-1">{result.character_count_original} characters</div>
        </div>

        <div>
          <div className="text-xs font-medium text-green-600 uppercase tracking-wide mb-2">Suggested</div>
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-gray-800">
            {result.suggested}
          </div>
          <div className="text-xs text-gray-400 mt-1">{result.character_count_suggested} characters</div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={onApply}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Check className="w-4 h-4" />
            Apply
          </button>
          <button
            onClick={onDismiss}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Quick Actions</span>
        <div className="relative">
          <select
            value={toneOverride}
            onChange={(e) => onToneChange(e.target.value as AIToneOption)}
            className="text-xs px-2 py-1 pr-6 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none"
          >
            {TONE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => {
          const isActive = isLoading && currentAction === action.id;
          return (
            <button
              key={action.id}
              onClick={() => onAction(action.id)}
              disabled={isLoading}
              className={`flex items-start gap-2.5 p-3 rounded-lg border transition-all text-left ${
                isActive
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-200 hover:bg-blue-50/50'
              } disabled:opacity-60`}
            >
              <div className={`p-1.5 rounded-md ${isActive ? 'bg-blue-100' : 'bg-gray-100'}`}>
                {isActive ? (
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                ) : (
                  <action.icon className="w-4 h-4 text-gray-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">{action.label}</div>
                <div className="text-xs text-gray-500 truncate">{action.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GenerateTab({
  objective,
  onObjectiveChange,
  tone,
  onToneChange,
  length,
  onLengthChange,
  customPrompt,
  onCustomPromptChange,
  onGenerate,
  isLoading,
  result,
  selectedVariation,
  onSelectVariation,
  onApply,
  brandboardName,
}: {
  objective: AIGenerateObjective;
  onObjectiveChange: (v: AIGenerateObjective) => void;
  tone: AIToneOption;
  onToneChange: (v: AIToneOption) => void;
  length: AIContentLength;
  onLengthChange: (v: AIContentLength) => void;
  customPrompt: string;
  onCustomPromptChange: (v: string) => void;
  onGenerate: () => void;
  isLoading: boolean;
  result: AIGenerateNewResult | null;
  selectedVariation: number;
  onSelectVariation: (i: number) => void;
  onApply: () => void;
  brandboardName?: string;
}) {
  if (result) {
    return (
      <div className="p-4 space-y-4">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Select a Variation
        </div>
        <div className="space-y-2">
          {result.variations.map((variation, idx) => (
            <button
              key={idx}
              onClick={() => onSelectVariation(idx)}
              className={`w-full p-3 rounded-lg border text-left transition-all ${
                selectedVariation === idx
                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="text-sm text-gray-800">{variation.content}</p>
              <p className="text-xs text-gray-400 mt-1">{variation.character_count} characters</p>
            </button>
          ))}
        </div>
        <button
          onClick={onApply}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Check className="w-4 h-4" />
          Use Selected
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Objective</label>
        <select
          value={objective}
          onChange={(e) => onObjectiveChange(e.target.value as AIGenerateObjective)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {OBJECTIVE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Tone</label>
          <select
            value={tone}
            onChange={(e) => onToneChange(e.target.value as AIToneOption)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TONE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.value === 'brandboard_default' && brandboardName
                  ? `${opt.label} (${brandboardName})`
                  : opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Length</label>
          <select
            value={length}
            onChange={(e) => onLengthChange(e.target.value as AIContentLength)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {LENGTH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label} ({opt.estimate})</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">
          Custom Prompt <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          value={customPrompt}
          onChange={(e) => onCustomPromptChange(e.target.value)}
          placeholder="E.g., Write about our new summer sale..."
          className="w-full h-20 px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        onClick={onGenerate}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-teal-600 text-white rounded-lg hover:from-blue-700 hover:to-teal-700 transition-all text-sm font-medium disabled:opacity-60"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Wand2 className="w-4 h-4" />
            Generate Content
          </>
        )}
      </button>
    </div>
  );
}

function RepurposeTab({
  action,
  onActionChange,
  onRepurpose,
  isLoading,
  result,
  onApply,
  hasContent,
}: {
  action: AIRepurposeAction;
  onActionChange: (v: AIRepurposeAction) => void;
  onRepurpose: () => void;
  isLoading: boolean;
  result: AIRepurposeResult | null;
  onApply: () => void;
  hasContent: boolean;
}) {
  if (result) {
    return (
      <div className="p-4 space-y-4">
        {result.slides && result.slides.length > 1 ? (
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Carousel Slides ({result.slides.length})
            </div>
            <div className="space-y-2">
              {result.slides.map((slide, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs font-medium text-gray-400 mb-1">Slide {idx + 1}</div>
                  <p className="text-sm text-gray-800">{slide}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="text-xs font-medium text-green-600 uppercase tracking-wide mb-2">Result</div>
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-gray-800">
              {result.content}
            </div>
            <div className="text-xs text-gray-400 mt-1">{result.character_count} characters</div>
          </div>
        )}
        <button
          onClick={onApply}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Check className="w-4 h-4" />
          Apply
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {!hasContent && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Enter content in the composer to repurpose
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">Repurpose Action</label>
        <div className="space-y-2">
          {REPURPOSE_ACTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onActionChange(opt.value)}
              className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                action === opt.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                action === opt.value ? 'border-blue-500' : 'border-gray-300'
              }`}>
                {action === opt.value && <div className="w-2 h-2 rounded-full bg-blue-500" />}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">{opt.label}</div>
                <div className="text-xs text-gray-500">{opt.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onRepurpose}
        disabled={isLoading || !hasContent}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-teal-600 text-white rounded-lg hover:from-blue-700 hover:to-teal-700 transition-all text-sm font-medium disabled:opacity-60"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Repeat2 className="w-4 h-4" />
            Repurpose Content
          </>
        )}
      </button>
    </div>
  );
}

function BrandVoiceTab({ brandboard }: { brandboard: ActiveBrandboardForAI | null }) {
  const voice = brandboard?.brand_voice;

  if (!voice) {
    return (
      <div className="p-6 text-center">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <Palette className="w-6 h-6 text-gray-400" />
        </div>
        <h3 className="font-medium text-gray-900 mb-1">No Brand Voice Active</h3>
        <p className="text-sm text-gray-500">
          Set up a brand voice in Settings &gt; Brandboard to ensure AI-generated content matches your brand.
        </p>
      </div>
    );
  }

  const { tone_settings, dos, donts, vocabulary_preferred, vocabulary_prohibited } = voice;

  const getToneLabel = (value: number) => {
    if (value < 35) return 'Low';
    if (value < 70) return 'Medium';
    return 'High';
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
        <Palette className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-medium text-blue-900">{voice.name}</span>
        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded">v{voice.version}</span>
      </div>

      <div>
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Tone Settings</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Formality', value: tone_settings.formality },
            { label: 'Friendliness', value: tone_settings.friendliness },
            { label: 'Energy', value: tone_settings.energy },
            { label: 'Confidence', value: tone_settings.confidence },
          ].map((item) => (
            <div key={item.label} className="bg-gray-50 rounded-lg p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600">{item.label}</span>
                <span className="text-xs font-medium text-gray-900">{getToneLabel(item.value)}</span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-teal-500 rounded-full transition-all"
                  style={{ width: `${item.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {dos.length > 0 && (
        <div>
          <div className="text-xs font-medium text-green-600 uppercase tracking-wide mb-2">Do</div>
          <ul className="space-y-1">
            {dos.slice(0, 4).map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {donts.length > 0 && (
        <div>
          <div className="text-xs font-medium text-red-600 uppercase tracking-wide mb-2">Don't</div>
          <ul className="space-y-1">
            {donts.slice(0, 4).map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {vocabulary_preferred.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Preferred Terms</div>
          <div className="flex flex-wrap gap-1">
            {vocabulary_preferred.slice(0, 8).map((term, idx) => (
              <span key={idx} className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">
                {term}
              </span>
            ))}
          </div>
        </div>
      )}

      {vocabulary_prohibited.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Avoid Terms</div>
          <div className="flex flex-wrap gap-1">
            {vocabulary_prohibited.slice(0, 8).map((term, idx) => (
              <span key={idx} className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs line-through">
                {term}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
