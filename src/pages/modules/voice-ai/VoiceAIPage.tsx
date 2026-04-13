import { Outlet, NavLink, useLocation, Navigate } from 'react-router-dom';
import {
  Users, Phone, Globe, Wrench,
  BarChart3, Settings,
} from 'lucide-react';

const voiceTabs = [
  { path: '/ai-agents/voice/assistants', label: 'Assistants', icon: Users },
  { path: '/ai-agents/voice/numbers', label: 'Numbers', icon: Phone },
  { path: '/ai-agents/voice/widgets', label: 'Widgets', icon: Globe },
  { path: '/ai-agents/voice/tools', label: 'Tools', icon: Wrench },
  { path: '/ai-agents/voice/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/ai-agents/voice/settings', label: 'Settings', icon: Settings },
];

export function VoiceAIPage() {
  const location = useLocation();

  if (location.pathname === '/ai-agents/voice') {
    return <Navigate to="/ai-agents/voice/assistants" replace />;
  }

  return (
    <div>
      <nav className="flex gap-1 mb-6 border-b border-slate-700 -mt-2 overflow-x-auto">
        {voiceTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.path ||
            location.pathname.startsWith(tab.path + '/');

          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? 'text-cyan-400 border-cyan-500'
                  : 'text-slate-500 border-transparent hover:text-slate-300 hover:border-slate-600'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </NavLink>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
