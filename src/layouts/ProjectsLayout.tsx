import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { FolderKanban, List, GitBranch, TrendingUp } from 'lucide-react';
import { usePaymentsAccess } from '../hooks/usePaymentsAccess';

const allTabs = [
  { path: '/projects', label: 'Board', icon: FolderKanban, exact: true },
  { path: '/projects/list', label: 'List', icon: List },
  { path: '/projects/pipelines', label: 'Pipelines', icon: GitBranch },
  { path: '/projects/profitability', label: 'Profitability', icon: TrendingUp },
];

export function ProjectsLayout() {
  const location = useLocation();
  const canAccessPayments = usePaymentsAccess();

  const tabs = canAccessPayments
    ? allTabs
    : allTabs.filter((t) => t.path !== '/projects/profitability');

  const isActiveTab = (path: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="h-full min-w-0 flex flex-col">
      <div className="flex-none border-b border-slate-700 bg-slate-800/50">
        <div className="px-6 pt-2">
          <h1 className="text-xl font-semibold text-white mb-2">Project Manager</h1>
          <nav className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = isActiveTab(tab.path, tab.exact);
              return (
                <NavLink
                  key={tab.path}
                  to={tab.path}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                    active
                      ? 'bg-slate-900 text-white border-t border-l border-r border-slate-700'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
