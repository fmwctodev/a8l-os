import { useState, useEffect } from 'react';
import { Plus, Check, X, AlertCircle, Loader2, Star, Trash2 } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import * as providersService from '../../../services/llmProviders';
import * as modelsService from '../../../services/llmModels';
import type { LLMProvider, LLMModel, LLMProviderType } from '../../../types';
import { LLM_PROVIDER_LABELS } from '../../../types';

const PROVIDER_CONFIGS: Array<{
  id: LLMProviderType;
  name: string;
  description: string;
  docsUrl: string;
}> = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4, GPT-4o, and other OpenAI models',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 3.5, Claude 3, and other Anthropic models',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'google',
    name: 'Google AI',
    description: 'Gemini 1.5 Pro, Gemini Flash, and other Google models',
    docsUrl: 'https://makersuite.google.com/app/apikey',
  },
];

export function ModelsSettingsTab() {
  const { user } = useAuth();
  const orgId = user?.organization_id;

  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [models, setModels] = useState<LLMModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingProvider, setEditingProvider] = useState<LLMProviderType | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [savingProvider, setSavingProvider] = useState(false);

  const [filterProvider, setFilterProvider] = useState<string>('all');

  useEffect(() => {
    if (orgId) {
      loadData();
    }
  }, [orgId]);

  const loadData = async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const [providersData, modelsData] = await Promise.all([
        providersService.getProviders(orgId),
        modelsService.getModels(orgId),
      ]);
      setProviders(providersData);
      setModels(modelsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const getProviderStatus = (providerType: LLMProviderType) => {
    const provider = providers.find((p) => p.provider === providerType);
    return provider ? { connected: true, enabled: provider.enabled, id: provider.id } : null;
  };

  const handleConfigureProvider = (providerType: LLMProviderType) => {
    const existing = providers.find((p) => p.provider === providerType);
    setEditingProvider(providerType);
    setApiKey('');
    setBaseUrl(existing?.base_url || '');
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    if (!orgId || !editingProvider) return;

    const existing = providers.find((p) => p.provider === editingProvider);

    try {
      setTestingProvider(editingProvider);
      setTestResult(null);

      if (existing) {
        if (apiKey) {
          await providersService.updateProvider(existing.id, { api_key: apiKey, base_url: baseUrl });
        }
        const result = await providersService.testProviderConnection(orgId, existing.id);
        setTestResult(result);
      } else {
        if (!apiKey) {
          setTestResult({ success: false, error: 'API key is required' });
          return;
        }
        const newProvider = await providersService.createProvider(orgId, {
          provider: editingProvider,
          api_key: apiKey,
          base_url: baseUrl || undefined,
          enabled: false,
        });
        const result = await providersService.testProviderConnection(orgId, newProvider.id);
        setTestResult(result);
        await loadData();
      }
    } catch (err) {
      setTestResult({ success: false, error: err instanceof Error ? err.message : 'Test failed' });
    } finally {
      setTestingProvider(null);
    }
  };

  const handleSaveProvider = async () => {
    if (!orgId || !editingProvider) return;

    const existing = providers.find((p) => p.provider === editingProvider);

    try {
      setSavingProvider(true);

      if (existing) {
        const updates: { api_key?: string; base_url?: string; enabled?: boolean } = {
          enabled: true,
        };
        if (apiKey) updates.api_key = apiKey;
        if (baseUrl !== existing.base_url) updates.base_url = baseUrl;
        await providersService.updateProvider(existing.id, updates);
      } else {
        if (!apiKey) {
          setError('API key is required');
          return;
        }
        await providersService.createProvider(orgId, {
          provider: editingProvider,
          api_key: apiKey,
          base_url: baseUrl || undefined,
          enabled: true,
        });
      }

      await loadData();
      await seedDefaultModels(editingProvider);
      setEditingProvider(null);
      setApiKey('');
      setBaseUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save provider');
    } finally {
      setSavingProvider(false);
    }
  };

  const seedDefaultModels = async (providerType: LLMProviderType) => {
    if (!orgId) return;

    const provider = providers.find((p) => p.provider === providerType);
    if (!provider) {
      const updatedProviders = await providersService.getProviders(orgId);
      const newProvider = updatedProviders.find((p) => p.provider === providerType);
      if (!newProvider) return;

      const defaultModels = modelsService.DEFAULT_MODELS.filter((m) => m.provider === providerType);
      for (const model of defaultModels) {
        try {
          await modelsService.createModel(orgId, {
            provider_id: newProvider.id,
            model_key: model.model_key,
            display_name: model.display_name,
            context_window: model.context_window,
            enabled: true,
          });
        } catch {
          // Model may already exist
        }
      }
      await loadData();
    }
  };

  const handleToggleProviderEnabled = async (providerId: string, enabled: boolean) => {
    try {
      await providersService.toggleProviderEnabled(providerId, enabled);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update provider');
    }
  };

  const handleToggleModelEnabled = async (modelId: string, enabled: boolean) => {
    try {
      await modelsService.toggleModelEnabled(modelId, enabled);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update model');
    }
  };

  const handleSetDefaultModel = async (modelId: string) => {
    if (!orgId) return;
    try {
      await modelsService.setDefaultModel(orgId, modelId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default model');
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    if (!confirm('Are you sure you want to delete this model?')) return;
    try {
      await modelsService.deleteModel(modelId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete model');
    }
  };

  const filteredModels =
    filterProvider === 'all'
      ? models
      : models.filter((m) => m.provider?.provider === filterProvider);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      <section>
        <h2 className="text-lg font-medium text-white mb-4">LLM Providers</h2>
        <p className="text-sm text-slate-400 mb-4">
          Connect your AI provider accounts to enable AI agent functionality
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          {PROVIDER_CONFIGS.map((config) => {
            const status = getProviderStatus(config.id);

            return (
              <div
                key={config.id}
                className="bg-slate-800 border border-slate-700 rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-white">{config.name}</h3>
                    <p className="text-xs text-slate-400 mt-1">{config.description}</p>
                  </div>
                  {status?.connected && (
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                        status.enabled
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-slate-500/10 text-slate-400'
                      }`}
                    >
                      {status.enabled ? 'Connected' : 'Disabled'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleConfigureProvider(config.id)}
                    className="flex-1 px-3 py-2 bg-slate-700 text-white rounded hover:bg-slate-600 transition-colors text-sm"
                  >
                    {status?.connected ? 'Configure' : 'Connect'}
                  </button>
                  {status?.connected && (
                    <button
                      onClick={() => handleToggleProviderEnabled(status.id, !status.enabled)}
                      className={`px-3 py-2 rounded text-sm ${
                        status.enabled
                          ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          : 'bg-cyan-600 text-white hover:bg-cyan-700'
                      }`}
                    >
                      {status.enabled ? 'Disable' : 'Enable'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {editingProvider && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-medium text-white mb-4">
              Configure {LLM_PROVIDER_LABELS[editingProvider]}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    providers.find((p) => p.provider === editingProvider)
                      ? '••••••••••••••••'
                      : 'Enter API key'
                  }
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <a
                  href={PROVIDER_CONFIGS.find((c) => c.id === editingProvider)?.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-cyan-400 hover:underline mt-1 inline-block"
                >
                  Get API key
                </a>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Base URL (Optional)
                </label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="For proxies or custom endpoints"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {testResult && (
                <div
                  className={`flex items-center gap-2 p-3 rounded-lg ${
                    testResult.success
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}
                >
                  {testResult.success ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                  <span>{testResult.success ? 'Connection successful!' : testResult.error}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setEditingProvider(null);
                    setApiKey('');
                    setBaseUrl('');
                    setTestResult(null);
                  }}
                  className="px-4 py-2 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTestConnection}
                  disabled={testingProvider !== null}
                  className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50"
                >
                  {testingProvider ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Test Connection'
                  )}
                </button>
                <button
                  onClick={handleSaveProvider}
                  disabled={savingProvider}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50"
                >
                  {savingProvider ? 'Saving...' : 'Save & Enable'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-medium text-white">Available Models</h2>
            <p className="text-sm text-slate-400">
              Enable models and set organization defaults
            </p>
          </div>
          <select
            value={filterProvider}
            onChange={(e) => setFilterProvider(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
          >
            <option value="all">All Providers</option>
            {providers.filter((p) => p.enabled).map((p) => (
              <option key={p.id} value={p.provider}>
                {LLM_PROVIDER_LABELS[p.provider as LLMProviderType]}
              </option>
            ))}
          </select>
        </div>

        {filteredModels.length === 0 ? (
          <div className="text-center py-8 bg-slate-800/50 rounded-lg border border-slate-700">
            <p className="text-slate-400">
              No models available. Connect a provider to see available models.
            </p>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Model</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">
                    Provider
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">
                    Context Window
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Status</th>
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody>
                {filteredModels.map((model) => (
                  <tr
                    key={model.id}
                    className="border-b border-slate-700/50 last:border-0 hover:bg-slate-700/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{model.display_name}</span>
                        {model.is_default && (
                          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        )}
                      </div>
                      <span className="text-xs text-slate-500">{model.model_key}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {model.provider
                        ? LLM_PROVIDER_LABELS[model.provider.provider as LLMProviderType]
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {model.context_window
                        ? `${(model.context_window / 1000).toFixed(0)}k`
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleModelEnabled(model.id, !model.enabled)}
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          model.enabled
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-slate-500/10 text-slate-400'
                        }`}
                      >
                        {model.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {model.enabled && !model.is_default && (
                          <button
                            onClick={() => handleSetDefaultModel(model.id)}
                            title="Set as default"
                            className="p-1 text-slate-400 hover:text-yellow-400"
                          >
                            <Star className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteModel(model.id)}
                          title="Delete model"
                          className="p-1 text-slate-400 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
