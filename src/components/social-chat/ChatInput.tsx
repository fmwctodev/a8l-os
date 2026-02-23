import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Loader2,
  Paperclip,
  Link,
  X,
} from 'lucide-react';

interface ChatInputProps {
  onSend: (content: string, messageType?: string, attachments?: Array<{ type: string; url: string; title?: string }>) => void;
  disabled?: boolean;
  sending?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled,
  sending,
  placeholder = 'Ask your AI social manager...',
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [value]);

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed || disabled || sending) return;

    if (urlInput.trim()) {
      onSend(trimmed, 'url_share', [{ type: 'url', url: urlInput.trim() }]);
      setUrlInput('');
      setShowUrlInput(false);
    } else {
      onSend(trimmed);
    }
    setValue('');

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="border-t border-slate-700 bg-slate-800 p-4">
      {showUrlInput && (
        <div className="flex items-center gap-2 mb-3 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
          <Link className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <input
            type="url"
            placeholder="Paste a URL to analyze..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <button
            onClick={() => {
              setShowUrlInput(false);
              setUrlInput('');
            }}
            className="p-1 text-slate-500 hover:text-slate-400"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowUrlInput(!showUrlInput)}
            className={`p-2 rounded-lg transition-colors ${
              showUrlInput
                ? 'text-cyan-400 bg-cyan-400/10'
                : 'text-slate-500 hover:text-slate-400 hover:bg-slate-700'
            }`}
            title="Share a URL"
          >
            <Link className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || sending}
            rows={1}
            className="w-full resize-none bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50 transition-colors"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!value.trim() || disabled || sending}
          className="p-3 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>

      <div className="flex items-center gap-3 mt-2 px-1">
        <span className="text-[11px] text-slate-600">
          Try: "Create a post about..." or "Suggest a content strategy"
        </span>
      </div>
    </div>
  );
}
