import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader2, ArrowDown, Volume2, VolumeX, RefreshCw } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useAssistant } from '../../../contexts/AssistantContext';
import {
  getThreadMessages,
  sendMessage,
  sendMessageStreaming,
  sendMessageNonStreaming,
  persistStreamedAssistantMessage,
  createThread,
  subscribeToMessages,
} from '../../../services/assistantChat';
import { createStreamingTTS } from '../../../services/assistantVoice';
import { updateProfile } from '../../../services/assistantProfile';
import { useStreamingPlayer } from '../../../hooks/useStreamingPlayer';
import { isSessionHealthy } from '../../../lib/edgeFunction';
import type { AssistantMessage } from '../../../types/assistant';
import { ThreadSelector } from './ThreadSelector';
import { MessageBubble } from './MessageBubble';

export function AssistantChatView() {
  const { user } = useAuth();
  const {
    activeThreadId,
    setActiveThread,
    pageContext,
    prefilledPrompt,
    clearPrefilledPrompt,
    profile,
    refreshProfile,
  } = useAssistant();

  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [togglingMute, setTogglingMute] = useState(false);
  const [failedPrompt, setFailedPrompt] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const streamAbortRef = useRef<(() => void) | null>(null);
  const ttsControllerRef = useRef<ReturnType<typeof createStreamingTTS> | null>(null);

  const streamingPlayer = useStreamingPlayer(useCallback(() => {
    setIsSpeaking(false);
  }, []));

  useEffect(() => {
    if (!activeThreadId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    getThreadMessages(activeThreadId)
      .then(setMessages)
      .catch(() => {})
      .finally(() => setLoadingMessages(false));
  }, [activeThreadId]);

  useEffect(() => {
    if (!activeThreadId) return;
    const unsub = subscribeToMessages(activeThreadId, (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });
    return unsub;
  }, [activeThreadId]);

  useEffect(() => {
    if (prefilledPrompt) {
      setInput(prefilledPrompt);
      clearPrefilledPrompt();
      inputRef.current?.focus();
    }
  }, [prefilledPrompt, clearPrefilledPrompt]);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, streamingContent, scrollToBottom]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 80);
  };

  const handleSend = async (retryText?: string) => {
    const text = retryText || input.trim();
    if (!text || sending || !user) return;
    if (!retryText) setInput('');
    setSending(true);
    setFailedPrompt(null);

    try {
      let threadId = activeThreadId;
      if (!threadId) {
        const thread = await createThread(
          user.id,
          user.organization_id,
          pageContext.current_module,
          pageContext.current_record_id
        );
        threadId = thread.id;
        setActiveThread(thread.id);
      }

      let usedStreaming = false;

      try {
        const { userMessage, stream, abort } = await sendMessageStreaming(threadId, text, pageContext);
        streamAbortRef.current = abort;
        usedStreaming = true;

        setMessages((prev) => {
          if (prev.some((m) => m.id === userMessage.id)) return prev;
          return [...prev, userMessage];
        });

        const placeholderId = `streaming-${Date.now()}`;
        setStreamingMessageId(placeholderId);
        setStreamingContent('');

        let fullResponse = '';
        let metadata: Record<string, unknown> = {};

        const shouldSpeak = profile?.voice_enabled && profile?.auto_speak_chat && profile?.elevenlabs_voice_id;

        for await (const evt of stream) {
          if (evt.type === 'token' && typeof evt.text === 'string') {
            fullResponse += evt.text;
            setStreamingContent(fullResponse);
          } else if (evt.type === 'done') {
            fullResponse = (evt.response as string) || fullResponse;
            setStreamingContent(fullResponse);
            metadata = { model_used: evt.model_used };
          } else if (evt.type === 'plan') {
            fullResponse = (evt.response as string) || fullResponse;
            setStreamingContent(fullResponse);
            metadata = { its_request: evt.its_request, model_used: evt.model_used };
          } else if (evt.type === 'execution_result') {
            fullResponse = (evt.response as string) || fullResponse;
            setStreamingContent(fullResponse);
            metadata = {
              its_request: evt.its_request,
              execution_result: evt.execution_result,
              model_used: evt.model_used,
            };
          } else if (evt.type === 'error') {
            throw new Error(evt.message as string);
          }
        }

        if (shouldSpeak && fullResponse && profile?.elevenlabs_voice_id) {
          setIsSpeaking(true);
          const tts = createStreamingTTS(profile.elevenlabs_voice_id, profile.speech_rate);
          ttsControllerRef.current = tts;
          tts.onAudioChunk((chunk) => streamingPlayer.enqueue(chunk));
          tts.onDone(() => streamingPlayer.finalize());
          tts.onError(() => {});
          tts.start([fullResponse]);
        }

        setStreamingMessageId(null);
        setStreamingContent('');

        if (threadId && fullResponse) {
          persistStreamedAssistantMessage(threadId, fullResponse, metadata)
            .then((assistantMsg) => {
              setMessages((prev) => {
                if (prev.some((m) => m.id === assistantMsg.id)) return prev;
                return [...prev, assistantMsg];
              });
            })
            .catch(() => {
              setMessages((prev) => [
                ...prev,
                {
                  id: `local-${Date.now()}`,
                  thread_id: threadId!,
                  role: 'assistant',
                  content: fullResponse,
                  message_type: 'text',
                  tool_calls: null,
                  metadata,
                  created_at: new Date().toISOString(),
                },
              ]);
            });
        }
      } catch (streamErr) {
        setStreamingMessageId(null);
        setStreamingContent('');

        const chatResponse = await sendMessageNonStreaming(threadId, text, pageContext);

        setMessages((prev) => [
          ...prev,
          {
            id: `fallback-${Date.now()}`,
            thread_id: threadId!,
            role: 'assistant',
            content: chatResponse.response,
            message_type: 'text',
            tool_calls: null,
            metadata: { model_used: chatResponse.model_used },
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      setStreamingMessageId(null);
      setStreamingContent('');
      console.error('[Clara] Send failed:', err);
      const raw = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      const isAuthError = /invalid jwt|authentication required|session expired|unauthorized/i.test(raw);
      const msg = isAuthError
        ? 'Your session has expired. Please refresh the page or log out and back in.'
        : raw;
      if (isAuthError) setFailedPrompt(text);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          thread_id: activeThreadId || '',
          role: 'assistant',
          content: msg,
          message_type: 'text',
          tool_calls: null,
          metadata: { is_auth_error: isAuthError },
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700/40">
        <ThreadSelector />
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0 scrollbar-thin"
      >
        {loadingMessages ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
          </div>
        ) : messages.length === 0 && !streamingMessageId ? (
          <EmptyState />
        ) : (
          messages.map((msg) => (
            <div key={msg.id}>
              <MessageBubble message={msg} />
              {msg.id.startsWith('error-') && (msg.metadata as Record<string, unknown>)?.is_auth_error && failedPrompt && (
                <div className="flex items-center gap-2 mt-1.5 ml-8">
                  <button
                    onClick={() => {
                      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
                      handleSend(failedPrompt);
                    }}
                    disabled={sending || !isSessionHealthy()}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 rounded-full hover:bg-cyan-400/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    Retry
                  </button>
                  <span className="text-[9px] text-slate-600">Session may have recovered</span>
                </div>
              )}
            </div>
          ))
        )}

        {streamingMessageId && streamingContent && (
          <MessageBubble
            message={{
              id: streamingMessageId,
              thread_id: activeThreadId || '',
              role: 'assistant',
              content: streamingContent,
              message_type: 'text',
              tool_calls: null,
              metadata: null,
              created_at: new Date().toISOString(),
            }}
            streaming
          />
        )}

        {sending && !streamingContent && (
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-[10px] text-slate-500">Clara is thinking...</span>
          </div>
        )}
      </div>

      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 p-1.5 bg-slate-800 border border-slate-700 rounded-full shadow-lg text-slate-400 hover:text-white transition-colors"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
      )}

      <div className="px-3 py-2 border-t border-slate-700/40">
        {isSpeaking && (
          <div className="flex items-center gap-2 mb-1.5 px-2">
            <div className="flex gap-0.5 items-end">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="w-0.5 bg-cyan-400 rounded-full animate-pulse"
                  style={{
                    height: `${8 + (i % 2) * 6}px`,
                    animationDelay: `${i * 100}ms`,
                  }}
                />
              ))}
            </div>
            <span className="text-[10px] text-cyan-400">Clara is speaking...</span>
            <button
              onClick={() => {
                streamingPlayer.stop();
                ttsControllerRef.current?.cancel();
                setIsSpeaking(false);
              }}
              className="ml-auto text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              Stop
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 bg-slate-800 rounded-xl px-3 py-2">
          {profile?.voice_enabled && (
            <button
              onClick={async () => {
                if (!user || togglingMute) return;
                setTogglingMute(true);
                try {
                  await updateProfile(user.id, { auto_speak_chat: !profile.auto_speak_chat });
                  await refreshProfile();
                } catch { /* noop */ }
                setTogglingMute(false);
              }}
              disabled={togglingMute}
              className={`p-1 rounded-md transition-colors flex-shrink-0 ${
                profile.auto_speak_chat
                  ? 'text-cyan-400 hover:text-cyan-300'
                  : 'text-slate-600 hover:text-slate-400'
              }`}
              title={profile.auto_speak_chat ? 'Auto-speak on (click to mute)' : 'Auto-speak off (click to unmute)'}
            >
              {profile.auto_speak_chat ? (
                <Volume2 className="w-3.5 h-3.5" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" />
              )}
            </button>
          )}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Clara anything..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 resize-none outline-none max-h-24"
            style={{ minHeight: '20px' }}
            disabled={sending}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || sending}
            className="p-1.5 rounded-lg bg-cyan-600 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-cyan-500 transition-colors flex-shrink-0"
          >
            {sending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        <p className="text-[9px] text-slate-600 text-center mt-1">
          Ctrl+Shift+K to toggle &middot; Clara may make mistakes
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-600/20 border border-cyan-500/20 flex items-center justify-center mb-3">
        <span className="text-lg">&#10024;</span>
      </div>
      <h4 className="text-sm font-medium text-white mb-1">Hi, I'm Clara</h4>
      <p className="text-xs text-slate-400 leading-relaxed max-w-[260px]">
        Your personal AI assistant. I can help with emails, calendar, contacts, opportunities, and more.
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
        {['Check my calendar today', 'Draft a follow-up email', 'Show pipeline summary'].map((s) => (
          <span
            key={s}
            className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-full text-[10px] text-slate-400"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
