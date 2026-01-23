import { DollarSign, User, Tag, Clock, AlertTriangle } from 'lucide-react';
import type { Opportunity, PipelineStage } from '../../types';
import { normalizeTags } from '../../utils/tagNormalization';

interface OpportunityCardProps {
  opportunity: Opportunity;
  onClick: () => void;
  isDragging?: boolean;
  stage?: PipelineStage;
  canDrag?: boolean;
}

export function OpportunityCard({
  opportunity,
  onClick,
  isDragging,
  stage,
  canDrag = true
}: OpportunityCardProps) {
  const contact = opportunity.contact;
  const contactName = contact
    ? `${contact.first_name} ${contact.last_name}`.trim()
    : 'Unknown Contact';

  const tags = normalizeTags((contact as any)?.tags);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: opportunity.currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'won':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'lost':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'won':
        return 'Won';
      case 'lost':
        return 'Lost';
      default:
        return 'Open';
    }
  };

  const getDaysInStage = () => {
    const stageDate = opportunity.stage_changed_at || opportunity.created_at;
    const now = new Date();
    const then = new Date(stageDate);
    const diff = now.getTime() - then.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const daysInStage = getDaysInStage();
  const agingThreshold = stage?.aging_threshold_days;
  const isAging = agingThreshold && daysInStage > agingThreshold && opportunity.status === 'open';

  const timeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diff = now.getTime() - then.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  const isDraggable = canDrag && opportunity.status === 'open';

  return (
    <div
      onClick={onClick}
      className={`bg-slate-700/50 rounded-lg p-3 transition-all border border-slate-600/50 ${
        isDragging ? 'opacity-50 shadow-xl' : ''
      } ${isDraggable ? 'cursor-grab active:cursor-grabbing hover:bg-slate-700' : 'cursor-pointer hover:bg-slate-700/70'}`}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-white font-medium truncate flex-1">{contactName}</h4>
        <span className={`ml-2 px-1.5 py-0.5 rounded text-xs border ${getStatusColor(opportunity.status)}`}>
          {getStatusLabel(opportunity.status)}
        </span>
      </div>

      <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
        <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-emerald-400 font-medium">
          {formatCurrency(Number(opportunity.value_amount))}
        </span>
      </div>

      {opportunity.assigned_user && (
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
          <User className="w-3.5 h-3.5" />
          <span className="truncate">{opportunity.assigned_user.name}</span>
        </div>
      )}

      {tags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap mb-2">
          {tags.slice(0, 3).map((tag: any) => (
            <span
              key={tag.id}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs"
              style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
            >
              <Tag className="w-2.5 h-2.5" />
              {tag.name}
            </span>
          ))}
          {tags.length > 3 && (
            <span className="text-xs text-slate-500">+{tags.length - 3}</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">
          Updated {timeAgo(opportunity.updated_at)}
        </span>
        {isAging && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            {daysInStage}d in stage
          </span>
        )}
        {!isAging && opportunity.status === 'open' && daysInStage > 0 && (
          <span className="flex items-center gap-1 text-slate-500">
            <Clock className="w-3 h-3" />
            {daysInStage}d
          </span>
        )}
      </div>

      {!isDraggable && opportunity.status !== 'open' && (
        <div className="mt-2 pt-2 border-t border-slate-600/50 text-xs text-slate-500 italic">
          {opportunity.status === 'won' ? 'Deal closed - won' : 'Deal closed - lost'}
        </div>
      )}
    </div>
  );
}
