import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getProposals, getProposalStats, deleteProposal, sendProposal, updateProposal } from '../../services/proposals';
import type { Proposal, ProposalStats, ProposalStatus } from '../../types';
import {
  FileText,
  FileDown,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Send,
  Eye,
  Trash2,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  DollarSign,
  Calendar,
  User,
  Sparkles,
  ChevronDown,
  ExternalLink,
  Copy,
  PenTool,
  Ban,
} from 'lucide-react';
import { CreateProposalModal } from '../../components/proposals/CreateProposalModal';
import { exportProposalToPDF } from '../../services/proposalPdfExport';
import { getBrandKits } from '../../services/brandboard';
import { extractValueFromSections } from '../../utils/extractProposalValue';

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: typeof Clock; label: string }> = {
  draft: { bg: 'bg-slate-500/20', text: 'text-slate-300', icon: Clock, label: 'Draft' },
  sent: { bg: 'bg-cyan-500/20', text: 'text-cyan-300', icon: Send, label: 'Sent' },
  viewed: { bg: 'bg-amber-500/20', text: 'text-amber-300', icon: Eye, label: 'Viewed' },
  accepted: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', icon: CheckCircle2, label: 'Accepted' },
  rejected: { bg: 'bg-red-500/20', text: 'text-red-300', icon: XCircle, label: 'Rejected' },
  expired: { bg: 'bg-slate-700/50', text: 'text-slate-500', icon: AlertCircle, label: 'Expired' },
};

const SIGNATURE_STATUS_STYLES: Record<string, { bg: string; text: string; icon: typeof PenTool; label: string }> = {
  pending_signature: { bg: 'bg-amber-500/20', text: 'text-amber-300', icon: PenTool, label: 'Awaiting Signature' },
  viewed: { bg: 'bg-cyan-500/20', text: 'text-cyan-300', icon: Eye, label: 'Viewed by Signer' },
  signed: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', icon: PenTool, label: 'Signed' },
  declined: { bg: 'bg-red-500/20', text: 'text-red-300', icon: Ban, label: 'Declined' },
  voided: { bg: 'bg-slate-500/20', text: 'text-slate-400', icon: Ban, label: 'Voided' },
};

