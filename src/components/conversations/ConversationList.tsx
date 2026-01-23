import { Phone, Mail, PhoneCall, MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Conversation, MessageChannel } from '../../types';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  loading: boolean;
  onSelect: (conversation: Conversation) => void;
  totalCount: number;
  page: number;
  onPageChange: (page: number) => void;
}

const PAGE_SIZE = 50;

export function ConversationList({
  conversations,
  selectedId,
  loading,
  onSelect,
  totalCount,
  page,
  onPageChange,
}: ConversationListProps) {
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (loading && conversations.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="p-4 border-b border-gray-100 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-48" />
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
          <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No conversations found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 overflow-y-auto">
        {conversations.map((conversation) => (
          <ConversationListItem
            key={conversation.id}
            conversation={conversation}
            isSelected={conversation.id === selectedId}
            onClick={() => onSelect(conversation)}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="p-3 border-t border-gray-200 flex items-center justify-between text-sm">
          <span className="text-gray-500">
            {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
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
}

function ConversationListItem({ conversation, isSelected, onClick }: ConversationListItemProps) {
  const contact = conversation.contact;
  const contactName = contact
    ? `${contact.first_name} ${contact.last_name}`.trim()
    : 'Unknown';

  const lastMessagePreview = conversation.last_message?.body || 'No messages yet';
  const truncatedPreview = lastMessagePreview.length > 60
    ? lastMessagePreview.substring(0, 60) + '...'
    : lastMessagePreview;

  const hasUnread = conversation.unread_count > 0;

  return (
    <button
      onClick={onClick}
      className={`w-full p-4 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors ${
        isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="relative">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
            getAvatarColor(contactName)
          }`}>
            {getInitials(contactName)}
          </div>
          {conversation.assigned_user && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center">
              {conversation.assigned_user.avatar_url ? (
                <img
                  src={conversation.assigned_user.avatar_url}
                  alt=""
                  className="w-4 h-4 rounded-full"
                />
              ) : (
                <span className="text-[8px] font-medium text-gray-600">
                  {getInitials(conversation.assigned_user.name)}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className={`truncate ${hasUnread ? 'font-semibold text-gray-900' : 'text-gray-900'}`}>
              {contactName}
            </span>
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {formatRelativeTime(conversation.last_message_at)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <ChannelIcon channel={conversation.last_message?.channel} />
            <p className={`text-sm truncate flex-1 ${hasUnread ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
              {truncatedPreview}
            </p>
          </div>

          <div className="flex items-center justify-between mt-1.5">
            <StatusBadge status={conversation.status} />
            {hasUnread && (
              <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-medium">
                {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function ChannelIcon({ channel }: { channel?: MessageChannel }) {
  const iconClass = "w-3.5 h-3.5 text-gray-400";

  switch (channel) {
    case 'sms':
      return <Phone className={iconClass} />;
    case 'email':
      return <Mail className={iconClass} />;
    case 'voice':
      return <PhoneCall className={iconClass} />;
    case 'webchat':
      return <MessageCircle className={iconClass} />;
    default:
      return <MessageCircle className={iconClass} />;
  }
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    open: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    closed: 'bg-gray-100 text-gray-600',
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
    'bg-blue-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-cyan-500',
    'bg-violet-500',
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
