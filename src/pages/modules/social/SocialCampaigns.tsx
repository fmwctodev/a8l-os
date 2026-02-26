import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Repeat,
  Calendar,
  Zap,
  Pause,
  Play,
  Trash2,
  Loader2,
  Facebook,
  Instagram,
  Linkedin,
  MapPin,
  MoreVertical,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import {
  getCampaigns,
  createCampaign,
  deleteCampaign,
  updateCampaign,
} from '../../../services/socialCampaigns';
import type {
  SocialCampaign,
  SocialCampaignStatus,
  SocialCampaignFrequency,
  HookStylePreset,
  SocialProvider,
} from '../../../types';

const FREQUENCY_LABELS: Record<SocialCampaignFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  monthly: 'Monthly',
};

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  google_business: MapPin,
};

const STATUS_FILTER_TABS: { value: SocialCampaignStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
];

const HOOK_STYLE_LABELS: Record<HookStylePreset, string> = {
  question: 'Question',
  statistic: 'Statistic',
  story: 'Story',
  bold_claim: 'Bold Claim',
  educational: 'Educational',
};

export function SocialCampaigns() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [campaigns, setCampaigns] = useState<SocialCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<SocialCampaignStatus | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);

  useEffect(() => {
    loadCampaigns();
  }, [user?.organization_id]);

  async function loadCampaigns() {
    if (!user?.organization_id) return;
    try {
      setLoading(true);
      const data = await getCampaigns(user.organization_id);
      setCampaigns(data);
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleTogglePause(campaign: SocialCampaign) {
    try {
      const newStatus = campaign.status === 'active' ? 'paused' : 'active';
      await updateCampaign(campaign.id, { status: newStatus });
      setCampaigns(prev =>
        prev.map(c => c.id === campaign.id ? { ...c, status: newStatus as SocialCampaignStatus } : c)
      );
      showToast('success', `Campaign ${newStatus === 'active' ? 'resumed' : 'paused'}`);
    } catch (error) {
      console.error('Failed to update campaign:', error);
      showToast('warning', 'Failed to update campaign');
    }
    setMenuId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this campaign? This will not delete associated posts.')) return;
    try {
      await deleteCampaign(id);
      setCampaigns(prev => prev.filter(c => c.id !== id));
      showToast('success', 'Campaign deleted');
    } catch (error) {
      console.error('Failed to delete:', error);
      showToast('warning', 'Failed to delete campaign');
    }
    setMenuId(null);
  }

  const filtered = campaigns.filter(c =>
    statusFilter === 'all' || c.status === statusFilter
  );

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-slate-800 rounded-xl border border-slate-700 p-6 animate-pulse">
            <div className="h-5 w-40 bg-slate-700 rounded mb-3" />
            <div className="h-4 w-full bg-slate-700 rounded mb-2" />
            <div className="h-4 w-2/3 bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {STATUS_FILTER_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                statusFilter === tab.value
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-300 border border-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Create Campaign
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
          <Repeat className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No campaigns yet</h3>
          <p className="text-slate-400 mb-6 max-w-sm mx-auto">
            Create a recurring campaign to auto-generate content on a schedule
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Create Campaign
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(campaign => (
            <div
              key={campaign.id}
              className="bg-slate-800 rounded-xl border border-slate-700 p-5 hover:border-slate-600 transition-colors group cursor-pointer"
              onClick={() => navigate(`/marketing/social/campaigns/${campaign.id}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold truncate">{campaign.name}</h3>
                  {campaign.description && (
                    <p className="text-slate-400 text-sm mt-1 line-clamp-2">{campaign.description}</p>
                  )}
                </div>
                <div className="relative flex-shrink-0 ml-2" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setMenuId(menuId === campaign.id ? null : campaign.id)}
                    className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {menuId === campaign.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
                      <div className="absolute right-0 top-10 z-20 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
                        <button
                          onClick={() => handleTogglePause(campaign)}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                        >
                          {campaign.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          {campaign.status === 'active' ? 'Pause' : 'Resume'}
                        </button>
                        <button
                          onClick={() => handleDelete(campaign.id)}
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

              <div className="flex flex-wrap items-center gap-2 mt-4">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  campaign.status === 'active'
                    ? 'bg-emerald-400/10 text-emerald-400'
                    : campaign.status === 'paused'
                    ? 'bg-amber-400/10 text-amber-400'
                    : 'bg-slate-700 text-slate-400'
                }`}>
                  {campaign.status}
                </span>
                <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-1 rounded-full">
                  {FREQUENCY_LABELS[campaign.frequency]}
                </span>
                <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-1 rounded-full">
                  {HOOK_STYLE_LABELS[campaign.hook_style_preset]}
                </span>
                {campaign.autopilot_mode && (
                  <span className="text-xs text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded-full flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    Autopilot
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-700">
                <div className="flex items-center gap-1">
                  {(campaign.platforms as string[]).map(p => {
                    const Icon = PLATFORM_ICONS[p];
                    if (!Icon) return null;
                    return <Icon key={p} className="w-4 h-4 text-slate-500" />;
                  })}
                </div>
                <span className="text-xs text-slate-500">
                  {campaign.post_count} post{campaign.post_count !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateCampaignModal
          onClose={() => setShowCreateModal(false)}
          onCreate={async (data) => {
            if (!user?.organization_id) return;
            try {
              const campaign = await createCampaign(user.organization_id, user.id, data);
              setCampaigns(prev => [campaign, ...prev]);
              setShowCreateModal(false);
              showToast('success', 'Campaign created');
              navigate(`/marketing/social/campaigns/${campaign.id}`);
            } catch (error) {
              console.error('Failed to create campaign:', error);
              showToast('warning', 'Failed to create campaign');
            }
          }}
        />
      )}
    </div>
  );
}

function CreateCampaignModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: {
    name: string;
    description: string;
    theme: string;
    frequency: SocialCampaignFrequency;
    platforms: SocialProvider[];
    hook_style_preset: HookStylePreset;
    approval_required: boolean;
    autopilot_mode: boolean;
  }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState('');
  const [frequency, setFrequency] = useState<SocialCampaignFrequency>('weekly');
  const [platforms, setPlatforms] = useState<SocialProvider[]>(['linkedin']);
  const [hookStyle, setHookStyle] = useState<HookStylePreset>('question');
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [autopilot, setAutopilot] = useState(false);
  const [creating, setCreating] = useState(false);

  const platformOptions: { value: SocialProvider; label: string }[] = [
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'google_business', label: 'Google Business' },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    await onCreate({ name, description, theme, frequency, platforms, hook_style_preset: hookStyle, approval_required: approvalRequired, autopilot_mode: autopilot });
    setCreating(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
          <h2 className="text-lg font-semibold text-white">Create Campaign</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Campaign Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Weekly Tips Series"
              required
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="What is this campaign about?"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Theme / Topic</label>
            <input
              value={theme}
              onChange={e => setTheme(e.target.value)}
              placeholder="e.g. Industry insights, customer success stories"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Frequency</label>
              <select
                value={frequency}
                onChange={e => setFrequency(e.target.value as SocialCampaignFrequency)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
              >
                {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Hook Style</label>
              <select
                value={hookStyle}
                onChange={e => setHookStyle(e.target.value as HookStylePreset)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
              >
                {Object.entries(HOOK_STYLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Platforms</label>
            <div className="flex flex-wrap gap-2">
              {platformOptions.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => {
                    setPlatforms(prev =>
                      prev.includes(p.value)
                        ? prev.filter(x => x !== p.value)
                        : [...prev, p.value]
                    );
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    platforms.includes(p.value)
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:text-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={approvalRequired}
                onChange={e => setApprovalRequired(e.target.checked)}
                className="rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500/50"
              />
              <span className="text-sm text-slate-300">Require approval</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autopilot}
                onChange={e => setAutopilot(e.target.checked)}
                className="rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500/50"
              />
              <span className="text-sm text-slate-300">Autopilot mode</span>
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-300 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || platforms.length === 0 || creating}
              className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Campaign
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
