import { useState, useRef, KeyboardEvent } from 'react';
import { Send, Paperclip, X, FileText, Film, Music, Archive, File, AlertCircle, Loader2 } from 'lucide-react';
import {
  type TeamAttachment,
  TEAM_ATTACHMENT_MAX_SIZE,
  TEAM_ATTACHMENT_MAX_FILES,
  uploadTeamAttachment,
} from '../../services/teamMessaging';
import { useAuth } from '../../contexts/AuthContext';

interface InternalMessageComposerProps {
  onSendMessage: (content: string, attachments?: TeamAttachment[]) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return null;
  if (type.startsWith('video/')) return Film;
  if (type.startsWith('audio/')) return Music;
  if (type === 'application/pdf') return FileText;
  if (type.includes('zip') || type.includes('rar') || type.includes('gzip')) return Archive;
  return File;
}

export function InternalMessageComposer({
  onSendMessage,
  disabled = false,
  placeholder = 'Type a message...',
}: InternalMessageComposerProps) {
  const { user: authUser } = useAuth();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasContent = message.trim().length > 0 || selectedFiles.length > 0;

  const handleSend = async () => {
    if (!hasContent || sending || disabled || uploading) return;

    try {
      setSending(true);
      let attachments: TeamAttachment[] | undefined;

      if (selectedFiles.length > 0) {
        const orgId = authUser?.organization_id;
        if (!orgId) throw new Error('Organization not found');

        setUploading(true);
        attachments = await Promise.all(
          selectedFiles.map((file) => uploadTeamAttachment(file, orgId))
        );
        setUploading(false);
      }

      await onSendMessage(message.trim(), attachments);
      setMessage('');
      setSelectedFiles([]);
      setFileError(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setUploading(false);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    e.target.style.height = 'auto';
    const newHeight = Math.min(e.target.scrollHeight, 150);
    e.target.style.height = `${newHeight}px`;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setFileError(null);

    const totalCount = selectedFiles.length + files.length;
    if (totalCount > TEAM_ATTACHMENT_MAX_FILES) {
      setFileError(`Maximum ${TEAM_ATTACHMENT_MAX_FILES} files allowed`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const oversized = files.find((f) => f.size > TEAM_ATTACHMENT_MAX_SIZE);
    if (oversized) {
      setFileError(`"${oversized.name}" exceeds 100 MB limit`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFiles((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFileError(null);
  };

  return (
    <div className="border-t border-slate-700 bg-slate-800">
      {selectedFiles.length > 0 && (
        <div className="px-4 pt-3 flex flex-wrap gap-2">
          {selectedFiles.map((file, i) => {
            const isImage = file.type.startsWith('image/');
            const Icon = getFileIcon(file.type);

            return (
              <div
                key={`${file.name}-${i}`}
                className="relative group flex items-center gap-2 bg-slate-700 rounded-lg border border-slate-600 overflow-hidden"
              >
                {isImage ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-16 h-16 object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 flex items-center justify-center bg-slate-600">
                    {Icon && <Icon size={24} className="text-slate-300" />}
                  </div>
                )}
                <div className="pr-8 py-1.5 max-w-[140px]">
                  <p className="text-xs text-white font-medium truncate">{file.name}</p>
                  <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
                </div>
                <button
                  onClick={() => removeFile(i)}
                  className="absolute top-1 right-1 p-0.5 rounded-full bg-slate-900/70 hover:bg-red-500 text-slate-300 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {fileError && (
        <div className="mx-4 mt-2 flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle size={12} />
          {fileError}
        </div>
      )}

      <div className="p-4">
        <div className="flex items-end gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors flex-shrink-0"
            title="Attach file"
            disabled={disabled || sending}
          >
            <Paperclip size={20} />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/ogg,audio/wav,audio/webm,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,application/zip"
          />

          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={selectedFiles.length > 0 ? 'Add a message (optional)' : placeholder}
              disabled={disabled || sending}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none min-h-[44px] max-h-[150px]"
              rows={1}
            />
          </div>

          <button
            onClick={handleSend}
            disabled={!hasContent || sending || disabled}
            className="p-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            title="Send message"
          >
            {uploading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>

        <p className="text-xs text-slate-500 mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
