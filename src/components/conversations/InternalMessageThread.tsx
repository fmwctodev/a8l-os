import { useEffect, useRef, useState, useCallback } from 'react';
import { Hash, Users, RefreshCw, FileText, Film, Music, Archive, File as FileIcon, Download } from 'lucide-react';
import { TeamMessage, TeamAttachment, ChannelWithDetails } from '../../services/teamMessaging';
import { InternalMessageComposer } from './InternalMessageComposer';
import { MediaLightbox, LightboxItem } from '../ui/MediaLightbox';
import { formatTime, formatDate } from '../../utils/dateUtils';
import { useAuth } from '../../contexts/AuthContext';

interface InternalMessageThreadProps {
  channel: ChannelWithDetails;
  messages: TeamMessage[];
  loading: boolean;
  refreshing: boolean;
  onSendMessage: (content: string, attachments?: TeamAttachment[]) => Promise<void>;
  onRefresh: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getNonImageIcon(type: string) {
  if (type.startsWith('video/')) return Film;
  if (type.startsWith('audio/')) return Music;
  if (type === 'application/pdf') return FileText;
  if (type.includes('zip') || type.includes('rar') || type.includes('gzip')) return Archive;
  return FileIcon;
}

function MessageAttachments({ attachments }: { attachments: TeamAttachment[] }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const mediaItems: LightboxItem[] = attachments
    .filter((a) => a.type.startsWith('image/') || a.type.startsWith('video/'))
    .map((a) => ({
      url: a.url,
      mediaType: a.type.startsWith('video/') ? 'video' as const : 'image' as const,
      filename: a.name,
    }));

  const imageAttachments = attachments.filter((a) => a.type.startsWith('image/'));
  const videoAttachments = attachments.filter((a) => a.type.startsWith('video/'));
  const otherAttachments = attachments.filter(
    (a) => !a.type.startsWith('image/') && !a.type.startsWith('video/')
  );

  const openLightbox = useCallback((attachment: TeamAttachment) => {
    const idx = mediaItems.findIndex((m) => m.url === attachment.url);
    if (idx >= 0) {
      setLightboxIndex(idx);
      setLightboxOpen(true);
    }
  }, [mediaItems]);

  return (
    <>
      {imageAttachments.length > 0 && (
        <div className={`mt-1.5 flex flex-wrap gap-1.5 ${imageAttachments.length === 1 ? '' : 'max-w-[320px]'}`}>
          {imageAttachments.map((att, i) => (
            <button
              key={i}
              onClick={() => openLightbox(att)}
              className="block rounded-lg overflow-hidden hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <img
                src={att.url}
                alt={att.name}
                className={`object-cover ${
                  imageAttachments.length === 1
                    ? 'max-w-[280px] max-h-[200px] rounded-lg'
                    : 'w-[100px] h-[100px]'
                }`}
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {videoAttachments.length > 0 && (
        <div className="mt-1.5 space-y-1.5">
          {videoAttachments.map((att, i) => (
            <button
              key={i}
              onClick={() => openLightbox(att)}
              className="relative block rounded-lg overflow-hidden bg-slate-700 hover:opacity-90 transition-opacity max-w-[280px] focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <div className="w-full h-[160px] flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Film size={20} className="text-white" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 px-3 py-1.5 bg-gradient-to-t from-black/70 to-transparent">
                <p className="text-xs text-white/80 truncate">{att.name}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {otherAttachments.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {otherAttachments.map((att, i) => {
            const Icon = getNonImageIcon(att.type);
            return (
              <a
                key={i}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                download={att.name}
                className="flex items-center gap-2.5 px-3 py-2 bg-slate-700/60 hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors max-w-[280px] group"
              >
                <div className="w-8 h-8 rounded bg-slate-600 flex items-center justify-center flex-shrink-0">
                  <Icon size={16} className="text-slate-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white font-medium truncate">{att.name}</p>
                  <p className="text-xs text-slate-400">{formatFileSize(att.size)}</p>
                </div>
                <Download size={14} className="text-slate-500 group-hover:text-slate-300 flex-shrink-0 transition-colors" />
              </a>
            );
          })}
        </div>
      )}

      {lightboxOpen && mediaItems.length > 0 && (
        <MediaLightbox
          items={mediaItems}
          startIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}

export function InternalMessageThread({
  channel,
  messages,
  loading,
  refreshing,
  onSendMessage,
  onRefresh,
}: InternalMessageThreadProps) {
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getChannelDisplay = () => {
    if (channel.type === 'direct') {
      const otherMember = channel.members?.find(m => m.user_id !== user?.id);
      return {
        name: otherMember?.name || 'Unknown User',
        subtitle: otherMember?.email || '',
        icon: null,
      };
    }

    return {
      name: channel.name || 'Unnamed Group',
      subtitle: `${channel.member_count} member${channel.member_count !== 1 ? 's' : ''}`,
      icon: <Hash className="w-5 h-5" />,
    };
  };

  const groupMessagesByDate = (msgs: TeamMessage[]) => {
    const groups: { [key: string]: TeamMessage[] } = {};

    msgs.forEach((message) => {
      const date = formatDate(new Date(message.created_at));
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });

    return groups;
  };

  const display = getChannelDisplay();
  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="p-4 border-b border-slate-700 bg-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {display.icon ? (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              {display.icon}
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {display.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              {display.name}
              {channel.type === 'group' && (
                <Users className="w-4 h-4 text-slate-400" />
              )}
            </h2>
            <p className="text-xs text-slate-400">{display.subtitle}</p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          title="Refresh messages"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin mx-auto mb-2" />
              <p className="text-sm text-slate-400">Loading messages...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
                {channel.type === 'direct' ? (
                  <span className="text-2xl">💬</span>
                ) : (
                  <Users className="w-8 h-8 text-slate-500" />
                )}
              </div>
              <h3 className="text-lg font-medium text-white mb-1">
                {channel.type === 'direct' ? 'Start the conversation' : 'No messages yet'}
              </h3>
              <p className="text-sm text-slate-400">
                {channel.type === 'direct'
                  ? `Send a message to ${display.name}`
                  : 'Be the first to send a message in this group'}
              </p>
            </div>
          </div>
        ) : (
          Object.entries(messageGroups).map(([date, dateMessages]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-slate-700"></div>
                <span className="text-xs font-medium text-slate-500 px-3 py-1 bg-slate-800 rounded-full">
                  {date}
                </span>
                <div className="flex-1 h-px bg-slate-700"></div>
              </div>

              <div className="space-y-4">
                {dateMessages.map((message, index) => {
                  const isOwnMessage = message.sender_id === user?.id;
                  const showAvatar =
                    index === 0 ||
                    dateMessages[index - 1]?.sender_id !== message.sender_id;
                  const hasAttachments = message.attachments && message.attachments.length > 0;
                  const hasText = message.content.trim().length > 0;

                  return (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${
                        isOwnMessage ? 'flex-row-reverse' : ''
                      }`}
                    >
                      <div className="flex-shrink-0 w-8">
                        {showAvatar &&
                          !isOwnMessage &&
                          (message.sender?.avatar_url ? (
                            <img
                              src={message.sender.avatar_url}
                              alt={message.sender.name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                              <span className="text-white text-xs font-medium">
                                {message.sender?.name?.charAt(0).toUpperCase() ||
                                  '?'}
                              </span>
                            </div>
                          ))}
                      </div>

                      <div
                        className={`flex-1 max-w-[70%] ${
                          isOwnMessage ? 'text-right' : ''
                        }`}
                      >
                        {showAvatar && (
                          <div
                            className={`flex items-center gap-2 mb-1 ${
                              isOwnMessage ? 'justify-end' : ''
                            }`}
                          >
                            <span className="text-sm font-medium text-white">
                              {isOwnMessage
                                ? 'You'
                                : message.sender?.name || 'Unknown User'}
                            </span>
                            <span className="text-xs text-slate-500">
                              {formatTime(new Date(message.created_at))}
                            </span>
                          </div>
                        )}

                        {hasText && (
                          <div
                            className={`inline-block px-4 py-2 rounded-2xl ${
                              isOwnMessage
                                ? 'bg-cyan-600 text-white'
                                : 'bg-slate-800 text-white'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {message.content}
                            </p>
                            {message.is_edited && (
                              <span className="text-xs opacity-70 ml-2">(edited)</span>
                            )}
                          </div>
                        )}

                        {hasAttachments && (
                          <div className={`${isOwnMessage ? 'flex justify-end' : ''}`}>
                            <MessageAttachments attachments={message.attachments} />
                          </div>
                        )}

                        {message.reactions && message.reactions.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {Array.from(
                              new Set(message.reactions.map((r) => r.emoji))
                            ).map((emoji) => {
                              const count = message.reactions!.filter(
                                (r) => r.emoji === emoji
                              ).length;
                              return (
                                <button
                                  key={emoji}
                                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded-full text-xs flex items-center gap-1"
                                >
                                  <span>{emoji}</span>
                                  <span className="text-slate-400">{count}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex-shrink-0 w-8"></div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <InternalMessageComposer
        onSendMessage={onSendMessage}
        disabled={loading}
        placeholder={`Message ${display.name}...`}
      />
    </div>
  );
}
