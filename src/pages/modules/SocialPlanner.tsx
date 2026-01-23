import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  ArrowLeft,
  Calendar,
  List,
  Settings,
  AlertCircle,
  CheckCircle,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  MapPin,
  Music2,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getSocialAccounts,
  disconnectSocialAccount,
  createOAuthState,
  getProviderDisplayName,
  getProviderColor,
} from '../../services/socialAccounts';
import { getSocialPosts } from '../../services/socialPosts';
import type { SocialAccount, SocialPost, SocialProvider } from '../../types';

const PROVIDER_ICONS: Record<SocialProvider, React.ElementType> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  google_business: MapPin,
  tiktok: Music2,
  youtube: Youtube,
};

const PROVIDERS: SocialProvider[] = [
  'facebook',
  'instagram',
  'linkedin',
  'google_business',
  'tiktok',
  'youtube',
];

export function SocialPlanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'accounts'>('posts');
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<SocialProvider | null>(null);

  const successMessage = searchParams.get('success');
  const errorMessage = searchParams.get('error');

  useEffect(() => {
    loadData();
  }, [user?.organization_id]);

  async function loadData() {
    if (!user?.organization_id) return;

    try {
      setLoading(true);
      const [accountsData, postsData] = await Promise.all([
        getSocialAccounts(user.organization_id),
        getSocialPosts(user.organization_id),
      ]);
      setAccounts(accountsData);
      setPosts(postsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnectProvider(provider: SocialProvider) {
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

      let authUrl: string;
      const clientId = getClientIdForProvider(provider);

      switch (provider) {
        case 'facebook':
        case 'instagram':
          authUrl = buildFacebookAuthUrl(provider, state.state_token, callbackUrl);
          break;
        case 'linkedin':
          authUrl = buildLinkedInAuthUrl(state.state_token, callbackUrl, clientId);
          break;
        case 'google_business':
        case 'youtube':
          authUrl = buildGoogleAuthUrl(provider, state.state_token, callbackUrl, clientId);
          break;
        case 'tiktok':
          authUrl = buildTikTokAuthUrl(state.state_token, callbackUrl, clientId);
          break;
        default:
          throw new Error(`Unknown provider: ${provider}`);
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
      loadData();
    } catch (error) {
      console.error('Failed to disconnect account:', error);
    }
  }

  function getStatusBadge(status: SocialPost['status']) {
    switch (status) {
      case 'posted':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Posted
          </span>
        );
      case 'scheduled':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
            <Calendar className="w-3 h-3 mr-1" />
            Scheduled
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  }

  const connectedAccounts = accounts.filter((a) => a.status === 'connected');

  return (
    <div className="space-y-6">
      {(successMessage || errorMessage) && (
        <div
          className={`p-4 rounded-lg ${
            successMessage
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {successMessage || errorMessage}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/marketing"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Social Planner
            </h1>
            <p className="text-sm text-gray-500">
              Schedule and publish to social media
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/marketing/social/calendar"
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Calendar
          </Link>
          <button
            onClick={() => navigate('/marketing/social/new')}
            disabled={connectedAccounts.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            New Post
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('posts')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'posts'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <List className="w-4 h-4 inline mr-2" />
          Posts
        </button>
        <button
          onClick={() => setActiveTab('accounts')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'accounts'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Settings className="w-4 h-4 inline mr-2" />
          Connected Accounts ({connectedAccounts.length})
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>
      ) : activeTab === 'posts' ? (
        <PostsList
          posts={posts}
          accounts={accounts}
          getStatusBadge={getStatusBadge}
        />
      ) : (
        <AccountsList
          accounts={accounts}
          onConnect={() => setShowConnectModal(true)}
          onDisconnect={handleDisconnect}
        />
      )}

      {showConnectModal && (
        <ConnectAccountModal
          onConnect={handleConnectProvider}
          onClose={() => setShowConnectModal(false)}
          connecting={connectingProvider}
        />
      )}
    </div>
  );
}

function PostsList({
  posts,
  accounts,
  getStatusBadge,
}: {
  posts: SocialPost[];
  accounts: SocialAccount[];
  getStatusBadge: (status: SocialPost['status']) => React.ReactNode;
}) {
  if (posts.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No posts yet</h3>
        <p className="text-gray-500 mb-4">
          Create your first social media post
        </p>
        <Link
          to="/marketing/social/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Post
        </Link>
      </div>
    );
  }

  function getAccountsForPost(targetIds: string[]) {
    return accounts.filter((a) => targetIds.includes(a.id));
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Content
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Platforms
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Scheduled
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {posts.map((post) => {
            const targetAccounts = getAccountsForPost(post.targets);
            return (
              <tr key={post.id} className="hover:bg-gray-50">
                <td className="px-4 py-4">
                  <Link
                    to={`/marketing/social/${post.id}/edit`}
                    className="block max-w-md"
                  >
                    <div className="text-gray-900 line-clamp-2">{post.body}</div>
                    {post.media.length > 0 && (
                      <div className="text-sm text-gray-500 mt-1">
                        {post.media.length} media file(s)
                      </div>
                    )}
                  </Link>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-1">
                    {targetAccounts.map((account) => {
                      const Icon = PROVIDER_ICONS[account.provider];
                      return (
                        <div
                          key={account.id}
                          className="p-1 rounded"
                          style={{ backgroundColor: getProviderColor(account.provider) + '20' }}
                          title={account.display_name}
                        >
                          <Icon
                            className="w-4 h-4"
                            style={{ color: getProviderColor(account.provider) }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </td>
                <td className="px-4 py-4">{getStatusBadge(post.status)}</td>
                <td className="px-4 py-4 text-sm text-gray-500">
                  {post.scheduled_at_utc
                    ? new Date(post.scheduled_at_utc).toLocaleString()
                    : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AccountsList({
  accounts,
  onConnect,
  onDisconnect,
}: {
  accounts: SocialAccount[];
  onConnect: () => void;
  onDisconnect: (account: SocialAccount) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={onConnect}
          className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Connect Account
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Settings className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No accounts connected
          </h3>
          <p className="text-gray-500 mb-4">
            Connect your social media accounts to start posting
          </p>
          <button
            onClick={onConnect}
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
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
                className="bg-white rounded-xl border border-gray-200 p-4"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: color + '20' }}
                  >
                    <Icon className="w-6 h-6" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {account.display_name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {getProviderDisplayName(account.provider)}
                    </div>
                    <div className="mt-2">
                      {account.status === 'connected' ? (
                        <span className="inline-flex items-center text-xs text-green-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Connected
                        </span>
                      ) : account.status === 'error' ? (
                        <span className="inline-flex items-center text-xs text-red-600">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Error
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs text-yellow-600">
                          <RefreshCw className="w-3 h-3 mr-1" />
                          {account.status}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onDisconnect(account)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConnectAccountModal({
  onConnect,
  onClose,
  connecting,
}: {
  onConnect: (provider: SocialProvider) => void;
  onClose: () => void;
  connecting: SocialProvider | null;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Connect Social Account
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            &times;
          </button>
        </div>

        <div className="p-6 grid grid-cols-2 gap-3">
          {PROVIDERS.map((provider) => {
            const Icon = PROVIDER_ICONS[provider];
            const color = getProviderColor(provider);
            const isConnecting = connecting === provider;

            return (
              <button
                key={provider}
                onClick={() => onConnect(provider)}
                disabled={!!connecting}
                className="flex items-center gap-3 p-4 rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-colors disabled:opacity-50"
              >
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: color + '20' }}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {isConnecting ? 'Connecting...' : getProviderDisplayName(provider)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
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

function buildFacebookAuthUrl(provider: SocialProvider, state: string, redirectUri: string): string {
  const scopes = provider === 'instagram'
    ? 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement'
    : 'pages_show_list,pages_read_engagement,pages_manage_posts,publish_video';

  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_FACEBOOK_APP_ID || '',
    redirect_uri: redirectUri,
    state,
    scope: scopes,
    response_type: 'code',
  });

  return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
}

function buildLinkedInAuthUrl(state: string, redirectUri: string, clientId: string): string {
  const scopes = 'r_liteprofile r_emailaddress w_member_social r_organization_social w_organization_social';

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: scopes,
  });

  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

function buildGoogleAuthUrl(provider: SocialProvider, state: string, redirectUri: string, clientId: string): string {
  const scopes = provider === 'youtube'
    ? 'openid profile email https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.upload'
    : 'openid profile email https://www.googleapis.com/auth/business.manage';

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    state,
    access_type: 'offline',
    prompt: 'consent',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function buildTikTokAuthUrl(state: string, redirectUri: string, clientKey: string): string {
  const scopes = 'user.info.basic,video.publish,video.upload';

  const params = new URLSearchParams({
    client_key: clientKey,
    redirect_uri: redirectUri,
    state,
    scope: scopes,
    response_type: 'code',
  });

  return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
}
