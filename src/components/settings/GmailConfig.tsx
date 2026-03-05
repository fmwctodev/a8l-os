import { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, AlertCircle, Check, Loader2, Mail, Trash2, RefreshCw, Clock, Activity, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getChannelConfiguration, saveChannelConfiguration } from '../../services/channelConfigurations';
import { getConnectedGmailAccounts, getGmailAuthUrl } from '../../services/channels/gmail';
import { supabase } from '../../lib/supabase';
import { fetchEdge } from '../../lib/edgeFunction';
import type { GmailConfig as GmailConfigType, GmailOAuthToken } from '../../types';

interface SyncState {
  sync_status: 'idle' | 'syncing' | 'error';
  last_full_sync_at: string | null;
  last_incremental_sync_at: string | null;
  error_message: string | null;
}

const DAYS_OPTIONS = [
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
  { label: 'Last 6 months', value: 180 },
  { label: 'Last year', value: 365 },
];

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function GmailConfig() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<GmailOAuthToken[]>([]);
  const [syncStates, setSyncStates] = useState<Record<string, SyncState>>({});
  const [syncDays, setSyncDays] = useState<Record<string, number>>({});
  const [showDaysDropdown, setShowDaysDropdown] = useState<string | null>(null);

  const [config, setConfig] = useState<GmailConfigType>({
    client_id: '',
    client_secret: '',
    redirect_uri: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-oauth-callback`,
  });

  const loadSyncStates = useCallback(async (accounts: GmailOAuthToken[]) => {
    if (!user?.organization_id || accounts.length === 0) return;
    const { data } = await supabase
      .from('gmail_sync_state')
      .select('user_id, sync_status, last_full_sync_at, last_incremental_sync_at, error_message')
      .eq('organization_id', user.organization_id)
      .in('user_id', accounts.map((a) => a.user_id));

    if (data) {
      const map: Record<string, SyncState> = {};
      for (const row of data) {
        const account = accounts.find((a) => a.user_id === row.user_id);
        if (account) map[account.id] = row as SyncState;
      }
      setSyncStates(map);
    }
  }, [user?.organization_id]);

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
        await loadSyncStates(accounts);
      } catch (err) {
        console.error('Failed to load Gmail config:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user?.organization_id, loadSyncStates]);

  useEffect(() => {
    const hasSyncing = Object.values(syncStates).some((s) => s.sync_status === 'syncing');
    if (!hasSyncing) return;
    const interval = setInterval(() => {
      loadSyncStates(connectedAccounts);
    }, 5000);
    return () => clearInterval(interval);
  }, [syncStates, connectedAccounts, loadSyncStates]);

  const handleSave = async () => {
    if (!user?.organization_id) return;
    try {
      setSaving(true);
      setError(null);
      await saveChannelConfiguration(user.organization_id, 'gmail', config, isActive);
      setSuccess('Configuration saved');
      setTimeout(() => setSuccess(null), 3000);
    } catch {
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
    } catch {
      setError('Failed to disconnect Gmail account');
    }
  };

  const handleSync = async (tokenId: string) => {
    if (!user?.organization_id) return;
    const account = connectedAccounts.find((a) => a.id === tokenId);
    if (!account) return;

    const days = syncDays[tokenId] || 365;

    try {
      setSyncingAccountId(tokenId);
      setError(null);
      setSyncStates((prev) => ({
        ...prev,
        [tokenId]: { ...(prev[tokenId] || {}), sync_status: 'syncing', error_message: null } as SyncState,
      }));

      const response = await fetchEdge('gmail-sync', {
        body: {
          org_id: user.organization_id,
          user_id: account.user_id,
          days_back: days,
        },
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(`Sync complete — ${result.processed ?? 0} conversations imported`);
        setTimeout(() => setSuccess(null), 5000);
        await loadSyncStates(connectedAccounts);
      } else {
        setError(result.error || 'Sync failed');
        setSyncStates((prev) => ({
          ...prev,
          [tokenId]: { ...(prev[tokenId] || {}), sync_status: 'error', error_message: result.error } as SyncState,
        }));
      }
    } catch {
      setError('Failed to sync Gmail');
      setSyncStates((prev) => ({
        ...prev,
        [tokenId]: { ...(prev[tokenId] || {}), sync_status: 'error' } as SyncState,
      }));
    } finally {
      setSyncingAccountId(null);
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
          <p className="text-sm text-gray-500">Connect Gmail accounts to automatically sync all email conversations with contacts</p>
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
          <AlertCircle size={18} className="shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <Check size={18} className="shrink-0" />
          {success}
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
          <input
            type="text"
            value={config.client_id}
            onChange={(e) => setConfig({ ...config, client_id: e.target.value })}
            placeholder="xxxxxxxx.apps.googleusercontent.com"
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret</label>
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
          <code className="block w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 break-all">
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
          <div>
            <h4 className="text-sm font-medium text-gray-900">Connected Accounts</h4>
            <p className="text-xs text-gray-500 mt-0.5">Emails sync automatically every 5 minutes. Use the sync button to import history.</p>
          </div>
          <button
            onClick={handleConnectGmail}
            disabled={!config.client_id || !config.client_secret}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors flex items-center gap-2 text-sm"
          >
            <Mail size={16} />
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
            {connectedAccounts.map((account) => {
              const state = syncStates[account.id];
              const isSyncing = syncingAccountId === account.id || state?.sync_status === 'syncing';
              const days = syncDays[account.id] || 365;
              const daysLabel = DAYS_OPTIONS.find((o) => o.value === days)?.label || 'Last year';

              return (
                <div key={account.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
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
                      <div className="relative">
                        <button
                          onClick={() => setShowDaysDropdown(showDaysDropdown === account.id ? null : account.id)}
                          disabled={isSyncing}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
                        >
                          <Clock size={14} />
                          {daysLabel}
                          <ChevronDown size={14} />
                        </button>
                        {showDaysDropdown === account.id && (
                          <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                            {DAYS_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() => {
                                  setSyncDays((prev) => ({ ...prev, [account.id]: opt.value }));
                                  setShowDaysDropdown(null);
                                }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors ${days === opt.value ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleSync(account.id)}
                        disabled={isSyncing}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
                        title="Sync email history"
                      >
                        <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                        {isSyncing ? 'Syncing...' : 'Sync History'}
                      </button>

                      <button
                        onClick={() => handleDisconnect(account.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Disconnect"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="px-4 pb-3 pt-0 border-t border-gray-100 bg-gray-50 flex items-center gap-6 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <Activity size={12} />
                      <span>Status:</span>
                      {isSyncing ? (
                        <span className="text-blue-600 font-medium">Syncing…</span>
                      ) : state?.sync_status === 'error' ? (
                        <span className="text-red-600 font-medium">Error</span>
                      ) : (
                        <span className="text-green-600 font-medium">Idle</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} />
                      <span>Last sync:</span>
                      <span className="font-medium text-gray-600">
                        {formatRelativeTime(state?.last_incremental_sync_at || state?.last_full_sync_at || null)}
                      </span>
                    </div>
                    {state?.error_message && (
                      <div className="flex items-center gap-1.5 text-red-500">
                        <AlertCircle size={12} />
                        <span className="truncate max-w-xs">{state.error_message}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
