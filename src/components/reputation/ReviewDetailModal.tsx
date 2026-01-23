import { useState } from 'react';
import { X, Star, Link as LinkIcon, ExternalLink, MessageSquare, Mail, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Review } from '../../types';

interface ReviewDetailModalProps {
  review: Review;
  onClose: () => void;
}

export function ReviewDetailModal({ review, onClose }: ReviewDetailModalProps) {
  const providerLabels = {
    google: 'Google',
    facebook: 'Facebook',
    internal: 'Internal Feedback',
  };

  const providerColors = {
    google: 'bg-red-100 text-red-700',
    facebook: 'bg-blue-100 text-blue-700',
    internal: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Review Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className="w-5 h-5"
                      fill={star <= review.rating ? '#FFA500' : 'none'}
                      stroke={star <= review.rating ? '#FFA500' : '#D1D5DB'}
                      strokeWidth={2}
                    />
                  ))}
                </div>
                <span className="text-2xl font-bold text-gray-900">
                  {review.rating}.0
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    providerColors[review.provider]
                  }`}
                >
                  {providerLabels[review.provider]}
                </span>
                {!review.published && (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-700">
                    Private
                  </span>
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Reviewer</h3>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="font-medium text-gray-900">{review.reviewer_name}</div>
              {review.reviewer_email && (
                <div className="text-sm text-gray-600 mt-1">{review.reviewer_email}</div>
              )}
            </div>
          </div>

          {review.contact && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Linked Contact</h3>
              <Link
                to={`/contacts/${review.contact.id}`}
                className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between hover:bg-blue-100 transition-colors"
              >
                <div>
                  <div className="font-medium text-gray-900">
                    {review.contact.first_name} {review.contact.last_name}
                  </div>
                  <div className="text-sm text-gray-600">
                    {review.contact.email} {review.contact.phone && `• ${review.contact.phone}`}
                  </div>
                </div>
                <ExternalLink className="w-5 h-5 text-blue-600" />
              </Link>
            </div>
          )}

          {review.comment && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Comment</h3>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-gray-700 whitespace-pre-wrap">{review.comment}</p>
              </div>
            </div>
          )}

          {review.review_request && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Review Request</h3>
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  {review.review_request.channel === 'sms' ? (
                    <MessageSquare className="w-4 h-4" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                  <span className="capitalize">{review.review_request.channel}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <LinkIcon className="w-4 h-4" />
                  <a
                    href={`/r/${review.review_request.public_slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View review page
                  </a>
                </div>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Received</h3>
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-4 h-4" />
              <span>{new Date(review.received_at).toLocaleString()}</span>
            </div>
          </div>

          {review.provider_review_id && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">External Review ID</h3>
              <div className="p-3 bg-gray-50 rounded-lg font-mono text-sm text-gray-700">
                {review.provider_review_id}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
