import { useState, useEffect } from 'react';
import {
  Image,
  Film,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Settings2,
  Zap,
  Palette,
  Lock,
} from 'lucide-react';
import { getKieModels, getLockedImageModel } from '../../services/mediaGeneration';
import type { KieModel } from '../../services/mediaGeneration';
import { getStylePresets } from '../../services/mediaStylePresets';
import type { MediaStylePreset } from '../../services/mediaStylePresets';
import type { MediaPreferences } from '../../services/socialChat';

interface ChatMediaSettingsProps {
  preferences: MediaPreferences;
  onChange: (prefs: MediaPreferences) => void;
}

const ASPECT_RATIOS = [
  { value: '1:1', label: '1:1', desc: 'Square' },
  { value: '16:9', label: '16:9', desc: 'Landscape' },
  { value: '9:16', label: '9:16', desc: 'Portrait' },
  { value: '4:3', label: '4:3', desc: 'Standard' },
];

export function ChatMediaSettings({ preferences, onChange }: ChatMediaSettingsProps) {
  const [expanded, setExpanded] = useState(false);
  const [lockedImageModel, setLockedImageModel] = useState<KieModel | null>(null);
  const [videoModels, setVideoModels] = useState<KieModel[]>([]);
  const [stylePresets, setStylePresets] = useState<MediaStylePreset[]>([]);
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');

  useEffect(() => {
    loadModels();
    loadPresets();
  }, []);

  useEffect(() => {
    if (videoModels.length > 0 && !preferences.video_model_id) {
      const sorted = [...videoModels].sort(
        (a, b) => (a.display_priority ?? 99) - (b.display_priority ?? 99)
      );
      onChange({ ...preferences, video_model_id: sorted[0].id });
    }
  }, [videoModels]);

  async function loadModels() {
    try {
      const [imgModel, vids] = await Promise.all([
        getLockedImageModel(),
        getKieModels('video'),
      ]);
      setLockedImageModel(imgModel);
      setVideoModels(vids);
    } catch {
    }
  }

  async function loadPresets() {
    try {
      const presets = await getStylePresets();
      setStylePresets(presets);
    } catch {
    }
  }

  const selectedVideoModel = videoModels.find(m => m.id === preferences.video_model_id);
  const selectedPreset = stylePresets.find(p => p.id === preferences.style_preset_id);
  const autoGen = preferences.auto_generate_media !== false;

  const isKling3 = selectedVideoModel?.model_key?.startsWith('kling-3.0') ?? false;

  function selectVideoModel(model: KieModel) {
    const isNewKling = model.model_key?.startsWith('kling-3.0') ?? false;
    onChange({
      ...preferences,
      video_model_id: model.id,
      video_mode: isNewKling ? (preferences.video_mode || 'std') : undefined,
    });
  }

  function selectPreset(presetId: string | undefined) {
    const newPrefs = { ...preferences };
    if (presetId === preferences.style_preset_id) {
      newPrefs.style_preset_id = undefined;
    } else {
      newPrefs.style_preset_id = presetId;
      const preset = stylePresets.find(p => p.id === presetId);
      if (preset?.recommended_aspect_ratio) {
        newPrefs.aspect_ratio = preset.recommended_aspect_ratio;
      }
    }
    onChange(newPrefs);
  }

  return (
    <div className="border-t border-slate-700 bg-slate-800/50 flex-shrink-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs text-slate-400 hover:text-slate-300 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings2 className="w-3.5 h-3.5" />
          <span>Media Generation</span>
          {autoGen && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px]">
              <Zap className="w-2.5 h-2.5" />
              Auto
            </span>
          )}
          {selectedPreset && (
            <span className="px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 rounded text-[10px]">
              {selectedPreset.display_name}
            </span>
          )}
          {lockedImageModel && (
            <span className="px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded text-[10px]">
              {lockedImageModel.display_name}
            </span>
          )}
          {selectedVideoModel && (
            <span className="px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded text-[10px]">
              {selectedVideoModel.display_name}
              {isKling3 && preferences.video_mode === 'pro' ? ' Pro' : ''}
            </span>
          )}
        </div>
        {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-3 max-h-[28rem] overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoGen}
                onChange={(e) => onChange({ ...preferences, auto_generate_media: e.target.checked })}
                className="rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500/30 w-3.5 h-3.5"
              />
              Auto-generate media with posts
            </label>
          </div>

          {autoGen && (
            <>
              {stylePresets.length > 0 && (
                <div>
                  <label className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
                    <Palette className="w-3 h-3" />
                    Style Preset
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {stylePresets.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => selectPreset(preset.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                          preferences.style_preset_id === preset.id
                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 ring-1 ring-cyan-500/20'
                            : 'bg-slate-900 text-slate-500 border border-transparent hover:border-slate-600 hover:text-slate-400'
                        }`}
                        title={preset.description}
                      >
                        {preset.display_name}
                      </button>
                    ))}
                  </div>
                  {selectedPreset && (
                    <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                      {selectedPreset.description}
                      {selectedPreset.recommended_aspect_ratio && (
                        <span className="ml-1 text-cyan-500/70">
                          ({selectedPreset.recommended_aspect_ratio})
                        </span>
                      )}
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-1 bg-slate-900 rounded-lg p-0.5">
                <button
                  onClick={() => setActiveTab('image')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    activeTab === 'image'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-500 hover:text-slate-400'
                  }`}
                >
                  <Image className="w-3 h-3" />
                  Image
                </button>
                <button
                  onClick={() => setActiveTab('video')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    activeTab === 'video'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-500 hover:text-slate-400'
                  }`}
                >
                  <Film className="w-3 h-3" />
                  Video ({videoModels.length})
                </button>
              </div>

              {activeTab === 'image' ? (
                lockedImageModel ? (
                  <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-cyan-300">
                          {lockedImageModel.display_name}
                        </span>
                        {lockedImageModel.badge_label && (
                          <span className="px-1 py-px rounded text-[9px] font-semibold bg-amber-500/15 text-amber-400">
                            {lockedImageModel.badge_label}
                          </span>
                        )}
                      </div>
                      {lockedImageModel.short_description && (
                        <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                          {lockedImageModel.short_description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Lock className="w-3 h-3 text-slate-500" />
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-500 text-xs">
                    Image model not available
                  </div>
                )
              ) : (
                <>
                  <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {videoModels.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => selectVideoModel(model)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                          preferences.video_model_id === model.id
                            ? 'bg-cyan-500/10 border border-cyan-500/30'
                            : 'bg-slate-900/50 border border-transparent hover:border-slate-600'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-medium ${preferences.video_model_id === model.id ? 'text-cyan-300' : 'text-slate-300'}`}>
                              {model.display_name}
                            </span>
                            {model.badge_label && (
                              <span className={`px-1 py-px rounded text-[9px] font-semibold ${
                                model.is_recommended
                                  ? 'bg-amber-500/15 text-amber-400'
                                  : 'bg-slate-700 text-slate-400'
                              }`}>
                                {model.badge_label}
                              </span>
                            )}
                          </div>
                          {model.short_description && (
                            <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                              {model.short_description}
                            </p>
                          )}
                        </div>
                        {preferences.video_model_id === model.id && (
                          <Sparkles className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>

                  {isKling3 && (
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">
                        Quality Mode
                      </label>
                      <div className="flex gap-1.5">
                        {[
                          { value: 'std', label: 'Standard', desc: 'Fast, everyday use' },
                          { value: 'pro', label: 'Pro', desc: 'Higher quality' },
                        ].map((m) => (
                          <button
                            key={m.value}
                            onClick={() => onChange({ ...preferences, video_mode: m.value })}
                            className={`flex-1 px-2 py-1.5 rounded-md text-[10px] font-medium transition-colors ${
                              (preferences.video_mode || 'std') === m.value
                                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                                : 'bg-slate-900 text-slate-500 border border-transparent hover:border-slate-600'
                            }`}
                          >
                            <div>{m.label}</div>
                            <div className="text-[9px] opacity-60">{m.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">
                  Aspect Ratio
                </label>
                <div className="flex gap-1.5">
                  {ASPECT_RATIOS.map((ar) => (
                    <button
                      key={ar.value}
                      onClick={() => onChange({ ...preferences, aspect_ratio: ar.value })}
                      className={`flex-1 px-2 py-1.5 rounded-md text-[10px] font-medium transition-colors ${
                        (preferences.aspect_ratio || '16:9') === ar.value
                          ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                          : 'bg-slate-900 text-slate-500 border border-transparent hover:border-slate-600'
                      }`}
                    >
                      <div>{ar.label}</div>
                      <div className="text-[9px] opacity-60">{ar.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
