import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Calendar,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  Loader2,
  Search,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  MapPin,
  Music2,
  MoreVertical,
  Copy,
  Trash2,
  Edit3,
  Eye,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getSocialPosts, deleteSocialPost, duplicatePost } from '../../../services/socialPosts';
import { getSocialAccounts, getProviderColor } from '../../../services/socialAccounts';
import type { SocialPost, SocialPostStatus, SocialAccount, SocialProvider } from '../../../types';

const PROVIDER_ICONS: Record<SocialProvider, React.ElementType> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  google_business: MapPin,
  tiktok: Music2,
  youtube: Youtube,
};

const STATUS_TABS: { value: SocialPostStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Posts' },
  { value: 'draft', label: 'Drafts' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'posted', label: 'Published' },
  { value: 'failed', label: 'Failed' },
];

export function SocialPosts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<SocialPostStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [menuPostId, setMenuPostId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [user?.organization_id]);

  async function loadData() {
    if (!user?.organization_id) return;
    try {
      setLoading(true);
      const [postsData, accountsData] = await Promise.all([
        getSocialPosts(user.organization_id),
        getSocialAccounts(user.organization_id),
      ]);
      setPosts(postsData);
      setAccounts(accountsData);
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(postId: string) {
    if (!confirm('Delete this post?')) return;
    try {
      await deleteSocialPost(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (error) {
      console.error('Failed to delete post:', error);
    }
    setMenuPostId(null);
  }

  async function handleDuplicate(postId: string) {
    if (!user) return;
    try {
      const newPost = await duplicatePost(postId, user.id);
      setPosts(prev => [newPost, ...prev]);
    } catch (error) {
      console.error('Failed to duplicate post:', error);
    }
    setMenuPostId(null);
  }

  const filteredPosts = posts.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (searchQuery && !p.body.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  function getAccountsForPost(targetIds: string[]) {
    return accounts.filter(a => targetIds.includes(a.id));
  }

  function getStatusConfig(status: SocialPostStatus) {
    switch (status) {
      case 'posted': return { icon: CheckCircle, label: 'Published', bg: 'bg-emerald-400/10', text: 'text-emerald-400' };
      case 'scheduled': return { icon: Clock, label: 'Scheduled', bg: 'bg-blue-400/10', text: 'text-blue-400' };
      case 'queued': return { icon: Send, label: 'Queued', bg: 'bg-amber-400/10', text: 'text-amber-400' };
      case 'posting': return { icon: Send, label: 'Publishing', bg: 'bg-amber-400/10', text: 'text-amber-400' };
      case 'failed': return { icon: AlertCircle, label: 'Failed', bg: 'bg-red-400/10', text: 'text-red-400' };
      case 'pending_approval': return { icon: Eye, label: 'Pending Approval', bg: 'bg-amber-400/10', text: 'text-amber-400' };
      case 'denied': return { icon: AlertCircle, label: 'Denied', bg: 'bg-red-400/10', text: 'text-red-400' };
      case 'cancelled': return { icon: AlertCircle, label: 'Cancelled', bg: 'bg-slate-400/10', text: 'text-slate-400' };
      default: return { icon: FileText, label: 'Draft', bg: 'bg-slate-400/10', text: 'text-slate-400' };
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-slate-800 rounded-xl border border-slate-700 p-5 animate-pulse">
            <div className="h-4 w-3/4 bg-slate-700 rounded mb-3" />
            <div className="h-3 w-1/2 bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search posts..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Link
            to="/marketing/social/posts/calendar"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Calendar View
          </Link>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_TABS.map(tab => {
          const count = tab.value === 'all' ? posts.length : posts.filter(p => p.status === tab.value).length;
          return (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                statusFilter === tab.value
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-300 border border-slate-700'
              }`}
            >
              {tab.label}
              <span className="ml-2 text-xs opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {filteredPosts.length === 0 ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            {statusFilter === 'all' ? 'No posts yet' : `No ${statusFilter} posts`}
          </h3>
          <p className="text-slate-400 mb-6 max-w-sm mx-auto">
            Start a conversation with your AI social manager to create content
          </p>
          <Link
            to="/marketing/social/chat"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm font-medium"
          >
            Create with AI
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPosts.map(post => {
            const status = getStatusConfig(post.status);
            const StatusIcon = status.icon;
            const targetAccounts = getAccountsForPost(post.targets);
            return (
              <div
                key={post.id}
                className="bg-slate-800 rounded-xl border border-slate-700 p-5 hover:border-slate-600 transition-colors group"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/marketing/social/posts/${post.id}/edit`}
                      className="block"
                    >
                      <p className="text-white line-clamp-2 text-sm leading-relaxed">
                        {post.body}
                      </p>
                    </Link>
                    <div className="flex items-center gap-3 mt-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${status.text} ${status.bg} px-2 py-1 rounded-full`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                      {post.engagement_prediction != null && (
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          post.engagement_prediction >= 70
                            ? 'bg-emerald-400/10 text-emerald-400'
                            : post.engagement_prediction >= 40
                            ? 'bg-amber-400/10 text-amber-400'
                            : 'bg-red-400/10 text-red-400'
                        }`}>
                          {Math.round(post.engagement_prediction)}% predicted
                        </span>
                      )}
                      {post.campaign_id && (
                        <span className="text-xs text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded-full">
                          Campaign
                        </span>
                      )}
                      {post.thread_id && (
                        <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded-full">
                          From Chat
                        </span>
                      )}
                      <div className="flex items-center gap-1">
                        {targetAccounts.map(acc => {
                          const Icon = PROVIDER_ICONS[acc.provider];
                          const color = getProviderColor(acc.provider);
                          return (
                            <div
                              key={acc.id}
                              className="p-1 rounded"
                              style={{ backgroundColor: color + '15' }}
                              title={acc.display_name}
                            >
                              <Icon className="w-3.5 h-3.5" style={{ color }} />
                            </div>
                          );
                        })}
                      </div>
                      {post.scheduled_at_utc && (
                        <span className="text-xs text-slate-500">
                          {new Date(post.scheduled_at_utc).toLocaleDateString(undefined, {
                            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={() => setMenuPostId(menuPostId === post.id ? null : post.id)}
                      className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuPostId === post.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuPostId(null)} />
                        <div className="absolute right-0 top-10 z-20 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
                          <button
                            onClick={() => { navigate(`/marketing/social/posts/${post.id}/edit`); setMenuPostId(null); }}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDuplicate(post.id)}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                            Duplicate
                          </button>
                          <button
                            onClick={() => handleDelete(post.id)}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-400/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
