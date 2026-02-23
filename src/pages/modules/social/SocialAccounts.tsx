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
  Link2,
  Loader2,
  X,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getSocialAccounts,
  disconnectSocialAccount,
  createOAuthState,
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
};

const PROVIDERS: SocialProvider[] = [
  'facebook', 'instagram', 'linkedin', 'google_business', 'tiktok', 'youtube',
];

export function SocialAccounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<SocialProvider | null>(null);

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
    if (!user?.organization_id) return;
    try {
      setConnectingProvider(provider);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const callbackUrl = `${supabaseUrl}/functions/v1/social-oauth-callback`;

      const state = await createOAuthState(
        user.organization_id,
        user.id,
        provider,
        callbackUrl
      );

      let authUrl = '';
      const clientId = getClientIdForProvider(provider);

      switch (provider) {
        case 'facebook':
        case 'instagram': {
          const scopes = provider === 'instagram'
            ? 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement'
            : 'pages_show_list,pages_read_engagement,pages_manage_posts,publish_video';
          const params = new URLSearchParams({
            client_id: import.meta.env.VITE_FACEBOOK_APP_ID || '',
            redirect_uri: callbackUrl,
            state: state.state_token,
            scope: scopes,
            response_type: 'code',
          });
          authUrl = `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
          break;
        }
        case 'linkedin': {
          const params = new URLSearchParams({
            response_type: 'code',
            client_id: clientId,
            redirect_uri: callbackUrl,
            state: state.state_token,
            scope: 'r_liteprofile r_emailaddress w_member_social r_organization_social w_organization_social',
          });
          authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
          break;
        }
        case 'google_business':
        case 'youtube': {
          const scopes = provider === 'youtube'
            ? 'openid profile email https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.upload'
            : 'openid profile email https://www.googleapis.com/auth/business.manage';
          const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: callbackUrl,
            response_type: 'code',
            scope: scopes,
            state: state.state_token,
            access_type: 'offline',
            prompt: 'consent',
          });
          authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
          break;
        }
        case 'tiktok': {
          const params = new URLSearchParams({
            client_key: clientId,
            redirect_uri: callbackUrl,
            state: state.state_token,
            scope: 'user.info.basic,video.publish,video.upload',
            response_type: 'code',
          });
          authUrl = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
          break;
        }
      }

      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to start OAuth:', error);
      setConnectingProvider(null);
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

      {accounts.length === 0 ? (
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
          {accounts.map((account) => {
            const Icon = PROVIDER_ICONS[account.provider];
            const color = getProviderColor(account.provider);
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
                    <div className="mt-3 flex items-center gap-2">
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
                onClick={() => setShowConnectModal(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-3">
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
      )}
    </div>
  );
}

function getClientIdForProvider(provider: SocialProvider): string {
  switch (provider) {
    case 'facebook':
    case 'instagram':
      return import.meta.env.VITE_FACEBOOK_APP_ID || '';
    case 'linkedin':
      return import.meta.env.VITE_LINKEDIN_CLIENT_ID || '';
    case 'google_business':
    case 'youtube':
      return import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    case 'tiktok':
      return import.meta.env.VITE_TIKTOK_CLIENT_KEY || '';
    default:
      return '';
  }
}
