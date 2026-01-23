import { DollarSign, User, Tag } from 'lucide-react';
import type { Opportunity } from '../../types';
import { normalizeTags } from '../../utils/tagNormalization';

interface OpportunityCardProps {
  opportunity: Opportunity;
  onClick: () => void;
  isDragging?: boolean;
}

export function OpportunityCard({ opportunity, onClick, isDragging }: OpportunityCardProps) {
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
        return 'bg-emerald-500/20 text-emerald-400';
      case 'lost':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-cyan-500/20 text-cyan-400';
    }
  };

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

  return (
    <div
      onClick={onClick}
      className={`bg-slate-700/50 rounded-lg p-3 cursor-pointer hover:bg-slate-700 transition-all border border-slate-600/50 ${
        isDragging ? 'opacity-50 shadow-xl' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-white font-medium truncate flex-1">{contactName}</h4>
        {opportunity.status !== 'open' && (
          <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${getStatusColor(opportunity.status)}`}>
            {opportunity.status}
          </span>
        )}
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

      <div className="text-xs text-slate-500">
        Updated {timeAgo(opportunity.updated_at)}
      </div>
    </div>
  );
}
