import { useState, useRef, useEffect } from 'react';
import { MessageCircle, ChevronLeft, ChevronRight, UserPlus, CheckCircle, XCircle, Trash2, Eye, EyeOff, CheckSquare, Square, X } from 'lucide-react';
import { ChannelIcon } from './ChannelIcon';
import { useAuth } from '../../contexts/AuthContext';
import type { Conversation, MessageChannel } from '../../types';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  loading: boolean;
  onSelect: (conversation: Conversation) => void;
  totalCount: number;
  page: number;
  onPageChange: (page: number) => void;
  onRefresh?: () => void;
  onBulkAction?: (action: BulkAction, ids: string[]) => Promise<void>;
}

export type BulkAction = 'mark_read' | 'mark_unread' | 'close' | 'reopen' | 'delete';

const PAGE_SIZE = 50;

export function ConversationList({
  conversations,
  selectedId,
  loading,
  onSelect,
  totalCount,
  page,
  onPageChange,
  onBulkAction,
}: ConversationListProps) {
  const { hasPermission } = useAuth();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [processingBulk, setProcessingBulk] = useState(false);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const canManage = hasPermission('conversations.manage');
  const canDelete = hasPermission('conversations.delete');

  const toggleSelectAll = () => {
    if (selectedIds.size === conversations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(conversations.map((c) => c.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkAction = async (action: BulkAction) => {
    if (!onBulkAction || selectedIds.size === 0) return;
    try {
      setProcessingBulk(true);
      await onBulkAction(action, Array.from(selectedIds));
      setSelectedIds(new Set());
      setBulkMode(false);
    } catch (error) {
      console.error('Bulk action failed:', error);
    } finally {
      setProcessingBulk(false);
    }
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    setSelectedIds(new Set());
  };

  if (loading && conversations.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="p-4 border-b border-slate-700 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-slate-700 rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-slate-700 rounded w-32 mb-2" />
                <div className="h-3 bg-slate-600 rounded w-48" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <MessageCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No conversations found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {canManage && (
        <div className="p-2 border-b border-slate-700 flex items-center justify-between">
          {bulkMode ? (
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSelectAll}
                  className="p-1 hover:bg-slate-700 rounded transition-colors"
                >
                  {selectedIds.size === conversations.length ? (
                    <CheckSquare size={18} className="text-cyan-400" />
                  ) : (
                    <Square size={18} className="text-slate-400" />
                  )}
                </button>
                <span className="text-sm text-slate-300">
                  {selectedIds.size} selected
                </span>
              </div>
              <button
                onClick={exitBulkMode}
                className="p-1 hover:bg-slate-700 rounded transition-colors"
              >
                <X size={18} className="text-slate-400" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setBulkMode(true)}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Select multiple
            </button>
          )}
        </div>
      )}

      {bulkMode && selectedIds.size > 0 && (
        <div className="p-2 border-b border-slate-700 bg-slate-800/80 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400">Actions:</span>
          <button
            onClick={() => handleBulkAction('mark_read')}
            disabled={processingBulk}
            className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 rounded transition-colors"
          >
            Mark read
          </button>
          <button
            onClick={() => handleBulkAction('mark_unread')}
            disabled={processingBulk}
            className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 rounded transition-colors"
          >
            Mark unread
          </button>
          <button
            onClick={() => handleBulkAction('close')}
            disabled={processingBulk}
            className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 rounded transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => handleBulkAction('reopen')}
            disabled={processingBulk}
            className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 rounded transition-colors"
          >
            Reopen
          </button>
          {canDelete && (
            <button
              onClick={() => handleBulkAction('delete')}
              disabled={processingBulk}
              className="px-2 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 disabled:opacity-50 text-red-400 rounded transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {conversations.map((conversation) => (
          <ConversationListItem
            key={conversation.id}
            conversation={conversation}
            isSelected={conversation.id === selectedId}
            onClick={() => bulkMode ? toggleSelectOne(conversation.id) : onSelect(conversation)}
            bulkMode={bulkMode}
            isChecked={selectedIds.has(conversation.id)}
            onToggleSelect={() => toggleSelectOne(conversation.id)}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="p-3 border-t border-slate-700 flex items-center justify-between text-sm">
          <span className="text-slate-400">
            {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="p-1 rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-400"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              className="p-1 rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-400"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ConversationListItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
  bulkMode?: boolean;
  isChecked?: boolean;
  onToggleSelect?: () => void;
}

function ConversationListItem({ conversation, isSelected, onClick, bulkMode, isChecked, onToggleSelect }: ConversationListItemProps) {
  const { hasPermission } = useAuth();
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const contact = conversation.contact;
  const contactName = contact
    ? `${contact.first_name} ${contact.last_name}`.trim()
    : 'Unknown';

  const hasMessages = !!conversation.last_message;
  const lastMessagePreview = hasMessages
    ? (conversation.last_message?.body || conversation.last_message?.subject || 'No preview available')
    : (conversation.unread_count > 0 ? `${conversation.unread_count} unread message${conversation.unread_count > 1 ? 's' : ''}` : 'No messages yet');
  const truncatedPreview = lastMessagePreview.length > 50
    ? lastMessagePreview.substring(0, 50) + '...'
    : lastMessagePreview;

  const hasUnread = conversation.unread_count > 0;
  const canManage = hasPermission('conversations.manage');
  const canDelete = hasPermission('conversations.delete');

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowContextMenu(false);
      }
    }
    if (showContextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showContextMenu]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  return (
    <>
      <button
        onClick={onClick}
        onContextMenu={bulkMode ? undefined : handleContextMenu}
        className={`w-full p-4 text-left border-b border-slate-700 hover:bg-slate-700 transition-colors ${
          isSelected && !bulkMode ? 'bg-slate-700 border-l-4 border-l-cyan-500' : 'border-l-4 border-l-transparent'
        } ${isChecked ? 'bg-cyan-500/10' : ''}`}
      >
        <div className="flex items-start gap-3">
          {bulkMode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect?.();
              }}
              className="mt-1 p-0.5"
            >
              {isChecked ? (
                <CheckSquare size={18} className="text-cyan-400" />
              ) : (
                <Square size={18} className="text-slate-500" />
              )}
            </button>
          )}
          <div className="relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
              getAvatarColor(contactName)
            }`}>
              {getInitials(contactName)}
            </div>
            {conversation.assigned_user && !bulkMode && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-600 border-2 border-slate-800 flex items-center justify-center">
                {conversation.assigned_user.avatar_url ? (
                  <img
                    src={conversation.assigned_user.avatar_url}
                    alt=""
                    className="w-4 h-4 rounded-full"
                  />
                ) : (
                  <span className="text-[8px] font-medium text-slate-300">
                    {getInitials(conversation.assigned_user.name)}
                  </span>
                )}
              </div>
            )}
            {hasUnread && !bulkMode && (
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-500 border-2 border-slate-800" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`truncate ${hasUnread ? 'font-semibold text-white' : 'text-slate-200'}`}>
                  {contactName}
                </span>
                {conversation.provider === 'vapi' && (
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-400 text-[10px] font-medium">
                    Vapi
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {conversation.provider === 'vapi' && conversation.conversation_metadata?.duration_seconds != null && (
                  <span className="text-[10px] text-slate-500">
                    {formatDuration(conversation.conversation_metadata.duration_seconds as number)}
                  </span>
                )}
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  {formatRelativeTime(conversation.last_message_at)}
                </span>
              </div>
            </div>

            {conversation.provider === 'vapi' && conversation.conversation_metadata?.assistant_name && (
              <div className="text-[11px] text-teal-400/70 truncate mb-0.5">
                {conversation.conversation_metadata.assistant_name as string}
              </div>
            )}

            <div className="flex items-center gap-2">
              {hasMessages ? (
                <ChannelIcon
                  channel={conversation.last_message?.channel as MessageChannel}
                  size="sm"
                  platform={conversation.late_dm_platform}
                />
              ) : (
                <MessageCircle className="w-3.5 h-3.5 text-slate-500" />
              )}
              <p className={`text-sm truncate flex-1 ${hasUnread ? 'text-slate-200 font-medium' : hasMessages ? 'text-slate-400' : 'text-slate-500 italic'}`}>
                {truncatedPreview}
              </p>
            </div>

            <div className="flex items-center justify-between mt-1.5">
              <StatusBadge status={conversation.status} />
              {hasUnread && (
                <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-medium">
                  {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
                </span>
              )}
            </div>
          </div>
        </div>
      </button>

      {showContextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-xl py-1 min-w-[180px]"
          style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
        >
          {canManage && (
            <>
              <ContextMenuItem
                icon={UserPlus}
                label="Assign to..."
                onClick={() => setShowContextMenu(false)}
              />
              <ContextMenuItem
                icon={hasUnread ? EyeOff : Eye}
                label={hasUnread ? 'Mark as read' : 'Mark as unread'}
                onClick={() => setShowContextMenu(false)}
              />
              {conversation.status === 'open' ? (
                <ContextMenuItem
                  icon={XCircle}
                  label="Close conversation"
                  onClick={() => setShowContextMenu(false)}
                />
              ) : (
                <ContextMenuItem
                  icon={CheckCircle}
                  label="Reopen conversation"
                  onClick={() => setShowContextMenu(false)}
                />
              )}
            </>
          )}
          {canDelete && (
            <>
              <div className="border-t border-slate-700 my-1" />
              <ContextMenuItem
                icon={Trash2}
                label="Delete"
                onClick={() => setShowContextMenu(false)}
                danger
              />
            </>
          )}
        </div>
      )}
    </>
  );
}

interface ContextMenuItemProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

function ContextMenuItem({ icon: Icon, label, onClick, danger }: ContextMenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-700 transition-colors ${
        danger ? 'text-red-400 hover:text-red-300' : 'text-slate-200'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    open: 'bg-emerald-500/20 text-emerald-400',
    pending: 'bg-amber-500/20 text-amber-400',
    closed: 'bg-slate-600 text-slate-400',
  };

  return (
    <span className={`px-2 py-0.5 text-xs rounded-full capitalize ${colors[status as keyof typeof colors] || colors.open}`}>
      {status}
    </span>
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-600',
    'bg-emerald-600',
    'bg-amber-600',
    'bg-rose-600',
    'bg-cyan-600',
    'bg-teal-600',
  ];
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[index % colors.length];
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}
