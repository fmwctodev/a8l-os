import { useState } from 'react';
import { Phone, Mail, PhoneCall, MessageCircle, Check, CheckCheck, Clock, AlertCircle, Eye, Archive, Trash2, MoreHorizontal } from 'lucide-react';
import { trashGmailMessage, archiveGmailMessage } from '../../services/gmailApi';
import type { Message, MessageChannel, MessageStatus } from '../../types';

interface MessageBubbleProps {
  message: Message;
  onMessageAction?: (messageId: string, action: 'archived' | 'trashed') => void;
}

export function MessageBubble({ message, onMessageAction }: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const isOutbound = message.direction === 'outbound';
  const isSystem = message.direction === 'system';
  const isGmailMessage = message.channel === 'email' && (message.metadata as Record<string, unknown>)?.gmail_message_id;
  const gmailMessageId = (message.metadata as Record<string, unknown>)?.gmail_message_id as string | undefined;

  const handleArchive = async () => {
    if (!gmailMessageId) return;
    setActionLoading(true);
    try {
      await archiveGmailMessage(gmailMessageId);
      onMessageAction?.(message.id, 'archived');
    } catch (err) {
      console.error('Failed to archive:', err);
    } finally {
      setActionLoading(false);
      setShowActions(false);
    }
  };

  const handleTrash = async () => {
    if (!gmailMessageId) return;
    setActionLoading(true);
    try {
      await trashGmailMessage(gmailMessageId);
      onMessageAction?.(message.id, 'trashed');
    } catch (err) {
      console.error('Failed to trash:', err);
    } finally {
      setActionLoading(false);
      setShowActions(false);
    }
  };

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
    <div
      className={`group flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
      onMouseLeave={() => setShowActions(false)}
    >
      {isOutbound && isGmailMessage && (
        <div className="relative flex items-start mr-1">
          <button
            onClick={() => setShowActions(!showActions)}
            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal size={14} />
          </button>
          {showActions && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowActions(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-slate-800 border border-slate-600 rounded-lg shadow-lg min-w-[140px]">
                <button
                  onClick={handleArchive}
                  disabled={actionLoading}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded-t-lg disabled:opacity-50"
                >
                  <Archive size={14} />
                  Archive
                </button>
                <button
                  onClick={handleTrash}
                  disabled={actionLoading}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-700 rounded-b-lg disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}

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
          {isGmailMessage && (
            <span className="text-[10px] opacity-70">Gmail</span>
          )}
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

      {!isOutbound && isGmailMessage && (
        <div className="relative flex items-start ml-1">
          <button
            onClick={() => setShowActions(!showActions)}
            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal size={14} />
          </button>
          {showActions && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowActions(false)} />
              <div className="absolute left-0 top-full mt-1 z-20 bg-slate-800 border border-slate-600 rounded-lg shadow-lg min-w-[140px]">
                <button
                  onClick={handleArchive}
                  disabled={actionLoading}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded-t-lg disabled:opacity-50"
                >
                  <Archive size={14} />
                  Archive
                </button>
                <button
                  onClick={handleTrash}
                  disabled={actionLoading}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-700 rounded-b-lg disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}
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
