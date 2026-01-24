import { useState, useEffect } from 'react';
import {
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Trash2,
  Copy,
  ChevronRight,
  X,
  Play,
  Pause,
  Flame,
  AlertTriangle,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getCampaignDomains,
  getCampaignDomainWithConfig,
  createCampaignDomain,
  deleteCampaignDomain,
  verifyCampaignDomainDNS,
  startWarmup,
  pauseWarmup,
  resumeWarmup,
  syncWarmupStats,
  getWarmupProgress,
  getAIRecommendations,
  getCampaignDomainEvents,
} from '../../../services/emailCampaignDomains';
import type {
  EmailCampaignDomain,
  EmailWarmupDailyStat,
  EmailWarmupAIRecommendation,
  EmailCampaignDomainEvent,
} from '../../../types';
import { WarmUpConfigForm } from './WarmUpConfigForm';
import { WarmUpProgressPanel } from './WarmUpProgressPanel';
import { AIRecommendationsPanel } from './AIRecommendationsPanel';
import { CampaignDomainEventLog } from './CampaignDomainEventLog';

export function CampaignDomainsTab() {
  const { user } = useAuth();
  const [domains, setDomains] = useState<EmailCampaignDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<EmailCampaignDomain | null>(null);
  const [selectedDomainStats, setSelectedDomainStats] = useState<EmailWarmupDailyStat[]>([]);
  const [selectedDomainRecommendations, setSelectedDomainRecommendations] = useState<EmailWarmupAIRecommendation[]>([]);
  const [selectedDomainEvents, setSelectedDomainEvents] = useState<EmailCampaignDomainEvent[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'progress' | 'config' | 'ai' | 'events'>('progress');

  useEffect(() => {
    loadDomains();
  }, [user?.organization_id]);

  const loadDomains = async () => {
    if (!user?.organization_id) return;
    try {
      const data = await getCampaignDomains(user.organization_id);
      setDomains(data);
    } catch (err) {
      console.error('Failed to load campaign domains:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDomainDetails = async (domain: EmailCampaignDomain) => {
    try {
      const [fullDomain, stats, recommendations, events] = await Promise.all([
        getCampaignDomainWithConfig(domain.id),
        getWarmupProgress(domain.id, 30),
        getAIRecommendations(domain.id),
        getCampaignDomainEvents(domain.id, 50),
      ]);
      if (fullDomain) {
        setSelectedDomain(fullDomain);
      }
      setSelectedDomainStats(stats);
      setSelectedDomainRecommendations(recommendations);
      setSelectedDomainEvents(events);
    } catch (err) {
      console.error('Failed to load domain details:', err);
    }
  };

  const handleSelectDomain = async (domain: EmailCampaignDomain) => {
    setSelectedDomain(domain);
    setActiveDetailTab('progress');
    await loadDomainDetails(domain);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      const result = await createCampaignDomain({
        domain: newDomain,
        friendly_label: newLabel || undefined,
      });
      if (result.success && result.domain) {
        setShowAddDrawer(false);
        setNewDomain('');
        setNewLabel('');
        await loadDomains();
        setSelectedDomain(result.domain);
      } else {
        setError(result.error || 'Failed to add domain');
      }
    } catch (err) {
      setError('Failed to add domain');
    } finally {
      setAdding(false);
    }
  };

  const handleVerify = async (domainId: string) => {
    setVerifying(domainId);
    setError(null);
    try {
      const result = await verifyCampaignDomainDNS(domainId);
      await loadDomains();
      if (selectedDomain?.id === domainId) {
        await loadDomainDetails(selectedDomain);
      }
    } catch (err) {
      setError('Failed to verify domain');
    } finally {
      setVerifying(null);
    }
  };

  const handleDelete = async (domainId: string) => {
    if (!confirm('Are you sure you want to delete this campaign domain?')) return;
    setDeleting(domainId);
    try {
      const result = await deleteCampaignDomain(domainId);
      if (result.success) {
        if (selectedDomain?.id === domainId) {
          setSelectedDomain(null);
        }
        await loadDomains();
      } else {
        setError(result.error || 'Failed to delete domain');
      }
    } catch (err) {
      setError('Failed to delete domain');
    } finally {
      setDeleting(null);
    }
  };

  const handleStartWarmup = async (domainId: string) => {
    setActionLoading('start');
    try {
      const result = await startWarmup(domainId);
      if (result.success) {
        await loadDomains();
        if (selectedDomain?.id === domainId) {
          await loadDomainDetails(selectedDomain);
        }
      } else {
        setError(result.error || 'Failed to start warm-up');
      }
    } catch (err) {
      setError('Failed to start warm-up');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePauseWarmup = async (domainId: string) => {
    setActionLoading('pause');
    try {
      const result = await pauseWarmup(domainId, 'User paused warm-up');
      if (result.success) {
        await loadDomains();
        if (selectedDomain?.id === domainId) {
          await loadDomainDetails(selectedDomain);
        }
      } else {
        setError(result.error || 'Failed to pause warm-up');
      }
    } catch (err) {
      setError('Failed to pause warm-up');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResumeWarmup = async (domainId: string) => {
    setActionLoading('resume');
    try {
      const result = await resumeWarmup(domainId);
      if (result.success) {
        await loadDomains();
        if (selectedDomain?.id === domainId) {
          await loadDomainDetails(selectedDomain);
        }
      } else {
        setError(result.error || 'Failed to resume warm-up');
      }
    } catch (err) {
      setError('Failed to resume warm-up');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncStats = async (domainId: string) => {
    setSyncing(domainId);
    try {
      const result = await syncWarmupStats(domainId);
      if (result.success) {
        await loadDomains();
        if (selectedDomain?.id === domainId) {
          await loadDomainDetails(selectedDomain);
        }
      } else {
        setError(result.error || 'Failed to sync stats');
      }
    } catch (err) {
      setError('Failed to sync stats');
    } finally {
      setSyncing(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusBadge = (status: EmailCampaignDomain['status']) => {
    switch (status) {
      case 'warmed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Warmed
          </span>
        );
      case 'warming_up':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Flame className="h-3 w-3 mr-1" />
            Warming Up
          </span>
        );
      case 'verified':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Verified
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <Pause className="h-3 w-3 mr-1" />
            Paused
          </span>
        );
      case 'degraded':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Degraded
          </span>
        );
      case 'pending_verification':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="h-3 w-3 mr-1" />
            Pending DNS
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <Clock className="h-3 w-3 mr-1" />
            Not Configured
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      <div className={`${selectedDomain ? 'w-1/2' : 'w-full'}`}>
        <div className="bg-slate-800 border border-slate-700 rounded-lg">
          <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-white">Campaign Domains</h3>
              <p className="text-sm text-slate-400 mt-1">
                Dedicated domains for marketing emails with warm-up tracking
              </p>
            </div>
            <button
              onClick={() => setShowAddDrawer(true)}
              className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-cyan-600 hover:bg-cyan-500"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Domain
            </button>
          </div>

          {error && (
            <div className="px-6 py-3 bg-red-500/10 border-b border-red-500/20">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div className="bg-cyan-500/5 border-b border-cyan-500/10 px-6 py-3">
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-cyan-400 mt-0.5" />
              <div>
                <p className="text-sm text-cyan-400 font-medium">Why use campaign domains?</p>
                <p className="text-xs text-slate-400 mt-1">
                  Separate your marketing emails from transactional messages to protect deliverability.
                  Use a subdomain like <code className="text-cyan-400">mail.yourdomain.com</code> for campaigns.
                </p>
              </div>
            </div>
          </div>

          {domains.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Flame className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No campaign domains configured</p>
              <p className="text-sm text-slate-500 mt-2">
                Add a domain to start warming up for marketing emails
              </p>
              <button
                onClick={() => setShowAddDrawer(true)}
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-cyan-600 hover:bg-cyan-500"
              >
                Add Your First Domain
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-700">
              {domains.map((domain) => (
                <li
                  key={domain.id}
                  onClick={() => handleSelectDomain(domain)}
                  className={`px-6 py-4 hover:bg-slate-700/50 cursor-pointer flex items-center justify-between ${
                    selectedDomain?.id === domain.id ? 'bg-slate-700/50' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-medium text-white truncate">{domain.domain}</p>
                      {getStatusBadge(domain.status)}
                      {selectedDomainRecommendations.length > 0 && selectedDomain?.id === domain.id && (
                        <span className="flex items-center text-xs text-amber-400">
                          <Sparkles className="h-3 w-3 mr-1" />
                          AI
                        </span>
                      )}
                    </div>
                    {domain.friendly_label && (
                      <p className="text-xs text-slate-500 mt-1">{domain.friendly_label}</p>
                    )}
                    {(domain.status === 'warming_up' || domain.status === 'warmed') && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                          <span>Warm-up Progress</span>
                          <span>{domain.warmup_progress_percent}%</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              domain.status === 'warmed' ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${domain.warmup_progress_percent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-500 ml-4" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {selectedDomain && (
        <div className="w-1/2">
          <div className="bg-slate-800 border border-slate-700 rounded-lg">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-white">{selectedDomain.domain}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {getStatusBadge(selectedDomain.status)}
                  {selectedDomain.current_daily_limit > 0 && (
                    <span className="text-xs text-slate-400">
                      {selectedDomain.current_daily_limit.toLocaleString()} / day
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedDomain(null)}
                className="text-slate-400 hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-slate-700">
              <nav className="flex gap-4 px-6">
                {(['progress', 'config', 'ai', 'events'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveDetailTab(tab)}
                    className={`py-3 border-b-2 text-sm font-medium transition-colors ${
                      activeDetailTab === tab
                        ? 'border-cyan-500 text-cyan-400'
                        : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab === 'progress' && 'Progress'}
                    {tab === 'config' && 'Settings'}
                    {tab === 'ai' && (
                      <span className="flex items-center gap-1">
                        AI
                        {selectedDomainRecommendations.length > 0 && (
                          <span className="bg-amber-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                            {selectedDomainRecommendations.length}
                          </span>
                        )}
                      </span>
                    )}
                    {tab === 'events' && 'History'}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6">
              {selectedDomain.status === 'pending_verification' && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-white mb-4">DNS Records</h4>
                  {selectedDomain.dns_records.length === 0 ? (
                    <p className="text-sm text-slate-400">No DNS records available</p>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-400">
                        Add these records to your DNS provider:
                      </p>
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead>
                            <tr className="text-left">
                              <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase">Type</th>
                              <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase">Host</th>
                              <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase">Value</th>
                              <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700">
                            {selectedDomain.dns_records.map((record, index) => (
                              <tr key={index}>
                                <td className="px-3 py-2 text-sm text-white">{record.type}</td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center">
                                    <span className="text-xs font-mono text-slate-300 truncate max-w-[120px]">
                                      {record.host}
                                    </span>
                                    <button
                                      onClick={() => copyToClipboard(record.host)}
                                      className="ml-2 text-slate-500 hover:text-slate-300"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </button>
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center">
                                    <span className="text-xs font-mono text-slate-300 truncate max-w-[120px]">
                                      {record.value}
                                    </span>
                                    <button
                                      onClick={() => copyToClipboard(record.value)}
                                      className="ml-2 text-slate-500 hover:text-slate-300"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </button>
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  {record.valid ? (
                                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-red-400" />
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeDetailTab === 'progress' && (
                <WarmUpProgressPanel
                  domain={selectedDomain}
                  stats={selectedDomainStats}
                  syncing={syncing === selectedDomain.id}
                  onSync={() => handleSyncStats(selectedDomain.id)}
                />
              )}

              {activeDetailTab === 'config' && (
                <WarmUpConfigForm
                  domainId={selectedDomain.id}
                  config={selectedDomain.warmup_config}
                  onSaved={() => loadDomainDetails(selectedDomain)}
                />
              )}

              {activeDetailTab === 'ai' && (
                <AIRecommendationsPanel
                  domainId={selectedDomain.id}
                  recommendations={selectedDomainRecommendations}
                  onUpdate={() => loadDomainDetails(selectedDomain)}
                />
              )}

              {activeDetailTab === 'events' && (
                <CampaignDomainEventLog events={selectedDomainEvents} />
              )}
            </div>

            <div className="px-6 py-4 bg-slate-700/30 rounded-b-lg flex justify-between">
              <div className="flex gap-2">
                {selectedDomain.status === 'verified' && (
                  <button
                    onClick={() => handleStartWarmup(selectedDomain.id)}
                    disabled={actionLoading === 'start'}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Start Warm-up
                  </button>
                )}
                {selectedDomain.status === 'warming_up' && (
                  <button
                    onClick={() => handlePauseWarmup(selectedDomain.id)}
                    disabled={actionLoading === 'pause'}
                    className="inline-flex items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md text-slate-200 bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
                  >
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </button>
                )}
                {selectedDomain.status === 'paused' && (
                  <button
                    onClick={() => handleResumeWarmup(selectedDomain.id)}
                    disabled={actionLoading === 'resume'}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </button>
                )}
                {selectedDomain.status === 'pending_verification' && (
                  <button
                    onClick={() => handleVerify(selectedDomain.id)}
                    disabled={verifying === selectedDomain.id}
                    className="inline-flex items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md text-slate-200 bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${verifying === selectedDomain.id ? 'animate-spin' : ''}`} />
                    Verify DNS
                  </button>
                )}
              </div>
              <button
                onClick={() => handleDelete(selectedDomain.id)}
                disabled={deleting === selectedDomain.id}
                className="inline-flex items-center px-4 py-2 border border-red-500/30 text-sm font-medium rounded-md text-red-400 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowAddDrawer(false)} />
          <div className="absolute inset-y-0 right-0 max-w-md w-full bg-slate-800 border-l border-slate-700 shadow-xl">
            <div className="flex flex-col h-full">
              <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                <h3 className="text-lg font-medium text-white">Add Campaign Domain</h3>
                <button
                  onClick={() => setShowAddDrawer(false)}
                  className="text-slate-400 hover:text-slate-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAdd} className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                    <div className="flex gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-amber-400 font-medium">Use a subdomain</p>
                        <p className="text-xs text-slate-400 mt-1">
                          We recommend using a subdomain like <code className="text-amber-400">mail.yourdomain.com</code>
                          to keep your main domain's reputation separate.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="domain" className="block text-sm font-medium text-slate-300">
                      Domain <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      id="domain"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      placeholder="mail.example.com"
                      required
                      className="mt-1 block w-full bg-slate-900 border-slate-600 rounded-md text-white placeholder-slate-500 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="label" className="block text-sm font-medium text-slate-300">
                      Friendly Label
                    </label>
                    <input
                      type="text"
                      id="label"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="e.g., Marketing Campaigns"
                      className="mt-1 block w-full bg-slate-900 border-slate-600 rounded-md text-white placeholder-slate-500 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Optional label to identify this domain
                    </p>
                  </div>
                </div>
              </form>

              <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddDrawer(false)}
                  className="px-4 py-2 border border-slate-600 rounded-md text-sm font-medium text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={handleAdd}
                  disabled={adding || !newDomain}
                  className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50"
                >
                  {adding ? 'Adding...' : 'Add Domain'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
