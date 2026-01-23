import { MessageSquare, Mail, Phone } from 'lucide-react';
import { Badge } from './Badge';
import type { AssignedConversation } from '../../services/dashboard';

interface ConversationQueueItemProps {
  conversation: AssignedConversation;
  onClick: () => void;
}

const channelIcons = {
  sms: MessageSquare,
  email: Mail,
  voice: Phone,
  webchat: MessageSquare,
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function ConversationQueueItem({ conversation, onClick }: ConversationQueueItemProps) {
  const Icon = channelIcons[conversation.channel as keyof typeof channelIcons] || MessageSquare;
  const contactName = `${conversation.contact.first_name} ${conversation.contact.last_name}`.trim();

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-700/50 transition-colors text-left"
    >
      <div className="p-2 bg-teal-500/10 rounded-lg">
        <Icon className="h-4 w-4 text-teal-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">{contactName || 'Unknown'}</span>
          {conversation.unread_count > 0 && (
            <span className="flex items-center justify-center h-5 min-w-[20px] px-1.5 bg-cyan-500 text-white text-xs font-medium rounded-full">
              {conversation.unread_count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant={conversation.status === 'open' ? 'info' : 'warning'}>
            {conversation.status}
          </Badge>
          <span className="text-xs text-slate-500">{formatTimeAgo(conversation.last_message_at)}</span>
        </div>
      </div>
    </button>
  );
}
