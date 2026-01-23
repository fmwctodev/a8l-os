import { Phone, Mail, PhoneCall, MessageCircle, Check, CheckCheck, Clock, AlertCircle, Eye } from 'lucide-react';
import type { Message, MessageChannel, MessageStatus } from '../../types';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound';
  const isSystem = message.direction === 'system';

  if (isSystem) {
    return (
      <div className="flex items-center justify-center my-2">
        <span className="text-xs text-slate-400 bg-slate-700 px-3 py-1 rounded-full">
          {message.body}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
          isOutbound
            ? 'bg-cyan-600 text-white rounded-br-md'
            : 'bg-slate-700 text-white rounded-bl-md'
        }`}
      >
        {message.subject && (
          <div className={`text-xs font-medium mb-1 ${isOutbound ? 'text-cyan-200' : 'text-slate-400'}`}>
            Subject: {message.subject}
          </div>
        )}

        <div className="whitespace-pre-wrap break-words">{message.body}</div>

        <div className={`flex items-center justify-end gap-2 mt-1.5 ${isOutbound ? 'text-cyan-200' : 'text-slate-400'}`}>
          <ChannelIndicator channel={message.channel} isOutbound={isOutbound} />
          <span className="text-xs">{formatTime(message.sent_at)}</span>
          {isOutbound && <StatusIndicator status={message.status} />}
        </div>

        {message.status === 'failed' && message.metadata?.error_message && (
          <div className="mt-2 p-2 bg-red-900/50 rounded text-xs text-red-300 flex items-center gap-1">
            <AlertCircle size={12} />
            {String(message.metadata.error_message)}
          </div>
        )}
      </div>
    </div>
  );
}

function ChannelIndicator({ channel, isOutbound }: { channel: MessageChannel; isOutbound: boolean }) {
  const iconClass = `w-3 h-3 ${isOutbound ? 'text-cyan-200' : 'text-slate-400'}`;

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
      return null;
  }
}

function StatusIndicator({ status }: { status: MessageStatus }) {
  switch (status) {
    case 'pending':
      return <Clock size={12} className="text-cyan-200" />;
    case 'sent':
      return <Check size={12} className="text-cyan-200" />;
    case 'delivered':
      return <CheckCheck size={12} className="text-cyan-200" />;
    case 'read':
      return <Eye size={12} className="text-cyan-200" />;
    case 'failed':
      return <AlertCircle size={12} className="text-red-300" />;
    default:
      return null;
  }
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}
