import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  getContracts,
  getContractStats,
  deleteContract,
  archiveContract,
  unarchiveContract,
} from '../../services/contracts';
import type { Contract, ContractStatus, ContractSignatureStatus } from '../../types';
import type { ContractStats, ContractListFilters } from '../../services/contracts';
import { Ligature as FileSignature, Plus, Search, Filter, MoreVertical, Eye, Trash2, Loader2, CheckCircle2, Clock, XCircle, DollarSign, Calendar, User, ChevronDown, ExternalLink, Copy, PenTool, Ban, Send, Archive, ArchiveRestore, FileText } from 'lucide-react';

const STATUS_STYLES: Record<ContractStatus, { bg: string; text: string; icon: typeof Clock; label: string }> = {
  draft: { bg: 'bg-slate-500/20', text: 'text-slate-300', icon: Clock, label: 'Draft' },
  sent: { bg: 'bg-cyan-500/20', text: 'text-cyan-300', icon: Send, label: 'Sent' },
  viewed: { bg: 'bg-amber-500/20', text: 'text-amber-300', icon: Eye, label: 'Viewed' },
  signed: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', icon: CheckCircle2, label: 'Signed' },
  declined: { bg: 'bg-red-500/20', text: 'text-red-300', icon: XCircle, label: 'Declined' },
  expired: { bg: 'bg-slate-700/50', text: 'text-slate-500', icon: Clock, label: 'Expired' },
  voided: { bg: 'bg-slate-600/30', text: 'text-slate-400', icon: Ban, label: 'Voided' },
};

const SIGNATURE_STYLES: Record<string, { bg: string; text: string; icon: typeof PenTool; label: string }> = {
  pending_signature: { bg: 'bg-amber-500/20', text: 'text-amber-300', icon: PenTool, label: 'Awaiting Signature' },
  viewed: { bg: 'bg-cyan-500/20', text: 'text-cyan-300', icon: Eye, label: 'Viewed by Signer' },
  signed: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', icon: PenTool, label: 'Signed' },
  declined: { bg: 'bg-red-500/20', text: 'text-red-300', icon: Ban, label: 'Declined' },
  voided: { bg: 'bg-slate-500/20', text: 'text-slate-400', icon: Ban, label: 'Voided' },
};

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  freelance_service: 'Freelance Service',
  retainer: 'Retainer',
  partnership: 'Partnership',
  nda: 'NDA',
};

