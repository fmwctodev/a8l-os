import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle, ChevronLeft, ChevronRight, Search, Filter, Eye, MessageSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getApprovalQueue, approveItem, rejectItem, getPendingApprovalCount } from '../../services/workflowApprovals';
import type { ApprovalQueueItem, ApprovalFilters } from '../../services/workflowApprovals';
import { useToast } from '../../contexts/ToastContext';

export default function AutomationApprovals() {
  const { user, organization } = useAuth();
  const { addToast } = useToast();
  const orgId = organization?.id || '';

  const [items, setItems] = useState<ApprovalQueueItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ApprovalFilters>({ status: ['pending'] });
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<ApprovalQueueItem | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  const perPage = 20;

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [queueResult, count] = await Promise.all([
        getApprovalQueue(orgId, { ...filters, search: search || undefined }, page, perPage),
        getPendingApprovalCount(orgId),
      ]);
      setItems(queueResult.data);
      setTotalCount(queueResult.count);
      setPendingCount(count);
    } catch {
      addToast('Failed to load approval queue', 'error');
    } finally {
      setLoading(false);
    }
  }, [orgId, filters, search, page, addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleApprove(id: string) {
    if (!user?.id) return;
    setProcessing(id);
    try {
      await approveItem(id, user.id, actionNote || undefined);
      addToast('Item approved and workflow resumed', 'success');
      setSelectedItem(null);
      setActionNote('');
      loadData();
    } catch {
      addToast('Failed to approve item', 'error');
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(id: string) {
    if (!user?.id) return;
    setProcessing(id);
    try {
      await rejectItem(id, user.id, actionNote || undefined);
      addToast('Item rejected and workflow stopped', 'success');
      setSelectedItem(null);
      setActionNote('');
      loadData();
    } catch {
      addToast('Failed to reject item', 'error');
    } finally {
      setProcessing(null);
    }
  }

  const totalPages = Math.ceil(totalCount / perPage);

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  };

  const statusTabs = [
    { key: 'pending', label: 'Pending', icon: Clock },
    { key: 'approved', label: 'Approved', icon: CheckCircle },
    { key: 'rejected', label: 'Rejected', icon: XCircle },
    { key: 'all', label: 'All', icon: Filter },
  ];

  function formatDraftContent(content: unknown): string {
    if (!content) return 'No content';
    if (typeof content === 'string') return content;
    if (typeof content === 'object') return JSON.stringify(content, null, 2);
    return String(content);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Approval Queue</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Review and approve workflow actions before they execute
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
              {pendingCount} pending approval{pendingCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {statusTabs.map((tab) => {
            const isActive = tab.key === 'all'
              ? !filters.status || filters.status.length === 0
              : filters.status?.length === 1 && filters.status[0] === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setFilters({ ...filters, status: tab.key === 'all' ? [] : [tab.key] })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by workflow or contact..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <CheckCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">All caught up</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">No items match the current filters</p>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">Workflow</th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">Contact</th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">Action</th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">Requested</th>
                  <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.workflow?.name || 'Unknown Workflow'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {item.contact
                          ? `${item.contact.first_name} ${item.contact.last_name}`
                          : 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        {(item.action_type || '').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[item.status] || ''}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(item.requested_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setSelectedItem(item); setActionNote(''); }}
                          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {item.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(item.id)}
                              disabled={processing === item.id}
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50"
                              title="Approve"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleReject(item.id)}
                              disabled={processing === item.id}
                              className="p-1.5 text-red-600 hover:text-red-700 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                              title="Reject"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Showing {(page - 1) * perPage + 1}--{Math.min(page * perPage, totalCount)} of {totalCount}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-700 dark:text-gray-300 px-2">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedItem(null)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Approval Details</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {selectedItem.workflow?.name} -- {(selectedItem.action_type || '').replace(/_/g, ' ')}
                </p>
              </div>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[selectedItem.status] || ''}`}>
                {selectedItem.status}
              </span>
            </div>

            <div className="px-6 py-4 overflow-y-auto max-h-[50vh] space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contact</label>
                  <p className="text-sm text-gray-900 dark:text-white mt-1">
                    {selectedItem.contact
                      ? `${selectedItem.contact.first_name} ${selectedItem.contact.last_name}`
                      : 'N/A'}
                  </p>
                  {selectedItem.contact?.email && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{selectedItem.contact.email}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Requested</label>
                  <p className="text-sm text-gray-900 dark:text-white mt-1">
                    {new Date(selectedItem.requested_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {selectedItem.draft_content && (
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Draft Content</label>
                  <pre className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap overflow-x-auto border border-gray-200 dark:border-gray-700">
                    {formatDraftContent(selectedItem.draft_content)}
                  </pre>
                </div>
              )}

              {selectedItem.resolved_at && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Resolved At</label>
                    <p className="text-sm text-gray-900 dark:text-white mt-1">
                      {new Date(selectedItem.resolved_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Resolved By</label>
                    <p className="text-sm text-gray-900 dark:text-white mt-1">
                      {selectedItem.resolved_by?.name || 'Unknown'}
                    </p>
                  </div>
                </div>
              )}

              {selectedItem.resolution_note && (
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Resolution Note</label>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{selectedItem.resolution_note}</p>
                </div>
              )}

              {selectedItem.status === 'pending' && (
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Note (optional)</label>
                  <div className="relative mt-1">
                    <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <textarea
                      value={actionNote}
                      onChange={(e) => setActionNote(e.target.value)}
                      placeholder="Add a note about your decision..."
                      rows={3}
                      className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
              {selectedItem.status === 'pending' && (
                <>
                  <button
                    onClick={() => handleReject(selectedItem.id)}
                    disabled={processing === selectedItem.id}
                    className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(selectedItem.id)}
                    disabled={processing === selectedItem.id}
                    className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    Approve & Resume
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
