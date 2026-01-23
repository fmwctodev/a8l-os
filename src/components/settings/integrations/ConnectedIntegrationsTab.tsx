import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, ExternalLink, RefreshCw, Power, Settings } from 'lucide-react';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (integrations.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
        <Settings className="mx-auto h-12 w-12 text-gray-300" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">No Connected Integrations</h3>
        <p className="mt-2 text-sm text-gray-500">
          Connect integrations from the All Integrations tab to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Integration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Connected
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Account
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {integrations.map((integration) => (
              <tr key={integration.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-4">
                  <button
                    onClick={() => handleClick(integration)}
                    className="flex items-center gap-3 text-left hover:text-blue-600"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{integration.name}</div>
                      <div className="text-sm text-gray-500">{integration.category.replace('_', ' ')}</div>
                    </div>
                    {integration.settings_path && (
                      <ExternalLink className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  {integration.connection?.status === 'connected' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                      <CheckCircle className="h-3 w-3" />
                      Healthy
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                      <AlertCircle className="h-3 w-3" />
                      Error
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {formatDate(integration.connection?.connected_at || null)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {integration.connection?.account_info?.email ||
                    integration.connection?.account_info?.name ||
                    '-'}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleTest(integration)}
                      disabled={testingId === integration.id}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                      title="Test Connection"
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${testingId === integration.id ? 'animate-spin' : ''}`}
                      />
                    </button>
                    <button
                      onClick={() => handleToggle(integration)}
                      disabled={togglingId === integration.id}
                      className={`rounded p-1 hover:bg-gray-100 disabled:opacity-50 ${
                        integration.enabled ? 'text-green-500' : 'text-gray-400'
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
