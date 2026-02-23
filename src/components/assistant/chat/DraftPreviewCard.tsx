import { useState } from 'react';
import { Mail, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import type { ClaraDraft } from '../../../types/assistant';

interface DraftPreviewCardProps {
  draft: ClaraDraft;
}

export function DraftPreviewCard({ draft }: DraftPreviewCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isEmail = draft.type === 'email';
  const Icon = isEmail ? Mail : MessageSquare;

  return (
    <div className="border border-cyan-500/20 bg-cyan-500/5 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-cyan-500/10 transition-colors"
      >
        <Icon className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium text-cyan-400 uppercase">
            {isEmail ? 'Email Draft' : 'SMS Draft'}
          </p>
          <p className="text-xs text-slate-300 mt-0.5">To: {draft.to}</p>
          {isEmail && draft.subject && (
            <p className="text-[11px] text-slate-400 truncate">Subject: {draft.subject}</p>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-3 h-3 text-slate-500 flex-shrink-0 mt-1" />
        ) : (
          <ChevronDown className="w-3 h-3 text-slate-500 flex-shrink-0 mt-1" />
        )}
      </button>

      {expanded && (
        <div className="px-3 py-2 border-t border-cyan-500/10">
          <p className="text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed">
            {draft.body}
          </p>
        </div>
      )}
    </div>
  );
}
