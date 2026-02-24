import { useState, useEffect } from 'react';
import {
  Image,
  Video,
  Star,
  ChevronDown,
  ChevronUp,
  Loader2,
  Zap,
  Sparkles,
  Search,
} from 'lucide-react';
import type { KieModel } from '../../services/mediaGeneration';
import { getKieModels } from '../../services/mediaGeneration';

interface ModelSelectorProps {
  selectedModelId: string | null;
  onSelect: (model: KieModel) => void;
  mediaType?: 'image' | 'video';
  platformHint?: string;
}

const BADGE_STYLES: Record<string, string> = {
  'TOP PICK': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  'POPULAR': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'NEW': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  'LATEST': 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  'FAST': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'PRO': 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300',
  'HD': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  'EDIT': 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  'UTILITY': 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400',
};

export default function ModelSelector({
  selectedModelId,
  onSelect,
  mediaType,
  platformHint,
}: ModelSelectorProps) {
  const [models, setModels] = useState<KieModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'image' | 'video'>(mediaType || 'image');
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadModels();
  }, []);

  useEffect(() => {
    if (mediaType) setActiveTab(mediaType);
  }, [mediaType]);

  async function loadModels() {
    try {
      setLoading(true);
      const data = await getKieModels();
      setModels(data);
    } catch (err) {
      console.error('Failed to load models:', err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = models.filter((m) => {
    if (m.type !== activeTab) return false;
    if (!showAll && !m.is_recommended) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        m.display_name.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q) ||
        (m.short_description || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectedModel = models.find((m) => m.id === selectedModelId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading models...</span>
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No AI models available yet.</p>
        <p className="text-xs mt-1">Models will appear once Kie.ai is configured.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveTab('image')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'image'
              ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
          }`}
        >
          <Image className="w-3.5 h-3.5" />
          Image
        </button>
        <button
          onClick={() => setActiveTab('video')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'video'
              ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          Video
        </button>

        <div className="ml-auto flex items-center gap-2">
          {showAll && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 w-36 focus:outline-none focus:ring-1 focus:ring-gray-300"
              />
            </div>
          )}
          <button
            onClick={() => {
              setShowAll(!showAll);
              setSearch('');
            }}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
          >
            {showAll ? (
              <>
                <Star className="w-3 h-3" />
                Recommended
                <ChevronUp className="w-3 h-3" />
              </>
            ) : (
              <>
                All Models
                <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>
        </div>
      </div>

      {selectedModel && (
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="w-8 h-8 rounded-lg bg-gray-900 dark:bg-white flex items-center justify-center flex-shrink-0">
            {selectedModel.type === 'image' ? (
              <Image className="w-4 h-4 text-white dark:text-gray-900" />
            ) : (
              <Video className="w-4 h-4 text-white dark:text-gray-900" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {selectedModel.display_name}
              </span>
              {selectedModel.badge_label && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${
                    BADGE_STYLES[selectedModel.badge_label] || BADGE_STYLES['UTILITY']
                  }`}
                >
                  {selectedModel.badge_label}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500 capitalize">{selectedModel.provider}</span>
          </div>
          <Zap className="w-4 h-4 text-emerald-500 flex-shrink-0" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-1.5 max-h-[280px] overflow-y-auto pr-1">
        {filtered.map((model) => {
          const isSelected = model.id === selectedModelId;
          return (
            <button
              key={model.id}
              onClick={() => onSelect(model)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                isSelected
                  ? 'border-gray-900 bg-gray-50 dark:border-white dark:bg-gray-800/50 ring-1 ring-gray-900 dark:ring-white'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/30'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isSelected
                    ? 'bg-gray-900 dark:bg-white'
                    : 'bg-gray-100 dark:bg-gray-800'
                }`}
              >
                {model.type === 'image' ? (
                  <Image
                    className={`w-4 h-4 ${
                      isSelected ? 'text-white dark:text-gray-900' : 'text-gray-500'
                    }`}
                  />
                ) : (
                  <Video
                    className={`w-4 h-4 ${
                      isSelected ? 'text-white dark:text-gray-900' : 'text-gray-500'
                    }`}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {model.display_name}
                  </span>
                  {model.badge_label && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full whitespace-nowrap ${
                        BADGE_STYLES[model.badge_label] || BADGE_STYLES['UTILITY']
                      }`}
                    >
                      {model.badge_label}
                    </span>
                  )}
                  {model.is_recommended && !model.badge_label && (
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {model.short_description || model.provider}
                </p>
              </div>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-6 text-gray-500 text-sm">
            {search ? 'No models match your search.' : 'No models available for this category.'}
          </div>
        )}
      </div>
    </div>
  );
}