export function Contracts() {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [stats, setStats] = useState<ContractStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'all'>('all');
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 25;

  const canView = hasPermission('contracts.view');
  const canDelete = hasPermission('contracts.delete');

  useEffect(() => {
    if (canView) loadData();
  }, [user, canView, page, statusFilter, searchQuery]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const filters: ContractListFilters = {};
      if (statusFilter !== 'all') filters.status = [statusFilter];
      if (searchQuery) filters.search = searchQuery;

      const [listResult, statsData] = await Promise.all([
        getContracts(filters, page, pageSize),
        getContractStats(),
      ]);

      setContracts(listResult.data);
      setTotalCount(listResult.total);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load contracts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (contract: Contract) => {
    if (!confirm('Are you sure you want to delete this contract? This cannot be undone.')) return;
    try {
      await deleteContract(contract.id);
      loadData();
    } catch (err) {
      console.error('Failed to delete contract:', err);
    }
    setActionMenuId(null);
  };

  const handleArchive = async (contract: Contract) => {
    try {
      if (contract.archived_at) {
        await unarchiveContract(contract.id);
      } else {
        await archiveContract(contract.id);
      }
      loadData();
    } catch (err) {
      console.error('Failed to archive/unarchive contract:', err);
    }
    setActionMenuId(null);
  };

  const copyPublicLink = (token: string | null) => {
    if (!token) return;
    const url = `${window.location.origin}/c/${token}`;
    navigator.clipboard.writeText(url);
  };

  const formatCurrency = (amount: number, currency = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const getContactName = (contract: Contract) => {
    if (contract.party_b_name) return contract.party_b_name;
    const c = contract.contact as { first_name?: string; last_name?: string; company?: string } | null;
    if (!c) return 'Unknown';
    return c.company || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown';
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400">You don't have permission to view contracts.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
              <FileSignature className="w-7 h-7 text-cyan-400" />
              Contracts
            </h1>
            <p className="text-slate-400 mt-1">Manage contracts created from proposals</p>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
              <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                <FileText className="w-4 h-4" />
                Total
              </div>
              <p className="text-2xl font-semibold text-white">{stats.total}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
              <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                <Clock className="w-4 h-4" />
                Drafts
              </div>
              <p className="text-2xl font-semibold text-slate-300">{stats.draft}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
              <div className="flex items-center gap-2 text-cyan-400 text-sm mb-1">
                <Send className="w-4 h-4" />
                Sent
              </div>
              <p className="text-2xl font-semibold text-cyan-300">{stats.sent}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
              <div className="flex items-center gap-2 text-emerald-400 text-sm mb-1">
                <CheckCircle2 className="w-4 h-4" />
                Signed
              </div>
              <p className="text-2xl font-semibold text-emerald-300">{stats.signed}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
              <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                <DollarSign className="w-4 h-4" />
                Total Value
              </div>
              <p className="text-2xl font-semibold text-white">{formatCurrency(stats.totalValue)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="px-6 py-4 flex items-center gap-4 border-b border-slate-700/50">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search contracts..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
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
            onChange={(e) => { setStatusFilter(e.target.value as ContractStatus | 'all'); setPage(1); }}
            className="absolute inset-0 opacity-0 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="viewed">Viewed</option>
            <option value="signed">Signed</option>
            <option value="declined">Declined</option>
            <option value="expired">Expired</option>
            <option value="voided">Voided</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        ) : contracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <FileSignature className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium text-slate-300 mb-1">No contracts found</p>
            <p className="text-sm">Contracts are created by converting proposals</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-800/95 sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Contract</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Client</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Type</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Value</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Effective</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Created</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {contracts.map((contract) => {
                const statusStyle = STATUS_STYLES[contract.status];
                const StatusIcon = statusStyle.icon;
                const sigStatus = contract.signature_status as ContractSignatureStatus;
                const sigStyle = sigStatus && sigStatus !== 'not_sent' ? SIGNATURE_STYLES[sigStatus] : null;

                return (
                  <tr
                    key={contract.id}
                    onClick={() => navigate(`/contracts/${contract.id}`)}
                    className="hover:bg-slate-800/30 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                          <FileSignature className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate">{contract.title}</p>
                          {contract.source_proposal && (
                            <span className="text-xs text-slate-500 truncate block">
                              From: {(contract.source_proposal as { title?: string }).title}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="text-slate-300 truncate">{getContactName(contract)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-300 text-sm">
                        {CONTRACT_TYPE_LABELS[contract.contract_type] || contract.contract_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {!sigStyle && (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusStyle.label}
                          </span>
                        )}
                        {sigStyle && (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sigStyle.bg} ${sigStyle.text}`}>
                            {(() => { const SigIcon = sigStyle.icon; return <SigIcon className="w-3 h-3" />; })()}
                            {sigStyle.label}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-white font-medium">
                        {formatCurrency(contract.total_value, contract.currency)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-300">{formatDate(contract.effective_date)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-400 text-sm">
                        <Calendar className="w-4 h-4" />
                        {formatDate(contract.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="relative">
                        <button
                          onClick={() => setActionMenuId(actionMenuId === contract.id ? null : contract.id)}
                          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-4 h-4 text-slate-400" />
                        </button>

                        {actionMenuId === contract.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
                            <button
                              onClick={() => navigate(`/contracts/${contract.id}`)}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors rounded-t-lg"
                            >
                              <Eye className="w-4 h-4" />
                              View Details
                            </button>
                            {contract.public_token && (
                              <>
                                <button
                                  onClick={() => copyPublicLink(contract.public_token)}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                                >
                                  <Copy className="w-4 h-4" />
                                  Copy Link
                                </button>
                                <a
                                  href={`/c/${contract.public_token}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                  Public View
                                </a>
                              </>
                            )}
                            <button
                              onClick={() => handleArchive(contract)}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                            >
                              {contract.archived_at ? (
                                <>
                                  <ArchiveRestore className="w-4 h-4" />
                                  Unarchive
                                </>
                              ) : (
                                <>
                                  <Archive className="w-4 h-4" />
                                  Archive
                                </>
                              )}
                            </button>
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(contract)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors rounded-b-lg"
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
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} contracts
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
    </div>
  );
}
