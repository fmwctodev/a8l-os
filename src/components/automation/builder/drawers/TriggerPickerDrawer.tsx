import { useState, useMemo } from 'react';
import { X, Search, Zap, Calendar, MessageSquare, TrendingUp, CreditCard, Send, Megaphone, Star, FolderKanban, FileText, Sparkles, Webhook, User } from 'lucide-react';
import { TRIGGER_CATEGORIES, TRIGGER_OPTIONS, type TriggerCategoryKey } from '../../../../types/workflowBuilder';

const ICON_MAP: Record<string, React.ElementType> = {
  User, MessageSquare, Calendar, TrendingUp, CreditCard, Send,
  Megaphone, Star, FolderKanban, FileText, Sparkles, Webhook,
};

interface TriggerPickerDrawerProps {
  onSelect: (triggerType: string) => void;
  onClose: () => void;
}

export function TriggerPickerDrawer({ onSelect, onClose }: TriggerPickerDrawerProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TriggerCategoryKey | 'all'>('all');

  const filtered = useMemo(() => {
    return TRIGGER_OPTIONS.filter(opt => {
      const matchesSearch = !search ||
        opt.label.toLowerCase().includes(search.toLowerCase()) ||
        opt.description.toLowerCase().includes(search.toLowerCase());
      const matchesCat = selectedCategory === 'all' || opt.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [search, selectedCategory]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof TRIGGER_OPTIONS> = {};
    for (const opt of filtered) {
      if (!groups[opt.category]) groups[opt.category] = [];
      groups[opt.category].push(opt);
    }
    return groups;
  }, [filtered]);

  return (
    <div className="fixed inset-0 z-30 sm:static sm:z-auto w-full sm:w-[440px] h-full bg-white sm:border-l border-gray-200 flex flex-col shadow-xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-emerald-500 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Add Trigger</h3>
            <p className="text-xs text-gray-500">Select an event that starts this workflow</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors">
          <X className="w-4.5 h-4.5 text-gray-400" />
        </button>
      </div>

      <div className="px-5 py-3 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search triggers..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
          />
        </div>
      </div>

      <div className="px-5 py-2.5 flex flex-wrap gap-1.5 border-b border-gray-100">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
            selectedCategory === 'all'
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        {TRIGGER_CATEGORIES.map(cat => {
          const count = TRIGGER_OPTIONS.filter(o => o.category === cat.key).length;
          return (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                selectedCategory === cat.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-5">
        {Object.entries(grouped).map(([catKey, options]) => {
          const cat = TRIGGER_CATEGORIES.find(c => c.key === catKey);
          const IconComp = ICON_MAP[cat?.icon ?? ''] ?? Zap;
          return (
            <div key={catKey}>
              <div className="flex items-center gap-2 mb-2">
                <IconComp className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {cat?.label ?? catKey}
                </span>
              </div>
              <div className="space-y-1">
                {options.map(opt => (
                  <button
                    key={opt.type}
                    onClick={() => onSelect(opt.type)}
                    className="w-full flex items-start gap-3 p-2.5 rounded-lg hover:bg-emerald-50 transition-colors text-left group"
                  >
                    <div className="w-7 h-7 rounded-md bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-emerald-200 transition-colors">
                      <Zap className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 group-hover:text-emerald-700 transition-colors">{opt.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No triggers match your search</div>
        )}
      </div>
    </div>
  );
}
