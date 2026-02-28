import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import {
  ThreadSidebar,
  ChatMessageList,
  ChatInput,
  ChatMediaSettings,
} from '../../../components/social-chat';
import {
  getThreads,
  createThread,
  getThreadMessages,
  sendMessage,
  archiveThread,
  deleteThread,
  publishDraftFromChat,
} from '../../../services/socialChat';
import { getAssetsByJobIds } from '../../../services/mediaGeneration';
import { supabase } from '../../../lib/supabase';
import type {
  SocialAIThread,
  SocialAIMessage,
  SocialAIMessageType,
  SocialAIAttachment,
} from '../../../types';
import type { PostDraft, SocialAccount } from '../../../components/social-chat/PostDraftCard';
import type { MediaPreferences, MediaJobInfo, PublishMode } from '../../../services/socialChat';
import type { MediaAsset } from '../../../services/mediaGeneration';

export function SocialChat() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [threads, setThreads] = useState<SocialAIThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SocialAIMessage[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [mediaPreferences, setMediaPreferences] = useState<MediaPreferences>({
    auto_generate_media: true,
  });
  const [activeMediaJobs, setActiveMediaJobs] = useState<MediaJobInfo[]>([]);
  const [draftAssets, setDraftAssets] = useState<Record<number, MediaAsset[]>>({});
  const [publishStatuses, setPublishStatuses] = useState<
    Record<string, { mode: PublishMode; scheduledAt?: string }>
  >({});

  const orgId = user?.organization_id;
  const userId = user?.id;

  useEffect(() => {
    if (orgId && userId) {
      loadThreads();
      loadAccounts();
    }
  }, [orgId, userId]);

  useEffect(() => {
    if (activeThreadId) {
      loadMessages(activeThreadId);
    } else {
      setMessages([]);
    }
    setActiveMediaJobs([]);
    setDraftAssets({});
    setPublishStatuses({});
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

      const allJobInfos: MediaJobInfo[] = [];
      for (const msg of data) {
        const meta = msg.metadata as Record<string, unknown> | null;
        const msgJobs = meta?.media_jobs as MediaJobInfo[] | undefined;
        if (msgJobs && msgJobs.length > 0) {
          allJobInfos.push(...msgJobs);
        }
      }

      if (allJobInfos.length > 0) {
        const jobIds = allJobInfos.map((j) => j.job_id);
        const assetMap = await getAssetsByJobIds(jobIds);

        const rehydratedJobs: MediaJobInfo[] = allJobInfos.map((j) => ({
          ...j,
          preloadedAssets: assetMap[j.job_id] || [],
        }));

        const restoredDraftAssets: Record<number, MediaAsset[]> = {};
        for (const j of rehydratedJobs) {
          if (j.preloadedAssets && j.preloadedAssets.length > 0) {
            const existing = restoredDraftAssets[j.draft_index] || [];
            restoredDraftAssets[j.draft_index] = [...existing, ...j.preloadedAssets];
          }
        }

        setActiveMediaJobs(rehydratedJobs);
        setDraftAssets(restoredDraftAssets);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  }

  async function loadAccounts() {
    if (!orgId) return;
    try {
      const { data } = await supabase
        .from('social_accounts')
        .select('id, provider, display_name, profile_image_url')
        .eq('organization_id', orgId)
        .eq('status', 'connected');
      setAccounts((data as SocialAccount[]) || []);
    } catch {
      // accounts stay empty
    }
  }

  async function handleNewThread() {
    if (!orgId || !userId) return;
    try {
      const thread = await createThread(orgId, userId);
      setThreads((prev) => [thread, ...prev]);
      setActiveThreadId(thread.id);
      setMessages([]);
    } catch {
      showToast('warning', 'Failed to create new chat');
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
        } catch {
          showToast('warning', 'Failed to create chat');
          return;
        }
      }

      try {
        setSending(true);
        const result = await sendMessage(
          threadId,
          content,
          (messageType as SocialAIMessageType) || 'text',
          (attachments as SocialAIAttachment[]) || [],
          mediaPreferences
        );
        setMessages((prev) => [...prev, result.userMessage, result.aiMessage]);

        if (result.mediaJobs.length > 0) {
          setActiveMediaJobs((prev) => [...prev, ...result.mediaJobs]);
        }

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
        showToast('warning', msg);
      } finally {
        setSending(false);
      }
    },
    [orgId, userId, activeThreadId, showToast, mediaPreferences]
  );

  const handleSendPrompt = useCallback(
    (prompt: string) => {
      handleSend(prompt);
    },
    [handleSend]
  );

  const handlePublishDraft = useCallback(
    async (
      msgId: string,
      draftIndex: number,
      draft: PostDraft,
      mode: PublishMode,
      accountIds: string[],
      media: Array<{ url: string; type: string; thumbnail_url?: string }>,
      mediaAssetIds: string[],
      scheduledAt?: string
    ) => {
      if (!orgId || !userId) return;
      try {
        await publishDraftFromChat({
          orgId,
          userId,
          draft: {
            platform: draft.platform,
            hook: draft.hook_text || '',
            body: draft.body,
            cta: draft.cta_text || '',
            hashtags: draft.hashtags || [],
            visual_style_suggestion: draft.visual_style_suggestion,
          },
          accountIds,
          mode,
          scheduledAtUtc: scheduledAt,
          media,
          mediaAssetIds,
          threadId: activeThreadId || undefined,
        });

        setPublishStatuses((prev) => ({
          ...prev,
          [`${msgId}-${draftIndex}`]: { mode, scheduledAt },
        }));

        const label =
          mode === 'post_now' ? 'Posted' : mode === 'schedule' ? 'Scheduled' : 'Saved as draft';
        showToast('success', label);
      } catch {
        showToast('warning', 'Failed to publish draft');
      }
    },
    [orgId, userId, activeThreadId, showToast]
  );

  const handleMediaAssetReady = useCallback(
    (draftIndex: number, assets: MediaAsset[]) => {
      setDraftAssets((prev) => ({
        ...prev,
        [draftIndex]: [...(prev[draftIndex] || []), ...assets],
      }));
    },
    []
  );

  const handleMediaJobStatusChange = useCallback(
    (jobId: string, newStatus: string) => {
      setActiveMediaJobs((prev) =>
        prev.map((j) => (j.job_id === jobId ? { ...j, status: newStatus } : j))
      );
    },
    []
  );

  async function handleArchiveThread(threadId: string) {
    try {
      await archiveThread(threadId);
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      if (activeThreadId === threadId) {
        setActiveThreadId(null);
        setMessages([]);
      }
      showToast('success', 'Chat archived');
    } catch {
      showToast('warning', 'Failed to archive chat');
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
      showToast('success', 'Chat deleted');
    } catch {
      showToast('warning', 'Failed to delete chat');
    }
  }

  return (
    <div
      className="flex bg-slate-900 rounded-xl border border-slate-700 overflow-hidden"
      style={{ height: 'calc(100vh - 260px)', minHeight: '500px' }}
    >
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
          accounts={accounts}
          activeMediaJobs={activeMediaJobs}
          draftAssets={draftAssets}
          publishStatuses={publishStatuses}
          onPublishDraft={handlePublishDraft}
          onMediaAssetReady={handleMediaAssetReady}
          onMediaJobStatusChange={handleMediaJobStatusChange}
          onSendPrompt={handleSendPrompt}
        />
        <ChatMediaSettings
          preferences={mediaPreferences}
          onChange={setMediaPreferences}
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
