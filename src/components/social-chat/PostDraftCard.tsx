import {
  FileText,
  Send,
  Copy,
  Check,
  Hash,
  Palette,
} from 'lucide-react';
import { useState } from 'react';

interface PostDraft {
  platform: string;
  body: string;
  hook_text?: string;
  cta_text?: string;
  hashtags?: string[];
  visual_style_suggestion?: string;
}

interface PostDraftCardProps {
  draft: PostDraft;
  onSchedule: (draft: PostDraft) => void;
}

export function PostDraftCard({ draft, onSchedule }: PostDraftCardProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(draft.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <div className="flex items-center gap-1">
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
          <button
            onClick={() => onSchedule(draft)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 text-white text-xs font-medium rounded-lg hover:bg-cyan-700 transition-colors"
          >
            <Send className="w-3 h-3" />
            Schedule
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
        {draft.body}
      </p>

      {draft.hashtags && draft.hashtags.length > 0 && (
        <div className="flex items-center gap-1 mt-3 flex-wrap">
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

      {draft.visual_style_suggestion && (
        <div className="flex items-start gap-2 mt-3 text-xs text-slate-500">
          <Palette className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>{draft.visual_style_suggestion}</span>
        </div>
      )}
    </div>
  );
}
