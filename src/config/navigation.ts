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
  FolderKanban,
  Star,
  BarChart3,
  Settings,
  Shield,
  FileText,
  FileSignature,
  Landmark,
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
  id: string;
  title?: string;
  collapsible?: boolean;
  items: NavItem[];
}

export const navigationConfig: NavSection[] = [
  {
    id: 'core-operations',
    title: 'Core Operations',
    collapsible: true,
    items: [
      { name: 'Calendars', path: '/calendars', icon: Calendar, permission: 'calendars.view', featureFlag: 'calendars' },
      { name: 'Contacts', path: '/contacts', icon: Users, permission: 'contacts.view', featureFlag: 'contacts' },
      { name: 'Payments', path: '/payments', icon: CreditCard, permission: 'payments.view', featureFlag: 'payments' },
      { name: 'Proposals', path: '/proposals', icon: FileText, permission: 'proposals.view', featureFlag: 'proposals' },
      { name: 'Contracts', path: '/contracts', icon: FileSignature, permission: 'contracts.view', featureFlag: 'contracts' },
      { name: 'Projects', path: '/projects', icon: FolderKanban, permission: 'projects.view', featureFlag: 'projects' },
    ],
  },
  {
    id: 'growth-marketing',
    title: 'Growth & Marketing',
    collapsible: true,
    items: [
      { name: 'Conversations', path: '/conversations', icon: MessageSquare, permission: 'conversations.view', featureFlag: 'conversations' },
      { name: 'Opportunities', path: '/opportunities', icon: Target, permission: 'opportunities.view', featureFlag: 'opportunities' },
      { name: 'Government', path: '/government', icon: Landmark, permission: 'opportunities.view', featureFlag: 'opportunities' },
      { name: 'Marketing', path: '/marketing', icon: Megaphone, permission: 'marketing.view', featureFlag: 'marketing' },
      { name: 'Reputation', path: '/reputation', icon: Star, permission: 'reputation.view', featureFlag: 'reputation' },
    ],
  },
  {
    id: 'automation-ai',
    title: 'Automation & AI',
    collapsible: true,
    items: [
      { name: 'Automation', path: '/automation', icon: Workflow, permission: 'automation.view', featureFlag: 'automation' },
      { name: 'AI Agents', path: '/ai-agents', icon: Bot, permission: 'ai_agents.view', featureFlag: 'ai_agents' },
    ],
  },
  {
    id: 'files-analytics',
    title: 'Files & Analytics',
    collapsible: true,
    items: [
      { name: 'File Manager', path: '/media', icon: FolderOpen, permission: 'media.view', featureFlag: 'media' },
      { name: 'Reporting', path: '/reporting', icon: BarChart3, permission: 'reporting.view', featureFlag: 'reporting' },
    ],
  },
  {
    id: 'administration',
    title: 'Administration',
    collapsible: true,
    items: [
      { name: 'Settings', path: '/settings', icon: Settings, permission: 'settings.view' },
      { name: 'Audit Logs', path: '/audit-logs', icon: Shield, permission: 'audit_logs.view' },
    ],
  },
];
