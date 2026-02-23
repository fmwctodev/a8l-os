import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader2, ArrowDown } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useAssistant } from '../../../contexts/AssistantContext';
import {
  getThreadMessages,
  sendMessage,
  createThread,
  subscribeToMessages,
} from '../../../services/assistantChat';
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
  } = useAssistant();

  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

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
  }, [messages.length, scrollToBottom]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 80);
  };

  const handleSend = async () => {
    if (!input.trim() || sending || !user) return;
    const text = input.trim();
    setInput('');
    setSending(true);

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

      const result = await sendMessage(threadId, text, pageContext);
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        const newMsgs = [result.userMessage, result.assistantMessage].filter(
          (m) => !ids.has(m.id)
        );
        return [...prev, ...newMsgs];
      });
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          thread_id: activeThreadId || '',
          role: 'assistant',
          content: 'Something went wrong. Please try again.',
          message_type: 'text',
          tool_calls: null,
          metadata: null,
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
        ) : messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}

        {sending && (
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
        <div className="flex items-end gap-2 bg-slate-800 rounded-xl px-3 py-2">
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
            onClick={handleSend}
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
