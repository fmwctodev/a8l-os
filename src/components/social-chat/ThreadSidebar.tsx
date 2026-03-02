import { useState } from 'react';
import {
  Plus,
  MessageSquare,
  Search,
  Trash2,
  Archive,
  MoreVertical,
  Loader2,
} from 'lucide-react';
import type { SocialAIThread } from '../../types';

interface ThreadSidebarProps {
  threads: (SocialAIThread & { owner_name?: string })[];
  activeThreadId: string | null;
  loading: boolean;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  onArchiveThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
  showOwner?: boolean;
  currentUserId?: string;
}

export function ThreadSidebar({
  threads,
  activeThreadId,
  loading,
  onSelectThread,
  onNewThread,
  onArchiveThread,
  onDeleteThread,
  showOwner = false,
  currentUserId,
}: ThreadSidebarProps) {
  const [search, setSearch] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const filtered = search.trim()
    ? threads.filter(t => {
        const q = search.toLowerCase();
        return t.title.toLowerCase().includes(q) ||
          (showOwner && t.owner_name?.toLowerCase().includes(q));
      })
    : threads;

  return (
    <div className="flex flex-col h-full bg-slate-800 border-r border-slate-700">
      <div className="p-3 border-b border-slate-700">
        <button
          onClick={onNewThread}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search chats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 px-4">
            <MessageSquare className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">
              {search ? 'No matching chats' : 'No chats yet'}
            </p>
            {!search && (
              <p className="text-xs text-slate-600 mt-1">
                Start a conversation with your AI social manager
              </p>
            )}
          </div>
        ) : (
          filtered.map(thread => (
            <div
              key={thread.id}
              className="relative group"
            >
              <button
                onClick={() => onSelectThread(thread.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors text-sm ${
                  activeThreadId === thread.id
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-300'
                }`}
              >
                <div className="truncate font-medium">{thread.title}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-slate-500">
                    {formatRelativeTime(thread.updated_at || thread.created_at)}
                  </span>
                  {showOwner && thread.owner_name && thread.user_id !== currentUserId && (
                    <span className="text-[10px] text-cyan-400/70 bg-cyan-400/10 px-1.5 py-px rounded-full truncate max-w-[100px]">
                      {thread.owner_name}
                    </span>
                  )}
                </div>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenId(menuOpenId === thread.id ? null : thread.id);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-600 hover:text-slate-400 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>

              {menuOpenId === thread.id && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMenuOpenId(null)}
                  />
                  <div className="absolute right-0 top-full z-50 w-36 bg-slate-700 border border-slate-600 rounded-lg shadow-lg py-1">
                    <button
                      onClick={() => {
                        onArchiveThread(thread.id);
                        setMenuOpenId(null);
                      }}
                      className="w-full text-left px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-600 flex items-center gap-2"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      Archive
                    </button>
                    <button
                      onClick={() => {
                        onDeleteThread(thread.id);
                        setMenuOpenId(null);
                      }}
                      className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-slate-600 flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
