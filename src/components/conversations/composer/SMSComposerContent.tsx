import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, FileText, Paperclip, X, Image, File, AlertCircle, ClipboardList } from 'lucide-react';
import { calculateSMSSegments } from '../../../lib/phoneUtils';
import { ComposerToolbar } from './ComposerToolbar';
import { FormSurveyPicker, type PickerItem } from './FormSurveyPicker';
import { MMS_MAX_FILES, MMS_MAX_FILE_SIZE } from '../../../services/sendSms';
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
  mediaFiles: File[];
  onMediaChange: (files: File[]) => void;
  mediaError: string | null;
  onMediaError: (err: string | null) => void;
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
  mediaFiles,
  onMediaChange,
  mediaError,
  onMediaError,
}: SMSComposerContentProps) {
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showFormSurveyPicker, setShowFormSurveyPicker] = useState(false);
  const fromRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInsertFormSurveyLink = (item: PickerItem) => {
    const path = item.kind === 'form' ? 'f' : 's';
    const url = `${window.location.origin}/${path}/${item.slug}`;
    let newBody = body;
    let textarea: HTMLTextAreaElement | null = null;
    if (textareaRef && typeof textareaRef === 'object' && 'current' in textareaRef) {
      textarea = (textareaRef as React.RefObject<HTMLTextAreaElement>).current;
    }
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      newBody = body.substring(0, start) + url + body.substring(end);
    } else {
      const sep = body.length > 0 && !/\s$/.test(body) ? ' ' : '';
      newBody = body + sep + url;
    }
    onBodyChange(newBody);
    setShowFormSurveyPicker(false);
  };

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

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    e.target.value = '';
    const combined = [...mediaFiles, ...selected];

    if (combined.length > MMS_MAX_FILES) {
      onMediaError(`Maximum ${MMS_MAX_FILES} attachments allowed`);
      return;
    }

    const oversized = selected.find(f => f.size > MMS_MAX_FILE_SIZE);
    if (oversized) {
      onMediaError(`"${oversized.name}" exceeds the 5 MB limit`);
      return;
    }

    onMediaError(null);
    onMediaChange(combined);
  }, [mediaFiles, onMediaChange, onMediaError]);

  const removeMedia = useCallback((index: number) => {
    onMediaChange(mediaFiles.filter((_, i) => i !== index));
    onMediaError(null);
  }, [mediaFiles, onMediaChange, onMediaError]);

  const selectedNum = fromNumbers.find(n => n.phone_number === selectedFromNumber);
  const canSendMms = selectedNum?.capabilities?.mms ?? false;

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2" ref={fromRef}>
          <span className="text-sm text-slate-400">From:</span>
          <div className="relative">
            <button
              onClick={() => setShowFromDropdown(!showFromDropdown)}
              className="flex items-center gap-1.5 text-sm font-medium text-white hover:text-slate-200"
            >
              {formatPhone(selectedFromNumber || (fromNumbers[0]?.phone_number ?? ''))}
              <ChevronDown size={14} className="text-slate-500" />
            </button>
            {showFromDropdown && fromNumbers.length > 0 && (
              <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-30 min-w-[220px]">
                {fromNumbers.map((num) => (
                  <button
                    key={num.id}
                    onClick={() => {
                      onFromNumberChange(num.phone_number);
                      setShowFromDropdown(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-700 first:rounded-t-lg last:rounded-b-lg ${
                      num.phone_number === selectedFromNumber ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-300'
                    }`}
                  >
                    <span className="flex-1">{formatPhone(num.phone_number)}</span>
                    <div className="flex items-center gap-1">
                      {num.capabilities.mms && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-teal-900/60 text-teal-400">MMS</span>
                      )}
                      {num.is_default_sms && (
                        <span className="text-[10px] text-slate-500">Default</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">To:</span>
          <span className="text-sm font-medium text-white">
            {formatPhone(toNumber)}
          </span>
        </div>
      </div>

      <div className="border-t border-slate-700" />

      {mediaFiles.length > 0 && (
        <div className="px-4 pt-3 flex flex-wrap gap-2">
          {mediaFiles.map((file, i) => (
            <MediaPreviewChip key={i} file={file} onRemove={() => removeMedia(i)} />
          ))}
        </div>
      )}

      {mediaError && (
        <div className="mx-4 mt-2 flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle size={12} />
          {mediaError}
        </div>
      )}

      <div className="px-4 pt-3 pb-2">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={mediaFiles.length > 0 ? 'Add a caption (optional)' : 'Type a message'}
          className={`w-full text-sm text-white placeholder-slate-500 resize-y border-none outline-none bg-transparent ${
            expanded ? 'min-h-[200px]' : 'min-h-[80px]'
          }`}
          style={{ maxHeight: expanded ? '400px' : '200px' }}
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/mp4,audio/mpeg,audio/ogg,application/pdf"
        className="hidden"
        onChange={handleFileSelect}
      />

      <ComposerToolbar
        leftIcons={
          <>
            {canUseSnippets && (
              <button
                onClick={onSnippetClick}
                className="p-2 text-slate-400 hover:text-white rounded transition-colors"
                title="Insert Snippet"
              >
                <FileText size={18} />
              </button>
            )}
            <button
              onClick={() => setShowFormSurveyPicker(true)}
              className="p-2 text-slate-400 hover:text-white rounded transition-colors"
              title="Insert form or survey link"
            >
              <ClipboardList size={18} />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!canSendMms}
              className={`p-2 rounded transition-colors ${
                canSendMms
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
              title={canSendMms ? 'Attach media (MMS)' : 'Selected number does not support MMS'}
            >
              <Paperclip size={18} />
            </button>
          </>
        }
        centerContent={
          <>
            {mediaFiles.length > 0 && (
              <span className="text-teal-400 text-xs mr-2">
                {mediaFiles.length} file{mediaFiles.length !== 1 ? 's' : ''}
              </span>
            )}
            Segs: {smsInfo?.segments ?? 0}
          </>
        }
        onClear={onClear}
        onSend={onSend}
        sendDisabled={sendDisabled}
        sending={sending}
      />

      <FormSurveyPicker
        open={showFormSurveyPicker}
        onClose={() => setShowFormSurveyPicker(false)}
        onSelect={handleInsertFormSurveyLink}
      />
    </div>
  );
}

function MediaPreviewChip({ file, onRemove }: { file: File; onRemove: () => void }) {
  const isImage = file.type.startsWith('image/');
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!isImage) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  const sizeLabel =
    file.size < 1024 * 1024
      ? `${(file.size / 1024).toFixed(0)} KB`
      : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div className="relative flex items-center gap-2 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5">
      {isImage && preview ? (
        <img src={preview} alt={file.name} className="w-8 h-8 object-cover rounded" />
      ) : (
        <div className="w-8 h-8 flex items-center justify-center bg-slate-600 rounded">
          {isImage ? <Image size={16} className="text-slate-300" /> : <File size={16} className="text-slate-300" />}
        </div>
      )}
      <div className="flex flex-col max-w-[120px]">
        <span className="text-xs text-white truncate">{file.name}</span>
        <span className="text-[10px] text-slate-400">{sizeLabel}</span>
      </div>
      <button
        onClick={onRemove}
        className="ml-1 p-0.5 text-slate-500 hover:text-white rounded transition-colors"
      >
        <X size={12} />
      </button>
    </div>
  );
}
