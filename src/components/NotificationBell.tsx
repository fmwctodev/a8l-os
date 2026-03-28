import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  MessageSquare,
  Calendar,
  Star,
  Bot,
  AlertTriangle,
  Info,
  X,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  subscribeToNotifications,
  type Notification,
} from '../services/notifications';

const typeConfig: Record<string, { icon: typeof Bell; color: string }> = {
  message: { icon: MessageSquare, color: 'text-sky-400' },
  conversation: { icon: MessageSquare, color: 'text-cyan-400' },
  conversation_assigned: { icon: MessageSquare, color: 'text-cyan-400' },
  calendar: { icon: Calendar, color: 'text-emerald-400' },
  appointment: { icon: Calendar, color: 'text-emerald-400' },
  appointment_booked: { icon: Calendar, color: 'text-emerald-400' },
  review: { icon: Star, color: 'text-amber-400' },
  ai: { icon: Bot, color: 'text-teal-400' },
  ai_draft_ready: { icon: Bot, color: 'text-teal-400' },
  support_ticket: { icon: AlertTriangle, color: 'text-orange-400' },
  change_request: { icon: Info, color: 'text-sky-400' },
  task_assigned: { icon: CheckCheck, color: 'text-emerald-400' },
  email: { icon: MessageSquare, color: 'text-sky-400' },
  warning: { icon: AlertTriangle, color: 'text-orange-400' },
  system: { icon: Info, color: 'text-slate-400' },
};

function getTypeConfig(type: string) {
  return typeConfig[type] || typeConfig.system;
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    getUnreadCount(user.id)
      .then(setUnreadCount)
      .catch(() => {});

    const unsubscribe = subscribeToNotifications(user.id, (newNotification) => {
      setNotifications((prev) => [newNotification, ...prev].slice(0, 30));
      if (!newNotification.is_read) {
        setUnreadCount((prev) => prev + 1);
      }
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!user || hasLoaded) return;
    setIsLoading(true);
    try {
      const data = await getNotifications(user.id);
      setNotifications(data);
      setHasLoaded(true);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [user, hasLoaded]);

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next && !hasLoaded) {
      loadNotifications();
    }
  };

  const handleMarkAsRead = async (notification: Notification, e: React.MouseEvent) => {
    e.stopPropagation();
    if (notification.is_read) return;
    try {
      await markAsRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silent
    }
  };

  const handleMarkAllRead = async () => {
    if (!user || unreadCount === 0) return;
    try {
      await markAllAsRead(user.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // silent
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      try {
        await markAsRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // silent
      }
    }
    if (notification.link) {
      setIsOpen(false);
      navigate(notification.link);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleToggle}
        className="relative p-2 rounded-lg hover:bg-slate-800 transition-colors group"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-red-500 rounded-full ring-2 ring-slate-900 animate-in fade-in">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-h-[480px] bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-cyan-400 hover:text-cyan-300 hover:bg-slate-700 rounded-md transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain">
            {isLoading && !hasLoaded ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="w-12 h-12 rounded-full bg-slate-700/50 flex items-center justify-center mb-3">
                  <Bell className="w-6 h-6 text-slate-500" />
                </div>
                <p className="text-sm text-slate-400 font-medium">No notifications yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  You'll see updates from your modules here
                </p>
              </div>
            ) : (
              <div>
                {notifications.map((notification) => {
                  const config = getTypeConfig(notification.type);
                  const Icon = config.icon;

                  return (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-700/50 transition-colors border-b border-slate-700/50 last:border-0 ${
                        !notification.is_read ? 'bg-slate-750/30' : ''
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          !notification.is_read
                            ? 'bg-slate-700'
                            : 'bg-slate-700/50'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${config.color}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-sm leading-tight ${
                              !notification.is_read
                                ? 'font-semibold text-white'
                                : 'font-medium text-slate-300'
                            }`}
                          >
                            {notification.title}
                          </p>
                          {!notification.is_read && (
                            <span className="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-cyan-400" />
                          )}
                        </div>
                        {notification.body && (
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                            {notification.body}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-500 mt-1">
                          {formatTimeAgo(notification.created_at)}
                        </p>
                      </div>

                      {!notification.is_read && (
                        <button
                          onClick={(e) => handleMarkAsRead(notification, e)}
                          className="flex-shrink-0 mt-0.5 p-1 text-slate-500 hover:text-cyan-400 hover:bg-slate-600 rounded transition-colors"
                          title="Mark as read"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
