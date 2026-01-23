import { NavLink, useLocation } from 'react-router-dom';
import { Zap, Home } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { navigationConfig } from '../config/navigation';
import { useUnreadCount } from '../hooks/useUnreadCount';
import type { NavItem } from '../config/navigation';

function NavItemComponent({ item, badge }: { item: NavItem; badge?: number }) {
  const location = useLocation();
  const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
        isActive
          ? 'bg-slate-800 text-white border-l-2 border-cyan-500 -ml-[2px] pl-[14px]'
          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
      }`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="flex-1">{item.name}</span>
      {badge !== undefined && badge > 0 && (
        <span className="min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-semibold rounded-full flex items-center justify-center">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const { hasPermission, isFeatureEnabled } = useAuth();
  const location = useLocation();
  const isHomeActive = location.pathname === '/';
  const { unreadCount } = useUnreadCount();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-sm">Autom8ion Lab</h1>
            <p className="text-slate-500 text-xs">OS Platform</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-6">
        <div>
          <NavLink
            to="/"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
              isHomeActive
                ? 'bg-slate-800 text-white border-l-2 border-cyan-500 -ml-[2px] pl-[14px]'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Home className="w-5 h-5 flex-shrink-0" />
            <span>Dashboard</span>
          </NavLink>
        </div>

        {navigationConfig.map((section, sectionIndex) => {
          const visibleItems = section.items.filter((item) => {
            const hasAccess = hasPermission(item.permission);
            const featureEnabled = !item.featureFlag || isFeatureEnabled(item.featureFlag);
            return hasAccess && featureEnabled;
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={sectionIndex}>
              {section.title && (
                <h3 className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {section.title}
                </h3>
              )}
              <div className="space-y-1">
                {visibleItems.map((item) => (
                  <NavItemComponent
                    key={item.path}
                    item={item}
                    badge={item.path === '/conversations' ? unreadCount : undefined}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-800">
        <div className="px-3 py-2">
          <p className="text-xs text-slate-600">Version 0.1.0</p>
        </div>
      </div>
    </aside>
  );
}
