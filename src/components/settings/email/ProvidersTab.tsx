import { useState, useEffect } from 'react';
import { Eye, EyeOff, CheckCircle, XCircle, RefreshCw, Unplug, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getProvider, connectProvider, testConnection, disconnectProvider } from '../../../services/emailProviders';
import type { EmailProvider } from '../../../types';

interface ProvidersTabProps {
  onSuccess: () => void;
}

export function ProvidersTab({ onSuccess }: ProvidersTabProps) {
  const { user } = useAuth();
  const [provider, setProvider] = useState<EmailProvider | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [nickname, setNickname] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [disconnectConfirm, setDisconnectConfirm] = useState('');

  useEffect(() => {
    loadProvider();
  }, [user?.org_id]);

  const loadProvider = async () => {
    if (!user?.org_id) return;
    try {
      const data = await getProvider(user.org_id);
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
      const result = await connectProvider(apiKey, nickname || undefined);
      if (result.success) {
        setSuccess('SendGrid connected successfully');
        setApiKey('');
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const isConnected = provider?.status === 'connected';

  return (
    <div className="max-w-2xl">
      {error && (
        <div className="mb-6 rounded-md bg-red-50 p-4">
          <div className="flex">
            <XCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-md bg-green-50 p-4">
          <div className="flex">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">{success}</p>
            </div>
          </div>
        </div>
      )}

      {isConnected ? (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle className="h-6 w-6 text-green-500 mr-3" />
                <div>
                  <h3 className="text-lg font-medium text-gray-900">SendGrid Connected</h3>
                  {provider.account_nickname && (
                    <p className="text-sm text-gray-500">{provider.account_nickname}</p>
                  )}
                </div>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Connected
              </span>
            </div>
          </div>
          <div className="px-6 py-4">
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Provider</dt>
                <dd className="mt-1 text-sm text-gray-900">SendGrid</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Connected Since</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(provider.created_at).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>
          <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-between">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${testing ? 'animate-spin' : ''}`} />
              Test Connection
            </button>
            <button
              type="button"
              onClick={() => setShowDisconnectModal(true)}
              className="inline-flex items-center px-4 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <Unplug className="h-4 w-4 mr-2" />
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-5 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Connect SendGrid</h3>
            <p className="mt-1 text-sm text-gray-500">
              Enter your SendGrid API key to enable email sending
            </p>
          </div>
          <form onSubmit={handleConnect} className="px-6 py-5 space-y-6">
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700">
                API Key <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  id="apiKey"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  required
                  placeholder="SG.xxxxxxxxxxxxxxxx"
                  className="block w-full pr-10 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showApiKey ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Create an API key in your{' '}
                <a
                  href="https://app.sendgrid.com/settings/api_keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-500"
                >
                  SendGrid Dashboard
                </a>
              </p>
            </div>

            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-gray-700">
                Account Nickname
              </label>
              <input
                type="text"
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g., Production Account"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional label to identify this connection
              </p>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={connecting || !apiKey}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
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
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowDisconnectModal(false)} />
            <span className="hidden sm:inline-block sm:h-screen sm:align-middle">&#8203;</span>
            <div className="inline-block transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 className="text-lg font-medium text-gray-900">Disconnect SendGrid</h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      This will immediately block all email sending. Workflows, AI agents, and
                      other features that rely on email will stop working.
                    </p>
                    <p className="mt-2 text-sm text-gray-500">
                      Type <strong>DISCONNECT</strong> to confirm:
                    </p>
                    <input
                      type="text"
                      value={disconnectConfirm}
                      onChange={(e) => setDisconnectConfirm(e.target.value)}
                      className="mt-2 block w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnectConfirm !== 'DISCONNECT' || disconnecting}
                  className="inline-flex w-full justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDisconnectModal(false);
                    setDisconnectConfirm('');
                  }}
                  className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
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