export function Proposals() {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [stats, setStats] = useState<ProposalStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 25;

  const canView = hasPermission('proposals.view');
  const canCreate = hasPermission('proposals.create');
  const canEdit = hasPermission('proposals.edit');
  const canSend = hasPermission('proposals.send');
  const canDelete = hasPermission('proposals.delete');

  useEffect(() => {
    if (canView) {
      loadData();
    }
  }, [user, canView, page, statusFilter, searchQuery]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const filters: { status?: ProposalStatus[]; search?: string } = {};

      if (statusFilter !== 'all') {
        filters.status = [statusFilter];
      }
      if (searchQuery) {
        filters.search = searchQuery;
      }

      const [proposalData, statsData] = await Promise.all([
        getProposals(filters, page, pageSize),
        getProposalStats(),
      ]);

      setProposals(proposalData.data);
      setTotalCount(proposalData.total);
      setStats(statsData);

      const needsBackfill = proposalData.data.filter(p => !p.total_value || p.total_value === 0);
      if (needsBackfill.length > 0) {
        (async () => {
          let didUpdate = false;
          for (const p of needsBackfill) {
            const extracted = extractValueFromSections(p.sections, p.currency);
            if (extracted && extracted.value > 0) {
              try {
                await updateProposal(p.id, { total_value: extracted.value, currency: extracted.currency });
                didUpdate = true;
              } catch {}
            }
          }
          if (didUpdate) {
            const refreshed = await getProposalStats();
            setStats(refreshed);
          }
        })();
      }
    } catch (err) {
      console.error('Failed to load proposals:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendProposal = async (proposal: Proposal) => {
    if (!user) return;
    try {
      await sendProposal(proposal.id, user.id);
      loadData();
    } catch (err) {
      console.error('Failed to send proposal:', err);
    }
    setActionMenuId(null);
  };

  const handleDeleteProposal = async (proposal: Proposal) => {
    if (!confirm('Are you sure you want to delete this proposal?')) return;
    try {
      await deleteProposal(proposal.id);
      loadData();
    } catch (err) {
      console.error('Failed to delete proposal:', err);
    }
    setActionMenuId(null);
  };

  const copyPublicLink = (token: string) => {
    const url = `${window.location.origin}/p/${token}`;
    navigator.clipboard.writeText(url);
  };

  const handleExportPDF = async (proposal: Proposal) => {
    try {
      setExportingId(proposal.id);
      setActionMenuId(null);
      let brandKit = null;
      try {
        const kits = await getBrandKits(proposal.org_id, { active: true });
        if (kits.length > 0) brandKit = kits[0];
      } catch {}
      await exportProposalToPDF(proposal, brandKit);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('Failed to open print window. Please allow popups for this site.');
    } finally {
      setExportingId(null);
    }
  };

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const getContactName = (proposal: Proposal) => {
    if (!proposal.contact) return 'Unknown';
    return proposal.contact.company || `${proposal.contact.first_name} ${proposal.contact.last_name}`;
  };

  const getProposalDisplayValue = (proposal: Proposal): { value: number; isRange: boolean; minValue: number } => {
    const items = proposal.line_items || [];
    if (items.length > 0) {
      let totalMin = 0;
      let totalMax = 0;
      let hasRange = false;
      for (const item of items) {
        const effectiveMin = item.unit_price;
        const effectiveMax = item.unit_price_max != null && item.unit_price_max > item.unit_price ? item.unit_price_max : item.unit_price;
        if (effectiveMax > effectiveMin) hasRange = true;
        const discount = item.discount_percent / 100;
        totalMin += item.quantity * effectiveMin * (1 - discount);
        totalMax += item.quantity * effectiveMax * (1 - discount);
      }
      return { value: totalMax, isRange: hasRange, minValue: totalMin };
    }

    if (proposal.total_value > 0) {
      return { value: proposal.total_value, isRange: false, minValue: proposal.total_value };
    }

    const extracted = extractValueFromSections(proposal.sections, proposal.currency);
    if (extracted && extracted.value > 0) {
      return { value: extracted.value, isRange: false, minValue: extracted.value };
    }

    return { value: 0, isRange: false, minValue: 0 };
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400">You don't have permission to view proposals.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
              <FileText className="w-7 h-7 text-cyan-400" />
              Proposals
            </h1>
            <p className="text-slate-400 mt-1">Create and manage client proposals with AI-powered generation</p>
          </div>
          {canCreate && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Proposal
            </button>
          )}
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
              <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                <FileText className="w-4 h-4" />
                Total
              </div>
              <p className="text-2xl font-semibold text-white">{stats.totalProposals}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
              <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                <Clock className="w-4 h-4" />
                Drafts
              </div>
              <p className="text-2xl font-semibold text-slate-300">{stats.draftCount}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
              <div className="flex items-center gap-2 text-cyan-400 text-sm mb-1">
                <Send className="w-4 h-4" />
                Sent
              </div>
              <p className="text-2xl font-semibold text-cyan-300">{stats.sentCount}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
              <div className="flex items-center gap-2 text-emerald-400 text-sm mb-1">
                <CheckCircle2 className="w-4 h-4" />
                Accepted
              </div>
              <p className="text-2xl font-semibold text-emerald-300">{stats.acceptedCount}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
              <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                <DollarSign className="w-4 h-4" />
                Total Value
              </div>
              <p className="text-2xl font-semibold text-white">{formatCurrency(stats.totalValue)}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
              <div className="flex items-center gap-2 text-emerald-400 text-sm mb-1">
                <Sparkles className="w-4 h-4" />
                Win Rate
              </div>
              <p className="text-2xl font-semibold text-emerald-300">{stats.conversionRate.toFixed(1)}%</p>
            </div>
            {(stats as Record<string, unknown>).signedCount !== undefined && (
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                <div className="flex items-center gap-2 text-teal-400 text-sm mb-1">
                  <PenTool className="w-4 h-4" />
                  Signed
                </div>
                <p className="text-2xl font-semibold text-teal-300">{String((stats as Record<string, unknown>).signedCount)}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-6 py-4 flex items-center gap-4 border-b border-slate-700/50">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search proposals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          />
        </div>

        <div className="relative">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors">
            <Filter className="w-4 h-4" />
            Status
            <ChevronDown className="w-4 h-4" />
          </button>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ProposalStatus | 'all')}
            className="absolute inset-0 opacity-0 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="viewed">Viewed</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        ) : proposals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <FileText className="w-12 h-12 mb-4 opacity-50" />
            <p>No proposals found</p>
            {canCreate && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 text-cyan-400 hover:text-cyan-300 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create your first proposal
              </button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-800/95 sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Proposal
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Client
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Value
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Valid Until
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Created
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {proposals.map((proposal) => {
                const statusStyle = STATUS_STYLES[proposal.status];
                const StatusIcon = statusStyle.icon;

                return (
                  <tr
                    key={proposal.id}
                    onClick={() => navigate(`/proposals/${proposal.id}`)}
                    className="hover:bg-slate-800/30 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{proposal.title}</p>
                          {proposal.ai_context?.generated_at && (
                            <span className="inline-flex items-center gap-1 text-xs text-cyan-400">
                              <Sparkles className="w-3 h-3" />
                              AI Generated
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-300">{getContactName(proposal)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {!(proposal.signature_status && SIGNATURE_STATUS_STYLES[proposal.signature_status]) && (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusStyle.label}
                          </span>
                        )}
                        {proposal.signature_status && SIGNATURE_STATUS_STYLES[proposal.signature_status] && (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${SIGNATURE_STATUS_STYLES[proposal.signature_status].bg} ${SIGNATURE_STATUS_STYLES[proposal.signature_status].text}`}>
                            {(() => { const SigIcon = SIGNATURE_STATUS_STYLES[proposal.signature_status!].icon; return <SigIcon className="w-3 h-3" />; })()}
                            {SIGNATURE_STATUS_STYLES[proposal.signature_status].label}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const { value, isRange, minValue } = getProposalDisplayValue(proposal);
                        return isRange ? (
                          <span className="text-white font-medium">
                            {formatCurrency(minValue, proposal.currency)}
                            <span className="text-slate-500 mx-1">–</span>
                            {formatCurrency(value, proposal.currency)}
                          </span>
                        ) : (
                          <span className="text-white font-medium">
                            {formatCurrency(value, proposal.currency)}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-300">{formatDate(proposal.valid_until)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-400 text-sm">
                        <Calendar className="w-4 h-4" />
                        {formatDate(proposal.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="relative">
                        <button
                          onClick={() => setActionMenuId(actionMenuId === proposal.id ? null : proposal.id)}
                          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-4 h-4 text-slate-400" />
                        </button>

                        {actionMenuId === proposal.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
                            <button
                              onClick={() => navigate(`/proposals/${proposal.id}`)}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                              View Details
                            </button>
                            <button
                              onClick={() => handleExportPDF(proposal)}
                              disabled={exportingId === proposal.id}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50"
                            >
                              {exportingId === proposal.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <FileDown className="w-4 h-4" />
                              )}
                              Export PDF
                            </button>
                            {canSend && proposal.status === 'draft' && (
                              <button
                                onClick={() => handleSendProposal(proposal)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                              >
                                <Send className="w-4 h-4" />
                                Send Proposal
                              </button>
                            )}
                            {proposal.status !== 'draft' && (
                              <button
                                onClick={() => copyPublicLink(proposal.public_token)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                              >
                                <Copy className="w-4 h-4" />
                                Copy Link
                              </button>
                            )}
                            {proposal.status !== 'draft' && (
                              <a
                                href={`/p/${proposal.public_token}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                              >
                                <ExternalLink className="w-4 h-4" />
                                Open Public View
                              </a>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDeleteProposal(proposal)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-slate-700/50 flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} proposals
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-slate-400 text-sm">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showCreateModal && (
        <CreateProposalModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}
