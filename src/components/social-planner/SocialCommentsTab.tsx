import { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ThumbsUp,
  EyeOff,
  CornerDownRight,
  Send,
  ExternalLink,
  Facebook,
  Instagram,
  Linkedin,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  Filter,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getCommentPosts,
  syncComments,
  hideComment,
  replyToComment,
  markCommentActioned,
  getLastCommentsSyncedAt,
} from '../../services/socialComments';
import type { SocialPostCommentPost, SocialPostComment, SocialCommentFilters } from '../../types';

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
};

const PLATFORM_COLORS: Record<string, string> = {
  facebook: '#1877F2',
  instagram: '#E1306C',
  linkedin: '#0A66C2',
};

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function PlatformBadge({ platform }: { platform: string }) {
  const Icon = PLATFORM_ICONS[platform];
  const color = PLATFORM_COLORS[platform] || '#64748b';
  if (!Icon) return <span className="text-xs text-slate-400 capitalize">{platform}</span>;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ backgroundColor: color + '20', color }}
    >
      <Icon className="w-3 h-3" />
      {platform.charAt(0).toUpperCase() + platform.slice(1)}
    </span>
  );
}

function CommentRow({
  comment,
  orgId,
  userId,
  onHide,
  onReply,
  onActioned,
}: {
  comment: SocialPostComment;
  orgId: string;
  userId: string;
  onHide: (c: SocialPostComment) => void;
  onReply: (c: SocialPostComment, text: string) => void;
  onActioned: (c: SocialPostComment) => void;
}) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const initials = (comment.author_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  async function handleReply() {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      await replyToComment(orgId, comment.late_comment_id, comment.late_post_id, comment.late_account_id, replyText.trim());
      await markCommentActioned(orgId, comment.id, userId);
      onReply(comment, replyText.trim());
      setReplyText('');
      setShowReply(false);
    } catch (err) {
      console.error('Reply failed:', err);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={`p-4 ${comment.is_reply ? 'pl-10 border-l-2 border-slate-700 ml-4' : ''} ${comment.hidden ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-3">
        {comment.author_avatar_url ? (
          <img src={comment.author_avatar_url} alt="" className="w-8 h-8 rounded-full flex-shrink-0 object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-xs font-medium text-slate-300 flex-shrink-0">
            {initials}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white">{comment.author_name || 'Unknown'}</span>
            {comment.author_handle && (
              <span className="text-xs text-slate-500">@{comment.author_handle}</span>
            )}
            {comment.is_reply && (
              <span className="text-xs text-slate-500 flex items-center gap-0.5">
                <CornerDownRight className="w-3 h-3" />
                reply
              </span>
            )}
            <span className="text-xs text-slate-500 ml-auto">{formatRelativeTime(comment.comment_created_at)}</span>
          </div>

          {comment.text && (
            <p className="text-sm text-slate-300 mt-1 leading-relaxed">{comment.text}</p>
          )}

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {comment.like_count > 0 && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <ThumbsUp className="w-3 h-3" />
                {comment.like_count}
              </span>
            )}
            {comment.reply_count > 0 && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <MessageCircle className="w-3 h-3" />
                {comment.reply_count}
              </span>
            )}
            {comment.actioned_at && (
              <span className="flex items-center gap-1 text-xs text-emerald-500">
                <CheckCircle className="w-3 h-3" />
                Actioned
              </span>
            )}
            {comment.hidden && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <EyeOff className="w-3 h-3" />
                Hidden
              </span>
            )}
            {comment.has_private_reply && (
              <span className="flex items-center gap-1 text-xs text-blue-400">
                <MessageCircle className="w-3 h-3" />
                Has private reply
              </span>
            )}

            {!comment.hidden && (
              <button
                onClick={() => onHide(comment)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors ml-auto"
              >
                <EyeOff className="w-3 h-3" />
                Hide
              </button>
            )}
            <button
              onClick={() => setShowReply(!showReply)}
              className="flex items-center gap-1 text-xs text-cyan-500 hover:text-cyan-400 transition-colors"
            >
              <CornerDownRight className="w-3 h-3" />
              Reply
            </button>
          </div>

          {showReply && (
            <div className="mt-3 flex items-end gap-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                rows={2}
                className="flex-1 px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
              />
              <button
                onClick={handleReply}
                disabled={!replyText.trim() || sending}
                className="p-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg transition-colors flex-shrink-0"
              >
                {sending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PostCommentGroup({
  post,
  orgId,
  userId,
  onUpdate,
}: {
  post: SocialPostCommentPost;
  orgId: string;
  userId: string;
  onUpdate: (postId: string, updatedComments: SocialPostComment[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const comments = post.comments || [];
  const unactionedCount = comments.filter(c => !c.actioned_at && !c.hidden && !c.is_reply).length;

  async function handleHide(comment: SocialPostComment) {
    try {
      await hideComment(orgId, comment.late_comment_id, comment.late_account_id);
      await markCommentActioned(orgId, comment.id, userId);
      onUpdate(post.late_post_id, comments.map(c =>
        c.id === comment.id ? { ...c, hidden: true, actioned_at: new Date().toISOString() } : c
      ));
    } catch (err) {
      console.error('Hide failed:', err);
    }
  }

  function handleReply(comment: SocialPostComment, _text: string) {
    onUpdate(post.late_post_id, comments.map(c =>
      c.id === comment.id ? { ...c, actioned_at: new Date().toISOString(), has_private_reply: true } : c
    ));
  }

  function handleActioned(comment: SocialPostComment) {
    onUpdate(post.late_post_id, comments.map(c =>
      c.id === comment.id ? { ...c, actioned_at: new Date().toISOString() } : c
    ));
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-4 hover:bg-slate-700/50 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <PlatformBadge platform={post.platform} />
            {unactionedCount > 0 && (
              <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full font-medium">
                {unactionedCount} new
              </span>
            )}
            {post.last_comment_at && (
              <span className="text-xs text-slate-500 ml-auto flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatRelativeTime(post.last_comment_at)}
              </span>
            )}
          </div>

          {post.post_body_preview && (
            <p className="text-sm text-slate-400 mt-1 line-clamp-2 leading-relaxed">
              {post.post_body_preview}
            </p>
          )}

          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <MessageCircle className="w-3 h-3" />
              {post.comment_count} comment{post.comment_count !== 1 ? 's' : ''}
            </span>
            {post.platform_post_url && (
              <a
                href={post.platform_post_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-xs text-cyan-500 hover:text-cyan-400 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                View post
              </a>
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-700 divide-y divide-slate-700/50">
          {comments.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">No comments loaded</div>
          ) : (
            comments.map(comment => (
              <CommentRow
                key={comment.id}
                comment={comment}
                orgId={orgId}
                userId={userId}
                onHide={handleHide}
                onReply={handleReply}
                onActioned={handleActioned}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function SocialCommentsTab() {
  const { user } = useAuth();
  const [commentPosts, setCommentPosts] = useState<SocialPostCommentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.organization_id) return;
    try {
      setLoading(true);
      const filters: SocialCommentFilters = {};
      if (platformFilter) filters.platform = platformFilter;

      const [posts, syncedAt] = await Promise.all([
        getCommentPosts(user.organization_id, filters),
        getLastCommentsSyncedAt(user.organization_id),
      ]);
      setCommentPosts(posts);
      setLastSynced(syncedAt);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.organization_id, platformFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSync() {
    if (!user?.organization_id || syncing) return;
    setSyncing(true);
    try {
      await syncComments(user.organization_id);
      await loadData();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  }

  function handlePostUpdate(latePostId: string, updatedComments: SocialPostComment[]) {
    setCommentPosts(prev =>
      prev.map(p => p.late_post_id === latePostId ? { ...p, comments: updatedComments } : p)
    );
  }

  const filteredPosts = commentPosts.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.post_body_preview?.toLowerCase().includes(q) ||
      p.comments?.some(c => c.text?.toLowerCase().includes(q) || c.author_name?.toLowerCase().includes(q))
    );
  });

  const totalUnactioned = commentPosts.reduce((sum, p) => {
    return sum + (p.comments?.filter(c => !c.actioned_at && !c.hidden && !c.is_reply).length || 0);
  }, 0);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-slate-800 rounded-xl border border-slate-700 p-5 animate-pulse">
            <div className="h-4 w-1/3 bg-slate-700 rounded mb-3" />
            <div className="h-3 w-2/3 bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search comments..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
          />
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
            platformFilter
              ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filter
        </button>

        <div className="flex items-center gap-2 ml-auto">
          {lastSynced && (
            <span className="text-xs text-slate-500">
              Synced {formatRelativeTime(lastSynced)}
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <label className="block text-xs font-medium text-slate-400 mb-2">Platform</label>
          <div className="flex gap-2 flex-wrap">
            {['', 'facebook', 'instagram', 'linkedin'].map(p => (
              <button
                key={p || 'all'}
                onClick={() => setPlatformFilter(p)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  platformFilter === p
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                    : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'
                }`}
              >
                {p === '' ? 'All platforms' : (
                  <>
                    {PLATFORM_ICONS[p] && (() => { const Icon = PLATFORM_ICONS[p]; return <Icon className="w-3 h-3" />; })()}
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {totalUnactioned > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
          <AlertCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <span className="text-sm text-cyan-300">
            <span className="font-semibold">{totalUnactioned}</span> comment{totalUnactioned !== 1 ? 's' : ''} waiting for a response
          </span>
        </div>
      )}

      {filteredPosts.length === 0 ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
          <MessageCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No comments yet</h3>
          <p className="text-slate-400 mb-6 max-w-sm mx-auto text-sm">
            Click "Sync Now" to pull in the latest comments from your connected social accounts.
          </p>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Comments'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPosts.map(post => (
            <PostCommentGroup
              key={`${post.late_post_id}-${post.late_account_id}`}
              post={post}
              orgId={user!.organization_id}
              userId={user!.id}
              onUpdate={handlePostUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
