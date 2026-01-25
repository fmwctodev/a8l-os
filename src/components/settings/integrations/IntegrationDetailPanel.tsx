import { useState, useEffect } from 'react';
import { X, ExternalLink, CheckCircle, AlertCircle, XCircle, Loader2, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getIntegrationUsage,
  initiateOAuthConnection,
  connectWithApiKey,
  disconnectIntegration,
  toggleIntegration,
  testIntegrationConnection,
} from '../../../services/integrations';
import type { Integration, ModuleIntegrationRequirement, ApiKeyFieldConfig } from '../../../types';

interface IntegrationDetailPanelProps {
  integration: Integration;
  onClose: () => void;
  onSuccess?: () => void;
}

export function IntegrationDetailPanel({ integration, onClose, onSuccess }: IntegrationDetailPanelProps) {
  const { hasPermission } = useAuth();
  const [usage, setUsage] = useState<ModuleIntegrationRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [showDisconnectWarning, setShowDisconnectWarning] = useState(false);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const canManage = hasPermission('integrations.manage');
  const isConnected = integration.connection?.status === 'connected';

  useEffect(() => {
    loadUsage();
  }, [integration.key]);

  const loadUsage = async () => {
    try {
      setLoading(true);
      const data = await getIntegrationUsage(integration.key);
      setUsage(data);
    } catch (err) {
      console.error('Failed to load usage:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthConnect = async () => {
    try {
      setConnecting(true);
      setError(null);
      const { authorization_url } = await initiateOAuthConnection(integration.key);
      window.location.href = authorization_url;
    } catch (err: any) {
      setError(err.message || 'Failed to initiate connection');
      setConnecting(false);
    }
  };

  const handleApiKeyConnect = async () => {
    try {
      setConnecting(true);
      setError(null);
      await connectWithApiKey({
        integration_key: integration.key,
        credentials,
      });
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (force: boolean = false) => {
    try {
      setDisconnecting(true);
      setError(null);
      const result = await disconnectIntegration(integration.key, force);
      if (!result.success && result.affected_modules?.length) {
        setShowDisconnectWarning(true);
        setDisconnecting(false);
        return;
      }
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect');
      setDisconnecting(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setError(null);
      await testIntegrationConnection(integration.key);
    } catch (err: any) {
      setError(err.message || 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleToggle = async () => {
    try {
      setToggling(true);
      setError(null);
      await toggleIntegration(integration.key, !integration.enabled);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle');
    } finally {
      setToggling(false);
    }
  };

  const apiKeyFields = (integration.api_key_config?.fields || []) as ApiKeyFieldConfig[];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg overflow-y-auto bg-slate-900 shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700 bg-slate-900 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">{integration.name}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-slate-300">Overview</h3>
            <p className="mt-2 text-sm text-slate-400">{integration.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-800 border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300 capitalize">
                {integration.scope}
              </span>
              <span className="rounded-full bg-slate-800 border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300 capitalize">
                {integration.connection_type.replace('_', ' ')}
              </span>
              <span className="rounded-full bg-slate-800 border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300">
                {integration.category.replace('_', ' ')}
              </span>
            </div>
            {integration.docs_url && (
              <a
                href={integration.docs_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300"
              >
                View Documentation
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <div className="border-t border-slate-700 pt-6">
            <h3 className="text-sm font-medium text-slate-300">Connection Status</h3>
            <div className="mt-3 flex items-center gap-3">
              {isConnected ? (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
                    <CheckCircle className="h-4 w-4" />
                    Connected
                  </span>
                  {integration.connection?.account_info?.email && (
                    <span className="text-sm text-slate-500">
                      as {integration.connection.account_info.email}
                    </span>
                  )}
                </>
              ) : integration.connection?.status === 'error' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1 text-sm font-medium text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  Error: {integration.connection.error_message || 'Unknown error'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-700 px-3 py-1 text-sm font-medium text-slate-400">
                  <XCircle className="h-4 w-4" />
                  Not Connected
                </span>
              )}
            </div>
            {integration.connection?.connected_at && (
              <p className="mt-2 text-xs text-slate-500">
                Connected on {new Date(integration.connection.connected_at).toLocaleDateString()}
              </p>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
            </div>
          ) : usage.length > 0 && (
            <div className="border-t border-slate-700 pt-6">
              <h3 className="text-sm font-medium text-slate-300">Used By Modules</h3>
              <ul className="mt-3 space-y-2">
                {usage.map((u) => (
                  <li key={u.id} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="mt-0.5 h-4 w-4 text-emerald-400" />
                    <div>
                      <span className="font-medium text-white capitalize">
                        {u.module_key.replace('_', ' ')}
                      </span>
                      {u.feature_description && (
                        <span className="text-slate-400"> - {u.feature_description}</span>
                      )}
                      {u.is_required && (
                        <span className="ml-2 rounded bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-400">
                          Required
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {canManage && (
            <div className="border-t border-slate-700 pt-6">
              <h3 className="text-sm font-medium text-slate-300">Connection</h3>
              <div className="mt-4 space-y-4">
                {!isConnected && integration.connection_type === 'oauth' && (
                  <button
                    onClick={handleOAuthConnect}
                    disabled={connecting}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 disabled:opacity-50"
                  >
                    {connecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>Connect with {integration.name}</>
                    )}
                  </button>
                )}

                {!isConnected && integration.connection_type === 'api_key' && (
                  <div className="space-y-4">
                    {apiKeyFields.map((field) => (
                      <div key={field.name}>
                        <label className="block text-sm font-medium text-slate-300">
                          {field.label}
                          {field.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                        <div className="relative mt-1">
                          <input
                            type={field.secret && !showSecrets[field.name] ? 'password' : 'text'}
                            value={credentials[field.name] || ''}
                            onChange={(e) =>
                              setCredentials({ ...credentials, [field.name]: e.target.value })
                            }
                            className="block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 pr-10 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          />
                          {field.secret && (
                            <button
                              type="button"
                              onClick={() =>
                                setShowSecrets({ ...showSecrets, [field.name]: !showSecrets[field.name] })
                              }
                              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-white"
                            >
                              {showSecrets[field.name] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={handleApiKeyConnect}
                      disabled={connecting || apiKeyFields.some((f) => f.required && !credentials[f.name])}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 disabled:opacity-50"
                    >
                      {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connect'}
                    </button>
                  </div>
                )}

                {isConnected && (
                  <div className="flex gap-3">
                    <button
                      onClick={handleTest}
                      disabled={testing}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                    >
                      {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Test Connection'}
                    </button>
                    <button
                      onClick={() => handleDisconnect(false)}
                      disabled={disconnecting}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disconnect'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {canManage && isConnected && (
            <div className="border-t border-slate-700 pt-6">
              <h3 className="text-sm font-medium text-slate-300">Settings</h3>
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">
                    {integration.enabled ? 'Enabled' : 'Disabled'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {integration.enabled
                      ? 'This integration is active and can be used'
                      : 'This integration is disabled and will not function'}
                  </p>
                </div>
                <button
                  onClick={handleToggle}
                  disabled={toggling}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    integration.enabled ? 'bg-cyan-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      integration.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showDisconnectWarning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-800 p-6 shadow-xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-semibold">Affected Modules</h3>
            </div>
            <p className="mt-3 text-sm text-slate-400">
              Disconnecting this integration will affect the following modules:
            </p>
            <ul className="mt-3 space-y-1">
              {usage.map((u) => (
                <li key={u.id} className="text-sm text-white capitalize">
                  - {u.module_key.replace('_', ' ')}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowDisconnectWarning(false)}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDisconnectWarning(false);
                  handleDisconnect(true);
                }}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Disconnect Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
