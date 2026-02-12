import { useState, useRef, useCallback } from 'react';
import { Smile } from 'lucide-react';
import { MentionDropdown } from './MentionDropdown';

interface MentionUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

interface InternalCommentContentProps {
  body: string;
  onBodyChange: (body: string) => void;
  onSend: () => void;
  onClear: () => void;
  sending: boolean;
  sendDisabled: boolean;
  expanded: boolean;
  mentions: string[];
  onMentionsChange: (mentions: string[]) => void;
  currentUserId?: string;
}

export function InternalCommentContent({
  body,
  onBodyChange,
  onSend,
  onClear,
  sending,
  sendDisabled,
  expanded,
  mentions,
  onMentionsChange,
  currentUserId,
}: InternalCommentContentProps) {
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleBodyChange = useCallback((value: string) => {
    onBodyChange(value);

    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex >= 0) {
      const charBefore = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' ';
      const textAfterAt = textBeforeCursor.slice(atIndex + 1);
      const hasSpace = textAfterAt.includes(' ') && textAfterAt.indexOf(' ') < textAfterAt.length - 1;

      if ((charBefore === ' ' || charBefore === '\n' || atIndex === 0) && !hasSpace) {
        setShowMentionDropdown(true);
        setMentionQuery(textAfterAt);
        setMentionStart(atIndex);
        return;
      }
    }

    setShowMentionDropdown(false);
    setMentionQuery('');
  }, [onBodyChange]);

  const handleMentionSelect = useCallback((user: MentionUser) => {
    const mentionText = `@[${user.name}](${user.id})`;
    const beforeMention = body.slice(0, mentionStart);
    const textarea = textareaRef.current;
    const cursorPos = textarea?.selectionStart ?? body.length;
    const afterMention = body.slice(cursorPos);

    const newBody = beforeMention + mentionText + ' ' + afterMention;
    onBodyChange(newBody);

    if (!mentions.includes(user.id)) {
      onMentionsChange([...mentions, user.id]);
    }

    setShowMentionDropdown(false);
    setMentionQuery('');
    setMentionStart(-1);

    setTimeout(() => {
      if (textarea) {
        const newCursorPos = beforeMention.length + mentionText.length + 1;
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  }, [body, mentionStart, mentions, onBodyChange, onMentionsChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentionDropdown) {
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab'].includes(e.key)) {
        e.preventDefault();
        return;
      }
      if (e.key === 'Escape') {
        setShowMentionDropdown(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && !showMentionDropdown) {
      e.preventDefault();
      onSend();
    }
  };

  const getDisplayBody = () => {
    return body.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
  };

  return (
    <div className="flex flex-col bg-amber-50/80">
      <div className="px-4 pt-3 pb-2 relative">
        <textarea
          ref={textareaRef}
          value={getDisplayBody()}
          onChange={(e) => {
            const displayVal = e.target.value;
            let rawVal = displayVal;
            const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
            let match;
            while ((match = mentionRegex.exec(body)) !== null) {
              const displayName = `@${match[1]}`;
              if (rawVal.includes(displayName)) {
                rawVal = rawVal.replace(displayName, match[0]);
              }
            }
            handleBodyChange(rawVal);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Write a comment and use @ to mention users. This is not visible to the contact."
          className={`w-full text-sm text-gray-800 placeholder-gray-400 resize-y border-none outline-none bg-transparent ${
            expanded ? 'min-h-[200px]' : 'min-h-[100px]'
          }`}
          style={{ maxHeight: expanded ? '400px' : '200px' }}
        />

        {showMentionDropdown && (
          <MentionDropdown
            query={mentionQuery}
            position={{ top: 40, left: 16 }}
            onSelect={handleMentionSelect}
            onClose={() => setShowMentionDropdown(false)}
            excludeUserId={currentUserId}
          />
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-t border-amber-200/60">
        <div className="flex items-center gap-1">
          <button
            className="p-2 text-gray-400 hover:text-gray-600 rounded transition-colors"
            title="Emoji"
          >
            <Smile size={18} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onClear}
            className="px-4 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-white/60 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={onSend}
            disabled={sendDisabled}
            className="px-6 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-2" />
            ) : (
              'Send'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
