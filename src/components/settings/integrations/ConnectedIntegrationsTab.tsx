import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, AlertTriangle, ExternalLink, RefreshCw, Power, Settings, Globe, User, Loader2 } from 'lucide-react';
import { getConnectedIntegrations, testIntegrationConnection, toggleIntegration } from '../../../services/integrations';
import type { Integration } from '../../../types';
import { IntegrationDetailPanel } from './IntegrationDetailPanel';

interface ConnectedIntegrationsTabProps {
  onSuccess?: () => void;
}

export function ConnectedIntegrationsTab({ onSuccess }: ConnectedIntegrationsTabProps) {
  const navigate = useNavigate();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      const data = await getConnectedIntegrations();
      setIntegrations(data);
    } catch (error) {
      console.error('Failed to load integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async (integration: Integration) => {
    try {
      setTestingId(integration.id);
      await testIntegrationConnection(integration.key);
      loadIntegrations();
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      setTestingId(null);
    }
  };

  const handleToggle = async (integration: Integration) => {
    try {
      setTogglingId(integration.id);
      await toggleIntegration(integration.key, !integration.enabled);
      loadIntegrations();
      onSuccess?.();
    } catch (error) {
      console.error('Toggle failed:', error);
    } finally {
      setTogglingId(null);
    }
  };

  const handleClick = (integration: Integration) => {
    if (integration.settings_path) {
      navigate(integration.settings_path);
    } else {
      setSelectedIntegration(integration);
    }
  };

  const handlePanelClose = () => {
    setSelectedIntegration(null);
    loadIntegrations();
    onSuccess?.();
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getHealthBadge = (integration: Integration) => {
    const health = integration.health?.status || (integration.connection?.status === 'connected' ? 'healthy' : 'unknown');

    switch (health) {
      case 'healthy':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400">
            <CheckCircle className="h-3 w-3" />
            Healthy
          </span>
        );
      case 'degraded':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            Degraded
          </span>
        );
      case 'down':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400">
            <AlertCircle className="h-3 w-3" />
            Down
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-700 px-2 py-1 text-xs font-medium text-slate-400">
            Unknown
          </span>
        );
    }
  };

  const getScopeBadge = (scope: string) => {
    if (scope === 'global') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-cyan-500/10 px-2 py-0.5 text-xs font-medium text-cyan-400">
          <Globe className="h-3 w-3" />
          Global
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded bg-slate-700 px-2 py-0.5 text-xs font-medium text-slate-400">
        <User className="h-3 w-3" />
        User
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (integrations.length === 0) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-12 text-center">
        <Settings className="mx-auto h-12 w-12 text-slate-600" />
        <h3 className="mt-4 text-lg font-medium text-white">No Connected Integrations</h3>
        <p className="mt-2 text-sm text-slate-400">
          Connect integrations from the All Integrations tab to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-800">
        <table className="min-w-full divide-y divide-slate-700">
          <thead className="bg-slate-800/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                Integration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                Scope
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                Connected By
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                Last Sync
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                Health
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50 bg-slate-900">
            {integrations.map((integration) => (
              <tr key={integration.id} className="transition-colors hover:bg-slate-800/50">
                <td className="whitespace-nowrap px-6 py-4">
                  <button
                    onClick={() => handleClick(integration)}
                    className="flex items-center gap-3 text-left hover:text-cyan-400"
                  >
                    <div>
                      <div className="font-medium text-white">{integration.name}</div>
                      <div className="text-sm text-slate-500">{integration.category.replace('_', ' ')}</div>
                    </div>
                    {integration.settings_path && (
                      <ExternalLink className="h-4 w-4 text-slate-500" />
                    )}
                  </button>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  {getScopeBadge(integration.scope)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-400">
                  {integration.connection?.connected_by_user?.name ||
                   integration.connection?.connected_by_user?.email ||
                   'System'}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  {integration.connection?.status === 'connected' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400">
                      <CheckCircle className="h-3 w-3" />
                      Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400">
                      <AlertCircle className="h-3 w-3" />
                      Error
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-400">
                  {formatDate(integration.connection?.updated_at || integration.connection?.connected_at || null)}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  {getHealthBadge(integration)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleTest(integration)}
                      disabled={testingId === integration.id}
                      className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white disabled:opacity-50"
                      title="Test Connection"
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${testingId === integration.id ? 'animate-spin' : ''}`}
                      />
                    </button>
                    <button
                      onClick={() => handleToggle(integration)}
                      disabled={togglingId === integration.id}
                      className={`rounded p-1.5 transition-colors hover:bg-slate-700 disabled:opacity-50 ${
                        integration.enabled ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                      title={integration.enabled ? 'Disable' : 'Enable'}
                    >
                      <Power className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedIntegration && (
        <IntegrationDetailPanel
          integration={selectedIntegration}
          onClose={handlePanelClose}
          onSuccess={handlePanelClose}
        />
      )}
    </div>
  );
}
