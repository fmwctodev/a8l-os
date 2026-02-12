import { useState, useRef, useEffect } from 'react';
import { ChevronDown, FileText, Braces, MoreVertical } from 'lucide-react';
import { calculateSMSSegments } from '../../../services/channels/twilio';
import { ComposerToolbar } from './ComposerToolbar';
import type { TwilioNumber } from '../../../services/phoneNumbers';

interface SMSComposerContentProps {
  body: string;
  onBodyChange: (body: string) => void;
  onSend: () => void;
  onClear: () => void;
  sending: boolean;
  sendDisabled: boolean;
  expanded: boolean;
  fromNumbers: TwilioNumber[];
  selectedFromNumber: string;
  onFromNumberChange: (number: string) => void;
  toNumber: string;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSnippetClick: () => void;
  canUseSnippets: boolean;
  textareaRef: React.Ref<HTMLTextAreaElement>;
}

export function SMSComposerContent({
  body,
  onBodyChange,
  onSend,
  onClear,
  sending,
  sendDisabled,
  expanded,
  fromNumbers,
  selectedFromNumber,
  onFromNumberChange,
  toNumber,
  onKeyDown,
  onSnippetClick,
  canUseSnippets,
  textareaRef,
}: SMSComposerContentProps) {
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const fromRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (fromRef.current && !fromRef.current.contains(e.target as Node)) {
        setShowFromDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const smsInfo = body ? calculateSMSSegments(body) : null;

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 ${cleaned.slice(1, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
      return `+1 ${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2" ref={fromRef}>
          <span className="text-sm text-gray-500">From:</span>
          <div className="relative">
            <button
              onClick={() => setShowFromDropdown(!showFromDropdown)}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-800 hover:text-gray-900"
            >
              {formatPhone(selectedFromNumber || (fromNumbers[0]?.phone_number ?? ''))}
              <ChevronDown size={14} className="text-gray-400" />
            </button>
            {showFromDropdown && fromNumbers.length > 0 && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 min-w-[200px]">
                {fromNumbers.map((num) => (
                  <button
                    key={num.id}
                    onClick={() => {
                      onFromNumberChange(num.phone_number);
                      setShowFromDropdown(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                      num.phone_number === selectedFromNumber ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    <span>{formatPhone(num.phone_number)}</span>
                    {num.is_default_sms && (
                      <span className="text-xs text-gray-400">(Default)</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">To:</span>
          <span className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
            {formatPhone(toNumber)}
            <ChevronDown size={14} className="text-gray-400" />
          </span>
        </div>
      </div>

      <div className="border-t border-gray-100" />

      <div className="px-4 pt-3 pb-2">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a message"
          className={`w-full text-sm text-gray-800 placeholder-gray-400 resize-y border-none outline-none bg-transparent ${
            expanded ? 'min-h-[200px]' : 'min-h-[100px]'
          }`}
          style={{ maxHeight: expanded ? '400px' : '200px' }}
        />
      </div>

      <ComposerToolbar
        leftIcons={
          <>
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
        centerContent={<>Segs: {smsInfo?.segments ?? 0}</>}
        onClear={onClear}
        onSend={onSend}
        sendDisabled={sendDisabled}
        sending={sending}
      />
    </div>
  );
}
