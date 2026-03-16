import { useState, useMemo } from 'react';
import { X, Search, Plus, Send, Users, CheckSquare, TrendingUp, Calendar, CreditCard, Megaphone, FileText, FolderKanban, GitBranch, Sparkles, Settings } from 'lucide-react';
import { ACTION_CATEGORIES, ACTION_OPTIONS, type ActionCategoryKey } from '../../../../types/workflowBuilder';

const ICON_MAP: Record<string, React.ElementType> = {
  Send, Users, CheckSquare, TrendingUp, Calendar, CreditCard,
  Megaphone, FileText, FolderKanban, GitBranch, Sparkles, Settings,
};

const CAT_COLORS: Record<string, string> = {
  communication: 'bg-sky-100 text-sky-600 group-hover:bg-sky-200',
  contact_management: 'bg-violet-100 text-violet-600 group-hover:bg-violet-200',
  tasks: 'bg-orange-100 text-orange-600 group-hover:bg-orange-200',
  opportunities: 'bg-emerald-100 text-emerald-600 group-hover:bg-emerald-200',
  appointments: 'bg-blue-100 text-blue-600 group-hover:bg-blue-200',
  payments: 'bg-green-100 text-green-600 group-hover:bg-green-200',
  marketing: 'bg-pink-100 text-pink-600 group-hover:bg-pink-200',
  proposals: 'bg-amber-100 text-amber-600 group-hover:bg-amber-200',
  projects: 'bg-teal-100 text-teal-600 group-hover:bg-teal-200',
  flow_control: 'bg-gray-100 text-gray-600 group-hover:bg-gray-200',
  ai: 'bg-amber-100 text-amber-600 group-hover:bg-amber-200',
  system: 'bg-slate-100 text-slate-600 group-hover:bg-slate-200',
};

interface ActionPickerDrawerProps {
  onSelect: (actionType: string) => void;
  onClose: () => void;
}

export function ActionPickerDrawer({ onSelect, onClose }: ActionPickerDrawerProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ActionCategoryKey | 'all'>('all');

  const filtered = useMemo(() => {
    return ACTION_OPTIONS.filter(opt => {
      const matchesSearch = !search ||
        opt.label.toLowerCase().includes(search.toLowerCase()) ||
        opt.description.toLowerCase().includes(search.toLowerCase());
      const matchesCat = selectedCategory === 'all' || opt.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [search, selectedCategory]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof ACTION_OPTIONS> = {};
    for (const opt of filtered) {
      if (!groups[opt.category]) groups[opt.category] = [];
      groups[opt.category].push(opt);
    }
    return groups;
  }, [filtered]);

  return (
    <div className="w-[440px] h-full bg-white border-l border-gray-200 flex flex-col shadow-xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-blue-500 flex items-center justify-center">
            <Plus className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Add Action</h3>
            <p className="text-xs text-gray-500">Choose what happens at this step</p>
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
            placeholder="Search actions..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
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
        {ACTION_CATEGORIES.map(cat => {
          const count = ACTION_OPTIONS.filter(o => o.category === cat.key).length;
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
          const cat = ACTION_CATEGORIES.find(c => c.key === catKey);
          const IconComp = ICON_MAP[cat?.icon ?? ''] ?? Settings;
          const colorClass = CAT_COLORS[catKey] ?? CAT_COLORS.system;
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
                    className="w-full flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left group"
                  >
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${colorClass}`}>
                      <IconComp className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{opt.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
                    </div>
                    {opt.createsNodeType && opt.createsNodeType !== 'action' && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 mt-0.5">
                        {opt.createsNodeType}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No actions match your search</div>
        )}
      </div>
    </div>
  );
}
