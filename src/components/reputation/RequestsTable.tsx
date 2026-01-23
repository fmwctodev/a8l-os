import { MessageSquare, Mail, Star, ExternalLink, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ReviewRequest } from '../../types';

interface RequestsTableProps {
  requests: ReviewRequest[];
  onResend?: (requestId: string) => void;
}

export function RequestsTable({ requests, onResend }: RequestsTableProps) {
  function getStatus(request: ReviewRequest): { label: string; color: string } {
    if (request.completed_at) {
      return { label: 'Completed', color: 'bg-green-100 text-green-700' };
    }
    if (request.clicked_at) {
      return { label: 'Clicked', color: 'bg-blue-100 text-blue-700' };
    }
    if (request.sent_at) {
      return { label: 'Sent', color: 'bg-gray-100 text-gray-700' };
    }
    return { label: 'Pending', color: 'bg-amber-100 text-amber-700' };
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-500">No review requests found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Contact
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Channel
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Sent At
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Rating
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {requests.map((request) => {
            const status = getStatus(request);

            return (
              <tr key={request.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  {request.contact ? (
                    <Link
                      to={`/contacts/${request.contact.id}`}
                      className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1"
                    >
                      {request.contact.first_name} {request.contact.last_name}
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  ) : (
                    <span className="text-sm text-gray-400">Unknown</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2 text-sm text-gray-900">
                    {request.channel === 'sms' ? (
                      <MessageSquare className="w-4 h-4 text-gray-400" />
                    ) : (
                      <Mail className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="capitalize">{request.channel}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {request.sent_at
                    ? new Date(request.sent_at).toLocaleString()
                    : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}
                  >
                    {status.label}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {request.rating ? (
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className="w-3 h-3"
                          fill={star <= request.rating! ? '#FFA500' : 'none'}
                          stroke={star <= request.rating! ? '#FFA500' : '#D1D5DB'}
                          strokeWidth={2}
                        />
                      ))}
                      <span className="ml-1 text-sm font-medium text-gray-900">
                        {request.rating}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {onResend && request.sent_at && !request.completed_at && (
                    <button
                      onClick={() => onResend(request.id)}
                      className="text-blue-600 hover:text-blue-900 flex items-center gap-1 ml-auto"
                      title="Resend request"
                    >
                      <RotateCcw className="w-4 h-4" />
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
  );
}
