import { Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom';
import {
  BrainCircuit,
  MessageSquare,
  FileText,
  Repeat,
  BookOpen,
  Link,
  BarChart3,
  Plus,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const tabs = [
  { path: '/marketing/social/chat', label: 'Chat', icon: MessageSquare },
  { path: '/marketing/social/posts', label: 'Posts', icon: FileText },
  { path: '/marketing/social/campaigns', label: 'Campaigns', icon: Repeat },
  { path: '/marketing/social/guidelines', label: 'Guidelines', icon: BookOpen },
  { path: '/marketing/social/accounts', label: 'Accounts', icon: Link },
  { path: '/marketing/social/analytics', label: 'Analytics', icon: BarChart3 },
];

export function AISocialManagerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useAuth();

  const canManage = hasPermission('marketing.social.manage');

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="border-b border-slate-700 bg-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/10 rounded-lg">
                <BrainCircuit className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">AI Social Manager</h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Your dedicated AI social media strategist
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {canManage && (
                <button
                  onClick={() => navigate('/marketing/social/posts/new')}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New Post
                </button>
              )}
            </div>
          </div>

          <nav className="flex gap-1 mt-6 -mb-px overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive =
                location.pathname === tab.path ||
                (location.pathname === '/marketing/social' && tab.path === '/marketing/social/chat') ||
                (location.pathname.startsWith(tab.path) &&
                  tab.path !== '/marketing/social/chat');

              return (
                <NavLink
                  key={tab.path}
                  to={tab.path}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    isActive
                      ? 'text-cyan-400 border-cyan-500'
                      : 'text-slate-400 border-transparent hover:text-slate-300 hover:border-slate-600'
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </div>
    </div>
  );
}
