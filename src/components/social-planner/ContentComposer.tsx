import { useState, useRef, RefObject } from 'react';
import {
  Sparkles,
  Bold,
  Italic,
  Smile,
  Image,
  FileText,
  Video,
  Hash,
  Tag,
  Link as LinkIcon,
  AtSign,
  X,
  Undo2,
  Maximize2,
  Play,
} from 'lucide-react';
import type { SocialProvider, SocialPostMedia } from '../../types';
import { MediaLightbox, InlineVideoPlayer, type LightboxItem } from '../ui/MediaLightbox';

const EMOJI_LIST = ['😀', '😂', '❤️', '👍', '🎉', '🔥', '✨', '💪', '🙌', '👏', '💯', '🚀', '⭐', '💡', '📣', '🎯', '💼', '📈', '🤝', '✅'];

interface ContentComposerProps {
  value: string;
  onChange: (value: string) => void;
  followUpComment?: string;
  onFollowUpChange?: (value: string) => void;
  showFollowUp?: boolean;
  characterLimit: number;
  platforms: SocialProvider[];
  media: SocialPostMedia[];
  onMediaAdd: () => void;
  onMediaRemove: (id: string) => void;
  onAIClick: () => void;
  aiButtonRef?: RefObject<HTMLButtonElement>;
  linkUrl?: string;
  onLinkChange?: (url: string) => void;
  onUndo?: () => void;
}

export function ContentComposer({
  value,
  onChange,
  followUpComment,
  onFollowUpChange,
  showFollowUp = false,
  characterLimit,
  platforms,
  media,
  onMediaAdd,
  onMediaRemove,
  onAIClick,
  aiButtonRef,
  linkUrl,
  onLinkChange,
  onUndo,
}: ContentComposerProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(!!linkUrl);
  const [showFollowUpSection, setShowFollowUpSection] = useState(!!followUpComment);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertText = (text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = value.slice(0, start) + text + value.slice(end);
    onChange(newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  const wrapSelection = (prefix: string, suffix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.slice(start, end);
    const newValue = value.slice(0, start) + prefix + selectedText + suffix + value.slice(end);
    onChange(newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  const charCount = value.length;
  const isOverLimit = charCount > characterLimit;
  const isNearLimit = charCount >= characterLimit * 0.9;

  const showFollowUpToggle = platforms.some((p) => ['facebook', 'instagram'].includes(p));

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-700">Type content</span>
          <span className="text-sm text-gray-500">
            Char limit:{' '}
            <span className={isOverLimit ? 'text-red-500 font-medium' : 'text-gray-700'}>
              {characterLimit}
            </span>
          </span>
        </div>

        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              if (e.target.value.length <= characterLimit) {
                onChange(e.target.value);
              }
            }}
            placeholder="Write your post here..."
            className="w-full h-40 px-4 py-3 resize-none focus:outline-none text-gray-900 placeholder-gray-400"
          />
          <div className="absolute bottom-2 right-3 text-sm">
            <span
              className={
                isOverLimit
                  ? 'text-red-500 font-medium'
                  : isNearLimit
                  ? 'text-amber-500'
                  : 'text-gray-400'
              }
            >
              {charCount}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 px-3 py-2 border-t border-gray-100 bg-gray-50">
          <button
            ref={aiButtonRef}
            type="button"
            onClick={onAIClick}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg text-sm font-medium hover:from-blue-600 hover:to-teal-600 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            AI
          </button>

          {onUndo && (
            <button
              type="button"
              onClick={onUndo}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Undo AI change"
            >
              <Undo2 className="w-4 h-4" />
            </button>
          )}

          <div className="w-px h-5 bg-gray-200 mx-1" />

          <button
            type="button"
            onClick={() => wrapSelection('**', '**')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => wrapSelection('_', '_')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-2 rounded-lg transition-colors ${
                showEmojiPicker
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
              title="Emoji"
            >
              <Smile className="w-4 h-4" />
            </button>

            {showEmojiPicker && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-2 grid grid-cols-5 gap-1 w-48">
                {EMOJI_LIST.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      insertText(emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="p-1 text-lg hover:bg-gray-100 rounded transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onMediaAdd}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Add Image"
          >
            <Image className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onMediaAdd}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Add Document"
          >
            <FileText className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onMediaAdd}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Add Video"
          >
            <Video className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => insertText('#')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Hashtag"
          >
            <Hash className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => insertText('@')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Tag"
          >
            <Tag className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowLinkInput(!showLinkInput)}
            className={`p-2 rounded-lg transition-colors ${
              showLinkInput
                ? 'bg-blue-100 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
            title="Add Link"
          >
            <LinkIcon className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => insertText('@')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Mention"
          >
            <AtSign className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showLinkInput && onLinkChange && (
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={linkUrl || ''}
            onChange={(e) => onLinkChange(e.target.value)}
            placeholder="https://example.com"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={() => {
              setShowLinkInput(false);
              onLinkChange('');
            }}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {media.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {media.map((item, idx) => (
            <div key={item.id} className="relative group aspect-square">
              {item.type === 'video' ? (
                <InlineVideoPlayer
                  src={item.url}
                  poster={item.thumbnail_url}
                  className="w-full h-full rounded-lg overflow-hidden"
                />
              ) : (
                <img
                  src={item.url}
                  alt={item.filename || 'Media'}
                  className="w-full h-full object-cover rounded-lg"
                />
              )}
              {item.status === 'pending' && (
                <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                  <div className="w-3/4 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 animate-pulse w-1/2" />
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(idx); }}
                className="absolute top-1 left-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                title="Preview"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => item.id && onMediaRemove(item.id)}
                className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <MediaLightbox
          items={media.map((m): LightboxItem => ({
            url: m.url,
            thumbnailUrl: m.thumbnail_url,
            mediaType: m.type,
            filename: m.filename,
          }))}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {showFollowUpToggle && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowFollowUpSection(!showFollowUpSection)}
            className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
          >
            <div
              className={`w-10 h-6 rounded-full transition-colors ${
                showFollowUpSection ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform mt-0.5 ${
                  showFollowUpSection ? 'translate-x-4.5 ml-0.5' : 'translate-x-0.5'
                }`}
              />
            </div>
            <span className="text-sm text-gray-700">Follow up comment</span>
            <span
              className="text-gray-400 text-xs"
              title="Post a follow-up comment after your main post. Great for hashtags or additional links."
            >
              ?
            </span>
          </button>

          {showFollowUpSection && onFollowUpChange && (
            <div className="px-4 pb-4">
              <textarea
                value={followUpComment || ''}
                onChange={(e) => onFollowUpChange(e.target.value)}
                placeholder="Add hashtags or additional content as a first comment..."
                className="w-full h-20 px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
