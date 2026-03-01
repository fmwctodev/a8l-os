import { useState, useEffect } from 'react';
import {
  Check,
  Copy,
  Pencil,
  Calendar,
  Send,
  ChevronDown,
  X,
  Save,
  Zap,
  Hash,
  Palette,
  Image as ImageIcon,
  Film,
  Maximize2,
  Instagram,
  Twitter,
  Facebook,
  Linkedin,
  Youtube,
  Music,
  Globe,
  FileText,
} from 'lucide-react';
import type { MediaAsset } from '../../services/mediaGeneration';
import type { PublishMode } from '../../services/socialChat';
import { MediaLightbox, InlineVideoPlayer, type LightboxItem } from '../ui/MediaLightbox';

export interface PostDraft {
  platform: string;
  body: string;
  hook_text?: string;
  cta_text?: string;
  hashtags?: string[];
  visual_style_suggestion?: string;
  media_type?: string;
}

export interface SocialAccount {
  id: string;
  provider: string;
  display_name: string;
  profile_image_url: string | null;
}

interface PostDraftCardProps {
  draft: PostDraft;
  accounts: SocialAccount[];
  attachedAssets: MediaAsset[];
  mediaGenerating?: boolean;
  mediaSkippedReason?: string;
  onPublish: (
    draft: PostDraft,
    mode: PublishMode,
    accountIds: string[],
    media: Array<{ url: string; type: string; thumbnail_url?: string }>,
    mediaAssetIds: string[],
    scheduledAt?: string
  ) => void;
  publishStatus?: { mode: PublishMode; scheduledAt?: string } | null;
}

const PLATFORM_CONFIG: Record<
  string,
  { icon: typeof Instagram; color: string; bg: string; label: string }
> = {
  instagram: {
    icon: Instagram,
    color: 'text-pink-400',
    bg: 'bg-gradient-to-br from-pink-500 to-orange-400',
    label: 'Instagram',
  },
  twitter: {
    icon: Twitter,
    color: 'text-sky-400',
    bg: 'bg-sky-500',
    label: 'X / Twitter',
  },
  facebook: {
    icon: Facebook,
    color: 'text-blue-400',
    bg: 'bg-blue-600',
    label: 'Facebook',
  },
  linkedin: {
    icon: Linkedin,
    color: 'text-blue-300',
    bg: 'bg-blue-700',
    label: 'LinkedIn',
  },
  youtube: {
    icon: Youtube,
    color: 'text-red-400',
    bg: 'bg-red-600',
    label: 'YouTube',
  },
  tiktok: {
    icon: Music,
    color: 'text-white',
    bg: 'bg-slate-900',
    label: 'TikTok',
  },
  google_business: {
    icon: Globe,
    color: 'text-emerald-400',
    bg: 'bg-emerald-600',
    label: 'Google Business',
  },
  reddit: {
    icon: Globe,
    color: 'text-orange-400',
    bg: 'bg-orange-600',
    label: 'Reddit',
  },
  all: {
    icon: FileText,
    color: 'text-cyan-400',
    bg: 'bg-cyan-600',
    label: 'All Platforms',
  },
};

const CHAR_LIMITS: Record<string, number> = {
  instagram: 2200,
  twitter: 280,
  facebook: 63206,
  linkedin: 3000,
  tiktok: 2200,
  youtube: 5000,
  google_business: 1500,
  reddit: 40000,
  all: 2200,
};

const TRUNCATE_LENGTH = 140;

