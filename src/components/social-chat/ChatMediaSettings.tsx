import { useState, useEffect } from 'react';
import {
  Image,
  Film,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Settings2,
  Zap,
} from 'lucide-react';
import { getKieModels } from '../../services/mediaGeneration';
import type { KieModel } from '../../services/mediaGeneration';
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
  const [imageModels, setImageModels] = useState<KieModel[]>([]);
  const [videoModels, setVideoModels] = useState<KieModel[]>([]);
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');

  useEffect(() => {
    loadModels();
  }, []);

  async function loadModels() {
    try {
      const [imgs, vids] = await Promise.all([
        getKieModels('image'),
        getKieModels('video'),
      ]);
      setImageModels(imgs);
      setVideoModels(vids);
    } catch {
      // models will stay empty
    }
  }

  const selectedImageModel = imageModels.find(m => m.id === preferences.image_model_id);
  const selectedVideoModel = videoModels.find(m => m.id === preferences.video_model_id);
  const autoGen = preferences.auto_generate_media !== false;

  function selectModel(model: KieModel) {
    if (model.type === 'image') {
      onChange({ ...preferences, image_model_id: model.id });
    } else {
      onChange({ ...preferences, video_model_id: model.id });
    }
  }

  const models = activeTab === 'image' ? imageModels : videoModels;
  const selectedId = activeTab === 'image' ? preferences.image_model_id : preferences.video_model_id;

  return (
    <div className="border-t border-slate-700 bg-slate-800/50">
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
          {selectedImageModel && (
            <span className="px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded text-[10px]">
              {selectedImageModel.display_name}
            </span>
          )}
          {selectedVideoModel && (
            <span className="px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded text-[10px]">
              {selectedVideoModel.display_name}
            </span>
          )}
        </div>
        {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-3">
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
                  Image ({imageModels.length})
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

              <div className="max-h-40 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {models.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => selectModel(model)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                      selectedId === model.id
                        ? 'bg-cyan-500/10 border border-cyan-500/30'
                        : 'bg-slate-900/50 border border-transparent hover:border-slate-600'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-medium ${selectedId === model.id ? 'text-cyan-300' : 'text-slate-300'}`}>
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
                    {selectedId === model.id && (
                      <Sparkles className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>

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
