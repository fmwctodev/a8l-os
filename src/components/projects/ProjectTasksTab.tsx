import { useState, useEffect } from 'react';
import {
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  User as UserIcon,
  X,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import type { ProjectTask, User } from '../../types';
import { getTasksByProject, createTask, updateTask, completeTask } from '../../services/projectTasks';

interface Props {
  projectId: string;
  orgId: string;
  users: User[];
  canManageTasks: boolean;
  currentUserId: string;
}

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-slate-600',
  in_progress: 'bg-cyan-500',
  in_review: 'bg-amber-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-red-500',
};

const PRIORITY_DOTS: Record<string, string> = {
  low: 'bg-slate-500',
  medium: 'bg-blue-500',
  high: 'bg-amber-500',
  urgent: 'bg-red-500',
};

export function ProjectTasksTab({ projectId, orgId, users, canManageTasks, currentUserId }: Props) {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assigned_user_id: '',
    priority: 'medium',
    due_date: '',
    depends_on_task_id: '',
  });

  useEffect(() => {
    loadTasks();
  }, [projectId]);

  async function loadTasks() {
    try {
      const data = await getTasksByProject(projectId);
      setTasks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    setSaving(true);
    try {
      await createTask({
        org_id: orgId,
        project_id: projectId,
        title: newTask.title.trim(),
        description: newTask.description || null,
        assigned_user_id: newTask.assigned_user_id || null,
        priority: newTask.priority,
        due_date: newTask.due_date || null,
        depends_on_task_id: newTask.depends_on_task_id || null,
        created_by: currentUserId,
      }, currentUserId);
      await loadTasks();
      setShowAddForm(false);
      setNewTask({ title: '', description: '', assigned_user_id: '', priority: 'medium', due_date: '', depends_on_task_id: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete(taskId: string) {
    try {
      await completeTask(taskId, currentUserId);
      await loadTasks();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleStatusChange(taskId: string, status: string) {
    try {
      await updateTask(taskId, { status } as Partial<ProjectTask>, currentUserId);
      await loadTasks();
    } catch (err) {
      console.error(err);
    }
  }

  const rootTasks = tasks.filter((t) => !t.parent_task_id);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500" /></div>;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
        {canManageTasks && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-3 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleCreateTask} className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-white">New Task</h3>
            <button type="button" onClick={() => setShowAddForm(false)} className="p-1 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <input
            type="text"
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            placeholder="Task title..."
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
            autoFocus
          />
          <div className="grid grid-cols-3 gap-3">
            <select
              value={newTask.assigned_user_id}
              onChange={(e) => setNewTask({ ...newTask, assigned_user_id: e.target.value })}
              className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <select
              value={newTask.priority}
              onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
              className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <input
              type="date"
              value={newTask.due_date}
              onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
              className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowAddForm(false)} className="px-3 py-1.5 text-sm bg-slate-700 text-slate-300 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving || !newTask.title.trim()} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-cyan-600 text-white rounded-lg disabled:opacity-50">
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Create
            </button>
          </div>
        </form>
      )}

      <div className="space-y-1">
        {rootTasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            allTasks={tasks}
            canManage={canManageTasks}
            onComplete={handleComplete}
            onStatusChange={handleStatusChange}
          />
        ))}
        {rootTasks.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-sm">No tasks yet</div>
        )}
      </div>
    </div>
  );
}


function TaskRow({
  task,
  allTasks,
  canManage,
  onComplete,
  onStatusChange,
}: {
  task: ProjectTask;
  allTasks: ProjectTask[];
  canManage: boolean;
  onComplete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const overdue = task.due_date && task.due_date < today && task.status !== 'completed' && task.status !== 'cancelled';
  const dep = task.depends_on_task_id ? allTasks.find((t) => t.id === task.depends_on_task_id) : null;
  const isBlocked = dep && dep.status !== 'completed';

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800/50 transition-colors group">
      {canManage && task.status !== 'completed' ? (
        <button onClick={() => onComplete(task.id)} className="text-slate-500 hover:text-emerald-400">
          <Circle className="w-4 h-4" />
        </button>
      ) : (
        <CheckCircle2 className={`w-4 h-4 ${task.status === 'completed' ? 'text-emerald-400' : 'text-slate-600'}`} />
      )}
      <div className={`w-2 h-2 rounded-full ${PRIORITY_DOTS[task.priority]}`} />
      <span className={`flex-1 text-sm ${task.status === 'completed' ? 'text-slate-500 line-through' : 'text-white'}`}>
        {task.title}
      </span>
      {isBlocked && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" title={`Blocked by: ${dep?.title}`} />}
      {task.assigned_user ? (
        <span className="text-xs text-slate-500 w-24 truncate text-right">{task.assigned_user.name}</span>
      ) : (
        <span className="w-24" />
      )}
      {task.due_date && (
        <span className={`text-xs w-20 text-right ${overdue ? 'text-red-400' : 'text-slate-500'}`}>
          {new Date(task.due_date).toLocaleDateString()}
        </span>
      )}
      <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLORS[task.status]} text-white`}>
        {STATUS_LABELS[task.status]}
      </span>
    </div>
  );
}
