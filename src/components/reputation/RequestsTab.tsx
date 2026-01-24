import { useState, useEffect } from 'react';
import { Mail, Phone, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { ReviewRequest, ReviewRequestFilters } from '../../types';
import { getReviewRequests, resendRequest } from '../../services/reviewRequests';

interface RequestsTabProps {
  onRequestReview: () => void;
  onConfigureLink: () => void;
}

export function RequestsTab({ onRequestReview, onConfigureLink }: RequestsTabProps) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const pageSize = 10;

  useEffect(() => {
    loadRequests();
  }, [user?.organization_id, page]);

  async function loadRequests() {
    if (!user?.organization_id) return;
    try {
      setLoading(true);
      const { data, count } = await getReviewRequests(user.organization_id, {}, page, pageSize);
      setRequests(data);
      setTotalCount(count);
    } catch (error) {
      console.error('Failed to load requests:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend(requestId: string) {
    if (!user?.id) return;
    try {
      await resendRequest(requestId, user.id);
      loadRequests();
    } catch (error) {
      console.error('Failed to resend request:', error);
    }
  }

  function getStatus(request: ReviewRequest): { label: string; color: string } {
    if (request.status === 'failed') {
      return { label: 'Failed', color: 'bg-red-100 text-red-700' };
    }
    if (request.completed_at) {
      return { label: 'Completed', color: 'bg-green-100 text-green-700' };
    }
    if (request.clicked_at) {
      return { label: 'Clicked', color: 'bg-amber-100 text-amber-700' };
    }
    if (request.sent_at) {
      return { label: 'Sent', color: 'bg-blue-100 text-blue-700' };
    }
    return { label: 'Pending', color: 'bg-gray-100 text-gray-700' };
  }

  function toggleSelect(id: string) {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  }

  function toggleSelectAll() {
    if (selectedIds.size === requests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(requests.map(r => r.id)));
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize);

  function getInitials(firstName?: string, lastName?: string): string {
    const first = firstName?.[0] || '';
    const last = lastName?.[0] || '';
    return (first + last).toUpperCase() || '?';
  }

  function getAvatarColor(name: string): string {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-amber-500',
      'bg-red-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-cyan-500',
      'bg-emerald-500',
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Requests</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={onConfigureLink}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Configure Review Link
          </button>
          <button
            onClick={onRequestReview}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Send Review Request
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No review requests yet</p>
            <button
              onClick={onRequestReview}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Send Your First Request
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === requests.length && requests.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invite Sent To
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email / Phone Number
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sent By
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sent Via
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date Sent
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Retries
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {requests.map((request) => {
                    const status = getStatus(request);
                    const contact = request.contact;
                    const fullName = contact
                      ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
                      : 'Unknown';

                    return (
                      <tr key={request.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(request.id)}
                            onChange={() => toggleSelect(request.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full ${getAvatarColor(fullName)} flex items-center justify-center text-white text-sm font-medium`}>
                              {getInitials(contact?.first_name, contact?.last_name)}
                            </div>
                            <span className="text-sm font-medium text-gray-900">{fullName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {contact?.email || contact?.phone || '--'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-blue-600 font-medium capitalize">
                            {request.sent_by_source || 'Manual'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {request.channel === 'email' ? (
                              <>
                                <Mail className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-600">Email</span>
                              </>
                            ) : (
                              <>
                                <Phone className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-600">Phone</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {request.sent_at
                            ? new Date(request.sent_at).toLocaleDateString('en-US', {
                                month: '2-digit',
                                day: '2-digit',
                                year: 'numeric',
                              })
                            : '--'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {request.retry_count || 0}
                        </td>
                        <td className="px-4 py-3">
                          {status.label === 'Failed' && (
                            <button
                              onClick={() => handleResend(request.id)}
                              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                            >
                              Resend
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <div className="text-sm text-gray-500">
                  Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 text-sm rounded ${
                          page === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
