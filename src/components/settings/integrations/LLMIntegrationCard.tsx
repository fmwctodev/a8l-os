import { useState, useEffect, useCallback } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  Settings,
  RefreshCw,
  Star,
  Search,
  Loader2,
  Cpu,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { fetchProviderModels, toggleModelEnabled, setDefaultModel } from '../../../services/llmModelCatalog';
import type { Integration, LLMProviderType, ProviderModelInfo } from '../../../types';

interface LLMIntegrationCardProps {
  integration: Integration;
  onOpenPanel: () => void;
}

const providerIcons: Record<string, string> = {
  openai: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/OpenAI_Logo.svg/512px-OpenAI_Logo.svg.png',
  google: 'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg',
};

function getProviderFromKey(key: string): LLMProviderType | null {
  if (key === 'openai') return 'openai';
  if (key === 'google' || key === 'google_ai') return 'google';
  return null;
}

export function LLMIntegrationCard({ integration, onOpenPanel }: LLMIntegrationCardProps) {
  const { user, isSuperAdmin } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [models, setModels] = useState<ProviderModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [updatingModel, setUpdatingModel] = useState<string | null>(null);

  const provider = getProviderFromKey(integration.key);
  const isConnected = integration.connection?.status === 'connected';

  const loadModels = useCallback(async () => {
    if (!user?.organization_id || !provider || !isConnected) return;

    setLoading(true);
    setError(null);

    try {
      const result = await fetchProviderModels(user.organization_id, provider);
      setModels(result.models);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load models');
    } finally {
      setLoading(false);
    }
  }, [user?.organization_id, provider, isConnected]);

  useEffect(() => {
    if (isExpanded && isSuperAdmin && isConnected && models.length === 0 && !loading) {
      loadModels();
    }
  }, [isExpanded, isSuperAdmin, isConnected, models.length, loading, loadModels]);

  const handleRefresh = async () => {
    setSyncing(true);
    await loadModels();
    setSyncing(false);
  };

  const handleToggleModel = async (model: ProviderModelInfo) => {
    if (!user?.organization_id || !provider) return;

    setUpdatingModel(model.model_key);
    try {
      await toggleModelEnabled(
        user.organization_id,
        provider,
        model.model_key,
        model,
        !model.is_enabled
      );
      setModels((prev) =>
        prev.map((m) =>
          m.model_key === model.model_key ? { ...m, is_enabled: !m.is_enabled } : m
        )
      );
    } catch (err) {
      console.error('Failed to toggle model:', err);
    } finally {
      setUpdatingModel(null);
    }
  };

  const handleSetDefault = async (model: ProviderModelInfo) => {
    if (!user?.organization_id || !provider) return;

    setUpdatingModel(model.model_key);
    try {
      await setDefaultModel(user.organization_id, provider, model.model_key, model);
      setModels((prev) =>
        prev.map((m) => ({
          ...m,
          is_default: m.model_key === model.model_key,
          is_enabled: m.model_key === model.model_key ? true : m.is_enabled,
        }))
      );
    } catch (err) {
      console.error('Failed to set default model:', err);
    } finally {
      setUpdatingModel(null);
    }
  };

  const filteredModels = models.filter((model) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      model.display_name.toLowerCase().includes(searchLower) ||
      model.model_key.toLowerCase().includes(searchLower)
    );
  });

  const getStatusBadge = () => {
    const status = integration.connection?.status;
    if (status === 'connected') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400">
          <CheckCircle className="h-3 w-3" />
          Connected
        </span>
      );
    }
    if (status === 'error') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400">
          <AlertCircle className="h-3 w-3" />
          Error
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-700 px-2 py-1 text-xs font-medium text-slate-400">
        <XCircle className="h-3 w-3" />
        Not Connected
      </span>
    );
  };

  const formatContextWindow = (tokens: number | null): string => {
    if (!tokens) return '';
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${Math.round(tokens / 1000)}k`;
    return String(tokens);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (!isSuperAdmin || !isConnected) {
      onOpenPanel();
      return;
    }

    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) {
      return;
    }

    setIsExpanded(!isExpanded);
  };

  return (
    <div
      className={`group relative flex flex-col rounded-lg border transition-all ${
        isExpanded
          ? 'border-cyan-500/50 bg-slate-800/80'
          : 'border-slate-700 bg-slate-800 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/5'
      }`}
    >
      <button
        onClick={handleCardClick}
        className="flex flex-col p-4 text-left w-full"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {providerIcons[integration.key] ? (
              <img
                src={providerIcons[integration.key]}
                alt={integration.name}
                className="h-10 w-10 rounded-lg object-contain bg-white p-1"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-700 text-slate-400">
                <Cpu className="h-5 w-5" />
              </div>
            )}
            <div>
              <h4 className="font-medium text-white">{integration.name}</h4>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="capitalize">{integration.scope}</span>
                <span>-</span>
                <span className="capitalize">{integration.connection_type.replace('_', ' ')}</span>
              </div>
            </div>
          </div>
          {isSuperAdmin && isConnected && (
            <div className="text-slate-500">
              {isExpanded ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </div>
          )}
        </div>
        <p className="mt-3 text-sm text-slate-400 line-clamp-2">
          {integration.description}
        </p>
        <div className="mt-4 flex items-center justify-between">
          {getStatusBadge()}
          {!integration.enabled && (
            <span className="text-xs text-slate-600">Disabled</span>
          )}
        </div>
      </button>

      {isSuperAdmin && isConnected && isExpanded && (
        <div className="border-t border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h5 className="text-sm font-medium text-white">Available Models</h5>
            <button
              onClick={handleRefresh}
              disabled={syncing || loading}
              className="flex items-center gap-1.5 rounded-md bg-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-600 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
            </div>
          ) : error ? (
            <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">
              {search ? 'No models match your search' : 'No models available'}
            </div>
          ) : (
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {filteredModels.map((model) => (
                <div
                  key={model.model_key}
                  className={`flex items-center justify-between rounded-md p-2 transition-colors ${
                    model.is_enabled
                      ? 'bg-cyan-500/10'
                      : 'bg-slate-900/50 hover:bg-slate-900'
                  } ${model.is_deprecated ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button
                      onClick={() => handleToggleModel(model)}
                      disabled={updatingModel === model.model_key}
                      className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                        model.is_enabled
                          ? 'border-cyan-500 bg-cyan-500 text-white'
                          : 'border-slate-600 hover:border-slate-500'
                      }`}
                    >
                      {updatingModel === model.model_key ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : model.is_enabled ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : null}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">
                          {model.display_name}
                        </span>
                        {model.is_default && (
                          <span className="flex items-center gap-0.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                            <Star className="h-2.5 w-2.5 fill-current" />
                            Default
                          </span>
                        )}
                        {model.is_deprecated && (
                          <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                            Deprecated
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <code className="rounded bg-slate-800 px-1 py-0.5 text-[10px]">
                          {model.model_key}
                        </code>
                        {model.context_window && (
                          <span className="text-slate-600">
                            {formatContextWindow(model.context_window)} tokens
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {model.capabilities.vision && (
                      <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">
                        Vision
                      </span>
                    )}
                    {model.capabilities.reasoning && (
                      <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">
                        Reasoning
                      </span>
                    )}
                    {model.is_enabled && !model.is_default && (
                      <button
                        onClick={() => handleSetDefault(model)}
                        disabled={updatingModel === model.model_key}
                        className="ml-1 rounded p-1 text-slate-500 transition-colors hover:bg-slate-700 hover:text-amber-400"
                        title="Set as default"
                      >
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="mt-3 text-xs text-slate-500">
            Enable models to make them available for AI agents. The default model will be used when no specific model is selected.
          </p>
        </div>
      )}
    </div>
  );
}
