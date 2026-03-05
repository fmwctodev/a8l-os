import { useState, useEffect } from 'react';
import {
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  X,
  Loader2,
  Pencil,
  Save,
  Trash2,
} from 'lucide-react';
import type { ProjectTask, User } from '../../types';
import { getTasksByProject, createTask, updateTask, completeTask, deleteTask } from '../../services/projectTasks';

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
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
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

  async function handleSaveTask(taskId: string, updates: Partial<ProjectTask>) {
    setSaving(true);
    try {
      await updateTask(taskId, updates, currentUserId);
      await loadTasks();
      setSelectedTaskId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTask(taskId: string) {
    try {
      await deleteTask(taskId);
      await loadTasks();
      setSelectedTaskId(null);
    } catch (err) {
      console.error(err);
    }
  }

  const rootTasks = tasks.filter((t) => !t.parent_task_id);
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500" /></div>;
  }

  return (
    <div className="flex h-full gap-0">
      <div className={`flex flex-col p-6 space-y-4 transition-all duration-200 ${selectedTask ? 'w-1/2' : 'w-full'}`}>
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
              isSelected={selectedTaskId === task.id}
              onSelect={(id) => setSelectedTaskId(selectedTaskId === id ? null : id)}
              onComplete={handleComplete}
              onStatusChange={handleStatusChange}
            />
          ))}
          {rootTasks.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-sm">No tasks yet</div>
          )}
        </div>
      </div>

      {selectedTask && (
        <TaskEditPanel
          task={selectedTask}
          allTasks={tasks}
          users={users}
          saving={saving}
          canManage={canManageTasks}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
}

function TaskRow({
  task,
  allTasks,
  canManage,
  isSelected,
  onSelect,
  onComplete,
  onStatusChange,
}: {
  task: ProjectTask;
  allTasks: ProjectTask[];
  canManage: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onComplete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const overdue = task.due_date && task.due_date < today && task.status !== 'completed' && task.status !== 'cancelled';
  const dep = task.depends_on_task_id ? allTasks.find((t) => t.id === task.depends_on_task_id) : null;
  const isBlocked = dep && dep.status !== 'completed';

  return (
    <div
      onClick={() => onSelect(task.id)}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer group ${
        isSelected
          ? 'bg-slate-700/80 ring-1 ring-cyan-500/40'
          : 'hover:bg-slate-800/50'
      }`}
    >
      <button
        onClick={(e) => { e.stopPropagation(); if (canManage && task.status !== 'completed') onComplete(task.id); }}
        className="shrink-0"
      >
        {task.status === 'completed' ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        ) : (
          <Circle className={`w-4 h-4 ${canManage ? 'text-slate-500 hover:text-emerald-400' : 'text-slate-600'}`} />
        )}
      </button>
      <div className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOTS[task.priority]}`} />
      <span className={`flex-1 text-sm min-w-0 truncate ${task.status === 'completed' ? 'text-slate-500 line-through' : 'text-white'}`}>
        {task.title}
      </span>
      {isBlocked && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" title={`Blocked by: ${dep?.title}`} />}
      {task.assigned_user ? (
        <span className="text-xs text-slate-500 w-24 truncate text-right shrink-0">{task.assigned_user.name}</span>
      ) : (
        <span className="w-24 shrink-0" />
      )}
      {task.due_date ? (
        <span className={`text-xs w-20 text-right shrink-0 ${overdue ? 'text-red-400' : 'text-slate-500'}`}>
          {new Date(task.due_date).toLocaleDateString()}
        </span>
      ) : (
        <span className="w-20 shrink-0" />
      )}
      <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${STATUS_COLORS[task.status]} text-white`}>
        {STATUS_LABELS[task.status]}
      </span>
      <Pencil className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 shrink-0 transition-colors" />
    </div>
  );
}

function TaskEditPanel({
  task,
  allTasks,
  users,
  saving,
  canManage,
  onSave,
  onDelete,
  onClose,
}: {
  task: ProjectTask;
  allTasks: ProjectTask[];
  users: User[];
  saving: boolean;
  canManage: boolean;
  onSave: (id: string, updates: Partial<ProjectTask>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    title: task.title,
    description: task.description ?? '',
    status: task.status,
    priority: task.priority,
    assigned_user_id: task.assigned_user_id ?? '',
    due_date: task.due_date ?? '',
    depends_on_task_id: task.depends_on_task_id ?? '',
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setForm({
      title: task.title,
      description: task.description ?? '',
      status: task.status,
      priority: task.priority,
      assigned_user_id: task.assigned_user_id ?? '',
      due_date: task.due_date ?? '',
      depends_on_task_id: task.depends_on_task_id ?? '',
    });
    setConfirmDelete(false);
  }, [task.id]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave(task.id, {
      title: form.title.trim(),
      description: form.description || null,
      status: form.status as ProjectTask['status'],
      priority: form.priority as ProjectTask['priority'],
      assigned_user_id: form.assigned_user_id || null,
      due_date: form.due_date || null,
      depends_on_task_id: form.depends_on_task_id || null,
    } as Partial<ProjectTask>);
  }

  const otherTasks = allTasks.filter((t) => t.id !== task.id);

  return (
    <div className="w-1/2 border-l border-slate-700/60 flex flex-col bg-slate-900/40">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60">
        <h3 className="text-sm font-semibold text-white">Edit Task</h3>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Title</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            disabled={!canManage}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-60"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            disabled={!canManage}
            rows={3}
            placeholder="Add a description..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-60 placeholder-slate-600"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              disabled={!canManage}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-60"
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="in_review">In Review</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              disabled={!canManage}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-60"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Assigned To</label>
            <select
              value={form.assigned_user_id}
              onChange={(e) => setForm({ ...form, assigned_user_id: e.target.value })}
              disabled={!canManage}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-60"
            >
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Due Date</label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              disabled={!canManage}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-60"
            />
          </div>
        </div>

        {otherTasks.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Depends On</label>
            <select
              value={form.depends_on_task_id}
              onChange={(e) => setForm({ ...form, depends_on_task_id: e.target.value })}
              disabled={!canManage}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-60"
            >
              <option value="">None</option>
              {otherTasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
        )}

        <div className="pt-1 pb-2 border-t border-slate-700/60 space-y-1.5">
          <p className="text-[10px] text-slate-600 uppercase tracking-wide font-medium">Created</p>
          <p className="text-xs text-slate-500">
            {task.created_by_user?.name ?? 'Unknown'} &middot; {new Date(task.created_at).toLocaleDateString()}
          </p>
        </div>
      </form>

      {canManage && (
        <div className="px-5 py-4 border-t border-slate-700/60 flex items-center justify-between gap-3">
          {confirmDelete ? (
            <div className="flex items-center gap-2 w-full">
              <span className="text-xs text-red-400 flex-1">Delete this task?</span>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 text-xs bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={() => onDelete(task.id)}
                className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !form.title.trim()}
                className="flex items-center gap-2 px-4 py-1.5 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 transition-colors ml-auto"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Changes
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
