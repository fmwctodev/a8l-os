import { useState } from 'react';
import { User, Sparkles, AlertTriangle, Volume2, Loader2 } from 'lucide-react';
import type { AssistantMessage, ClaraToolCall, ClaraActionConfirmation, ClaraDraft } from '../../../types/assistant';
import type { ITSRequest, ITSExecutionResult } from '../../../types/its';
import { useAssistant } from '../../../contexts/AssistantContext';
import { textToSpeech } from '../../../services/assistantVoice';
import { useVoicePlayer } from '../../../hooks/useVoicePlayer';
import { ToolReceiptCard } from './ToolReceiptCard';
import { ActionConfirmationCard } from './ActionConfirmationCard';
import { DraftPreviewCard } from './DraftPreviewCard';
import { ExecutionPlanCard } from './ExecutionPlanCard';
import { ExecutionResultCard } from './ExecutionResultCard';
import { ClaraMarkdown } from './ClaraMarkdown';
import { extractCleanResponse } from '../../../lib/claraResponseParser';

interface MessageBubbleProps {
  message: AssistantMessage;
  streaming?: boolean;
}

export function MessageBubble({ message, streaming }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const meta = message.metadata as Record<string, unknown> | null;
  const confirmations = (meta?.confirmations || []) as ClaraActionConfirmation[];
  const drafts = (meta?.drafts || []) as ClaraDraft[];
  const toolCalls = (message.tool_calls || []) as ClaraToolCall[];
  const itsRequest = meta?.its_request as ITSRequest | null;
  const executionResult = meta?.execution_result as ITSExecutionResult | null;
  const executionRequestId = meta?.execution_request_id as string | null;
  const permissionDenied = (meta?.permission_denied || []) as { action_id: string; action_type: string; reason: string }[];
  const integrationErrors = (meta?.integration_errors || []) as { action_id: string; action_type: string; reason: string }[];

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const { profile } = useAssistant();
  const player = useVoicePlayer();
  const [ttsLoading, setTtsLoading] = useState(false);

  const canSpeak = !isUser && profile?.voice_enabled && profile?.elevenlabs_voice_id;

  const displayContent = isUser ? message.content : extractCleanResponse(message.content);

  const handleSpeak = async () => {
    if (!profile?.elevenlabs_voice_id || ttsLoading || player.isPlaying) return;
    setTtsLoading(true);
    try {
      const blob = await textToSpeech(
        displayContent,
        profile.elevenlabs_voice_id,
        profile.speech_rate
      );
      player.play(blob, undefined, profile.output_volume);
    } catch { /* noop */ }
    setTtsLoading(false);
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
          <div className="bg-slate-800 border border-slate-700/50 rounded-2xl rounded-tl-md px-3 py-2 group/bubble">
            <div className="relative">
              <ClaraMarkdown content={displayContent} />
              {streaming && (
                <span className="inline-block w-1.5 h-3.5 bg-cyan-400 ml-0.5 -mb-0.5 animate-pulse rounded-sm" />
              )}
            </div>
            {!streaming && (
              <div className="flex items-center gap-1.5 mt-1">
                <p className="text-[9px] text-slate-500">
                  {formatTime(message.created_at)}
                </p>
                {canSpeak && (
                  <button
                    onClick={handleSpeak}
                    disabled={ttsLoading || player.isPlaying}
                    className="opacity-0 group-hover/bubble:opacity-100 transition-opacity p-0.5 rounded text-slate-500 hover:text-cyan-400 disabled:opacity-50"
                    title="Play aloud"
                  >
                    {ttsLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : player.isPlaying ? (
                      <Volume2 className="w-3 h-3 text-cyan-400 animate-pulse" />
                    ) : (
                      <Volume2 className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {(permissionDenied.length > 0 || integrationErrors.length > 0) && (
            <div className="space-y-1">
              {permissionDenied.map((d) => (
                <div key={d.action_id} className="flex items-start gap-1.5 px-2 py-1.5 bg-red-500/5 border border-red-500/10 rounded-lg">
                  <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-red-400">
                    {d.action_type}: {d.reason}
                  </p>
                </div>
              ))}
              {integrationErrors.map((e) => (
                <div key={e.action_id} className="flex items-start gap-1.5 px-2 py-1.5 bg-amber-500/5 border border-amber-500/10 rounded-lg">
                  <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-400">
                    {e.action_type}: {e.reason}
                  </p>
                </div>
              ))}
            </div>
          )}

          {itsRequest && itsRequest.requires_confirmation && itsRequest.actions.length > 0 && executionRequestId && (
            <ExecutionPlanCard
              itsRequest={itsRequest}
              executionRequestId={executionRequestId}
              threadId={message.thread_id}
            />
          )}

          {executionResult && (
            <ExecutionResultCard executionResult={executionResult} />
          )}

          {toolCalls.length > 0 && (
            <div className="space-y-1">
              {toolCalls.map((tc) => (
                <ToolReceiptCard key={tc.id} toolCall={tc} />
              ))}
            </div>
          )}

          {confirmations.length > 0 && !itsRequest && (
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
