import { Star, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Review } from '../../types';

interface ReviewsTableProps {
  reviews: Review[];
  onReviewClick: (review: Review) => void;
}

export function ReviewsTable({ reviews, onReviewClick }: ReviewsTableProps) {
  const providerLabels = {
    google: 'Google',
    facebook: 'Facebook',
    internal: 'Internal',
  };

  const providerColors = {
    google: 'bg-red-100 text-red-700',
    facebook: 'bg-blue-100 text-blue-700',
    internal: 'bg-gray-100 text-gray-700',
  };

  if (reviews.length === 0) {
    return (
      <div className="text-center py-12">
        <Star className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-500">No reviews found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Rating
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Provider
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Reviewer
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Contact
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Comment
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {reviews.map((review) => (
            <tr
              key={review.id}
              onClick={() => onReviewClick(review)}
              className="hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {new Date(review.received_at).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className="w-4 h-4"
                      fill={star <= review.rating ? '#FFA500' : 'none'}
                      stroke={star <= review.rating ? '#FFA500' : '#D1D5DB'}
                      strokeWidth={2}
                    />
                  ))}
                  <span className="ml-2 text-sm font-medium text-gray-900">
                    {review.rating}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    providerColors[review.provider]
                  }`}
                >
                  {providerLabels[review.provider]}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {review.reviewer_name}
                </div>
                {review.reviewer_email && (
                  <div className="text-xs text-gray-500">{review.reviewer_email}</div>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {review.contact ? (
                  <Link
                    to={`/contacts/${review.contact.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                  >
                    {review.contact.first_name} {review.contact.last_name}
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                ) : (
                  <span className="text-sm text-gray-400">Not linked</span>
                )}
              </td>
              <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                <div className="truncate">
                  {review.comment || (
                    <span className="text-gray-400 italic">No comment</span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {review.published ? (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    Published
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                    Private
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
