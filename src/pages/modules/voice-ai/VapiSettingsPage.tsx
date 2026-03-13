import { useNavigate } from 'react-router-dom';
import {
  Settings, ExternalLink, Key, Shield, Book,
} from 'lucide-react';

const links = [
  {
    label: 'Vapi Integration',
    description: 'Manage your Vapi API key and connection status',
    icon: Key,
    path: '/settings/integrations',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
  },
  {
    label: 'AI Agent Settings',
    description: 'Configure global AI agent preferences and defaults',
    icon: Settings,
    path: '/settings/ai-agents',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  {
    label: 'Permissions',
    description: 'Manage voice AI permissions for your team roles',
    icon: Shield,
    path: '/settings/staff',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
  },
  {
    label: 'Vapi Documentation',
    description: 'Learn about Vapi API capabilities and configuration',
    icon: Book,
    path: '',
    external: 'https://docs.vapi.ai',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
];

export function VapiSettingsPage() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white">Voice AI Settings</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Quick links to configure your Voice AI integration
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {links.map((link) => {
          const Icon = link.icon;

          const handleClick = () => {
            if (link.external) {
              window.open(link.external, '_blank');
            } else if (link.path) {
              navigate(link.path);
            }
          };

          return (
            <button
              key={link.label}
              onClick={handleClick}
              className="flex items-start gap-4 p-5 bg-slate-800 border border-slate-700 rounded-xl hover:border-slate-600 hover:bg-slate-800/80 transition-colors text-left group"
            >
              <div className={`p-2.5 rounded-lg ${link.bg}`}>
                <Icon className={`w-5 h-5 ${link.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">{link.label}</h3>
                  {link.external && (
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors" />
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">{link.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
