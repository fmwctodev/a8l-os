import { ClipboardList } from 'lucide-react';
import { Badge } from './Badge';
import type { TaskDue } from '../../services/dashboard';

interface TaskQueueItemProps {
  task: TaskDue;
  onClick: () => void;
}

function formatDueDate(dateString: string): { text: string; isOverdue: boolean } {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, isOverdue: true };
  if (diffDays === 0) return { text: 'Due today', isOverdue: false };
  if (diffDays === 1) return { text: 'Due tomorrow', isOverdue: false };
  if (diffDays < 7) return { text: `Due in ${diffDays}d`, isOverdue: false };
  return { text: date.toLocaleDateString(), isOverdue: false };
}

const priorityVariants = {
  high: 'error',
  medium: 'warning',
  low: 'neutral',
} as const;

export function TaskQueueItem({ task, onClick }: TaskQueueItemProps) {
  const contactName = `${task.contact.first_name} ${task.contact.last_name}`.trim();
  const dueInfo = formatDueDate(task.due_date);

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-700/50 transition-colors text-left"
    >
      <div className="p-2 bg-blue-500/10 rounded-lg">
        <ClipboardList className="h-4 w-4 text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{task.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-500">{contactName}</span>
          <span className="text-slate-600">·</span>
          <span className={`text-xs ${dueInfo.isOverdue ? 'text-red-400' : 'text-slate-500'}`}>
            {dueInfo.text}
          </span>
        </div>
      </div>
      <Badge variant={priorityVariants[task.priority]}>{task.priority}</Badge>
    </button>
  );
}
