import { useState, useEffect } from 'react';
import { Eye, EyeOff, AlertCircle, Check, Loader2, Mail, Trash2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getChannelConfiguration, saveChannelConfiguration } from '../../services/channelConfigurations';
import { getConnectedGmailAccounts, getGmailAuthUrl } from '../../services/channels/gmail';
import { supabase } from '../../lib/supabase';
import type { GmailConfig as GmailConfigType, GmailOAuthToken } from '../../types';

export function GmailConfig() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState<GmailOAuthToken[]>([]);

  const [config, setConfig] = useState<GmailConfigType>({
    client_id: '',
    client_secret: '',
    redirect_uri: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-oauth-callback`,
  });

  useEffect(() => {
    async function loadData() {
      if (!user?.organization_id) return;

      try {
        setLoading(true);
        const [configData, accounts] = await Promise.all([
          getChannelConfiguration(user.organization_id, 'gmail'),
          getConnectedGmailAccounts(user.organization_id),
        ]);

        if (configData) {
          setConfig(configData.config as GmailConfigType);
          setIsActive(configData.is_active);
        }
        setConnectedAccounts(accounts);
      } catch (err) {
        console.error('Failed to load Gmail config:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user?.organization_id]);

  const handleSave = async () => {
    if (!user?.organization_id) return;

    try {
      setSaving(true);
      setError(null);
      await saveChannelConfiguration(user.organization_id, 'gmail', config, isActive);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleConnectGmail = () => {
    if (!user?.organization_id || !user?.id || !config.client_id) {
      setError('Please save your Google OAuth credentials first');
      return;
    }

    const state = btoa(JSON.stringify({
      org_id: user.organization_id,
      user_id: user.id,
      redirect_uri: window.location.href,
    }));

    const authUrl = getGmailAuthUrl(config.client_id, config.redirect_uri, state);
    window.location.href = authUrl;
  };

  const handleDisconnect = async (tokenId: string) => {
    if (!confirm('Are you sure you want to disconnect this Gmail account?')) return;

    try {
      await supabase.from('gmail_oauth_tokens').delete().eq('id', tokenId);
      setConnectedAccounts((prev) => prev.filter((a) => a.id !== tokenId));
    } catch (err) {
      setError('Failed to disconnect Gmail account');
    }
  };

  const handleSync = async (tokenId: string) => {
    if (!user?.organization_id) return;

    const account = connectedAccounts.find((a) => a.id === tokenId);
    if (!account) return;

    try {
      setSyncing(true);
      setError(null);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          org_id: user.organization_id,
          user_id: account.user_id,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || 'Sync failed');
      }
    } catch (err) {
      setError('Failed to sync Gmail');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Gmail Configuration</h3>
          <p className="text-sm text-gray-500">Connect Gmail accounts to sync email conversations</p>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">Enabled</span>
        </label>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <Check size={18} />
          Operation completed successfully
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Setup Instructions</h4>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Go to the <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a></li>
          <li>Create a new OAuth 2.0 Client ID (Web application)</li>
          <li>Add the redirect URI shown below to Authorized redirect URIs</li>
          <li>Copy your Client ID and Client Secret here</li>
        </ol>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Client ID
          </label>
          <input
            type="text"
            value={config.client_id}
            onChange={(e) => setConfig({ ...config, client_id: e.target.value })}
            placeholder="xxxxxxxx.apps.googleusercontent.com"
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Client Secret
          </label>
          <div className="relative">
            <input
              type={showSecret ? 'text' : 'password'}
              value={config.client_secret}
              onChange={(e) => setConfig({ ...config, client_secret: e.target.value })}
              placeholder="Enter your client secret"
              className="w-full px-4 py-2 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Redirect URI (add this to Google Cloud Console)
          </label>
          <code className="block w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
            {config.redirect_uri}
          </code>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {saving && <Loader2 size={18} className="animate-spin" />}
          Save Configuration
        </button>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium text-gray-900">Connected Accounts</h4>
          <button
            onClick={handleConnectGmail}
            disabled={!config.client_id || !config.client_secret}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <Mail size={18} />
            Connect Gmail Account
          </button>
        </div>

        {connectedAccounts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Mail className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No Gmail accounts connected yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {connectedAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{account.email}</p>
                    <p className="text-xs text-gray-500">
                      Connected {new Date(account.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSync(account.id)}
                    disabled={syncing}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Sync emails"
                  >
                    <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
                  </button>
                  <button
                    onClick={() => handleDisconnect(account.id)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Disconnect"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
