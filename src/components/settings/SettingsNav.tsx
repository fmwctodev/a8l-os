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
  Palette,
  Zap,
  LayoutList,
  Braces,
  Target,
  MessageSquare,
  Video,
  HeartPulse,
  Sparkles,
  Film,
  Database,
  CreditCard,
  LucideIcon,
} from 'lucide-react';

interface SettingsNavItem {
  name: string;
  path: string;
  icon: LucideIcon;
  requiresPermission?: string;
}

interface SettingsNavSection {
  title: string;
  items: SettingsNavItem[];
}

const settingsNavSections: SettingsNavSection[] = [
  {
    title: 'Personal',
    items: [
      {
        name: 'My Profile',
        path: '/settings/profile',
        icon: User,
      },
    ],
  },
  {
    title: 'Organization',
    items: [
      {
        name: 'Organization',
        path: '/settings/organization',
        icon: Building2,
        requiresPermission: 'settings.manage',
      },
      {
        name: 'Staff Management',
        path: '/settings/staff',
        icon: Users,
        requiresPermission: 'users.view',
      },
    ],
  },
  {
    title: 'Communication',
    items: [
      {
        name: 'Conversations',
        path: '/settings/conversations',
        icon: MessageSquare,
      },
      {
        name: 'Calendars',
        path: '/settings/calendars',
        icon: Calendar,
      },
      {
        name: 'Email Services',
        path: '/settings/email-services',
        icon: Mail,
      },
      {
        name: 'Payments',
        path: '/settings/payments',
        icon: CreditCard,
        requiresPermission: 'payments.manage',
      },
      {
        name: 'Phone System',
        path: '/settings/phone-system',
        icon: Phone,
        requiresPermission: 'phone.settings.view',
      },
    ],
  },
  {
    title: 'AI & Automation',
    items: [
      {
        name: 'AI Agents',
        path: '/settings/ai-agents',
        icon: Bot,
        requiresPermission: 'ai.settings.view',
      },
      {
        name: 'Meeting Follow-Ups',
        path: '/settings/meeting-follow-ups',
        icon: Video,
        requiresPermission: 'calendars.view',
      },
      {
        name: 'Clara Assistant',
        path: '/settings/assistant',
        icon: Sparkles,
        requiresPermission: 'personal_assistant.view',
      },
      {
        name: 'Media Style Presets',
        path: '/settings/media-presets',
        icon: Film,
        requiresPermission: 'ai.settings.view',
      },
    ],
  },
  {
    title: 'Data & Fields',
    items: [
      {
        name: 'Custom Fields',
        path: '/settings/custom-fields',
        icon: LayoutList,
      },
      {
        name: 'Custom Objects',
        path: '/settings/custom-objects',
        icon: Database,
      },
      {
        name: 'Lead Scoring',
        path: '/settings/scoring',
        icon: Target,
      },
    ],
  },
  {
    title: 'Developer',
    items: [
      {
        name: 'Custom Values',
        path: '/settings/custom-values',
        icon: Braces,
      },
      {
        name: 'Integrations',
        path: '/settings/integrations',
        icon: Zap,
      },
    ],
  },
  {
    title: 'Branding',
    items: [
      {
        name: 'Brandboard',
        path: '/settings/brandboard',
        icon: Palette,
        requiresPermission: 'brandboard.view',
      },
    ],
  },
  {
    title: 'System',
    items: [
      {
        name: 'CRUD Health Check',
        path: '/settings/system/crud-health-check',
        icon: HeartPulse,
        requiresPermission: 'audit.view',
      },
    ],
  },
];

interface SettingsNavProps {
  onNavigate?: () => void;
}

export function SettingsNav({ onNavigate }: SettingsNavProps) {
  const { hasPermission } = useAuth();

  const visibleSections = settingsNavSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.requiresPermission && !hasPermission(item.requiresPermission)) {
          return false;
        }
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <nav className="flex flex-col gap-6 p-4">
      {visibleSections.map((section) => (
        <div key={section.title}>
          <h3 className="px-4 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {section.title}
          </h3>
          <div className="space-y-1">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-500/10 to-teal-500/10 border border-cyan-500/20 text-cyan-400'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`
                  }
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium">{item.name}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
