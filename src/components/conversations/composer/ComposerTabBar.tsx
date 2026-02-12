import { Maximize2, Minimize2 } from 'lucide-react';

export type ComposerTab = 'sms' | 'email' | 'internal_comment';

interface ComposerTabBarProps {
  activeTab: ComposerTab;
  onTabChange: (tab: ComposerTab) => void;
  hasSms: boolean;
  hasEmail: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
}

export function ComposerTabBar({
  activeTab,
  onTabChange,
  hasSms,
  hasEmail,
  expanded,
  onToggleExpand,
}: ComposerTabBarProps) {
  const tabClass = (tab: ComposerTab) =>
    `px-1 pb-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
      activeTab === tab
        ? 'text-blue-600 border-blue-600'
        : 'text-gray-500 border-transparent hover:text-gray-700'
    }`;

  return (
    <div className="flex items-center justify-between px-4 pt-3 border-b border-gray-200">
      <div className="flex items-center gap-5">
        {hasSms && (
          <button className={tabClass('sms')} onClick={() => onTabChange('sms')}>
            SMS
          </button>
        )}
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
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors mb-2"
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
    </div>
  );
}
