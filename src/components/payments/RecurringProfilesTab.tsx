import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getRecurringProfiles,
  getRecurringProfileStats,
  pauseRecurringProfile,
  resumeRecurringProfile,
  cancelRecurringProfile,
  type RecurringProfile,
  type RecurringProfileStats,
} from '../../services/recurringProfiles';
import {
  RefreshCw,
  Plus,
  Search,
  MoreVertical,
  Pause,
  Play,
  XCircle,
  Eye,
  Loader2,
  TrendingUp,
  Calendar,
  DollarSign,
  Users,
} from 'lucide-react';
import { CreateRecurringProfileModal } from './CreateRecurringProfileModal';

interface Props {
  onRefresh?: () => void;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', label: 'Active' },
  paused: { bg: 'bg-amber-500/20', text: 'text-amber-300', label: 'Paused' },
  cancelled: { bg: 'bg-slate-700/50', text: 'text-slate-500', label: 'Cancelled' },
};

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annually: 'Annually',
};

export function RecurringProfilesTab({ onRefresh }: Props) {
  const { user, hasPermission } = useAuth();
  const [profiles, setProfiles] = useState<RecurringProfile[]>([]);
  const [stats, setStats] = useState<RecurringProfileStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<RecurringProfile | null>(null);

  const canManage = hasPermission('payments.manage');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [profilesData, statsData] = await Promise.all([
        getRecurringProfiles(),
        getRecurringProfileStats(),
      ]);
      setProfiles(profilesData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load recurring profiles:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = async (profile: RecurringProfile) => {
    if (!user) return;
    try {
      await pauseRecurringProfile(profile.id, user);
      loadData();
    } catch (err) {
      console.error('Failed to pause profile:', err);
    }
    setActionMenuId(null);
  };

  const handleResume = async (profile: RecurringProfile) => {
    if (!user) return;
    try {
      await resumeRecurringProfile(profile.id, user);
      loadData();
    } catch (err) {
      console.error('Failed to resume profile:', err);
    }
    setActionMenuId(null);
  };

  const handleCancel = async (profile: RecurringProfile) => {
    if (!user || !confirm('Are you sure you want to cancel this recurring profile? This cannot be undone.')) return;
    try {
      await cancelRecurringProfile(profile.id, user);
      loadData();
    } catch (err) {
      console.error('Failed to cancel profile:', err);
    }
    setActionMenuId(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const getContactName = (profile: RecurringProfile) => {
    if (!profile.contact) return 'Unknown';
    return profile.contact.company || `${profile.contact.first_name} ${profile.contact.last_name}`;
  };

  const calculateProfileTotal = (profile: RecurringProfile) => {
    return (profile.items || []).reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  };

  const filteredProfiles = profiles.filter((profile) => {
    if (statusFilter !== 'all' && profile.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const contactName = getContactName(profile).toLowerCase();
      const profileName = profile.name.toLowerCase();
      if (!contactName.includes(query) && !profileName.includes(query)) return false;
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <Users className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-white">{stats.activeProfiles}</p>
                <p className="text-sm text-slate-400">Active Profiles</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-white">{formatCurrency(stats.monthlyRecurringRevenue)}</p>
                <p className="text-sm text-slate-400">Monthly Revenue</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-500/10">
                <TrendingUp className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-white">{formatCurrency(stats.annualRecurringRevenue)}</p>
                <p className="text-sm text-slate-400">Annual Revenue</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Pause className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-white">{stats.pausedProfiles}</p>
                <p className="text-sm text-slate-400">Paused</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search profiles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium hover:from-emerald-600 hover:to-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Profile
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-900 sticky top-0 z-10">
            <tr className="border-b border-slate-800">
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Profile</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Contact</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Amount</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Frequency</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Status</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Next Invoice</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProfiles.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No recurring profiles found</p>
                  {canManage && (
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Create your first profile
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filteredProfiles.map((profile) => {
                const statusStyle = STATUS_STYLES[profile.status] || STATUS_STYLES.active;
                const total = calculateProfileTotal(profile);
                return (
                  <tr
                    key={profile.id}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer"
                    onClick={() => setSelectedProfile(profile)}
                  >
                    <td className="py-3 px-4">
                      <div>
                        <span className="text-white font-medium">{profile.name}</span>
                        <div className="flex items-center gap-1 text-slate-400 text-xs mt-0.5">
                          <Calendar className="w-3 h-3" />
                          Created {formatDate(profile.created_at)}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-white">{getContactName(profile)}</span>
                      {profile.contact?.email && (
                        <p className="text-slate-400 text-xs">{profile.contact.email}</p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-white font-medium">{formatCurrency(total)}</span>
                      <p className="text-slate-400 text-xs">per {profile.frequency.replace('ly', '')}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-slate-300">{FREQUENCY_LABELS[profile.frequency]}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                        {statusStyle.label}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-slate-300">
                        {profile.next_invoice_date ? formatDate(profile.next_invoice_date) : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="relative">
                        <button
                          onClick={() => setActionMenuId(actionMenuId === profile.id ? null : profile.id)}
                          className="p-1.5 rounded hover:bg-slate-700 text-slate-400"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {actionMenuId === profile.id && (
                          <div className="absolute right-0 top-full mt-1 w-48 rounded-lg bg-slate-800 border border-slate-700 shadow-xl z-50">
                            <button
                              onClick={() => {
                                setSelectedProfile(profile);
                                setActionMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                            >
                              <Eye className="w-4 h-4" />
                              View Details
                            </button>
                            {profile.status === 'active' && canManage && (
                              <button
                                onClick={() => handlePause(profile)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                              >
                                <Pause className="w-4 h-4" />
                                Pause Profile
                              </button>
                            )}
                            {profile.status === 'paused' && canManage && (
                              <button
                                onClick={() => handleResume(profile)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                              >
                                <Play className="w-4 h-4" />
                                Resume Profile
                              </button>
                            )}
                            {profile.status !== 'cancelled' && canManage && (
                              <button
                                onClick={() => handleCancel(profile)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700"
                              >
                                <XCircle className="w-4 h-4" />
                                Cancel Profile
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <CreateRecurringProfileModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadData();
            onRefresh?.();
          }}
        />
      )}

      {selectedProfile && (
        <RecurringProfileDetailModal
          profile={selectedProfile}
          onClose={() => setSelectedProfile(null)}
          onUpdated={loadData}
        />
      )}
    </div>
  );
}

function RecurringProfileDetailModal({
  profile,
  onClose,
  onUpdated,
}: {
  profile: RecurringProfile;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { user, hasPermission } = useAuth();
  const canManage = hasPermission('payments.manage');
  const statusStyle = STATUS_STYLES[profile.status] || STATUS_STYLES.active;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const handlePause = async () => {
    if (!user) return;
    try {
      await pauseRecurringProfile(profile.id, user);
      onUpdated();
      onClose();
    } catch (err) {
      console.error('Failed to pause profile:', err);
    }
  };

  const handleResume = async () => {
    if (!user) return;
    try {
      await resumeRecurringProfile(profile.id, user);
      onUpdated();
      onClose();
    } catch (err) {
      console.error('Failed to resume profile:', err);
    }
  };

  const handleCancel = async () => {
    if (!user || !confirm('Are you sure you want to cancel this recurring profile?')) return;
    try {
      await cancelRecurringProfile(profile.id, user);
      onUpdated();
      onClose();
    } catch (err) {
      console.error('Failed to cancel profile:', err);
    }
  };

  const total = (profile.items || []).reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-semibold text-white">{profile.name}</h2>
            <p className="text-slate-400 text-sm mt-1">Recurring Profile Details</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-slate-400 text-sm">Status</p>
              <span className={`inline-flex mt-1 px-2 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                {statusStyle.label}
              </span>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-slate-400 text-sm">Frequency</p>
              <p className="text-white font-medium mt-1">{FREQUENCY_LABELS[profile.frequency]}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-slate-400 text-sm">Amount per Cycle</p>
              <p className="text-white font-medium mt-1">{formatCurrency(total)}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-slate-400 text-sm">Next Invoice</p>
              <p className="text-white font-medium mt-1">{formatDate(profile.next_invoice_date)}</p>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-4">
            <p className="text-slate-400 text-sm mb-2">Contact</p>
            <p className="text-white font-medium">
              {profile.contact?.company || `${profile.contact?.first_name} ${profile.contact?.last_name}`}
            </p>
            {profile.contact?.email && (
              <p className="text-slate-400 text-sm">{profile.contact.email}</p>
            )}
          </div>

          <div>
            <p className="text-slate-400 text-sm mb-3">Line Items</p>
            <div className="bg-slate-800/50 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 px-4 text-xs font-medium text-slate-400">Description</th>
                    <th className="text-right py-2 px-4 text-xs font-medium text-slate-400">Qty</th>
                    <th className="text-right py-2 px-4 text-xs font-medium text-slate-400">Price</th>
                    <th className="text-right py-2 px-4 text-xs font-medium text-slate-400">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(profile.items || []).map((item) => (
                    <tr key={item.id} className="border-b border-slate-700/50">
                      <td className="py-2 px-4 text-white text-sm">{item.description}</td>
                      <td className="py-2 px-4 text-slate-300 text-sm text-right">{item.quantity}</td>
                      <td className="py-2 px-4 text-slate-300 text-sm text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="py-2 px-4 text-white text-sm text-right font-medium">{formatCurrency(item.quantity * item.unit_price)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-700/30">
                    <td colSpan={3} className="py-2 px-4 text-white text-sm font-medium text-right">Total</td>
                    <td className="py-2 px-4 text-white text-sm text-right font-bold">{formatCurrency(total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-400">Auto-send Invoices</p>
              <p className="text-white">{profile.auto_send ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <p className="text-slate-400">End Date</p>
              <p className="text-white">{formatDate(profile.end_date)}</p>
            </div>
            <div>
              <p className="text-slate-400">Created</p>
              <p className="text-white">{formatDate(profile.created_at)}</p>
            </div>
            <div>
              <p className="text-slate-400">Last Updated</p>
              <p className="text-white">{formatDate(profile.updated_at)}</p>
            </div>
          </div>
        </div>

        {canManage && profile.status !== 'cancelled' && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-800">
            {profile.status === 'active' && (
              <button
                onClick={handlePause}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>
            )}
            {profile.status === 'paused' && (
              <button
                onClick={handleResume}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                <Play className="w-4 h-4" />
                Resume
              </button>
            )}
            <button
              onClick={handleCancel}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Cancel Profile
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
