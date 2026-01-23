import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  User,
  Building2,
  Users,
  Calendar,
  Bot,
  Mail,
  Phone,
  Bell,
  Shield,
  CreditCard,
  Palette,
  Globe,
  Zap,
  LayoutList,
  Key,
  Target,
  LucideIcon,
} from 'lucide-react';

interface SettingsNavItem {
  name: string;
  path: string;
  icon: LucideIcon;
  implemented: boolean;
  requiresPermission?: string;
}

const settingsNavItems: SettingsNavItem[] = [
  {
    name: 'My Profile',
    path: '/settings/profile',
    icon: User,
    implemented: true,
  },
  {
    name: 'Organization',
    path: '/settings/organization',
    icon: Building2,
    implemented: true,
    requiresPermission: 'settings.manage',
  },
  {
    name: 'My Staff',
    path: '/settings/staff',
    icon: Users,
    implemented: true,
    requiresPermission: 'users.view',
  },
  {
    name: 'Calendars',
    path: '/settings/calendars',
    icon: Calendar,
    implemented: true,
    requiresPermission: 'calendars.view',
  },
  {
    name: 'AI Agents',
    path: '/settings/ai-agents',
    icon: Bot,
    implemented: true,
    requiresPermission: 'ai.settings.view',
  },
  {
    name: 'Email Services',
    path: '/settings/email-services',
    icon: Mail,
    implemented: true,
    requiresPermission: 'email.settings.view',
  },
  {
    name: 'Phone System',
    path: '/settings/phone-system',
    icon: Phone,
    implemented: true,
    requiresPermission: 'phone.settings.view',
  },
  {
    name: 'Custom Fields',
    path: '/settings/custom-fields',
    icon: LayoutList,
    implemented: true,
    requiresPermission: 'custom_fields.view',
  },
  {
    name: 'Lead Scoring',
    path: '/settings/scoring',
    icon: Target,
    implemented: true,
    requiresPermission: 'scoring.view',
  },
  {
    name: 'API Keys & Secrets',
    path: '/settings/secrets',
    icon: Key,
    implemented: true,
    requiresPermission: 'secrets.view',
  },
  {
    name: 'Notifications',
    path: '/settings/notifications',
    icon: Bell,
    implemented: false,
  },
  {
    name: 'Security',
    path: '/settings/security',
    icon: Shield,
    implemented: false,
  },
  {
    name: 'Billing',
    path: '/settings/billing',
    icon: CreditCard,
    implemented: false,
    requiresPermission: 'settings.manage',
  },
  {
    name: 'Branding',
    path: '/settings/branding',
    icon: Palette,
    implemented: false,
    requiresPermission: 'settings.manage',
  },
  {
    name: 'Domain',
    path: '/settings/domain',
    icon: Globe,
    implemented: false,
    requiresPermission: 'settings.manage',
  },
  {
    name: 'Integrations',
    path: '/settings/integrations',
    icon: Zap,
    implemented: false,
  },
];

interface SettingsNavProps {
  onNavigate?: () => void;
}

export function SettingsNav({ onNavigate }: SettingsNavProps) {
  const { hasPermission } = useAuth();

  const visibleItems = settingsNavItems.filter((item) => {
    if (item.requiresPermission && !hasPermission(item.requiresPermission)) {
      return false;
    }
    return true;
  });

  return (
    <nav className="flex flex-col gap-1 p-4">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/10 to-teal-500/10 border border-cyan-500/20 text-cyan-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              } ${!item.implemented ? 'opacity-50 cursor-not-allowed' : ''}`
            }
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">{item.name}</span>
            {!item.implemented && (
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                Soon
              </span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
