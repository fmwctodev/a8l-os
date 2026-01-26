import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Check,
  X,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Image,
  Video,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  MapPin,
  Music2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { SocialProvider } from '../../types';

interface PostData {
  id: string;
  body: string;
  media: Array<{ url: string; type: string; filename?: string }>;
  scheduled_at_utc: string | null;
  status: string;
  created_at: string;
  creator_name: string;
  creator_email: string;
  org_name: string;
  targets: Array<{
    id: string;
    display_name: string;
    provider: SocialProvider;
    profile_image_url?: string;
  }>;
}

const PROVIDER_ICONS: Record<SocialProvider, React.ElementType> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  google_business: MapPin,
  tiktok: Music2,
  youtube: Youtube,
};

const PROVIDER_COLORS: Record<SocialProvider, string> = {
  facebook: '#1877F2',
  instagram: '#E4405F',
  linkedin: '#0A66C2',
  google_business: '#4285F4',
  tiktok: '#000000',
  youtube: '#FF0000',
};

export default function PostApprovalPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<{ type: 'approved' | 'denied'; message: string } | null>(null);
  const [showDenyModal, setShowDenyModal] = useState(false);
  const [denyNotes, setDenyNotes] = useState('');

  useEffect(() => {
    if (token) {
      fetchPost();
    }
  }, [token]);

  async function fetchPost() {
    try {
      setLoading(true);
      setError(null);

      const { data: postData, error: postError } = await supabase
        .from('social_posts')
        .select(`
          id,
          body,
          media,
          scheduled_at_utc,
          status,
          created_at,
          targets,
          created_by,
          organization_id
        `)
        .eq('approval_token', token)
        .maybeSingle();

      if (postError) throw postError;

      if (!postData) {
        setError('Post not found or the approval link has expired.');
        return;
      }

      if (postData.status !== 'pending_approval') {
        if (postData.status === 'scheduled' || postData.status === 'posted') {
          setActionResult({ type: 'approved', message: 'This post has already been approved.' });
        } else if (postData.status === 'denied') {
          setActionResult({ type: 'denied', message: 'This post has already been denied.' });
        } else {
          setError(`This post is no longer pending approval (status: ${postData.status}).`);
        }
        return;
      }

      const { data: creator } = await supabase
        .from('users')
        .select('full_name, email')
        .eq('id', postData.created_by)
        .maybeSingle();

      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', postData.organization_id)
        .maybeSingle();

      const { data: accounts } = await supabase
        .from('social_accounts')
        .select('id, display_name, provider, profile_image_url')
        .in('id', postData.targets || []);

      setPost({
        id: postData.id,
        body: postData.body,
        media: postData.media || [],
        scheduled_at_utc: postData.scheduled_at_utc,
        status: postData.status,
        created_at: postData.created_at,
        creator_name: creator?.full_name || 'Unknown',
        creator_email: creator?.email || '',
        org_name: org?.name || 'Organization',
        targets: accounts || [],
      });
    } catch (err) {
      console.error('Error fetching post:', err);
      setError('Failed to load post details. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    if (!token) return;

    try {
      setActionLoading(true);

      const { error: updateError } = await supabase
        .from('social_posts')
        .update({
          status: 'scheduled',
          approval_token: null,
        })
        .eq('approval_token', token)
        .eq('status', 'pending_approval');

      if (updateError) throw updateError;

      if (post) {
        await supabase.from('social_post_logs').insert({
          post_id: post.id,
          account_id: null,
          action: 'approved',
          details: { approved_via: 'email_link' },
        });
      }

      setActionResult({ type: 'approved', message: 'Post has been approved and will be published as scheduled.' });
    } catch (err) {
      console.error('Error approving post:', err);
      setError('Failed to approve post. Please try again.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeny() {
    if (!token) return;

    try {
      setActionLoading(true);

      const { error: updateError } = await supabase
        .from('social_posts')
        .update({
          status: 'denied',
          approval_notes: denyNotes || null,
          approval_token: null,
        })
        .eq('approval_token', token)
        .eq('status', 'pending_approval');

      if (updateError) throw updateError;

      if (post) {
        await supabase.from('social_post_logs').insert({
          post_id: post.id,
          account_id: null,
          action: 'denied',
          details: { denied_via: 'email_link', notes: denyNotes || undefined },
        });
      }

      setShowDenyModal(false);
      setActionResult({ type: 'denied', message: 'Post has been denied.' });
    } catch (err) {
      console.error('Error denying post:', err);
      setError('Failed to deny post. Please try again.');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading post details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Post</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (actionResult) {
    const isApproved = actionResult.type === 'approved';
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          {isApproved ? (
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          ) : (
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          )}
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            {isApproved ? 'Post Approved' : 'Post Denied'}
          </h1>
          <p className="text-gray-600 mb-6">{actionResult.message}</p>
          <p className="text-sm text-gray-500">You can close this window now.</p>
        </div>
      </div>
    );
  }

  if (!post) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-cyan-50">
            <h1 className="text-xl font-semibold text-gray-900">Social Post Approval</h1>
            <p className="text-sm text-gray-600 mt-1">
              Review and approve or deny this scheduled post
            </p>
          </div>

          <div className="p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">Submitted by</p>
                <p className="font-medium text-gray-900">{post.creator_name}</p>
                <p className="text-sm text-gray-500">{post.creator_email}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Organization</p>
                <p className="font-medium text-gray-900">{post.org_name}</p>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-6">
              <h2 className="text-sm font-medium text-gray-700 mb-3">Post Content</h2>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-900 whitespace-pre-wrap">{post.body}</p>
              </div>
            </div>

            {post.media.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-gray-700 mb-3">Media</h2>
                <div className="grid grid-cols-3 gap-3">
                  {post.media.map((item, index) => (
                    <div
                      key={index}
                      className="aspect-square rounded-lg overflow-hidden bg-gray-100 relative"
                    >
                      {item.type === 'video' ? (
                        <div className="w-full h-full flex items-center justify-center bg-gray-900">
                          <Video className="w-8 h-8 text-white" />
                        </div>
                      ) : (
                        <img
                          src={item.url}
                          alt={item.filename || `Media ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute bottom-1 right-1 p-1 bg-black/50 rounded text-white">
                        {item.type === 'video' ? (
                          <Video className="w-3 h-3" />
                        ) : (
                          <Image className="w-3 h-3" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-sm font-medium text-gray-700 mb-3">Target Accounts</h2>
              <div className="flex flex-wrap gap-2">
                {post.targets.map((account) => {
                  const Icon = PROVIDER_ICONS[account.provider];
                  const color = PROVIDER_COLORS[account.provider];
                  return (
                    <div
                      key={account.id}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg"
                    >
                      <div className="relative">
                        {account.profile_image_url ? (
                          <img
                            src={account.profile_image_url}
                            alt={account.display_name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: color + '20' }}
                          >
                            <Icon className="w-4 h-4" style={{ color }} />
                          </div>
                        )}
                        <div
                          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border border-white"
                          style={{ backgroundColor: color }}
                        >
                          <Icon className="w-2.5 h-2.5 text-white" />
                        </div>
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        {account.display_name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {post.scheduled_at_utc && (
              <div className="flex items-center gap-6 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">
                    {new Date(post.scheduled_at_utc).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">
                    {new Date(post.scheduled_at_utc).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
            <button
              onClick={() => setShowDenyModal(true)}
              disabled={actionLoading}
              className="flex items-center gap-2 px-5 py-2.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              Deny
            </button>
            <button
              onClick={handleApprove}
              disabled={actionLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Approve
            </button>
          </div>
        </div>
      </div>

      {showDenyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Deny Post</h2>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for denial (optional)
              </label>
              <textarea
                value={denyNotes}
                onChange={(e) => setDenyNotes(e.target.value)}
                placeholder="Provide feedback to the post creator..."
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-xl">
              <button
                onClick={() => setShowDenyModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeny}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
                Deny Post
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
