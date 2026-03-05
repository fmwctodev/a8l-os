import { useState, useRef, useEffect } from 'react';
import { Send, X, Loader2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { getGoogleErrorMessage } from '../../utils/googleAuthErrors';

interface GoogleChatComposerProps {
  onSend: (text: string, threadId?: string) => Promise<void>;
  replyToThread: string | null;
  onCancelReply: () => void;
  disabled?: boolean;
}

export function GoogleChatComposer({
  onSend,
  replyToThread,
  onCancelReply,
  disabled,
}: GoogleChatComposerProps) {
  const { showToast } = useToast();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleSend = async () => {
    const trimmedText = text.trim();
    if (!trimmedText || sending || disabled) return;

    try {
      setSending(true);
      await onSend(trimmedText, replyToThread || undefined);
      setText('');
      onCancelReply();
    } catch (error) {
      console.error('Failed to send message:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      const errInfo = getGoogleErrorMessage(errMsg, 'chat');
      showToast('warning', errInfo.title, errInfo.description);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-slate-700 bg-slate-800 p-4">
      {replyToThread && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-slate-700/50 rounded-lg">
          <div className="flex-1">
            <span className="text-xs text-slate-400">Replying to thread</span>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1 rounded hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex items-end gap-3">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={disabled || sending}
            rows={1}
            className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 resize-none focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending || disabled}
          className="flex-shrink-0 w-11 h-11 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-cyan-600"
        >
          {sending ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <Send size={20} />
          )}
        </button>
      </div>

      <p className="text-xs text-slate-500 mt-2 px-1">
        Press Enter to send, Shift + Enter for new line
      </p>
    </div>
  );
}
