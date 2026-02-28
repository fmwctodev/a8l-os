import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  MapPin,
  Music2,
  MessageSquare,
  Link2,
  Loader2,
  X,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getSocialAccounts,
  disconnectSocialAccount,
  connectViaLate,
  reconnectViaLate,
  getProviderDisplayName,
  getProviderColor,
} from '../../../services/socialAccounts';
import type { SocialAccount, SocialProvider } from '../../../types';

const PROVIDER_ICONS: Record<SocialProvider, React.ElementType> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  google_business: MapPin,
  tiktok: Music2,
  youtube: Youtube,
  reddit: MessageSquare,
};

const PROVIDERS: SocialProvider[] = [
  'facebook', 'instagram', 'linkedin', 'google_business', 'tiktok', 'youtube', 'reddit',
];

export function SocialAccounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<SocialProvider | null>(null);
  const [reconnectingId, setReconnectingId] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
  }, [user?.organization_id]);

  async function loadAccounts() {
    if (!user?.organization_id) return;
    try {
      setLoading(true);
      const data = await getSocialAccounts(user.organization_id);
      setAccounts(data);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect(provider: SocialProvider) {
    try {
      setConnectingProvider(provider);
      setConnectError(null);
      const { url } = await connectViaLate(provider);
      window.location.href = url;
    } catch (error) {
      console.error('Failed to start connection:', error);
      setConnectError(error instanceof Error ? error.message : 'Connection failed');
      setConnectingProvider(null);
    }
  }

  async function handleReconnect(account: SocialAccount) {
    try {
      setReconnectingId(account.id);
      const { url } = await reconnectViaLate(account.id, account.provider);
      window.location.href = url;
    } catch (error) {
      console.error('Failed to start reconnection:', error);
      setReconnectingId(null);
    }
  }

  async function handleDisconnect(account: SocialAccount) {
    if (!confirm(`Disconnect ${account.display_name}?`)) return;
    try {
      await disconnectSocialAccount(account.id);
      loadAccounts();
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-slate-800 rounded-xl border border-slate-700 p-6 animate-pulse">
            <div className="h-12 w-12 bg-slate-700 rounded-lg mb-4" />
            <div className="h-5 w-32 bg-slate-700 rounded mb-2" />
            <div className="h-4 w-24 bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Connected Accounts</h2>
          <p className="text-sm text-slate-400 mt-1">
            {accounts.filter(a => a.status === 'connected').length} account{accounts.filter(a => a.status === 'connected').length !== 1 ? 's' : ''} connected
          </p>
        </div>
        <button
          onClick={() => setShowConnectModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Connect Account
        </button>
      </div>

      {accounts.filter(a => a.status !== 'disconnected').length === 0 ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
          <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Link2 className="w-8 h-8 text-slate-500" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No accounts connected</h3>
          <p className="text-slate-400 mb-6 max-w-sm mx-auto">
            Connect your social media accounts to start publishing content with AI
          </p>
          <button
            onClick={() => setShowConnectModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Connect Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.filter(a => a.status !== 'disconnected').map((account) => {
            const Icon = PROVIDER_ICONS[account.provider];
            const color = getProviderColor(account.provider);
            const needsReconnect = account.status === 'error' || account.status === 'token_expiring';
            const isReconnecting = reconnectingId === account.id;
            return (
              <div
                key={account.id}
                className="bg-slate-800 rounded-xl border border-slate-700 p-5 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="p-2.5 rounded-lg flex-shrink-0"
                    style={{ backgroundColor: color + '20' }}
                  >
                    <Icon className="w-6 h-6" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white truncate">
                      {account.display_name}
                    </div>
                    <div className="text-sm text-slate-400">
                      {getProviderDisplayName(account.provider)}
                    </div>
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      {account.status === 'connected' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
                          <CheckCircle className="w-3 h-3" />
                          Connected
                        </span>
                      ) : account.status === 'error' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400 bg-red-400/10 px-2 py-1 rounded-full">
                          <AlertCircle className="w-3 h-3" />
                          Error
                        </span>
                      ) : account.status === 'token_expiring' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full">
                          <RefreshCw className="w-3 h-3" />
                          Token Expiring
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 bg-slate-700 px-2 py-1 rounded-full">
                          {account.status}
                        </span>
                      )}
                      {needsReconnect && (
                        <button
                          onClick={() => handleReconnect(account)}
                          disabled={isReconnecting}
                          className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20 px-2 py-1 rounded-full transition-colors disabled:opacity-50"
                        >
                          {isReconnecting ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3" />
                          )}
                          Reconnect
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDisconnect(account)}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors flex-shrink-0"
                    title="Disconnect"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 max-w-md w-full mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">Connect Account</h2>
              <button
                onClick={() => { setShowConnectModal(false); setConnectError(null); }}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {connectError && (
              <div className="mx-6 mt-4 p-3 bg-red-400/10 border border-red-400/20 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-300">{connectError}</p>
              </div>
            )}
            <div className="p-6">
              <p className="text-sm text-slate-400 mb-4">
                You'll be redirected to securely sign in to your social account.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {PROVIDERS.map((provider) => {
                  const Icon = PROVIDER_ICONS[provider];
                  const color = getProviderColor(provider);
                  const isConnecting = connectingProvider === provider;
                  return (
                    <button
                      key={provider}
                      onClick={() => handleConnect(provider)}
                      disabled={!!connectingProvider}
                      className="flex items-center gap-3 p-4 rounded-lg border border-slate-600 hover:border-slate-500 hover:bg-slate-700/50 transition-colors disabled:opacity-50"
                    >
                      <div className="p-2 rounded-lg" style={{ backgroundColor: color + '20' }}>
                        {isConnecting ? (
                          <Loader2 className="w-5 h-5 animate-spin" style={{ color }} />
                        ) : (
                          <Icon className="w-5 h-5" style={{ color }} />
                        )}
                      </div>
                      <span className="text-sm font-medium text-slate-200">
                        {isConnecting ? 'Connecting...' : getProviderDisplayName(provider)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
