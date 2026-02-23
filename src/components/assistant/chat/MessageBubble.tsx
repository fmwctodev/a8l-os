import { User, Sparkles } from 'lucide-react';
import type { AssistantMessage, ClaraToolCall, ClaraActionConfirmation, ClaraDraft } from '../../../types/assistant';
import { ToolReceiptCard } from './ToolReceiptCard';
import { ActionConfirmationCard } from './ActionConfirmationCard';
import { DraftPreviewCard } from './DraftPreviewCard';

interface MessageBubbleProps {
  message: AssistantMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const meta = message.metadata as Record<string, unknown> | null;
  const confirmations = (meta?.confirmations || []) as ClaraActionConfirmation[];
  const drafts = (meta?.drafts || []) as ClaraDraft[];
  const toolCalls = (message.tool_calls || []) as ClaraToolCall[];

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="flex items-start gap-2 max-w-[85%]">
          <div className="bg-cyan-600/20 border border-cyan-500/20 rounded-2xl rounded-tr-md px-3 py-2">
            <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
              {message.content}
            </p>
            <p className="text-[9px] text-slate-500 text-right mt-1">
              {formatTime(message.created_at)}
            </p>
          </div>
          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
            <User className="w-3 h-3 text-slate-400" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="flex items-start gap-2 max-w-[85%]">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles className="w-3 h-3 text-white" />
        </div>
        <div className="space-y-2">
          <div className="bg-slate-800 border border-slate-700/50 rounded-2xl rounded-tl-md px-3 py-2">
            <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
              {message.content}
            </p>
            <p className="text-[9px] text-slate-500 mt-1">
              {formatTime(message.created_at)}
            </p>
          </div>

          {toolCalls.length > 0 && (
            <div className="space-y-1">
              {toolCalls.map((tc) => (
                <ToolReceiptCard key={tc.id} toolCall={tc} />
              ))}
            </div>
          )}

          {confirmations.length > 0 && (
            <div className="space-y-1.5">
              {confirmations.map((c) => (
                <ActionConfirmationCard key={c.id} confirmation={c} threadId={message.thread_id} />
              ))}
            </div>
          )}

          {drafts.length > 0 && (
            <div className="space-y-1.5">
              {drafts.map((d) => (
                <DraftPreviewCard key={d.id} draft={d} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
