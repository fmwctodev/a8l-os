import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  List,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  MapPin,
  Music2,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  Loader2,
  X,
  GripVertical,
  Eye,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getSocialAccounts, getProviderColor } from '../../services/socialAccounts';
import {
  getCalendarPosts,
  schedulePost,
  getSocialPostById,
} from '../../services/socialPosts';
import type { SocialAccount, SocialPost, SocialProvider } from '../../types';

const PROVIDER_ICONS: Record<SocialProvider, React.ElementType> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  google_business: MapPin,
  tiktok: Music2,
  youtube: Youtube,
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function SocialCalendar() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);

  const [draggedPost, setDraggedPost] = useState<SocialPost | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);
  const [rescheduleModalPost, setRescheduleModalPost] = useState<SocialPost | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  const [previewPost, setPreviewPost] = useState<SocialPost | null>(null);

  useEffect(() => {
    loadData();
  }, [user?.organization_id, currentDate, viewMode]);

  async function loadData() {
    if (!user?.organization_id) return;

    try {
      setLoading(true);
      const accountsData = await getSocialAccounts(user.organization_id);
      setAccounts(accountsData.filter(a => a.status === 'connected'));

      const { start, end } = getDateRange();
      const postsData = await getCalendarPosts(user.organization_id, start, end);
      setPosts(postsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  function getDateRange(): { start: string; end: string } {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (viewMode === 'month') {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      firstDay.setDate(firstDay.getDate() - firstDay.getDay());
      lastDay.setDate(lastDay.getDate() + (6 - lastDay.getDay()));
      return {
        start: firstDay.toISOString(),
        end: lastDay.toISOString(),
      };
    } else {
      const day = currentDate.getDay();
      const start = new Date(currentDate);
      start.setDate(start.getDate() - day);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return {
        start: start.toISOString(),
        end: end.toISOString(),
      };
    }
  }

  function navigatePrev() {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setDate(newDate.getDate() - 7);
    }
    setCurrentDate(newDate);
  }

  function navigateNext() {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setDate(newDate.getDate() + 7);
    }
    setCurrentDate(newDate);
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  function getCalendarDays(): Date[] {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (viewMode === 'month') {
      const firstDayOfMonth = new Date(year, month, 1);
      const lastDayOfMonth = new Date(year, month + 1, 0);
      const startDate = new Date(firstDayOfMonth);
      startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay());

      const days: Date[] = [];
      const current = new Date(startDate);

      while (current <= lastDayOfMonth || current.getDay() !== 0) {
        days.push(new Date(current));
        current.setDate(current.getDate() + 1);
        if (days.length >= 42) break;
      }

      return days;
    } else {
      const day = currentDate.getDay();
      const start = new Date(currentDate);
      start.setDate(start.getDate() - day);

      const days: Date[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        days.push(d);
      }
      return days;
    }
  }

  function getPostsForDate(date: Date): SocialPost[] {
    const dateStr = date.toISOString().split('T')[0];
    return posts.filter(post => {
      if (!post.scheduled_at_utc) return false;
      const postDate = new Date(post.scheduled_at_utc).toISOString().split('T')[0];
      return postDate === dateStr;
    });
  }

  function formatDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  function handleDragStart(e: React.DragEvent, post: SocialPost) {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedPost(post);
  }

  function handleDragOver(e: React.DragEvent, date: Date) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetDate(formatDateKey(date));
  }

  function handleDragLeave() {
    setDropTargetDate(null);
  }

  async function handleDrop(e: React.DragEvent, date: Date) {
    e.preventDefault();
    setDropTargetDate(null);

    if (!draggedPost) return;

    const originalDate = draggedPost.scheduled_at_utc
      ? new Date(draggedPost.scheduled_at_utc)
      : new Date();
    const newDate = new Date(date);
    newDate.setHours(originalDate.getHours(), originalDate.getMinutes(), 0, 0);

    try {
      await schedulePost(
        draggedPost.id,
        newDate.toISOString(),
        draggedPost.scheduled_timezone || 'UTC'
      );
      loadData();
    } catch (error) {
      console.error('Failed to reschedule:', error);
    }

    setDraggedPost(null);
  }

  function handlePostClick(post: SocialPost) {
    setPreviewPost(post);
  }

  function openRescheduleModal(post: SocialPost) {
    setRescheduleModalPost(post);
    if (post.scheduled_at_utc) {
      const date = new Date(post.scheduled_at_utc);
      setRescheduleDate(date.toISOString().split('T')[0]);
      setRescheduleTime(date.toTimeString().slice(0, 5));
    }
    setPreviewPost(null);
  }

  async function handleReschedule() {
    if (!rescheduleModalPost || !rescheduleDate || !rescheduleTime) return;

    setRescheduling(true);
    try {
      const newDate = new Date(`${rescheduleDate}T${rescheduleTime}`);
      await schedulePost(
        rescheduleModalPost.id,
        newDate.toISOString(),
        rescheduleModalPost.scheduled_timezone || 'UTC'
      );
      setRescheduleModalPost(null);
      loadData();
    } catch (error) {
      console.error('Failed to reschedule:', error);
    } finally {
      setRescheduling(false);
    }
  }

  function getAccountsForTargets(targets: string[]): SocialAccount[] {
    return accounts.filter(a => targets.includes(a.id));
  }

  function getStatusColor(status: SocialPost['status']): string {
    switch (status) {
      case 'posted': return 'bg-green-500';
      case 'scheduled': return 'bg-blue-500';
      case 'queued': return 'bg-yellow-500';
      case 'posting': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  }

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/marketing/social/posts"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-white">
              Social Calendar
            </h1>
            <p className="text-sm text-gray-500">
              View and schedule your social media posts
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/marketing/social/posts"
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <List className="w-4 h-4" />
            List View
          </Link>
          <button
            onClick={() => navigate('/marketing/social/posts/new')}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Post
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={navigatePrev}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={navigateNext}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900 ml-2">
              {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button
              onClick={goToToday}
              className="ml-4 px-3 py-1 text-sm text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors"
            >
              Today
            </button>
          </div>

          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'month'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'week'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Week
            </button>
          </div>
        </div>

        {loading ? (
          <div className="h-96 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-7 border-b border-gray-200">
                {DAYS.map(day => (
                  <div
                    key={day}
                    className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className={`grid grid-cols-7 ${viewMode === 'month' ? '' : 'min-h-[500px]'}`}>
                {getCalendarDays().map((date, idx) => {
                  const dateKey = formatDateKey(date);
                  const dayPosts = getPostsForDate(date);
                  const isDropTarget = dropTargetDate === dateKey;
                  const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

                  return (
                    <div
                      key={idx}
                      className={`min-h-[120px] border-b border-r border-gray-100 p-2 transition-colors ${
                        !isCurrentMonth(date) ? 'bg-gray-50' : ''
                      } ${isDropTarget ? 'bg-rose-50' : ''} ${
                        viewMode === 'week' ? 'min-h-[400px]' : ''
                      }`}
                      onDragOver={(e) => handleDragOver(e, date)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, date)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-sm font-medium ${
                            isToday(date)
                              ? 'w-7 h-7 flex items-center justify-center bg-rose-600 text-white rounded-full'
                              : isCurrentMonth(date)
                              ? 'text-gray-900'
                              : 'text-gray-400'
                          }`}
                        >
                          {date.getDate()}
                        </span>
                        {!isPast && (
                          <button
                            onClick={() => {
                              const dateStr = date.toISOString().split('T')[0];
                              navigate(`/marketing/social/posts/new?date=${dateStr}`);
                            }}
                            className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="space-y-1">
                        {dayPosts.slice(0, viewMode === 'month' ? 3 : 10).map(post => (
                          <PostCard
                            key={post.id}
                            post={post}
                            accounts={getAccountsForTargets(post.targets)}
                            statusColor={getStatusColor(post.status)}
                            onDragStart={(e) => handleDragStart(e, post)}
                            onClick={() => handlePostClick(post)}
                            compact={viewMode === 'month'}
                          />
                        ))}
                        {dayPosts.length > (viewMode === 'month' ? 3 : 10) && (
                          <button
                            onClick={() => {
                              setViewMode('week');
                              setCurrentDate(date);
                            }}
                            className="text-xs text-rose-600 hover:text-rose-700"
                          >
                            +{dayPosts.length - (viewMode === 'month' ? 3 : 10)} more
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {previewPost && (
        <PostPreviewModal
          post={previewPost}
          accounts={getAccountsForTargets(previewPost.targets)}
          onClose={() => setPreviewPost(null)}
          onEdit={() => navigate(`/marketing/social/posts/${previewPost.id}/edit`)}
          onReschedule={() => openRescheduleModal(previewPost)}
        />
      )}

      {rescheduleModalPost && (
        <RescheduleModal
          post={rescheduleModalPost}
          date={rescheduleDate}
          time={rescheduleTime}
          onDateChange={setRescheduleDate}
          onTimeChange={setRescheduleTime}
          onClose={() => setRescheduleModalPost(null)}
          onSave={handleReschedule}
          saving={rescheduling}
        />
      )}
    </div>
  );
}

function PostCard({
  post,
  accounts,
  statusColor,
  onDragStart,
  onClick,
  compact,
}: {
  post: SocialPost;
  accounts: SocialAccount[];
  statusColor: string;
  onDragStart: (e: React.DragEvent) => void;
  onClick: () => void;
  compact?: boolean;
}) {
  const time = post.scheduled_at_utc
    ? new Date(post.scheduled_at_utc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={`group relative bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-rose-300 hover:shadow-sm transition-all ${
        compact ? 'p-1.5' : 'p-2'
      }`}
    >
      <div className="flex items-start gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${statusColor} mt-1.5 flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-0.5">
            {accounts.slice(0, 3).map(account => {
              const Icon = PROVIDER_ICONS[account.provider];
              return (
                <Icon
                  key={account.id}
                  className="w-3 h-3"
                  style={{ color: getProviderColor(account.provider) }}
                />
              );
            })}
            {accounts.length > 3 && (
              <span className="text-[10px] text-gray-400">+{accounts.length - 3}</span>
            )}
          </div>
          <p className={`text-gray-700 line-clamp-2 ${compact ? 'text-[10px]' : 'text-xs'}`}>
            {post.body}
          </p>
          {time && (
            <div className={`flex items-center gap-1 text-gray-400 mt-0.5 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
              <Clock className="w-2.5 h-2.5" />
              {time}
            </div>
          )}
        </div>
        <GripVertical className="w-3 h-3 text-gray-300 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
      </div>
    </div>
  );
}

function PostPreviewModal({
  post,
  accounts,
  onClose,
  onEdit,
  onReschedule,
}: {
  post: SocialPost;
  accounts: SocialAccount[];
  onClose: () => void;
  onEdit: () => void;
  onReschedule: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Post Preview</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="flex items-center gap-2 mb-4">
            {accounts.map(account => {
              const Icon = PROVIDER_ICONS[account.provider];
              return (
                <div
                  key={account.id}
                  className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded-full"
                >
                  <Icon
                    className="w-4 h-4"
                    style={{ color: getProviderColor(account.provider) }}
                  />
                  <span className="text-xs text-gray-600">{account.display_name}</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 mb-4">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              post.status === 'posted' ? 'bg-green-100 text-green-700' :
              post.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
              post.status === 'failed' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {post.status}
            </span>
            {post.scheduled_at_utc && (
              <span className="text-sm text-gray-500">
                {new Date(post.scheduled_at_utc).toLocaleString()}
              </span>
            )}
          </div>

          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-wrap">{post.body}</p>
          </div>

          {post.media && post.media.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {post.media.slice(0, 4).map((item, idx) => (
                <div key={idx} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  <img src={item.url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Eye className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={onReschedule}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Reschedule
          </button>
        </div>
      </div>
    </div>
  );
}

function RescheduleModal({
  post,
  date,
  time,
  onDateChange,
  onTimeChange,
  onClose,
  onSave,
  saving,
}: {
  post: SocialPost;
  date: string;
  time: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Reschedule Post</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500 line-clamp-2">{post.body}</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => onDateChange(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => onTimeChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving || !date || !time}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Calendar className="w-4 h-4" />
            )}
            Reschedule
          </button>
        </div>
      </div>
    </div>
  );
}
