import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSidebar } from '../contexts/SidebarContext';
import { LogOut, User, ChevronDown, Menu } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { navigationConfig } from '../config/navigation';

function getPageTitle(pathname: string): string {
  if (pathname === '/' || pathname === '') return 'Dashboard';

  for (const section of navigationConfig) {
    for (const item of section.items) {
      if (pathname === item.path || pathname.startsWith(item.path + '/')) {
        return item.name;
      }
    }
  }

  if (pathname.startsWith('/settings')) return 'Settings';
  if (pathname.startsWith('/audit-logs')) return 'Audit Logs';
  if (pathname.startsWith('/profile')) return 'Profile';

  return 'Dashboard';
}

export function Header() {
  const { user, signOut } = useAuth();
  const { isMobile, toggleMobileSidebar } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const pageTitle = getPageTitle(location.pathname);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3 sm:px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        {isMobile && (
          <button
            onClick={toggleMobileSidebar}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors touch-manipulation"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        {isMobile && (
          <span className="text-white font-semibold text-base truncate max-w-[180px]">
            {pageTitle}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <NotificationBell />
        <div className="w-px h-8 bg-slate-700/60" />
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors touch-manipulation"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center flex-shrink-0">
              {(user?.profile_photo || user?.avatar_url) ? (
                <img
                  src={user?.profile_photo || user?.avatar_url}
                  alt={user?.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-xs font-semibold text-white">{initials}</span>
              )}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium text-white">{user?.name}</p>
              <p className="text-xs text-slate-400">{user?.role?.name}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
              <div className="p-3 border-b border-slate-700">
                <p className="text-sm font-medium text-white">{user?.name}</p>
                <p className="text-xs text-slate-400">{user?.email}</p>
              </div>
              <div className="p-1">
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    navigate('/settings/profile');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded-md transition-colors touch-manipulation"
                >
                  <User className="w-4 h-4" />
                  Profile
                </button>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-700 rounded-md transition-colors touch-manipulation"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
