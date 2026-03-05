import { Check, Loader2, RefreshCw, Plug, RotateCcw } from 'lucide-react';
import type { IntegrationStatus, ConnectedAccount } from '../../services/reputationIntegration';

interface ProviderDef {
  key: 'google_business' | 'facebook';
  label: string;
  platformKey: string;
  iconBg: string;
  iconText: string;
  iconChar: string;
}

const PROVIDERS: ProviderDef[] = [
  {
    key: 'google_business',
    label: 'Google Business',
    platformKey: 'googlebusiness',
    iconBg: 'bg-white border border-gray-200',
    iconText: 'text-red-500',
    iconChar: 'G',
  },
  {
    key: 'facebook',
    label: 'Facebook',
    platformKey: 'facebook',
    iconBg: 'bg-blue-600',
    iconText: 'text-white',
    iconChar: 'f',
  },
];

function getConnectedAccounts(integration: IntegrationStatus | null): ConnectedAccount[] {
  if (!integration?.accounts_connected) return [];
  if (Array.isArray(integration.accounts_connected)) return integration.accounts_connected;
  return [];
}

function isProviderConnected(accounts: ConnectedAccount[], platformKey: string): ConnectedAccount | undefined {
  return accounts.find(a => a.platform === platformKey);
}

interface IntegrationSectionProps {
  integration: IntegrationStatus | null;
  testing: boolean;
  testResult: boolean | null;
  connecting: boolean;
  canReconnect: boolean;
  onTestConnection: () => void;
  onDisconnect: () => void;
  onConnect: (provider: 'google_business' | 'facebook') => void;
}

export function IntegrationSection({
  integration,
  testing,
  testResult,
  connecting,
  canReconnect,
  onTestConnection,
  onDisconnect,
  onConnect,
}: IntegrationSectionProps) {
  const accounts = getConnectedAccounts(integration);
  const hasAnyConnection = integration?.connected && accounts.length > 0;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Late.dev Integration</h3>
          <p className="text-sm text-gray-500 mt-1">
            Connect your review platforms through Late.dev to sync and manage reviews.
          </p>
        </div>

        <div className="space-y-3">
          {PROVIDERS.map((provider) => {
            const account = isProviderConnected(accounts, provider.platformKey);
            return (
              <div
                key={provider.key}
                className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 bg-gray-50/50"
              >
                <div className={`w-9 h-9 rounded-lg ${provider.iconBg} flex items-center justify-center flex-shrink-0`}>
                  <span className={`text-sm font-bold ${provider.iconText}`}>{provider.iconChar}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{provider.label}</p>
                  {account ? (
                    <p className="text-xs text-green-600 mt-0.5 truncate">
                      {account.name || 'Connected'}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-0.5">Not connected</p>
                  )}
                </div>
                {account ? (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 border border-green-200 text-green-700 text-xs font-medium rounded-full">
                      <Check className="w-3 h-3" />
                      Connected
                    </span>
                    {canReconnect && (
                      <button
                        onClick={() => onConnect(provider.key)}
                        disabled={connecting}
                        title="Re-authorize this account"
                        className="flex items-center gap-1.5 px-2.5 py-1 border border-amber-300 text-amber-700 bg-amber-50 text-xs font-medium rounded-full hover:bg-amber-100 transition-colors disabled:opacity-50"
                      >
                        {connecting ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3 h-3" />
                        )}
                        Reconnect
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => onConnect(provider.key)}
                    disabled={connecting}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {connecting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plug className="w-3.5 h-3.5" />
                    )}
                    Connect
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {connecting && (
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            Redirecting to authorization...
          </p>
        )}
      </div>

      {hasAnyConnection && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Sync Status</h4>
              {integration?.last_sync_at && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Last synced: {new Date(integration.last_sync_at).toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onTestConnection}
                disabled={testing}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span className="hidden sm:inline">Test Connection</span>
              </button>
              <button
                onClick={onDisconnect}
                className="px-3 py-1.5 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50 transition-colors"
              >
                Disconnect All
              </button>
            </div>
          </div>

          {testResult !== null && (
            <div className={`p-3 rounded-lg text-sm ${
              testResult ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {testResult ? 'Connection test passed - sync successful' : 'Connection test failed - please reconnect'}
            </div>
          )}

          {integration?.last_error && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              Last error: {integration.last_error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-500">Successful Syncs</span>
              <p className="text-lg font-semibold text-gray-900 mt-1">{integration?.sync_success_count ?? 0}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-500">Failed Syncs</span>
              <p className="text-lg font-semibold text-gray-900 mt-1">{integration?.sync_failure_count ?? 0}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
