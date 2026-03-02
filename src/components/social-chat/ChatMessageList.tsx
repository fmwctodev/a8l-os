import { useRef, useEffect, useMemo } from 'react';
import {
  BrainCircuit,
  User,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import { isJobActive } from '../../services/mediaGeneration';
import { PostDraftCard } from './PostDraftCard';
import { ChatMediaTracker } from './ChatMediaTracker';
import type { SocialAIMessage } from '../../types';
import type { PostDraft, SocialAccount } from './PostDraftCard';
import type { MediaJobInfo, PublishMode } from '../../services/socialChat';
import type { MediaAsset } from '../../services/mediaGeneration';

interface ChatMessageListProps {
  messages: SocialAIMessage[];
  isTyping: boolean;
  accounts: SocialAccount[];
  activeMediaJobs: MediaJobInfo[];
  draftAssets: Record<string, MediaAsset[]>;
  publishStatuses: Record<string, { mode: PublishMode; scheduledAt?: string }>;
  onPublishDraft: (
    msgId: string,
    draftIndex: number,
    draft: PostDraft,
    mode: PublishMode,
    accountIds: string[],
    media: Array<{ url: string; type: string; thumbnail_url?: string }>,
    mediaAssetIds: string[],
    scheduledAt?: string
  ) => void;
  onMediaAssetReady: (messageId: string, draftIndex: number, assets: MediaAsset[]) => void;
  onMediaJobStatusChange: (jobId: string, newStatus: string) => void;
  onSendPrompt: (prompt: string) => void;
}

export function ChatMessageList({
  messages,
  isTyping,
  accounts,
  activeMediaJobs,
  draftAssets,
  publishStatuses,
  onPublishDraft,
  onMediaAssetReady,
  onMediaJobStatusChange,
  onSendPrompt,
}: ChatMessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const hasActiveMediaJobs = useMemo(
    () => activeMediaJobs.some((j) => isJobActive(j.status)),
    [activeMediaJobs]
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, hasActiveMediaJobs]);

  if (messages.length === 0 && !isTyping) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
        <div className="w-16 h-16 bg-cyan-500/10 rounded-2xl flex items-center justify-center mb-6">
          <BrainCircuit className="w-8 h-8 text-cyan-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">
          AI Social Manager
        </h3>
        <p className="text-sm text-slate-400 text-center max-w-md mb-8">
          Your dedicated AI strategist for social media. Ask me to create posts, plan campaigns, analyze content, or develop your social strategy.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
          {STARTER_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => onSendPrompt(prompt)}
              className="text-left p-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 hover:border-cyan-500/50 hover:text-white transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
      {messages.map((msg) => {
        const isUser = msg.role === 'user';
        const { cleanContent, drafts } = resolveDrafts(msg);
        const msgMediaJobs = getMediaJobsForMessage(msg, activeMediaJobs);
        const mediaSkippedReason = (msg.metadata as Record<string, unknown> | null)?.media_skipped_reason as string | undefined;

        return (
          <div
            key={msg.id}
            className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isUser ? 'bg-slate-700' : 'bg-cyan-500/10'
              }`}
            >
              {isUser ? (
                <User className="w-4 h-4 text-slate-400" />
              ) : (
                <BrainCircuit className="w-4 h-4 text-cyan-400" />
              )}
            </div>

            <div className={`max-w-[75%] ${isUser ? 'text-right' : ''}`}>
              <div
                className={`inline-block text-sm leading-relaxed rounded-2xl px-4 py-3 ${
                  isUser
                    ? 'bg-cyan-600 text-white rounded-tr-md'
                    : 'bg-slate-800 text-slate-200 rounded-tl-md border border-slate-700'
                }`}
              >
                <div className="whitespace-pre-wrap">{cleanContent}</div>
              </div>

              {msgMediaJobs.length > 0 && (
                <ChatMediaTracker
                  jobs={msgMediaJobs}
                  onAssetReady={onMediaAssetReady}
                  onJobStatusChange={onMediaJobStatusChange}
                />
              )}

              {drafts.length > 0 && (
                <div className="mt-2 text-left">
                  {drafts.map((draft, idx) => {
                    const jobsForDraft = msgMediaJobs.filter(
                      (j) => j.draft_index === idx
                    );
                    const isGenerating =
                      jobsForDraft.length > 0 &&
                      jobsForDraft.some(
                        (j) =>
                          j.status === 'waiting' ||
                          j.status === 'queuing' ||
                          j.status === 'generating'
                      );

                    return (
                      <PostDraftCard
                        key={idx}
                        draft={draft}
                        accounts={accounts}
                        attachedAssets={draftAssets[`${msg.id}-${idx}`] || []}
                        mediaGenerating={isGenerating}
                        mediaSkippedReason={!isGenerating && jobsForDraft.length === 0 ? mediaSkippedReason : undefined}
                        onPublish={(d, mode, acctIds, media, assetIds, scheduledAt) =>
                          onPublishDraft(msg.id, idx, d, mode, acctIds, media, assetIds, scheduledAt)
                        }
                        publishStatus={publishStatuses[`${msg.id}-${idx}`] || null}
                      />
                    );
                  })}
                </div>
              )}

              <div
                className={`text-[11px] text-slate-600 mt-1 ${
                  isUser ? 'text-right' : ''
                }`}
              >
                {formatTime(msg.created_at)}
              </div>
            </div>
          </div>
        );
      })}

      {isTyping && (
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
            <BrainCircuit className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-md px-4 py-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}

      {!isTyping && hasActiveMediaJobs && (
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
            <BrainCircuit className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-md px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
              <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
              <span>Generating media...</span>
            </div>
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}

const STARTER_PROMPTS = [
  'Create a week of Instagram posts for my business',
  'Suggest a content strategy for LinkedIn',
  'Write an engaging tweet about our new feature',
  'Help me plan a social media campaign',
];

interface ParsedDraft {
  platform: string;
  body: string;
  hook_text?: string;
  cta_text?: string;
  hashtags?: string[];
  visual_style_suggestion?: string;
  media_type?: string;
}

function parseMessageContent(content: string): {
  cleanContent: string;
  drafts: ParsedDraft[];
} {
  const drafts: ParsedDraft[] = [];
  const draftRegex = /---DRAFT---\s*([\s\S]*?)\s*---END_DRAFT---/g;
  let match;

  while ((match = draftRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.body) {
        drafts.push(parsed);
      }
    } catch {
      // skip malformed
    }
  }

  const cleanContent = content
    .replace(/---DRAFT---[\s\S]*?---END_DRAFT---/g, '')
    .trim();

  return { cleanContent, drafts };
}

function resolveDrafts(msg: SocialAIMessage): {
  cleanContent: string;
  drafts: ParsedDraft[];
} {
  const parsed = parseMessageContent(msg.content);

  if (parsed.drafts.length > 0) {
    return parsed;
  }

  if (
    msg.generated_posts &&
    Array.isArray(msg.generated_posts) &&
    msg.generated_posts.length > 0
  ) {
    const fallbackDrafts: ParsedDraft[] = msg.generated_posts.map((gp) => {
      const raw = gp as Record<string, unknown>;
      return {
        platform: (raw.platform as string) || 'all',
        body: (raw.body as string) || '',
        hook_text:
          (raw.hook_text as string) || (raw.hook as string) || undefined,
        cta_text:
          (raw.cta_text as string) || (raw.cta as string) || undefined,
        hashtags: (raw.hashtags as string[]) || undefined,
        visual_style_suggestion:
          (raw.visual_style_suggestion as string) || undefined,
        media_type: (raw.media_type as string) || undefined,
      };
    });
    return { cleanContent: parsed.cleanContent, drafts: fallbackDrafts };
  }

  return parsed;
}

function getMediaJobsForMessage(
  msg: SocialAIMessage,
  allJobs: MediaJobInfo[]
): MediaJobInfo[] {
  const metadata = msg.metadata as Record<string, unknown> | null;
  const msgJobs = metadata?.media_jobs as MediaJobInfo[] | undefined;
  if (!msgJobs || msgJobs.length === 0) return [];
  const jobIds = new Set(msgJobs.map(j => j.job_id));
  return allJobs.filter(j => jobIds.has(j.job_id));
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
