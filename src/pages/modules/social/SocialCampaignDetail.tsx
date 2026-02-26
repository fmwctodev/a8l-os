import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Zap,
  Pause,
  Play,
  Trash2,
  Loader2,
  Sparkles,
  Calendar,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import {
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  generatePosts,
  getCampaignPosts,
} from '../../../services/socialCampaigns';
import type { SocialCampaign, SocialPost, SocialPostStatus } from '../../../types';

export function SocialCampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [campaign, setCampaign] = useState<SocialCampaign | null>(null);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);
      const [campaignData, postsData] = await Promise.all([
        getCampaignById(id!),
        getCampaignPosts(id!),
      ]);
      setCampaign(campaignData);
      setPosts(postsData);
    } catch (error) {
      console.error('Failed to load campaign:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleTogglePause() {
    if (!campaign) return;
    try {
      const newStatus = campaign.status === 'active' ? 'paused' : 'active';
      const updated = await updateCampaign(campaign.id, { status: newStatus });
      setCampaign(updated);
      showToast('success', `Campaign ${newStatus === 'active' ? 'resumed' : 'paused'}`);
    } catch (error) {
      showToast('warning', 'Failed to update campaign');
    }
  }

  async function handleGenerate() {
    if (!campaign) return;
    try {
      setGenerating(true);
      const result = await generatePosts(campaign.id);
      showToast('success', `Generated ${result.generated} posts`);
      loadData();
    } catch (error) {
      console.error('Generation failed:', error);
      showToast('warning', 'Failed to generate posts');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete() {
    if (!campaign) return;
    if (!confirm('Delete this campaign?')) return;
    try {
      await deleteCampaign(campaign.id);
      showToast('success', 'Campaign deleted');
      navigate('/marketing/social/campaigns');
    } catch (error) {
      showToast('warning', 'Failed to delete campaign');
    }
  }

  function getStatusBadge(status: SocialPostStatus) {
    switch (status) {
      case 'posted': return { icon: CheckCircle, label: 'Published', cls: 'text-emerald-400 bg-emerald-400/10' };
      case 'scheduled': return { icon: Clock, label: 'Scheduled', cls: 'text-blue-400 bg-blue-400/10' };
      case 'failed': return { icon: AlertCircle, label: 'Failed', cls: 'text-red-400 bg-red-400/10' };
      default: return { icon: FileText, label: status, cls: 'text-slate-400 bg-slate-700' };
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400">Campaign not found</p>
        <Link to="/marketing/social/campaigns" className="text-cyan-400 hover:text-cyan-300 text-sm mt-2 inline-block">
          Back to campaigns
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/marketing/social/campaigns')}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-white">{campaign.name}</h2>
          {campaign.description && (
            <p className="text-sm text-slate-400 mt-1">{campaign.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate Posts
          </button>
          <button
            onClick={handleTogglePause}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors text-sm font-medium"
          >
            {campaign.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {campaign.status === 'active' ? 'Pause' : 'Resume'}
          </button>
          <button
            onClick={handleDelete}
            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="text-sm text-slate-400">Status</div>
          <div className={`text-lg font-semibold mt-1 capitalize ${
            campaign.status === 'active' ? 'text-emerald-400' : campaign.status === 'paused' ? 'text-amber-400' : 'text-slate-400'
          }`}>
            {campaign.status}
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="text-sm text-slate-400">Frequency</div>
          <div className="text-lg font-semibold text-white mt-1 capitalize">{campaign.frequency}</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="text-sm text-slate-400">Total Posts</div>
          <div className="text-lg font-semibold text-white mt-1">{posts.length}</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="text-sm text-slate-400">Autopilot</div>
          <div className="flex items-center gap-2 mt-1">
            {campaign.autopilot_mode ? (
              <span className="text-cyan-400 flex items-center gap-1"><Zap className="w-4 h-4" /> On</span>
            ) : (
              <span className="text-slate-500">Off</span>
            )}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Campaign Posts</h3>
        {posts.length === 0 ? (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
            <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No posts generated yet. Click "Generate Posts" to create content.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map(post => {
              const badge = getStatusBadge(post.status);
              const BadgeIcon = badge.icon;
              return (
                <Link
                  key={post.id}
                  to={`/marketing/social/posts/${post.id}/edit`}
                  className="block bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-colors"
                >
                  <p className="text-white text-sm line-clamp-2">{post.body}</p>
                  <div className="flex items-center gap-3 mt-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${badge.cls}`}>
                      <BadgeIcon className="w-3 h-3" />
                      {badge.label}
                    </span>
                    {post.scheduled_at_utc && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(post.scheduled_at_utc).toLocaleDateString(undefined, {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
