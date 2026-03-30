import { NavLink, useLocation } from 'react-router-dom';
import { Home, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSidebar } from '../contexts/SidebarContext';
import { navigationConfig } from '../config/navigation';
import { useUnreadCount } from '../hooks/useUnreadCount';
import { usePaymentsAccess } from '../hooks/usePaymentsAccess';
import { Tooltip } from './Tooltip';
import type { NavItem, NavSection } from '../config/navigation';

function NavItemComponent({
  item,
  badge,
  isCompact,
  onNavigate,
}: {
  item: NavItem;
  badge?: number;
  isCompact: boolean;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
  const Icon = item.icon;

  const linkContent = (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 touch-manipulation ${
        isActive
          ? 'bg-slate-800 text-white border-l-2 border-cyan-500 -ml-[2px] pl-[14px]'
          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
      } ${isCompact ? 'justify-center px-2' : ''}`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {!isCompact && (
        <>
          <span className="flex-1 truncate">{item.name}</span>
          {badge !== undefined && badge > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-semibold rounded-full flex items-center justify-center">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </>
      )}
      {isCompact && badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  );

  if (isCompact) {
    return (
      <Tooltip content={item.name} side="right">
        <div className="relative">{linkContent}</div>
      </Tooltip>
    );
  }

  return linkContent;
}

function NavSectionComponent({
  section,
  isCompact,
  unreadCount,
  onNavigate,
}: {
  section: NavSection;
  isCompact: boolean;
  unreadCount: number;
  onNavigate?: () => void;
}) {
  const { hasPermission, isFeatureEnabled } = useAuth();
  const { isGroupCollapsed, toggleGroup } = useSidebar();
  const canAccessPayments = usePaymentsAccess();

  const visibleItems = section.items.filter((item) => {
    if (item.path === '/payments' && !canAccessPayments) return false;
    const hasAccess = hasPermission(item.permission);
    const featureEnabled = !item.featureFlag || isFeatureEnabled(item.featureFlag);
    return hasAccess && featureEnabled;
  });

  if (visibleItems.length === 0) return null;

  const isCollapsed = isGroupCollapsed(section.id);
  const showTitle = section.title && !isCompact;

  return (
    <div className="space-y-1">
      {showTitle && section.collapsible && (
        <button
          onClick={() => toggleGroup(section.id)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-400 transition-colors"
        >
          <span>{section.title}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isCollapsed ? '-rotate-90' : ''
            }`}
          />
        </button>
      )}
      {showTitle && !section.collapsible && (
        <h3 className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {section.title}
        </h3>
      )}
      {!isCollapsed && (
        <div className="space-y-0.5">
          {visibleItems.map((item) => (
            <NavItemComponent
              key={item.path}
              item={item}
              badge={item.path === '/conversations' ? unreadCount : undefined}
              isCompact={isCompact}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
      {isCollapsed && isCompact && (
        <div className="space-y-0.5">
          {visibleItems.map((item) => (
            <NavItemComponent
              key={item.path}
              item={item}
              badge={item.path === '/conversations' ? unreadCount : undefined}
              isCompact={isCompact}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const location = useLocation();
  const { isExpanded, toggleSidebar, isMobile, isMobileOpen, closeMobileSidebar } = useSidebar();
  const { unreadCount } = useUnreadCount();
  const isHomeActive = location.pathname === '/';

  const isCompact = !isMobile && !isExpanded;
  const sidebarWidth = isCompact ? 'w-16' : 'w-64';

  const dashboardLink = (
    <NavLink
      to="/"
      onClick={isMobile ? closeMobileSidebar : undefined}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 touch-manipulation ${
        isHomeActive
          ? 'bg-slate-800 text-white border-l-2 border-cyan-500 -ml-[2px] pl-[14px]'
          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
      } ${isCompact ? 'justify-center px-2' : ''}`}
    >
      <Home className="w-5 h-5 flex-shrink-0" />
      {!isCompact && <span>Dashboard</span>}
    </NavLink>
  );

  const sidebarContent = (
    <aside
      className={`${
        isMobile
          ? 'fixed left-0 top-0 h-screen w-72 bg-slate-900 border-r border-slate-800 flex flex-col z-50 transition-transform duration-300 ' +
            (isMobileOpen ? 'translate-x-0' : '-translate-x-full')
          : `fixed left-0 top-0 h-screen ${sidebarWidth} bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-200 z-40`
      }`}
    >
      <div className={`p-4 border-b border-slate-800 ${isCompact ? 'px-2' : ''}`}>
        <div className={`flex items-center ${!isCompact ? 'gap-3' : 'justify-center'}`}>
          <img
            src="/assets/logo/logo.png"
            alt="Autom8ion Lab"
            className="w-10 h-10 rounded-xl flex-shrink-0 object-contain"
          />
          {!isCompact && (
            <div className="min-w-0">
              <h1 className="text-white font-semibold text-sm truncate">Autom8ion Lab</h1>
              <p className="text-slate-500 text-xs">OS Platform</p>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-4">
        <div>
          {isCompact ? (
            <Tooltip content="Dashboard" side="right">
              {dashboardLink}
            </Tooltip>
          ) : (
            dashboardLink
          )}
        </div>

        {navigationConfig.map((section) => (
          <NavSectionComponent
            key={section.id}
            section={section}
            isCompact={isCompact}
            unreadCount={unreadCount}
            onNavigate={isMobile ? closeMobileSidebar : undefined}
          />
        ))}
      </nav>

      {!isMobile && (
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={toggleSidebar}
            className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors ${
              isCompact ? 'justify-center px-2' : ''
            }`}
          >
            {isExpanded ? (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span>Collapse</span>
              </>
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
          {isExpanded && (
            <div className="px-3 py-2 mt-1">
              <p className="text-xs text-slate-600">Version 0.1.0</p>
            </div>
          )}
        </div>
      )}

      {isMobile && (
        <div className="p-3 border-t border-slate-800">
          <p className="text-xs text-slate-600 px-3 py-2">Version 0.1.0</p>
        </div>
      )}
    </aside>
  );

  if (isMobile) {
    return (
      <>
        {isMobileOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
            onClick={closeMobileSidebar}
          />
        )}
        {sidebarContent}
      </>
    );
  }

  return sidebarContent;
}
