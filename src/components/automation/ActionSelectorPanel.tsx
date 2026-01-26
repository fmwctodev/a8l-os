import { useState, useMemo } from 'react';
import {
  Search,
  MessageSquare,
  Mail,
  Phone,
  Tag,
  Users,
  CheckSquare,
  CircleDollarSign,
  Calendar,
  CreditCard,
  Megaphone,
  GitBranch,
  Sparkles,
  Settings,
  X,
  Crown,
} from 'lucide-react';
import type {
  WorkflowActionType,
  ActionCategory,
  WorkflowActionDefinition,
} from '../../types/workflowActions';
import {
  WORKFLOW_ACTION_DEFINITIONS,
  ACTION_CATEGORY_LABELS,
  getActionsByCategory,
} from '../../types/workflowActions';
import { AI_ACTION_LABELS } from '../../types/aiWorkflowActions';

interface ActionSelectorPanelProps {
  onSelect: (actionType: WorkflowActionType | string) => void;
  onClose: () => void;
  userPermissions?: string[];
  showProActions?: boolean;
}

const CATEGORY_ICONS: Record<ActionCategory, React.ElementType> = {
  communication: MessageSquare,
  contact_management: Users,
  tasks: CheckSquare,
  opportunities: CircleDollarSign,
  appointments: Calendar,
  payments: CreditCard,
  marketing: Megaphone,
  flow_control: GitBranch,
  ai: Sparkles,
  system: Settings,
};

const CATEGORY_ORDER: ActionCategory[] = [
  'communication',
  'contact_management',
  'tasks',
  'opportunities',
  'appointments',
  'payments',
  'marketing',
  'flow_control',
  'ai',
  'system',
];

const AI_ACTIONS = [
  { type: 'ai_conversation_reply', label: 'AI Conversation Reply', description: 'Generate contextual replies', icon: 'MessageCircle' },
  { type: 'ai_email_draft', label: 'AI Email Draft', description: 'Create professional email drafts', icon: 'Mail' },
  { type: 'ai_follow_up_message', label: 'AI Follow-up', description: 'Generate follow-up messages', icon: 'Reply' },
  { type: 'ai_lead_qualification', label: 'AI Lead Qualification', description: 'Analyze and qualify leads', icon: 'UserCheck' },
  { type: 'ai_booking_assist', label: 'AI Booking Assistant', description: 'Help contacts book appointments', icon: 'CalendarCheck' },
  { type: 'ai_decision_step', label: 'AI Decision Step', description: 'Intelligent routing decisions', icon: 'GitBranch' },
];

export function ActionSelectorPanel({
  onSelect,
  onClose,
  userPermissions = [],
  showProActions = true,
}: ActionSelectorPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ActionCategory | 'all'>('all');

  const filteredActions = useMemo(() => {
    let actions = [...WORKFLOW_ACTION_DEFINITIONS];

    if (!showProActions) {
      actions = actions.filter(a => !a.isPro);
    }

    if (selectedCategory !== 'all') {
      actions = actions.filter(a => a.category === selectedCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      actions = actions.filter(
        a =>
          a.label.toLowerCase().includes(query) ||
          a.description.toLowerCase().includes(query) ||
          a.type.toLowerCase().includes(query)
      );
    }

    return actions;
  }, [searchQuery, selectedCategory, showProActions]);

  const filteredAIActions = useMemo(() => {
    if (selectedCategory !== 'all' && selectedCategory !== 'ai') {
      return [];
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return AI_ACTIONS.filter(
        a =>
          a.label.toLowerCase().includes(query) ||
          a.description.toLowerCase().includes(query)
      );
    }

    return AI_ACTIONS;
  }, [searchQuery, selectedCategory]);

  const groupedActions = useMemo(() => {
    const groups: Record<ActionCategory, WorkflowActionDefinition[]> = {
      communication: [],
      contact_management: [],
      tasks: [],
      opportunities: [],
      appointments: [],
      payments: [],
      marketing: [],
      flow_control: [],
      ai: [],
      system: [],
    };

    filteredActions.forEach(action => {
      groups[action.category].push(action);
    });

    return groups;
  }, [filteredActions]);

  const handleActionSelect = (actionType: string) => {
    onSelect(actionType as WorkflowActionType);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Add Action
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search actions..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              All
            </button>
            {CATEGORY_ORDER.map(category => {
              const Icon = CATEGORY_ICONS[category];
              const count =
                category === 'ai'
                  ? AI_ACTIONS.length
                  : getActionsByCategory(category).length;

              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === category
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {ACTION_CATEGORY_LABELS[category]}
                  <span className="text-xs opacity-60">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {selectedCategory === 'all' || selectedCategory === 'ai' ? (
            filteredAIActions.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    AI Actions
                  </h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredAIActions.map(action => (
                    <button
                      key={action.type}
                      onClick={() => handleActionSelect(action.type)}
                      className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:bg-blue-50 dark:hover:border-blue-600 dark:hover:bg-blue-900/20 transition-colors text-left"
                    >
                      <div className="p-2 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30">
                        <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
                            {action.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                          {action.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          ) : null}

          {CATEGORY_ORDER.filter(cat => cat !== 'ai').map(category => {
            const actions = groupedActions[category];
            if (actions.length === 0) return null;

            const Icon = CATEGORY_ICONS[category];

            return (
              <div key={category} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {ACTION_CATEGORY_LABELS[category]}
                  </h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {actions.map(action => (
                    <button
                      key={action.type}
                      onClick={() => handleActionSelect(action.type)}
                      className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:bg-blue-50 dark:hover:border-blue-600 dark:hover:bg-blue-900/20 transition-colors text-left group"
                    >
                      <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                        <ActionIcon iconName={action.icon} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
                            {action.label}
                          </span>
                          {action.isPro && (
                            <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                          {action.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {filteredActions.length === 0 && filteredAIActions.length === 0 && (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                No actions found matching "{searchQuery}"
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionIcon({ iconName }: { iconName: string }) {
  const icons: Record<string, React.ElementType> = {
    MessageSquare,
    Mail,
    Phone,
    Tag,
    Users,
    CheckSquare,
    CircleDollarSign,
    Calendar,
    CreditCard,
    Megaphone,
    GitBranch,
    Sparkles,
    Settings,
  };

  const Icon = icons[iconName] || Settings;
  return <Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
}
