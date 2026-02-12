import { useState } from 'react';
import { ChevronDown, MoreHorizontal, FileText, Braces, MoreVertical, Type, Link, Image } from 'lucide-react';
import { ComposerToolbar } from './ComposerToolbar';
import { ContactEmailAutocomplete } from './ContactEmailAutocomplete';

interface EmailRecipient {
  email: string;
  name: string;
  contactId?: string;
}

interface EmailComposerContentProps {
  body: string;
  onBodyChange: (body: string) => void;
  subject: string;
  onSubjectChange: (subject: string) => void;
  onSend: () => void;
  onClear: () => void;
  sending: boolean;
  sendDisabled: boolean;
  expanded: boolean;
  fromName: string;
  fromEmail: string;
  toEmail: string;
  toName: string;
  ccRecipients: EmailRecipient[];
  onCcChange: (recipients: EmailRecipient[]) => void;
  bccRecipients: EmailRecipient[];
  onBccChange: (recipients: EmailRecipient[]) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSnippetClick: () => void;
  canUseSnippets: boolean;
  textareaRef: React.Ref<HTMLTextAreaElement>;
}

export function EmailComposerContent({
  body,
  onBodyChange,
  subject,
  onSubjectChange,
  onSend,
  onClear,
  sending,
  sendDisabled,
  expanded,
  fromName,
  fromEmail,
  toEmail,
  toName,
  ccRecipients,
  onCcChange,
  bccRecipients,
  onBccChange,
  onKeyDown,
  onSnippetClick,
  canUseSnippets,
  textareaRef,
}: EmailComposerContentProps) {
  const [showCc, setShowCc] = useState(ccRecipients.length > 0);
  const [showBcc, setShowBcc] = useState(bccRecipients.length > 0);

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;

  const toInitial = toName
    ? toName.charAt(0).toUpperCase()
    : toEmail.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-gray-500 shrink-0">From Name:</span>
          <span className="text-sm font-medium text-gray-800 truncate">{fromName}</span>
          <button className="p-1 text-gray-400 hover:text-gray-600 shrink-0">
            <MoreHorizontal size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-gray-500 shrink-0">From email:</span>
          <span className="text-sm text-gray-800 truncate">{fromEmail}</span>
        </div>
      </div>

      <div className="border-t border-gray-100" />

      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm text-gray-500 shrink-0">To:</span>
          <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-medium shrink-0">
            {toInitial}
          </div>
          <span className="text-sm text-gray-800 truncate">
            {toEmail}
            <span className="text-gray-400 ml-1">(Primary)</span>
          </span>
          <ChevronDown size={14} className="text-gray-400 shrink-0" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowCc(!showCc)}
            className={`text-sm font-medium transition-colors ${
              showCc ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            CC
          </button>
          <button
            onClick={() => setShowBcc(!showBcc)}
            className={`text-sm font-medium transition-colors ${
              showBcc ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            BCC
          </button>
        </div>
      </div>

      {showCc && (
        <>
          <div className="border-t border-gray-100" />
          <ContactEmailAutocomplete
            label="CC"
            recipients={ccRecipients}
            onChange={onCcChange}
          />
        </>
      )}

      {showBcc && (
        <>
          <div className="border-t border-gray-100" />
          <ContactEmailAutocomplete
            label="BCC"
            recipients={bccRecipients}
            onChange={onBccChange}
          />
        </>
      )}

      <div className="border-t border-gray-100" />

      <div className="px-4 py-2">
        <input
          type="text"
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="Subject:"
          className="w-full text-sm text-gray-800 placeholder-gray-400 border-none outline-none bg-transparent"
        />
      </div>

      <div className="border-t border-gray-100" />

      <div className="px-4 pt-3 pb-2">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Write your email..."
          className={`w-full text-sm text-gray-800 placeholder-gray-400 resize-y border-none outline-none bg-transparent ${
            expanded ? 'min-h-[200px]' : 'min-h-[100px]'
          }`}
          style={{ maxHeight: expanded ? '400px' : '200px' }}
        />
      </div>

      <ComposerToolbar
        leftIcons={
          <>
            <button
              className="p-2 text-gray-400 hover:text-gray-600 rounded transition-colors"
              title="Text formatting"
            >
              <Type size={18} />
            </button>
            {canUseSnippets && (
              <button
                onClick={onSnippetClick}
                className="p-2 text-gray-400 hover:text-gray-600 rounded transition-colors"
                title="Insert Snippet"
              >
                <FileText size={18} />
              </button>
            )}
            <button
              className="p-2 text-gray-400 hover:text-gray-600 rounded transition-colors"
              title="Insert link"
            >
              <Link size={18} />
            </button>
            <button
              className="p-2 text-gray-400 hover:text-gray-600 rounded transition-colors"
              title="Insert image"
            >
              <Image size={18} />
            </button>
            <button
              className="p-2 text-gray-400 hover:text-gray-600 rounded transition-colors"
              title="Merge Fields"
            >
              <Braces size={18} />
            </button>
            <button
              className="p-2 text-gray-400 hover:text-gray-600 rounded transition-colors"
              title="More options"
            >
              <MoreVertical size={18} />
            </button>
          </>
        }
        centerContent={<>{wordCount} word{wordCount !== 1 ? 's' : ''}</>}
        onClear={onClear}
        onSend={onSend}
        sendDisabled={sendDisabled}
        sending={sending}
      />
    </div>
  );
}
