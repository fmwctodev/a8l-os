import { type ReactNode } from 'react';
import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Tab {
  id: string;
  label: string;
  icon?: LucideIcon;
}

interface Action {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

interface DetailViewProps {
  title: string;
  subtitle?: string;
  backPath?: string;
  tabs?: Tab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  actions?: Action[];
  children: ReactNode;
  stickyHeader?: boolean;
}

export function DetailView({
  title,
  subtitle,
  backPath,
  tabs,
  activeTab,
  onTabChange,
  actions,
  children,
  stickyHeader = false,
}: DetailViewProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full">
      <div
        className={`bg-slate-900 border-b border-slate-800 ${
          stickyHeader ? 'sticky top-0 z-10' : ''
        }`}
      >
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {backPath && (
                <button
                  onClick={() => navigate(backPath)}
                  className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <div>
                <h1 className="text-xl font-semibold text-white">{title}</h1>
                {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
              </div>
            </div>

            {actions && actions.length > 0 && (
              <div className="flex items-center gap-2">
                {actions.map((action, index) => {
                  const Icon = action.icon;
                  const variantClasses = {
                    primary:
                      'bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:from-cyan-600 hover:to-teal-600 shadow-lg shadow-cyan-500/25',
                    secondary: 'bg-slate-800 text-slate-300 hover:bg-slate-700',
                    danger: 'bg-red-500/10 text-red-400 hover:bg-red-500/20',
                  };
                  return (
                    <button
                      key={index}
                      onClick={action.onClick}
                      className={`px-4 py-2 rounded-lg transition-all font-medium text-sm flex items-center gap-2 ${
                        variantClasses[action.variant || 'secondary']
                      }`}
                    >
                      {Icon && <Icon className="w-4 h-4" />}
                      {action.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {tabs && tabs.length > 0 && onTabChange && (
          <div className="px-6 -mb-px">
            <nav className="flex gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
                      isActive
                        ? 'text-cyan-400 border-cyan-400'
                        : 'text-slate-400 border-transparent hover:text-white hover:border-slate-600'
                    }`}
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
