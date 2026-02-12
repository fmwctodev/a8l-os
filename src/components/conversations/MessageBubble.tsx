import { useState, useEffect } from 'react';
import { Phone, Mail, PhoneCall, MessageCircle, Check, CheckCheck, Clock, AlertCircle, Eye, Archive, Trash2, MoreHorizontal, Paperclip, Download, FileText, Image, File, ChevronDown, ChevronUp, StickyNote } from 'lucide-react';
import { trashGmailMessage, archiveGmailMessage, downloadAttachment, listMessageAttachments } from '../../services/gmailApi';
import type { Message, MessageChannel, MessageStatus } from '../../types';

const EMAIL_PREVIEW_LENGTH = 250;

interface MessageBubbleProps {
  message: Message;
  onMessageAction?: (messageId: string, action: 'archived' | 'trashed') => void;
}

function cleanEmailBody(body: string): string {
  let cleaned = body
    .replace(/\( https?:\/\/[^\s)]+\)/g, '')
    .replace(/https?:\/\/\S+/g, '[link]')
    .replace(/={3,}/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned;
}

export function MessageBubble({ message, onMessageAction }: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [downloadingAttId, setDownloadingAttId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const isOutbound = message.direction === 'outbound';
  const isSystem = message.direction === 'system';
  const metadata = message.metadata as Record<string, unknown> | undefined;
  const isGmailMessage = message.channel === 'email' && metadata?.gmail_message_id;
  const isEmailChannel = message.channel === 'email';
  const gmailMessageId = metadata?.gmail_message_id as string | undefined;
  const hasAttachments = metadata?.has_attachments === true;
  const fromEmail = metadata?.from_email as string | undefined;
  const fromName = metadata?.from_name as string | undefined;

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
    const isInternalComment = metadata?.type === 'internal_comment';
    if (isInternalComment) {
      return <InternalCommentBubble message={message} metadata={metadata} />;
    }

    return (
      <div className="flex items-center justify-center my-2">
        <span className="text-xs text-slate-400 bg-slate-700 px-3 py-1 rounded-full">
          {message.body}
        </span>
      </div>
    );
  }

  if (isEmailChannel) {
    return <EmailBubble
      message={message}
      isOutbound={isOutbound}
      isGmailMessage={!!isGmailMessage}
      gmailMessageId={gmailMessageId}
      hasAttachments={hasAttachments}
      fromEmail={fromEmail}
      fromName={fromName}
      expanded={expanded}
      onToggleExpand={() => setExpanded(!expanded)}
      showActions={showActions}
      onToggleActions={() => setShowActions(!showActions)}
      onCloseActions={() => setShowActions(false)}
      onArchive={handleArchive}
      onTrash={handleTrash}
      actionLoading={actionLoading}
      downloadingAttId={downloadingAttId}
      onDownloadAttachment={async (attId: string, filename: string) => {
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
    />;
  }

  return (
    <div
      className={`group flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
      onMouseLeave={() => setShowActions(false)}
    >
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
          isOutbound
            ? 'bg-cyan-600 text-white rounded-br-md'
            : 'bg-slate-700 text-white rounded-bl-md'
        }`}
      >
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

function InternalCommentBubble({ message, metadata }: { message: Message; metadata?: Record<string, unknown> }) {
  const authorName = (metadata?.author_name as string) || 'Team member';
  const displayBody = message.body.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');

  return (
    <div className="flex justify-center my-3">
      <div className="max-w-[85%] w-full rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-amber-200/60 bg-amber-100/40">
          <StickyNote size={14} className="text-amber-600" />
          <span className="text-xs font-medium text-amber-800">{authorName}</span>
          <span className="text-xs text-amber-500 ml-auto">{formatTime(message.sent_at)}</span>
        </div>
        <div className="px-4 py-3">
          <p className="text-sm text-amber-900 whitespace-pre-wrap break-words leading-relaxed">
            {displayBody}
          </p>
        </div>
        <div className="px-4 pb-2">
          <span className="text-[10px] text-amber-500 italic">Internal note - not visible to contact</span>
        </div>
      </div>
    </div>
  );
}

function EmailBubble({
  message,
  isOutbound,
  isGmailMessage,
  gmailMessageId,
  hasAttachments,
  fromEmail,
  fromName,
  expanded,
  onToggleExpand,
  showActions,
  onToggleActions,
  onCloseActions,
  onArchive,
  onTrash,
  actionLoading,
  downloadingAttId,
  onDownloadAttachment,
}: {
  message: Message;
  isOutbound: boolean;
  isGmailMessage: boolean;
  gmailMessageId?: string;
  hasAttachments: boolean;
  fromEmail?: string;
  fromName?: string;
  expanded: boolean;
  onToggleExpand: () => void;
  showActions: boolean;
  onToggleActions: () => void;
  onCloseActions: () => void;
  onArchive: () => void;
  onTrash: () => void;
  actionLoading: boolean;
  downloadingAttId: string | null;
  onDownloadAttachment: (attId: string, filename: string) => void;
}) {
  const cleanedBody = cleanEmailBody(message.body);
  const isLong = cleanedBody.length > EMAIL_PREVIEW_LENGTH;
  const displayBody = expanded || !isLong
    ? cleanedBody
    : cleanedBody.substring(0, EMAIL_PREVIEW_LENGTH) + '...';

  const senderDisplay = fromName || fromEmail || (isOutbound ? 'You' : 'Unknown');

  return (
    <div
      className={`group flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
      onMouseLeave={onCloseActions}
    >
      {isOutbound && isGmailMessage && (
        <GmailActionMenu
          position="left"
          showActions={showActions}
          onToggleActions={onToggleActions}
          onCloseActions={onCloseActions}
          onArchive={onArchive}
          onTrash={onTrash}
          actionLoading={actionLoading}
        />
      )}

      <div className={`max-w-[75%] rounded-xl border overflow-hidden ${
        isOutbound
          ? 'bg-cyan-900/30 border-cyan-700/50'
          : 'bg-slate-800 border-slate-600/50'
      }`}>
        <div className={`px-4 py-2.5 border-b ${
          isOutbound ? 'border-cyan-700/30 bg-cyan-900/40' : 'border-slate-600/30 bg-slate-700/40'
        }`}>
          <div className="flex items-center gap-2">
            <Mail size={14} className={isOutbound ? 'text-cyan-400' : 'text-slate-400'} />
            <span className="text-sm font-medium text-white truncate">
              {isOutbound ? 'You' : senderDisplay}
            </span>
            {!isOutbound && fromEmail && fromName && (
              <span className="text-xs text-slate-500 truncate">&lt;{fromEmail}&gt;</span>
            )}
          </div>
          {message.subject && (
            <div className={`text-xs mt-1 ${isOutbound ? 'text-cyan-300' : 'text-slate-300'} font-medium`}>
              {message.subject}
            </div>
          )}
        </div>

        <div className="px-4 py-3">
          <div className={`text-sm whitespace-pre-wrap break-words leading-relaxed ${
            isOutbound ? 'text-cyan-100' : 'text-slate-200'
          }`}>
            {displayBody}
          </div>
          {isLong && (
            <button
              onClick={onToggleExpand}
              className={`flex items-center gap-1 mt-2 text-xs font-medium transition-colors ${
                isOutbound
                  ? 'text-cyan-400 hover:text-cyan-300'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        {hasAttachments && gmailMessageId && (
          <div className="px-4 pb-3">
            <AttachmentStrip
              gmailMessageId={gmailMessageId}
              externalId={message.external_id}
              isOutbound={isOutbound}
              downloadingAttId={downloadingAttId}
              onDownload={onDownloadAttachment}
            />
          </div>
        )}

        <div className={`px-4 py-2 border-t flex items-center justify-between ${
          isOutbound ? 'border-cyan-700/30' : 'border-slate-600/30'
        }`}>
          <div className="flex items-center gap-2">
            {isGmailMessage && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                isOutbound ? 'bg-cyan-800/50 text-cyan-300' : 'bg-slate-600/50 text-slate-400'
              }`}>Gmail</span>
            )}
          </div>
          <div className={`flex items-center gap-2 ${isOutbound ? 'text-cyan-300' : 'text-slate-400'}`}>
            <span className="text-xs">{formatTime(message.sent_at)}</span>
            {isOutbound && <StatusIndicator status={message.status} />}
          </div>
        </div>

        {message.status === 'failed' && message.metadata?.error_message && (
          <div className="mx-4 mb-3 p-2 bg-red-900/50 rounded text-xs text-red-300 flex items-center gap-1">
            <AlertCircle size={12} />
            {String(message.metadata.error_message)}
          </div>
        )}
      </div>

      {!isOutbound && isGmailMessage && (
        <GmailActionMenu
          position="right"
          showActions={showActions}
          onToggleActions={onToggleActions}
          onCloseActions={onCloseActions}
          onArchive={onArchive}
          onTrash={onTrash}
          actionLoading={actionLoading}
        />
      )}
    </div>
  );
}

function GmailActionMenu({
  position,
  showActions,
  onToggleActions,
  onCloseActions,
  onArchive,
  onTrash,
  actionLoading,
}: {
  position: 'left' | 'right';
  showActions: boolean;
  onToggleActions: () => void;
  onCloseActions: () => void;
  onArchive: () => void;
  onTrash: () => void;
  actionLoading: boolean;
}) {
  return (
    <div className={`relative flex items-start ${position === 'left' ? 'mr-1' : 'ml-1'}`}>
      <button
        onClick={onToggleActions}
        className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <MoreHorizontal size={14} />
      </button>
      {showActions && (
        <>
          <div className="fixed inset-0 z-10" onClick={onCloseActions} />
          <div className={`absolute ${position === 'left' ? 'right-0' : 'left-0'} top-full mt-1 z-20 bg-slate-800 border border-slate-600 rounded-lg shadow-lg min-w-[140px]`}>
            <button
              onClick={onArchive}
              disabled={actionLoading}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded-t-lg disabled:opacity-50"
            >
              <Archive size={14} />
              Archive
            </button>
            <button
              onClick={onTrash}
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
