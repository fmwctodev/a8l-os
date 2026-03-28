import { Maximize2, Minimize2 } from 'lucide-react';

export type ComposerTab = 'email' | 'internal_comment';

interface ComposerTabBarProps {
  activeTab: ComposerTab;
  onTabChange: (tab: ComposerTab) => void;
  hasEmail: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
}

export function ComposerTabBar({
  activeTab,
  onTabChange,
  hasEmail,
  expanded,
  onToggleExpand,
}: ComposerTabBarProps) {
  const tabClass = (tab: ComposerTab) =>
    `px-1 pb-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
      activeTab === tab
        ? 'text-cyan-400 border-cyan-500'
        : 'text-slate-400 border-transparent hover:text-slate-300'
    }`;

  return (
    <div className="flex items-center justify-between px-4 pt-3 border-b border-slate-700">
      <div className="flex items-center gap-5">
        {hasEmail && (
          <button className={tabClass('email')} onClick={() => onTabChange('email')}>
            Email
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button className={tabClass('internal_comment')} onClick={() => onTabChange('internal_comment')}>
          Internal Comment
        </button>
        <button
          onClick={onToggleExpand}
          className="p-1 text-slate-400 hover:text-white transition-colors mb-2"
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
    </div>
  );
}
