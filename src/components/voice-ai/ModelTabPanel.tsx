import { useState, useEffect } from 'react';
import { RefreshCw, Loader2, Cpu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { callEdgeFunction } from '../../lib/edgeFunction';
import { supabase } from '../../lib/supabase';

const LLM_PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'groq', label: 'Groq' },
  { value: 'google', label: 'Google Gemini' },
];

const FALLBACK_MODELS: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-4.1', label: 'GPT-4.1' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
  anthropic: [
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
    { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
  ],
  groq: [
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
    { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
    { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
    { value: 'gemma2-9b-it', label: 'Gemma 2 9B' },
  ],
  google: [
    { value: 'gemini-2.5-pro-preview-05-06', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash-preview-04-17', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  ],
};

const TRANSCRIBER_PROVIDERS = [
  { value: 'deepgram', label: 'Deepgram' },
  { value: 'google', label: 'Google' },
  { value: 'assemblyai', label: 'AssemblyAI' },
];

interface ModelTabPanelProps {
  llmProvider: string;
  llmModel: string;
  transcriberProvider: string;
  transcriberModel: string;
  onLlmProviderChange: (provider: string) => void;
  onLlmModelChange: (model: string) => void;
  onTranscriberProviderChange: (provider: string) => void;
  onTranscriberModelChange: (model: string) => void;
}

interface CatalogModel {
  model_key: string;
  display_name: string;
  is_enabled: boolean;
  is_default: boolean;
  context_window: number | null;
}

export function ModelTabPanel({
  llmProvider,
  llmModel,
  transcriberProvider,
  transcriberModel,
  onLlmProviderChange,
  onLlmModelChange,
  onTranscriberProviderChange,
  onTranscriberModelChange,
}: ModelTabPanelProps) {
  const { user } = useAuth();
  const orgId = user?.organization_id;

  const [dynamicModels, setDynamicModels] = useState<Record<string, { value: string; label: string }[]>>({});
  const [loadingModels, setLoadingModels] = useState(false);
  const [fetchingFromApi, setFetchingFromApi] = useState(false);

  useEffect(() => {
    if (orgId) {
      loadCatalogModels(llmProvider);
    }
  }, [orgId, llmProvider]);

  const loadCatalogModels = async (provider: string) => {
    if (!orgId) return;
    setLoadingModels(true);
    try {
      const { data, error } = await supabase
        .from('llm_model_catalog')
        .select('model_key, display_name, is_enabled, is_default, context_window')
        .eq('org_id', orgId)
        .eq('provider', provider)
        .eq('is_enabled', true)
        .order('display_name');

      if (!error && data && data.length > 0) {
        const models = (data as CatalogModel[]).map(m => ({
          value: m.model_key,
          label: m.display_name,
        }));
        setDynamicModels(prev => ({ ...prev, [provider]: models }));
      }
    } catch {
      // fall through to fallback
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSyncModels = async () => {
    if (!orgId || (llmProvider !== 'openai' && llmProvider !== 'anthropic' && llmProvider !== 'google')) return;
    setFetchingFromApi(true);
    try {
      const response = await callEdgeFunction('fetch-provider-models', {
        action: 'sync-catalog',
        org_id: orgId,
        provider: llmProvider,
      });
      const result = await response.json();
      if (result.success) {
        await loadCatalogModels(llmProvider);
      }
    } catch {
      // silent fail
    } finally {
      setFetchingFromApi(false);
    }
  };

  const currentModels = dynamicModels[llmProvider] || FALLBACK_MODELS[llmProvider] || [];
  const modelInList = currentModels.some(m => m.value === llmModel);

  const handleProviderChange = (provider: string) => {
    onLlmProviderChange(provider);
    const models = dynamicModels[provider] || FALLBACK_MODELS[provider] || [];
    if (models.length > 0) {
      onLlmModelChange(models[0].value);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">LLM Provider</label>
          <select
            value={llmProvider}
            onChange={e => handleProviderChange(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            {LLM_PROVIDERS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-slate-300">LLM Model</label>
            {(llmProvider === 'openai' || llmProvider === 'anthropic' || llmProvider === 'google') && (
              <button
                onClick={handleSyncModels}
                disabled={fetchingFromApi}
                className="flex items-center gap-1 px-2 py-0.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
                title="Fetch latest models from provider API"
              >
                {fetchingFromApi ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                Refresh
              </button>
            )}
          </div>
          {loadingModels ? (
            <div className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading models...
            </div>
          ) : (
            <select
              value={modelInList ? llmModel : ''}
              onChange={e => onLlmModelChange(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              {!modelInList && llmModel && (
                <option value="">{llmModel} (not in catalog)</option>
              )}
              {currentModels.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Transcriber Provider</label>
          <select
            value={transcriberProvider}
            onChange={e => onTranscriberProviderChange(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            {TRANSCRIBER_PROVIDERS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Transcriber Model</label>
          <input
            type="text"
            value={transcriberModel}
            onChange={e => onTranscriberModelChange(e.target.value)}
            placeholder="nova-2"
            className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>
      </div>

      {llmModel && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg">
          <Cpu className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs text-slate-500">Configuration: </span>
          <span className="text-xs text-cyan-400 font-mono">
            {LLM_PROVIDERS.find(p => p.value === llmProvider)?.label} / {llmModel}
          </span>
        </div>
      )}
    </div>
  );
}
