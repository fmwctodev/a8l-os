import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, MessageSquare, ClipboardList, Bell } from 'lucide-react';
import { ConversationQueueItem } from './ConversationQueueItem';
import { TaskQueueItem } from './TaskQueueItem';
import type { AssignedConversation, TaskDue } from '../../services/dashboard';

type QueueTab = 'conversations' | 'tasks' | 'followups';

interface QueuePanelProps {
  conversations: AssignedConversation[];
  tasks: TaskDue[];
  onConversationClick: (conversation: AssignedConversation) => void;
  onTaskClick: (task: TaskDue) => void;
  isLoading?: boolean;
}

const tabs: { value: QueueTab; label: string; icon: typeof MessageSquare }[] = [
  { value: 'conversations', label: 'Conversations', icon: MessageSquare },
  { value: 'tasks', label: 'Tasks', icon: ClipboardList },
  { value: 'followups', label: 'Follow-ups', icon: Bell },
];

const viewAllLinks: Record<QueueTab, string> = {
  conversations: '/conversations',
  tasks: '/contacts',
  followups: '/contacts',
};

export function QueuePanel({
  conversations,
  tasks,
  onConversationClick,
  onTaskClick,
  isLoading,
}: QueuePanelProps) {
  const [activeTab, setActiveTab] = useState<QueueTab>('conversations');

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-white">My Queue</h3>
        <Link
          to={viewAllLinks[activeTab]}
          className="flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          View all
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="flex border-b border-slate-700">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const count =
            tab.value === 'conversations'
              ? conversations.length
              : tab.value === 'tasks'
              ? tasks.length
              : 0;

          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.value
                  ? 'border-cyan-400 text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {count > 0 && (
                <span className="px-1.5 py-0.5 bg-slate-700 text-xs rounded">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-3 max-h-[400px] overflow-y-auto">
        {isLoading ? (
          <LoadingSkeleton />
        ) : activeTab === 'conversations' ? (
          conversations.length === 0 ? (
            <EmptyState message="No assigned conversations" />
          ) : (
            <div className="space-y-1">
              {conversations.map((conversation) => (
                <ConversationQueueItem
                  key={conversation.id}
                  conversation={conversation}
                  onClick={() => onConversationClick(conversation)}
                />
              ))}
            </div>
          )
        ) : activeTab === 'tasks' ? (
          tasks.length === 0 ? (
            <EmptyState message="No pending tasks" />
          ) : (
            <div className="space-y-1">
              {tasks.map((task) => (
                <TaskQueueItem key={task.id} task={task} onClick={() => onTaskClick(task)} />
              ))}
            </div>
          )
        ) : (
          <EmptyState message="No follow-ups scheduled" />
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-8 text-center">
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <div className="h-10 w-10 bg-slate-700 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 bg-slate-700 rounded" />
            <div className="h-3 w-1/2 bg-slate-700 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
