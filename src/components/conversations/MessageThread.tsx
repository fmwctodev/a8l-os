import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { ConversationHeader } from './ConversationHeader';
import { getRecentMessages, createMessage } from '../../services/messages';
import { getInboxEvents } from '../../services/inboxEvents';
import { getContactChannels } from '../../services/contactLinking';
import { sendGmailEmail, replyToGmailThread } from '../../services/gmailApi';
import type { Conversation, Message, InboxEvent, MessageChannel, Contact } from '../../types';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<InboxEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [availableChannels, setAvailableChannels] = useState<{ channel: MessageChannel; identifier: string }[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<MessageChannel>('sms');

  useEffect(() => {
    async function loadThread() {
      try {
        setLoading(true);
        const [messagesData, eventsData] = await Promise.all([
          getRecentMessages(conversation.id, 100),
          getInboxEvents(conversation.id),
        ]);
        setMessages(messagesData);
        setEvents(eventsData);

        if (conversation.contact) {
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
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        setLoading(false);
      }
    }
    loadThread();
  }, [conversation.id, conversation.contact]);

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

  const handleSendMessage = async (body: string, subject?: string) => {
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
          updated_at: new Date().toISOString(),
          hidden_at: null,
          hidden_by_user_id: null,
        };

        setMessages((prev) => [...prev, optimisticMessage]);

        try {
          const emailSubject = subject || threadInfo.lastSubject || 'No Subject';

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
            });
          } else {
            await sendGmailEmail({
              to: channelConfig.identifier,
              subject: emailSubject,
              htmlBody: body,
              conversationId: conversation.id,
              contactId: conversation.contact_id,
            });
          }

          setMessages((prev) =>
            prev.map((m) =>
              m.id === optimisticMessage.id ? { ...m, status: 'delivered' } : m
            )
          );
        } catch (gmailError) {
          console.error('Gmail send failed, falling back:', gmailError);
          setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));

          const metadata: Record<string, unknown> = { to_email: channelConfig.identifier };
          const newMessage = await createMessage(
            user.organization_id,
            conversation.id,
            conversation.contact_id,
            selectedChannel,
            'outbound',
            body,
            metadata,
            subject
          );
          setMessages((prev) => [...prev, newMessage]);
        }
      } else {
        const metadata: Record<string, unknown> = {};
        if (selectedChannel === 'sms' && channelConfig) {
          metadata.to_number = channelConfig.identifier;
        } else if (selectedChannel === 'email' && channelConfig) {
          metadata.to_email = channelConfig.identifier;
        }

        const newMessage = await createMessage(
          user.organization_id,
          conversation.id,
          conversation.contact_id,
          selectedChannel,
          'outbound',
          body,
          metadata,
          subject
        );
        setMessages((prev) => [...prev, newMessage]);
      }

      onConversationUpdate();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const threadItems = buildThreadItems(messages, events);

  return (
    <div className="flex-1 flex flex-col">
      <ConversationHeader
        conversation={conversation}
        onConversationUpdate={onConversationUpdate}
        onToggleContactPanel={onToggleContactPanel}
        showContactPanel={showContactPanel}
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
          </div>
        ) : threadItems.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            No messages yet. Start the conversation!
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
              <MessageBubble key={(item.data as Message).id} message={item.data as Message} />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <MessageComposer
        onSend={handleSendMessage}
        sending={sending}
        disabled={conversation.status === 'closed'}
        availableChannels={availableChannels}
        selectedChannel={selectedChannel}
        onChannelChange={setSelectedChannel}
        showSubject={selectedChannel === 'email'}
        contact={conversation.contact as Contact}
        conversation={conversation}
        gmailConnected={user?.gmail_connected || false}
      />
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
