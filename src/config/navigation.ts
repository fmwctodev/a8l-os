import {
  MessageSquare,
  Calendar,
  Users,
  Target,
  CreditCard,
  Bot,
  Megaphone,
  Workflow,
  FolderOpen,
  Star,
  BarChart3,
  Settings,
  Shield,
  Radio,
  type LucideIcon,
} from 'lucide-react';
import type { PermissionKey } from '../types';

export interface NavItem {
  name: string;
  path: string;
  icon: LucideIcon;
  permission: PermissionKey;
  featureFlag?: string;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const navigationConfig: NavSection[] = [
  {
    items: [
      { name: 'Conversations', path: '/conversations', icon: MessageSquare, permission: 'conversations.view', featureFlag: 'conversations' },
      { name: 'Calendars', path: '/calendars', icon: Calendar, permission: 'calendars.view', featureFlag: 'calendars' },
      { name: 'Contacts', path: '/contacts', icon: Users, permission: 'contacts.view', featureFlag: 'contacts' },
      { name: 'Opportunities', path: '/opportunities', icon: Target, permission: 'opportunities.view', featureFlag: 'opportunities' },
      { name: 'Payments', path: '/payments', icon: CreditCard, permission: 'payments.view', featureFlag: 'payments' },
      { name: 'AI Agents', path: '/ai-agents', icon: Bot, permission: 'ai_agents.view', featureFlag: 'ai_agents' },
      { name: 'Marketing', path: '/marketing', icon: Megaphone, permission: 'marketing.view', featureFlag: 'marketing' },
      { name: 'Automation', path: '/automation', icon: Workflow, permission: 'automation.view', featureFlag: 'automation' },
      { name: 'Media Storage', path: '/media', icon: FolderOpen, permission: 'media.view', featureFlag: 'media' },
      { name: 'Reputation', path: '/reputation', icon: Star, permission: 'reputation.view', featureFlag: 'reputation' },
      { name: 'Reporting', path: '/reporting', icon: BarChart3, permission: 'reporting.view', featureFlag: 'reporting' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { name: 'Users', path: '/users', icon: Users, permission: 'users.view' },
      { name: 'Channels', path: '/channels', icon: Radio, permission: 'channels.configure' },
      { name: 'Settings', path: '/settings', icon: Settings, permission: 'settings.view' },
      { name: 'Audit Logs', path: '/audit-logs', icon: Shield, permission: 'audit_logs.view' },
    ],
  },
];