export function PostDraftCard({
  draft,
  accounts,
  attachedAssets,
  mediaGenerating = false,
  mediaSkippedReason,
  onPublish,
  publishStatus,
}: PostDraftCardProps) {
  const [editedBody, setEditedBody] = useState(draft.body);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(() =>
    accounts
      .filter((a) => draft.platform === 'all' || a.provider === draft.platform)
      .map((a) => a.id)
  );
  const [showAccountPicker, setShowAccountPicker] = useState(false);

  useEffect(() => {
    if (selectedAccounts.length > 0) return;
    const matching = accounts
      .filter((a) => draft.platform === 'all' || a.provider === draft.platform)
      .map((a) => a.id);
    if (matching.length > 0) setSelectedAccounts(matching);
  }, [accounts, draft.platform]);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const platform = PLATFORM_CONFIG[draft.platform] || PLATFORM_CONFIG.all;
  const PlatformIcon = platform.icon;
  const charLimit = CHAR_LIMITS[draft.platform] || 2200;
  const charCount = editedBody.length;
  const charPercent = Math.min((charCount / charLimit) * 100, 100);
  const charColor =
    charPercent > 90
      ? 'text-red-400'
      : charPercent > 70
        ? 'text-amber-400'
        : 'text-slate-500';
  const barColor =
    charPercent > 90
      ? 'bg-red-400'
      : charPercent > 70
        ? 'bg-amber-400'
        : 'bg-cyan-500';

  const filteredAccounts = accounts.filter(
    (a) => draft.platform === 'all' || a.provider === draft.platform
  );

  const needsTruncation = editedBody.length > TRUNCATE_LENGTH;
  const displayText =
    !expanded && needsTruncation
      ? editedBody.slice(0, TRUNCATE_LENGTH) + '...'
      : editedBody;

  async function handleCopy() {
    await navigator.clipboard.writeText(editedBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function buildMediaPayload() {
    return attachedAssets.map((a) => ({
      url: a.public_url,
      type: a.media_type,
      thumbnail_url: a.thumbnail_url || undefined,
    }));
  }

  function handlePublish(mode: PublishMode) {
    const media = buildMediaPayload();
    const assetIds = attachedAssets.map((a) => a.id);
    const modifiedDraft = { ...draft, body: editedBody };

    let scheduledAt: string | undefined;
    if (mode === 'schedule' && scheduleDate && scheduleTime) {
      scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    }

    onPublish(modifiedDraft, mode, selectedAccounts, media, assetIds, scheduledAt);
    setShowScheduler(false);
    setEditMode(false);
  }

  if (publishStatus) {
    return (
      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 my-3">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium text-emerald-400">
            {publishStatus.mode === 'post_now' && 'Posted successfully'}
            {publishStatus.mode === 'schedule' &&
              `Scheduled for ${new Date(publishStatus.scheduledAt!).toLocaleString()}`}
            {publishStatus.mode === 'draft' && 'Saved as draft'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden my-3 max-w-sm">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-lg ${platform.bg} flex items-center justify-center`}
          >
            <PlatformIcon className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs font-medium text-slate-300">
            {platform.label}
          </span>
          <ChevronDown className="w-3 h-3 text-slate-500" />
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setEditMode(!editMode)}
            className={`p-1.5 rounded-lg transition-colors ${
              editMode
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowScheduler(!showScheduler)}
            className={`p-1.5 rounded-lg transition-colors ${
              showScheduler
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
            title="Schedule"
          >
            <Calendar className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handlePublish('post_now')}
            disabled={selectedAccounts.length === 0}
            className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={
              selectedAccounts.length === 0
                ? 'Select accounts first'
                : 'Post now'
            }
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {mediaGenerating && attachedAssets.length === 0 && (
        <div className="relative w-full aspect-[4/3] bg-slate-900/80">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
              <ImageIcon className="w-5 h-5 text-cyan-400/60 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <span className="text-xs text-slate-400 font-medium">
              Generating image...
            </span>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent" />
        </div>
      )}

      {attachedAssets.length > 0 && (
        <div className="relative group/media">
          {attachedAssets[0].media_type === 'video' ? (
            <InlineVideoPlayer
              src={attachedAssets[0].public_url}
              poster={attachedAssets[0].thumbnail_url}
              className="w-full aspect-[4/3]"
            />
          ) : (
            <img
              src={attachedAssets[0].thumbnail_url || attachedAssets[0].public_url}
              alt=""
              className="w-full aspect-[4/3] object-cover"
            />
          )}
          <button
            onClick={() => setLightboxIndex(0)}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover/media:opacity-100 transition-opacity z-[1]"
            title="Preview full size"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          {attachedAssets.length > 1 && (
            <button
              onClick={() => setLightboxIndex(1)}
              className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 hover:bg-black/80 rounded-full text-[10px] text-white font-medium transition-colors cursor-pointer"
            >
              +{attachedAssets.length - 1} more
            </button>
          )}
        </div>
      )}

      {lightboxIndex !== null && (
        <MediaLightbox
          items={attachedAssets.map((a): LightboxItem => ({
            url: a.public_url,
            thumbnailUrl: a.thumbnail_url,
            mediaType: a.media_type,
          }))}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {!mediaGenerating && attachedAssets.length === 0 && draft.visual_style_suggestion && (
        <div className="w-full aspect-[4/3] bg-slate-900/50 flex flex-col items-center justify-center gap-2 border-b border-slate-700/50">
          {mediaSkippedReason ? (
            <>
              <ImageIcon className="w-8 h-8 text-amber-500/60" />
              <span className="text-[11px] text-amber-400/80 text-center px-6 leading-relaxed font-medium">
                Media generation unavailable
              </span>
              <span className="text-[10px] text-slate-500 text-center px-6">
                Configure the KIE API key in Settings to enable image generation
              </span>
            </>
          ) : (
            <>
              <Palette className="w-8 h-8 text-slate-600" />
              <span className="text-[11px] text-slate-500 text-center px-6 leading-relaxed">
                {draft.visual_style_suggestion}
              </span>
            </>
          )}
        </div>
      )}

      <div className="px-3 pt-3 pb-2">
        {editMode ? (
          <div className="space-y-2">
            <textarea
              value={editedBody}
              onChange={(e) => setEditedBody(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 resize-none min-h-[100px]"
              rows={5}
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-20 h-1 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${barColor} rounded-full transition-all`}
                    style={{ width: `${charPercent}%` }}
                  />
                </div>
                <span className={`text-[10px] ${charColor}`}>
                  {charCount}/{charLimit}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="p-1 text-slate-400 hover:text-white transition-colors"
                  title="Copy"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={() => setEditMode(false)}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 font-medium"
                >
                  Done
                </button>
              </div>
            </div>

            {draft.hashtags && draft.hashtags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap pt-1">
                <Hash className="w-3 h-3 text-slate-500" />
                {draft.hashtags.map((tag, i) => (
                  <span
                    key={i}
                    className="text-[10px] text-cyan-400/80 bg-cyan-400/10 px-1.5 py-px rounded-full"
                  >
                    {tag.startsWith('#') ? tag : `#${tag}`}
                  </span>
                ))}
              </div>
            )}

            <div className="relative pt-1">
              <button
                onClick={() => setShowAccountPicker(!showAccountPicker)}
                className="w-full flex items-center justify-between px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-xs text-slate-400 hover:border-slate-500 transition-colors"
              >
                <span>
                  {selectedAccounts.length === 0
                    ? 'Select accounts to post to...'
                    : `${selectedAccounts.length} account${selectedAccounts.length > 1 ? 's' : ''} selected`}
                </span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {showAccountPicker && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-10 max-h-36 overflow-y-auto">
                  {filteredAccounts.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-500">
                      No connected{' '}
                      {draft.platform !== 'all' ? draft.platform : ''} accounts
                    </div>
                  ) : (
                    filteredAccounts.map((account) => {
                      const selected = selectedAccounts.includes(account.id);
                      return (
                        <button
                          key={account.id}
                          onClick={() =>
                            setSelectedAccounts((prev) =>
                              selected
                                ? prev.filter((id) => id !== account.id)
                                : [...prev, account.id]
                            )
                          }
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-700/50 transition-colors ${
                            selected ? 'bg-cyan-500/5' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            readOnly
                            className="rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500/30 w-3.5 h-3.5"
                          />
                          {account.profile_image_url ? (
                            <img
                              src={account.profile_image_url}
                              alt=""
                              className="w-5 h-5 rounded-full"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-[9px] text-slate-400 uppercase">
                              {account.provider[0]}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs text-slate-300 truncate">
                              {account.display_name}
                            </div>
                            <div className="text-[10px] text-slate-500 capitalize">
                              {account.provider}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => handlePublish('draft')}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-500 text-slate-300 text-xs font-medium rounded-lg hover:bg-slate-600/50 transition-colors"
              >
                <Save className="w-3 h-3" />
                Save Draft
              </button>
              <button
                onClick={() => setShowScheduler(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-600 text-white text-xs font-medium rounded-lg hover:bg-slate-500 transition-colors"
              >
                <Calendar className="w-3 h-3" />
                Schedule
              </button>
              <button
                onClick={() => handlePublish('post_now')}
                disabled={selectedAccounts.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 text-white text-xs font-medium rounded-lg hover:bg-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Zap className="w-3 h-3" />
                Post Now
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="text-sm text-slate-200 leading-relaxed">
              {displayText}
              {needsTruncation && !expanded && (
                <button
                  onClick={() => setExpanded(true)}
                  className="text-cyan-400 hover:text-cyan-300 ml-1 font-medium text-sm"
                >
                  more
                </button>
              )}
              {expanded && needsTruncation && (
                <button
                  onClick={() => setExpanded(false)}
                  className="text-cyan-400 hover:text-cyan-300 ml-1 font-medium text-sm"
                >
                  less
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {showScheduler && (
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 p-2 bg-slate-900 border border-slate-600 rounded-lg">
            <Calendar className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <input
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={() => handlePublish('schedule')}
              disabled={!scheduleDate || !scheduleTime}
              className="px-2.5 py-1 bg-cyan-600 text-white text-xs rounded-md hover:bg-cyan-700 disabled:opacity-40 transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => setShowScheduler(false)}
              className="p-1 text-slate-500 hover:text-slate-400"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
