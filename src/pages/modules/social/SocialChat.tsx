import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import {
  ThreadSidebar,
  ChatMessageList,
  ChatInput,
} from '../../../components/social-chat';
import {
  getThreads,
  createThread,
  getThreadMessages,
  sendMessage,
  archiveThread,
  deleteThread,
  schedulePostFromDraft,
} from '../../../services/socialChat';
import type {
  SocialAIThread,
  SocialAIMessage,
  SocialAIMessageType,
  SocialAIAttachment,
} from '../../../types';

interface ParsedDraft {
  platform: string;
  body: string;
  hook_text?: string;
  cta_text?: string;
  hashtags?: string[];
  visual_style_suggestion?: string;
}

export function SocialChat() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [threads, setThreads] = useState<SocialAIThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SocialAIMessage[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const orgId = user?.organization_id;
  const userId = user?.id;

  useEffect(() => {
    if (orgId && userId) {
      loadThreads();
    }
  }, [orgId, userId]);

  useEffect(() => {
    if (activeThreadId) {
      loadMessages(activeThreadId);
    } else {
      setMessages([]);
    }
  }, [activeThreadId]);

  async function loadThreads() {
    if (!orgId || !userId) return;
    try {
      setLoadingThreads(true);
      const data = await getThreads(orgId, userId);
      setThreads(data);
    } catch (err) {
      console.error('Failed to load threads:', err);
    } finally {
      setLoadingThreads(false);
    }
  }

  async function loadMessages(threadId: string) {
    try {
      setLoadingMessages(true);
      const data = await getThreadMessages(threadId);
      setMessages(data);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  }

  async function handleNewThread() {
    if (!orgId || !userId) return;
    try {
      const thread = await createThread(orgId, userId);
      setThreads((prev) => [thread, ...prev]);
      setActiveThreadId(thread.id);
      setMessages([]);
    } catch (err) {
      addToast('error', 'Failed to create new chat');
      console.error(err);
    }
  }

  const handleSend = useCallback(
    async (
      content: string,
      messageType?: string,
      attachments?: Array<{ type: string; url: string; title?: string }>
    ) => {
      if (!orgId || !userId) return;

      let threadId = activeThreadId;

      if (!threadId) {
        try {
          const thread = await createThread(orgId, userId);
          setThreads((prev) => [thread, ...prev]);
          setActiveThreadId(thread.id);
          threadId = thread.id;
        } catch (err) {
          addToast('error', 'Failed to create chat');
          return;
        }
      }

      try {
        setSending(true);
        const { userMessage, aiMessage } = await sendMessage(
          threadId,
          content,
          (messageType as SocialAIMessageType) || 'text',
          (attachments as SocialAIAttachment[]) || []
        );
        setMessages((prev) => [...prev, userMessage, aiMessage]);

        setThreads((prev) =>
          prev.map((t) =>
            t.id === threadId
              ? {
                  ...t,
                  updated_at: new Date().toISOString(),
                  title:
                    t.title === 'New conversation'
                      ? content.slice(0, 60) + (content.length > 60 ? '...' : '')
                      : t.title,
                }
              : t
          )
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to send message';
        addToast('error', msg);
        console.error(err);
      } finally {
        setSending(false);
      }
    },
    [orgId, userId, activeThreadId, addToast]
  );

  async function handleArchiveThread(threadId: string) {
    try {
      await archiveThread(threadId);
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      if (activeThreadId === threadId) {
        setActiveThreadId(null);
        setMessages([]);
      }
      addToast('success', 'Chat archived');
    } catch {
      addToast('error', 'Failed to archive chat');
    }
  }

  async function handleDeleteThread(threadId: string) {
    try {
      await deleteThread(threadId);
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      if (activeThreadId === threadId) {
        setActiveThreadId(null);
        setMessages([]);
      }
      addToast('success', 'Chat deleted');
    } catch {
      addToast('error', 'Failed to delete chat');
    }
  }

  async function handleScheduleDraft(draft: ParsedDraft) {
    if (!orgId || !userId) return;
    try {
      await schedulePostFromDraft(
        orgId,
        userId,
        {
          platform: draft.platform,
          hook: draft.hook_text || '',
          body: draft.body,
          cta: draft.cta_text || '',
          hashtags: draft.hashtags || [],
          visual_style_suggestion: draft.visual_style_suggestion,
        },
        [draft.platform],
        undefined,
        activeThreadId || undefined
      );
      addToast('success', 'Draft saved to posts');
      navigate('/marketing/social/posts');
    } catch {
      addToast('error', 'Failed to schedule draft');
    }
  }

  return (
    <div className="flex bg-slate-900 rounded-xl border border-slate-700 overflow-hidden" style={{ height: 'calc(100vh - 260px)', minHeight: '500px' }}>
      <div className="w-72 flex-shrink-0">
        <ThreadSidebar
          threads={threads}
          activeThreadId={activeThreadId}
          loading={loadingThreads}
          onSelectThread={setActiveThreadId}
          onNewThread={handleNewThread}
          onArchiveThread={handleArchiveThread}
          onDeleteThread={handleDeleteThread}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <ChatMessageList
          messages={messages}
          isTyping={sending}
          onScheduleDraft={handleScheduleDraft}
        />
        <ChatInput
          onSend={handleSend}
          sending={sending}
          disabled={loadingMessages}
        />
      </div>
    </div>
  );
}
