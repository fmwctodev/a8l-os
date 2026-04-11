import { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, AlertTriangle, Bot, Mic, Clock, PhoneCall, FileAudio, ExternalLink, MessageSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { ConversationHeader } from './ConversationHeader';
import { EmailThreadDrawer } from './EmailThreadDrawer';
import { getRecentMessages, createMessage, getInternalComments } from '../../services/messages';
import { getInboxEvents } from '../../services/inboxEvents';
import { getContactChannels } from '../../services/contactLinking';
import { sendGmailEmail, replyToGmailThread } from '../../services/gmailApi';
import { getNumbers } from '../../services/phoneNumbers';
import { sendSms } from '../../services/sendSms';
import { supabase } from '../../lib/supabase';
import { getGoogleErrorMessage } from '../../utils/googleAuthErrors';
import type { Conversation, Message, InboxEvent, MessageChannel, Contact } from '../../types';
import type { TwilioNumber } from '../../services/phoneNumbers';

interface MessageThreadProps {
  conversation: Conversation;
  onConversationUpdate: () => void;
  onToggleContactPanel: () => void;
  showContactPanel: boolean;
}

interface ThreadItem {
  type: 'message' | 'event' | 'day-separator';
  data: Message | InboxEvent | string;
  timestamp: string;
}

export function MessageThread({
  conversation,
  onConversationUpdate,
  onToggleContactPanel,
  showContactPanel,
}: MessageThreadProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<InboxEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | false>(false);
  const [sending, setSending] = useState(false);
  const [availableChannels, setAvailableChannels] = useState<{ channel: MessageChannel; identifier: string }[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<MessageChannel>('sms');
  const [fromNumbers, setFromNumbers] = useState<TwilioNumber[]>([]);
  const [emailThread, setEmailThread] = useState<{ threadId: string; subject: string } | null>(null);

  const loadThread = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const [messagesResult, eventsResult, commentsResult] = await Promise.allSettled([
        getRecentMessages(conversation.id, 100),
        getInboxEvents(conversation.id),
        getInternalComments(conversation.id),
      ]);

      const messagesData = messagesResult.status === 'fulfilled' ? messagesResult.value : [];
      const eventsData = eventsResult.status === 'fulfilled' ? eventsResult.value : [];
      const commentsData = commentsResult.status === 'fulfilled' ? commentsResult.value : [];

      if (messagesResult.status === 'rejected') {
        console.error('Failed to load messages:', messagesResult.reason);
        const reason = messagesResult.reason;
        const msg = reason instanceof Error ? reason.message : String(reason);
        const isJwtError = msg.toLowerCase().includes('jwt') || msg.toLowerCase().includes('unauthorized') || msg.includes('401');
        setLoadError(isJwtError ? 'session' : 'generic');
      }
      if (eventsResult.status === 'rejected') {
        console.error('Failed to load events:', eventsResult.reason);
      }

      setMessages([...messagesData, ...commentsData]);
      setEvents(eventsData);

      if (conversation.contact) {
        try {
          const channels = await getContactChannels(conversation.contact as Contact);
          setAvailableChannels(channels);

          if (channels.length > 0) {
            const lastMessage = messagesData[messagesData.length - 1];
            if (lastMessage && channels.find((c) => c.channel === lastMessage.channel)) {
              setSelectedChannel(lastMessage.channel);
            } else {
              setSelectedChannel(channels[0].channel);
            }
          }
        } catch (channelError) {
          console.error('Failed to load channels:', channelError);
        }
      }
    } catch (error) {
      console.error('Failed to load thread:', error);
      const msg = error instanceof Error ? error.message : String(error);
      const isJwtError = msg.toLowerCase().includes('jwt') || msg.toLowerCase().includes('unauthorized') || msg.includes('401');
      setLoadError(isJwtError ? 'session' : 'generic');
    } finally {
      setLoading(false);
    }
  }, [conversation.id, conversation.contact]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  useEffect(() => {
    getNumbers()
      .then(setFromNumbers)
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getThreadInfo = (): { threadId?: string; inReplyTo?: string; references?: string; lastSubject?: string } => {
    const emailMessages = messages.filter(
      (m) => m.channel === 'email' && (m.metadata as Record<string, unknown>)?.gmail_message_id
    );
    if (emailMessages.length === 0) return {};

    const lastEmail = emailMessages[emailMessages.length - 1];
    const meta = lastEmail.metadata as Record<string, unknown> | undefined;
    return {
      threadId: meta?.thread_id as string | undefined,
      inReplyTo: meta?.gmail_message_id as string | undefined,
      references: meta?.gmail_message_id as string | undefined,
      lastSubject: lastEmail.subject || undefined,
    };
  };

  const handleSendMessage = async (body: string, subject?: string, extraMetadata?: Record<string, unknown>) => {
    if (!user?.organization_id || !conversation.contact) return;

    try {
      setSending(true);

      const channelConfig = availableChannels.find((c) => c.channel === selectedChannel);
      const isGmailConnected = user.gmail_connected;
      const isEmailChannel = selectedChannel === 'email';

      if (isEmailChannel && isGmailConnected && channelConfig) {
        const threadInfo = getThreadInfo();

        const optimisticMessage: Message = {
          id: `temp-${Date.now()}`,
          organization_id: user.organization_id,
          conversation_id: conversation.id,
          contact_id: conversation.contact_id,
          channel: 'email',
          direction: 'outbound',
          body,
          subject: subject || threadInfo.lastSubject || '',
          metadata: { to_email: channelConfig.identifier, sent_via: 'gmail' },
          status: 'pending',
          external_id: null,
          sent_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          hidden_at: null,
          hidden_by_user_id: null,
        };

        setMessages((prev) => [...prev, optimisticMessage]);

        try {
          const emailSubject = subject || threadInfo.lastSubject || 'No Subject';
          const cc = extraMetadata?.cc as string | undefined;
          const bcc = extraMetadata?.bcc as string | undefined;

          if (threadInfo.threadId) {
            await replyToGmailThread({
              to: channelConfig.identifier,
              subject: emailSubject.startsWith('Re:') ? emailSubject : `Re: ${emailSubject}`,
              htmlBody: body,
              threadId: threadInfo.threadId,
              inReplyTo: threadInfo.inReplyTo,
              references: threadInfo.references,
              conversationId: conversation.id,
              contactId: conversation.contact_id,
              cc,
              bcc,
            });
          } else {
            await sendGmailEmail({
              to: channelConfig.identifier,
              subject: emailSubject,
              htmlBody: body,
              conversationId: conversation.id,
              contactId: conversation.contact_id,
              cc,
              bcc,
            });
          }

          setMessages((prev) =>
            prev.map((m) =>
              m.id === optimisticMessage.id ? { ...m, status: 'delivered' } : m
            )
          );
        } catch (gmailError) {
          const errorMsg = gmailError instanceof Error ? gmailError.message : 'Unknown error';
          console.error('Gmail send failed:', errorMsg);

          setMessages((prev) =>
            prev.map((m) =>
              m.id === optimisticMessage.id
                ? { ...m, status: 'failed', metadata: { ...m.metadata, error_message: errorMsg } }
                : m
            )
          );

          const errInfo = getGoogleErrorMessage(errorMsg, 'gmail');
          showToast('warning', errInfo.title, errInfo.description);
          throw gmailError;
        }
      } else {
        const mediaUrls = extraMetadata?.media_urls as string[] | undefined;
        const cleanMetadata: Record<string, unknown> = { ...extraMetadata };
        delete cleanMetadata.media_urls;

        if (selectedChannel === 'sms' && channelConfig) {
          cleanMetadata.to_number = channelConfig.identifier;
        } else if (selectedChannel === 'email' && channelConfig) {
          cleanMetadata.to_email = channelConfig.identifier;
        }

        const newMessage = await createMessage(
          user.organization_id,
          conversation.id,
          conversation.contact_id,
          selectedChannel,
          'outbound',
          body,
          cleanMetadata,
          subject
        );

        if (mediaUrls && mediaUrls.length > 0) {
          await supabase
            .from('messages')
            .update({ media_urls: mediaUrls })
            .eq('id', newMessage.id);
          newMessage.media_urls = mediaUrls;
        }

        setMessages((prev) => [...prev, newMessage]);

        if (selectedChannel === 'sms') {
          sendSms(newMessage.id)
            .then(({ status }) => {
              setMessages((prev) =>
                prev.map((m) => m.id === newMessage.id ? { ...m, status: status as Message['status'] } : m)
              );
            })
            .catch((err) => {
              const errorMsg = err instanceof Error ? err.message : 'Failed to send';
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === newMessage.id
                    ? { ...m, status: 'failed', metadata: { ...m.metadata, error_message: errorMsg } }
                    : m
                )
              );
            });
        }
      }

      onConversationUpdate();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleSendInternalComment = async (body: string, mentions: string[]) => {
    if (!user?.organization_id) return;

    try {
      setSending(true);

      const newMessage = await createMessage(
        user.organization_id,
        conversation.id,
        conversation.contact_id,
        'sms',
        'system',
        body,
        {
          type: 'internal_comment',
          author_id: user.id,
          author_name: user.name,
          mentions,
        }
      );
      setMessages((prev) => [...prev, newMessage]);
      onConversationUpdate();
    } catch (error) {
      console.error('Failed to send internal comment:', error);
      showToast('warning', 'Failed to send comment', 'Please try again.');
      throw error;
    } finally {
      setSending(false);
    }
  };

  const threadItems = buildThreadItems(messages, events);
  const isVapiConversation = conversation.provider === 'vapi';
  const vapiMeta = conversation.conversation_metadata as Record<string, unknown> | undefined;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ConversationHeader
        conversation={conversation}
        onConversationUpdate={onConversationUpdate}
        onToggleContactPanel={onToggleContactPanel}
        showContactPanel={showContactPanel}
      />

      {isVapiConversation && vapiMeta && (
        <VapiCallInfoBar metadata={vapiMeta} />
      )}

      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
          </div>
        ) : loadError && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <AlertTriangle className="w-8 h-8 text-amber-400" />
            <p className="text-slate-400 text-sm">
              {loadError === 'session'
                ? 'Your session has expired. Please log out and log back in.'
                : 'Failed to load messages'}
            </p>
            <button
              onClick={loadThread}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition-colors"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        ) : threadItems.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-xs">
              <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-7 h-7 text-slate-500" />
              </div>
              <p className="text-slate-300 font-medium mb-1">
                {isVapiConversation ? 'No messages in this conversation.' : 'Start the conversation'}
              </p>
              {!isVapiConversation && (
                <p className="text-sm text-slate-500">
                  Send an email or SMS to begin communicating with this contact.
                </p>
              )}
            </div>
          </div>
        ) : (
          threadItems.map((item, index) => {
            if (item.type === 'day-separator') {
              return (
                <DaySeparator key={`day-${index}`} date={item.data as string} />
              );
            }

            if (item.type === 'event') {
              return (
                <SystemEventItem key={`event-${(item.data as InboxEvent).id}`} event={item.data as InboxEvent} />
              );
            }

            return (
              <MessageBubble
                key={(item.data as Message).id}
                message={item.data as Message}
                onOpenThread={(threadId, subject) => setEmailThread({ threadId, subject })}
                onRetry={(msgId, newStatus) => {
                  setMessages(prev =>
                    prev.map(m => m.id === msgId ? { ...m, status: newStatus as Message['status'] } : m)
                  );
                }}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {isVapiConversation ? (
        <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/50">
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
            <Bot size={16} />
            <span>This conversation was handled by Vapi AI and is read-only</span>
          </div>
        </div>
      ) : (
        <MessageComposer
          onSend={handleSendMessage}
          onSendInternalComment={handleSendInternalComment}
          sending={sending}
          disabled={conversation.status === 'closed'}
          availableChannels={availableChannels}
          selectedChannel={selectedChannel}
          onChannelChange={setSelectedChannel}
          showSubject={selectedChannel === 'email'}
          contact={conversation.contact as Contact}
          conversation={conversation}
          gmailConnected={user?.gmail_connected || false}
          fromNumbers={fromNumbers}
        />
      )}

      {emailThread && (
        <EmailThreadDrawer
          threadId={emailThread.threadId}
          subject={emailThread.subject}
          onClose={() => setEmailThread(null)}
        />
      )}
    </div>
  );
}

function DaySeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-4 my-4">
      <div className="flex-1 h-px bg-slate-700" />
      <span className="text-xs text-slate-500 font-medium">{date}</span>
      <div className="flex-1 h-px bg-slate-700" />
    </div>
  );
}

function SystemEventItem({ event }: { event: InboxEvent }) {
  const getEventText = () => {
    switch (event.event_type) {
      case 'assigned':
        return `Conversation assigned to ${(event.payload as { assigned_user_name?: string }).assigned_user_name || 'a team member'}`;
      case 'status_changed':
        return `Status changed to ${(event.payload as { new_status?: string }).new_status}`;
      case 'conversation_created':
        return 'Conversation started';
      case 'contact_merged':
        return 'Contact information updated';
      default:
        return event.event_type;
    }
  };

  return (
    <div className="flex items-center justify-center my-2">
      <span className="text-xs text-slate-400 bg-slate-700 px-3 py-1 rounded-full">
        {getEventText()} - {formatTime(event.created_at)}
      </span>
    </div>
  );
}

function buildThreadItems(messages: Message[], events: InboxEvent[]): ThreadItem[] {
  const items: ThreadItem[] = [];

  messages.forEach((msg) => {
    items.push({
      type: 'message',
      data: msg,
      timestamp: msg.sent_at,
    });
  });

  events.forEach((evt) => {
    items.push({
      type: 'event',
      data: evt,
      timestamp: evt.created_at,
    });
  });

  items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const withSeparators: ThreadItem[] = [];
  let lastDate = '';

  items.forEach((item) => {
    const itemDate = formatDate(item.timestamp);
    if (itemDate !== lastDate) {
      withSeparators.push({
        type: 'day-separator',
        data: itemDate,
        timestamp: item.timestamp,
      });
      lastDate = itemDate;
    }
    withSeparators.push(item);
  });

  return withSeparators;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function VapiCallInfoBar({ metadata }: { metadata: Record<string, unknown> }) {
  const recordingUrl = metadata.recording_url as string | undefined;
  const durationSeconds = metadata.duration_seconds as number | undefined;
  const channelType = metadata.channel_type as string | undefined;
  const endedReason = metadata.ended_reason as string | undefined;

  const hasInfo = recordingUrl || durationSeconds || channelType;
  if (!hasInfo) return null;

  return (
    <div className="px-4 py-2 border-b border-slate-700 bg-slate-800/30 flex items-center gap-4 flex-wrap">
      {channelType && (
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          {channelType === 'voice' || channelType === 'vapi_voice' ? (
            <PhoneCall size={13} className="text-teal-400" />
          ) : (
            <Bot size={13} className="text-teal-400" />
          )}
          <span className="capitalize">{channelType.replace('vapi_', '')}</span>
        </div>
      )}
      {durationSeconds != null && durationSeconds > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Clock size={13} />
          <span>{formatCallDuration(durationSeconds)}</span>
        </div>
      )}
      {endedReason && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span>Ended: {endedReason.replace(/-/g, ' ')}</span>
        </div>
      )}
      {recordingUrl && (
        <a
          href={recordingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors ml-auto"
        >
          <FileAudio size={13} />
          Play Recording
          <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}

function formatCallDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}m ${s}s`;
  }
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
