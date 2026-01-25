import { useState, useEffect, useRef } from 'react';
import { Users, MoreVertical, Loader2, RefreshCw } from 'lucide-react';
import type { GoogleChatSpaceCache, GoogleChatMessageCache } from '../../services/googleChat';
import { GoogleChatComposer } from './GoogleChatComposer';

interface GoogleChatMessageThreadProps {
  space: GoogleChatSpaceCache;
  messages: GoogleChatMessageCache[];
  loading: boolean;
  onSendMessage: (text: string, threadId?: string) => Promise<void>;
  onRefreshMessages: () => void;
  refreshing: boolean;
  currentUserEmail: string | null;
}

export function GoogleChatMessageThread({
  space,
  messages,
  loading,
  onSendMessage,
  onRefreshMessages,
  refreshing,
  currentUserEmail,
}: GoogleChatMessageThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [replyToThread, setReplyToThread] = useState<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatFullDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const groupMessagesByDate = (msgs: GoogleChatMessageCache[]) => {
    const groups: { date: string; messages: GoogleChatMessageCache[] }[] = [];
    let currentDate = '';

    msgs.forEach(msg => {
      const msgDate = new Date(msg.sent_at).toDateString();
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: currentDate, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });

    return groups;
  };

  const isOwnMessage = (msg: GoogleChatMessageCache) => {
    return currentUserEmail && msg.sender_email?.toLowerCase() === currentUserEmail.toLowerCase();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between bg-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-emerald-500/30">
            <Users className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-semibold text-white">
              {space.display_name || 'Unnamed Space'}
            </h2>
            <p className="text-xs text-slate-400">
              {space.space_type === 'DM' ? 'Direct Message' : 'Space'}
              {space.member_count > 0 && ` - ${space.member_count} members`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefreshMessages}
            disabled={refreshing}
            className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh messages"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-slate-500 animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-400">Loading messages...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-slate-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-1">No messages yet</h3>
              <p className="text-slate-400">Start the conversation by sending a message</p>
            </div>
          </div>
        ) : (
          messageGroups.map((group, groupIdx) => (
            <div key={groupIdx}>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1 h-px bg-slate-700" />
                <span className="text-xs text-slate-500 font-medium">
                  {new Date(group.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
                <div className="flex-1 h-px bg-slate-700" />
              </div>

              <div className="space-y-3">
                {group.messages.map((msg, msgIdx) => {
                  const isOwn = isOwnMessage(msg);
                  const showAvatar = msgIdx === 0 ||
                    group.messages[msgIdx - 1].sender_email !== msg.sender_email;

                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                    >
                      {showAvatar ? (
                        <div className={`flex-shrink-0 ${isOwn ? 'ml-2' : 'mr-2'}`}>
                          {msg.sender_avatar_url ? (
                            <img
                              src={msg.sender_avatar_url}
                              alt={msg.sender_name}
                              className="w-8 h-8 rounded-full"
                            />
                          ) : (
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                              isOwn
                                ? 'bg-cyan-500/20 text-cyan-400'
                                : 'bg-slate-700 text-slate-300'
                            }`}>
                              {getInitials(msg.sender_name || 'U')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-8 flex-shrink-0" />
                      )}

                      <div className={`flex flex-col max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
                        {showAvatar && (
                          <div className={`flex items-center gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
                            <span className="text-sm font-medium text-slate-300">
                              {isOwn ? 'You' : msg.sender_name}
                            </span>
                            <span className="text-xs text-slate-500" title={formatFullDate(msg.sent_at)}>
                              {formatTime(msg.sent_at)}
                            </span>
                          </div>
                        )}
                        <div
                          className={`px-4 py-2.5 rounded-2xl ${
                            isOwn
                              ? 'bg-cyan-600 text-white rounded-tr-sm'
                              : 'bg-slate-700 text-slate-100 rounded-tl-sm'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {msg.content || msg.formatted_text}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <GoogleChatComposer
        onSend={onSendMessage}
        replyToThread={replyToThread}
        onCancelReply={() => setReplyToThread(null)}
        disabled={loading}
      />
    </div>
  );
}
