import { useRef, useEffect } from 'react';
import {
  BrainCircuit,
  User,
  Loader2,
} from 'lucide-react';
import { PostDraftCard } from './PostDraftCard';
import type { SocialAIMessage } from '../../types';

interface ParsedDraft {
  platform: string;
  body: string;
  hook_text?: string;
  cta_text?: string;
  hashtags?: string[];
  visual_style_suggestion?: string;
}

interface ChatMessageListProps {
  messages: SocialAIMessage[];
  isTyping: boolean;
  onScheduleDraft: (draft: ParsedDraft) => void;
}

export function ChatMessageList({
  messages,
  isTyping,
  onScheduleDraft,
}: ChatMessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

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
        const { cleanContent, drafts } = parseMessageContent(msg.content);

        return (
          <div
            key={msg.id}
            className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isUser
                  ? 'bg-slate-700'
                  : 'bg-cyan-500/10'
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

              {drafts.length > 0 && (
                <div className="mt-2 text-left">
                  {drafts.map((draft, idx) => (
                    <PostDraftCard
                      key={idx}
                      draft={draft}
                      onSchedule={onScheduleDraft}
                    />
                  ))}
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

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
