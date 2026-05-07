import { useState, useEffect } from 'react';
import { Eye, EyeOff, CheckCircle, XCircle, RefreshCw, Unplug, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getProviderStatus,
  connectProvider,
  testConnection,
  disconnectProvider,
  type ProviderStatus,
} from '../../../services/emailProviders';

interface ProvidersTabProps {
  onSuccess: () => void;
}

export function ProvidersTab({ onSuccess }: ProvidersTabProps) {
  const { user } = useAuth();
  const [provider, setProvider] = useState<ProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [domain, setDomain] = useState('');
  const [webhookSigningKey, setWebhookSigningKey] = useState('');
  const [region, setRegion] = useState<'us' | 'eu'>('us');
  const [nickname, setNickname] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSigningKey, setShowSigningKey] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [disconnectConfirm, setDisconnectConfirm] = useState('');

  useEffect(() => {
    loadProvider();
  }, [user?.organization_id]);

  const loadProvider = async () => {
    if (!user?.organization_id) return;
    try {
      const data = await getProviderStatus(user.organization_id);
      setProvider(data);
    } catch (err) {
      console.error('Failed to load provider:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setConnecting(true);

    try {
      const result = await connectProvider({
        apiKey,
        domain,
        webhookSigningKey: webhookSigningKey || undefined,
        region,
        nickname: nickname || undefined,
      });
      if (result.success) {
        setSuccess('Mailgun connected successfully');
        setApiKey('');
        setDomain('');
        setWebhookSigningKey('');
        setNickname('');
        await loadProvider();
        onSuccess();
      } else {
        setError(result.error || 'Failed to connect');
      }
    } catch (err) {
      setError('An error occurred while connecting');
    } finally {
      setConnecting(false);
    }
  };

  const handleTest = async () => {
    setError(null);
    setSuccess(null);
    setTesting(true);

    try {
      const result = await testConnection();
      if (result.success) {
        setSuccess('Connection test successful');
      } else {
        setError(result.error || 'Connection test failed');
        await loadProvider();
      }
    } catch (err) {
      setError('An error occurred during testing');
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (disconnectConfirm !== 'DISCONNECT') return;
    setDisconnecting(true);

    try {
      const result = await disconnectProvider();
      if (result.success) {
        setShowDisconnectModal(false);
        setDisconnectConfirm('');
        await loadProvider();
        onSuccess();
      } else {
        setError(result.error || 'Failed to disconnect');
      }
    } catch (err) {
      setError('An error occurred while disconnecting');
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  const isConnected = provider?.connected ?? false;

  return (
    <div className="max-w-2xl">
      {error && (
        <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/20 p-4">
          <div className="flex">
            <XCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-red-400">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4">
          <div className="flex">
            <CheckCircle className="h-5 w-5 text-emerald-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-emerald-400">{success}</p>
            </div>
          </div>
        </div>
      )}

      {isConnected ? (
        <div className="bg-slate-800 border border-slate-700 rounded-lg">
          <div className="px-6 py-5 border-b border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle className="h-6 w-6 text-emerald-400 mr-3" />
                <div>
                  <h3 className="text-lg font-medium text-white">Mailgun Connected</h3>
                  {provider?.nickname && (
                    <p className="text-sm text-slate-400">{provider.nickname}</p>
                  )}
                </div>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Connected
              </span>
            </div>
          </div>
          <div className="px-6 py-4">
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-slate-400">Provider</dt>
                <dd className="mt-1 text-sm text-white">Mailgun</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-400">Sending Domain</dt>
                <dd className="mt-1 text-sm text-white">{provider?.domain ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-400">Region</dt>
                <dd className="mt-1 text-sm text-white">{(provider?.region ?? 'us').toUpperCase()}</dd>
              </div>
            </dl>
          </div>
          <div className="px-6 py-4 bg-slate-700/30 rounded-b-lg flex justify-between">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="inline-flex items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md text-slate-200 bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-cyan-500 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${testing ? 'animate-spin' : ''}`} />
              Test Connection
            </button>
            <button
              type="button"
              onClick={() => setShowDisconnectModal(true)}
              className="inline-flex items-center px-4 py-2 border border-red-500/30 text-sm font-medium rounded-md text-red-400 bg-red-500/10 hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-red-500"
            >
              <Unplug className="h-4 w-4 mr-2" />
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-lg">
          <div className="px-6 py-5 border-b border-slate-700">
            <h3 className="text-lg font-medium text-white">Connect Mailgun</h3>
            <p className="mt-1 text-sm text-slate-400">
              Enter your Mailgun API key, sending domain, and webhook signing key to enable email sending
            </p>
          </div>
          <form onSubmit={handleConnect} className="px-6 py-5 space-y-6">
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-slate-300">
                API Key <span className="text-red-400">*</span>
              </label>
              <div className="mt-1 relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  id="apiKey"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  required
                  placeholder="key-xxxxxxxxxxxxxxxx"
                  className="block w-full pr-10 bg-slate-900 border-slate-600 rounded-md text-white placeholder-slate-500 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showApiKey ? (
                    <EyeOff className="h-5 w-5 text-slate-500 hover:text-slate-300" />
                  ) : (
                    <Eye className="h-5 w-5 text-slate-500 hover:text-slate-300" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Find your private API key in your{' '}
                <a
                  href="https://app.mailgun.com/app/account/security/api_keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300"
                >
                  Mailgun Dashboard
                </a>
              </p>
            </div>

            <div>
              <label htmlFor="domain" className="block text-sm font-medium text-slate-300">
                Sending Domain <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                id="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                required
                placeholder="mg.yourdomain.com"
                className="mt-1 block w-full bg-slate-900 border-slate-600 rounded-md text-white placeholder-slate-500 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">
                A domain you've verified in Mailgun
              </p>
            </div>

            <div>
              <label htmlFor="region" className="block text-sm font-medium text-slate-300">
                Region
              </label>
              <select
                id="region"
                value={region}
                onChange={(e) => setRegion(e.target.value as 'us' | 'eu')}
                className="mt-1 block w-full bg-slate-900 border-slate-600 rounded-md text-white focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm"
              >
                <option value="us">US (api.mailgun.net)</option>
                <option value="eu">EU (api.eu.mailgun.net)</option>
              </select>
            </div>

            <div>
              <label htmlFor="webhookSigningKey" className="block text-sm font-medium text-slate-300">
                Webhook Signing Key
              </label>
              <div className="mt-1 relative">
                <input
                  type={showSigningKey ? 'text' : 'password'}
                  id="webhookSigningKey"
                  value={webhookSigningKey}
                  onChange={(e) => setWebhookSigningKey(e.target.value)}
                  placeholder="HTTP webhook signing key"
                  className="block w-full pr-10 bg-slate-900 border-slate-600 rounded-md text-white placeholder-slate-500 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowSigningKey(!showSigningKey)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showSigningKey ? (
                    <EyeOff className="h-5 w-5 text-slate-500 hover:text-slate-300" />
                  ) : (
                    <Eye className="h-5 w-5 text-slate-500 hover:text-slate-300" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Optional. Required if you'll receive Mailgun event webhooks (delivered, opened, etc).
              </p>
            </div>

            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-slate-300">
                Account Nickname
              </label>
              <input
                type="text"
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g., Production Account"
                className="mt-1 block w-full bg-slate-900 border-slate-600 rounded-md text-white placeholder-slate-500 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">
                Optional label to identify this connection
              </p>
            </div>

            <div className="pt-4 border-t border-slate-700">
              <button
                type="submit"
                disabled={connecting || !apiKey || !domain}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-cyan-600 hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-cyan-500 disabled:opacity-50"
              >
                {connecting ? (
                  <>
                    <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                    Testing & Connecting...
                  </>
                ) : (
                  'Test & Connect'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-black/60 transition-opacity" onClick={() => setShowDisconnectModal(false)} />
            <span className="hidden sm:inline-block sm:h-screen sm:align-middle">&#8203;</span>
            <div className="inline-block transform overflow-hidden rounded-lg bg-slate-800 border border-slate-700 px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-500/10 sm:mx-0 sm:h-10 sm:w-10">
                  <AlertTriangle className="h-6 w-6 text-red-400" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 className="text-lg font-medium text-white">Disconnect Mailgun</h3>
                  <div className="mt-2">
                    <p className="text-sm text-slate-400">
                      This will immediately block all email sending. Workflows, AI agents, and
                      other features that rely on email will stop working.
                    </p>
                    <p className="mt-2 text-sm text-slate-400">
                      Type <strong className="text-white">DISCONNECT</strong> to confirm:
                    </p>
                    <input
                      type="text"
                      value={disconnectConfirm}
                      onChange={(e) => setDisconnectConfirm(e.target.value)}
                      className="mt-2 block w-full bg-slate-900 border-slate-600 rounded-md text-white placeholder-slate-500 focus:ring-red-500 focus:border-red-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnectConfirm !== 'DISCONNECT' || disconnecting}
                  className="inline-flex w-full justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-800 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDisconnectModal(false);
                    setDisconnectConfirm('');
                  }}
                  className="mt-3 inline-flex w-full justify-center rounded-md border border-slate-600 bg-slate-700 px-4 py-2 text-base font-medium text-slate-200 shadow-sm hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-800 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
