import { Star, Clock, AlertTriangle, MessageSquare } from 'lucide-react';
import type { ReputationReview } from '../../services/reputationReviews';

interface Props {
  review: ReputationReview;
  selected: boolean;
  onClick: () => void;
}

const platformLabels: Record<string, string> = {
  googlebusiness: 'Google',
  facebook: 'Facebook',
};

const platformColors: Record<string, string> = {
  googlebusiness: 'bg-red-50 text-red-700',
  facebook: 'bg-blue-50 text-blue-700',
};

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  normal: 'bg-gray-100 text-gray-600',
  low: 'bg-gray-50 text-gray-500',
};

function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-amber-500', 'bg-red-500',
    'bg-teal-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-rose-500',
  ];
  const index = (name || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ReviewListItem({ review, selected, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors hover:bg-gray-50 ${
        selected ? 'bg-blue-50 border-l-2 border-l-blue-600' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-full ${getAvatarColor(review.reviewer_name || '')} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}>
          {review.reviewer_profile_image ? (
            <img src={review.reviewer_profile_image} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            getInitials(review.reviewer_name)
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-sm font-medium text-gray-900 truncate">
              {review.reviewer_name || 'Anonymous'}
            </span>
            <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
              {timeAgo(review.review_created_at)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mb-1">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-3 h-3 ${s <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
                />
              ))}
            </div>
            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${platformColors[review.platform] || 'bg-gray-100 text-gray-600'}`}>
              {platformLabels[review.platform] || review.platform}
            </span>
          </div>
          {review.review_text && (
            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
              {review.review_text}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {review.has_reply && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-50 text-green-700 text-[10px] font-medium rounded">
                <MessageSquare className="w-2.5 h-2.5" />
                Replied
              </span>
            )}
            {review.sla_breached && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-50 text-red-700 text-[10px] font-medium rounded">
                <Clock className="w-2.5 h-2.5" />
                SLA
              </span>
            )}
            {review.escalated && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-medium rounded">
                <AlertTriangle className="w-2.5 h-2.5" />
                Escalated
              </span>
            )}
            {review.priority !== 'normal' && review.priority !== 'low' && (
              <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded capitalize ${priorityColors[review.priority]}`}>
                {review.priority}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
