import { useState } from 'react';
import {
  FileText,
  Send,
  Copy,
  Check,
  Hash,
  Palette,
  Save,
  Calendar,
  Zap,
  X,
  ChevronDown,
  Image as ImageIcon,
  Film,
} from 'lucide-react';
import type { MediaAsset } from '../../services/mediaGeneration';
import type { PublishMode } from '../../services/socialChat';

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

const CHAR_LIMITS: Record<string, number> = {
  instagram: 2200,
  twitter: 280,
  facebook: 63206,
  linkedin: 3000,
  tiktok: 2200,
  youtube: 5000,
  google_business: 1500,
  all: 2200,
};

export function PostDraftCard({
  draft,
  accounts,
  attachedAssets,
  onPublish,
  publishStatus,
}: PostDraftCardProps) {
  const [editedBody, setEditedBody] = useState(draft.body);
  const [copied, setCopied] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const charLimit = CHAR_LIMITS[draft.platform] || 2200;
  const charCount = editedBody.length;
  const charPercent = Math.min((charCount / charLimit) * 100, 100);
  const charColor = charPercent > 90 ? 'text-red-400' : charPercent > 70 ? 'text-amber-400' : 'text-slate-500';
  const barColor = charPercent > 90 ? 'bg-red-400' : charPercent > 70 ? 'bg-amber-400' : 'bg-cyan-500';

  const filteredAccounts = accounts.filter(
    (a) => draft.platform === 'all' || a.provider === draft.platform
  );

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
  }

  if (publishStatus) {
    return (
      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 my-3">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium text-emerald-400">
            {publishStatus.mode === 'post_now' && 'Posted successfully'}
            {publishStatus.mode === 'schedule' && `Scheduled for ${new Date(publishStatus.scheduledAt!).toLocaleString()}`}
            {publishStatus.mode === 'draft' && 'Saved as draft'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-700/50 border border-slate-600 rounded-xl p-4 my-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-medium text-cyan-400 uppercase">
            Draft for {draft.platform}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-600 rounded-lg transition-colors"
          title="Copy content"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {attachedAssets.length > 0 && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {attachedAssets.map((asset) => (
            <div key={asset.id} className="relative flex-shrink-0">
              {asset.media_type === 'video' ? (
                <div className="w-20 h-20 rounded-lg bg-slate-800 border border-slate-600 flex items-center justify-center">
                  <Film className="w-6 h-6 text-slate-400" />
                </div>
              ) : (
                <img
                  src={asset.thumbnail_url || asset.public_url}
                  alt=""
                  className="w-20 h-20 rounded-lg object-cover border border-slate-600"
                />
              )}
              <span className="absolute bottom-1 left-1 px-1 py-px bg-black/70 rounded text-[9px] text-white">
                {asset.media_type === 'video' ? 'Video' : 'Image'}
              </span>
            </div>
          ))}
        </div>
      )}

      {isEditing ? (
        <div className="relative mb-3">
          <textarea
            value={editedBody}
            onChange={(e) => setEditedBody(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 resize-none min-h-[80px]"
            rows={4}
          />
          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-2">
              <div className="w-24 h-1 bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${charPercent}%` }} />
              </div>
              <span className={`text-[10px] ${charColor}`}>
                {charCount}/{charLimit}
              </span>
            </div>
            <button
              onClick={() => setIsEditing(false)}
              className="text-[10px] text-cyan-400 hover:text-cyan-300"
            >
              Done editing
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => setIsEditing(true)}
          className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed mb-3 cursor-text hover:bg-slate-700/30 rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors"
        >
          {editedBody}
        </div>
      )}

      {draft.hashtags && draft.hashtags.length > 0 && (
        <div className="flex items-center gap-1 mb-3 flex-wrap">
          <Hash className="w-3 h-3 text-slate-500" />
          {draft.hashtags.map((tag, i) => (
            <span
              key={i}
              className="text-xs text-cyan-400/80 bg-cyan-400/10 px-2 py-0.5 rounded-full"
            >
              {tag.startsWith('#') ? tag : `#${tag}`}
            </span>
          ))}
        </div>
      )}

      {draft.visual_style_suggestion && attachedAssets.length === 0 && (
        <div className="flex items-start gap-2 mb-3 text-xs text-slate-500">
          <Palette className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>{draft.visual_style_suggestion}</span>
        </div>
      )}

      <div className="relative mb-3">
        <button
          onClick={() => setShowAccountPicker(!showAccountPicker)}
          className="w-full flex items-center justify-between px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-xs text-slate-400 hover:border-slate-500 transition-colors"
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
                No connected {draft.platform !== 'all' ? draft.platform : ''} accounts
              </div>
            ) : (
              filteredAccounts.map((account) => {
                const selected = selectedAccounts.includes(account.id);
                return (
                  <button
                    key={account.id}
                    onClick={() => {
                      setSelectedAccounts((prev) =>
                        selected
                          ? prev.filter((id) => id !== account.id)
                          : [...prev, account.id]
                      );
                    }}
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
                      <img src={account.profile_image_url} alt="" className="w-5 h-5 rounded-full" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-[9px] text-slate-400 uppercase">
                        {account.provider[0]}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs text-slate-300 truncate">{account.display_name}</div>
                      <div className="text-[10px] text-slate-500 capitalize">{account.provider}</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {showScheduler && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-slate-800 border border-slate-600 rounded-lg">
          <Calendar className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <input
            type="date"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
          />
          <input
            type="time"
            value={scheduleTime}
            onChange={(e) => setScheduleTime(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
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
      )}

      <div className="flex items-center gap-2">
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
  );
}
