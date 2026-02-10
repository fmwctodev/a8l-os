import { useState, useEffect } from 'react';
import { Phone, Mail, PhoneCall, MessageCircle, Check, CheckCheck, Clock, AlertCircle, Eye, Archive, Trash2, MoreHorizontal, Paperclip, Download, FileText, Image, File } from 'lucide-react';
import { trashGmailMessage, archiveGmailMessage, downloadAttachment, listMessageAttachments } from '../../services/gmailApi';
import type { Message, MessageChannel, MessageStatus } from '../../types';

interface MessageBubbleProps {
  message: Message;
  onMessageAction?: (messageId: string, action: 'archived' | 'trashed') => void;
}

export function MessageBubble({ message, onMessageAction }: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [downloadingAttId, setDownloadingAttId] = useState<string | null>(null);
  const isOutbound = message.direction === 'outbound';
  const isSystem = message.direction === 'system';
  const metadata = message.metadata as Record<string, unknown> | undefined;
  const isGmailMessage = message.channel === 'email' && metadata?.gmail_message_id;
  const gmailMessageId = metadata?.gmail_message_id as string | undefined;
  const hasAttachments = metadata?.has_attachments === true;

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

        {hasAttachments && gmailMessageId && (
          <AttachmentStrip
            gmailMessageId={gmailMessageId}
            externalId={message.external_id}
            isOutbound={isOutbound}
            downloadingAttId={downloadingAttId}
            onDownload={async (attId: string, filename: string) => {
              if (!message.external_id) return;
              setDownloadingAttId(attId);
              try {
                const blob = await downloadAttachment(message.external_id, attId);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
              } catch (err) {
                console.error('Download failed:', err);
              } finally {
                setDownloadingAttId(null);
              }
            }}
          />
        )}

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

function AttachmentIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith('image/')) return <Image size={14} />;
  if (mimeType === 'application/pdf') return <FileText size={14} />;
  return <File size={14} />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AttachmentInfo {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

function AttachmentStrip({
  gmailMessageId,
  externalId,
  isOutbound,
  downloadingAttId,
  onDownload,
}: {
  gmailMessageId: string;
  externalId?: string;
  isOutbound: boolean;
  downloadingAttId: string | null;
  onDownload: (attachmentId: string, filename: string) => void;
}) {
  const [attachments, setAttachments] = useState<AttachmentInfo[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!externalId) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    listMessageAttachments(externalId)
      .then((res: { attachments?: AttachmentInfo[] }) => {
        if (!cancelled) setAttachments(res.attachments || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [externalId]);

  if (!loaded || attachments.length === 0) {
    return (
      <div className={`flex items-center gap-1 mt-2 text-xs ${isOutbound ? 'text-cyan-200' : 'text-slate-400'}`}>
        <Paperclip size={12} />
        <span>Attachments</span>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-1">
      {attachments.map((att) => (
        <button
          key={att.attachmentId}
          onClick={() => onDownload(att.attachmentId, att.filename)}
          disabled={downloadingAttId === att.attachmentId}
          className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
            isOutbound
              ? 'bg-cyan-700/50 hover:bg-cyan-700 text-cyan-100'
              : 'bg-slate-600/50 hover:bg-slate-600 text-slate-200'
          } disabled:opacity-50`}
        >
          <AttachmentIcon mimeType={att.mimeType} />
          <span className="flex-1 truncate">{att.filename}</span>
          <span className="text-[10px] opacity-70 shrink-0">{formatFileSize(att.size)}</span>
          {downloadingAttId === att.attachmentId ? (
            <span className="animate-spin w-3 h-3 border border-current border-t-transparent rounded-full" />
          ) : (
            <Download size={12} className="shrink-0 opacity-70" />
          )}
        </button>
      ))}
    </div>
  );
}
