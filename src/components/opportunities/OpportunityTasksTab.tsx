import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  getOpportunityTasks,
} from '../../services/contactTasks';
import type { ContactTask, User } from '../../types';
import {
  Plus,
  Loader2,
  X,
  CheckCircle2,
  Circle,
  Pencil,
  Save,
  Trash2,
} from 'lucide-react';

interface OpportunityTasksTabProps {
  contactId: string;
  opportunityId: string;
  users: User[];
  canEdit: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_BG_HEX: Record<string, string> = {
  pending: '#b45309',
  in_progress: '#06b6d4',
  completed: '#10b981',
  cancelled: '#475569',
};

const PRIORITY_DOTS: Record<string, string> = {
  low: 'bg-slate-500',
  medium: 'bg-blue-500',
  high: 'bg-amber-500',
};

export function OpportunityTasksTab({
  contactId,
  opportunityId,
  users,
  canEdit,
}: OpportunityTasksTabProps) {
  const { user: currentUser, isSuperAdmin } = useAuth();
  const [tasks, setTasks] = useState<ContactTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState({
    title: '',
    assigned_to_user_id: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    due_date: '',
  });

  const isAdmin = isSuperAdmin || currentUser?.role?.hierarchy_level === 2;

  const canModifyTask = (task: ContactTask) =>
    task.created_by_user_id === currentUser?.id ||
    task.assigned_to_user_id === currentUser?.id ||
    isAdmin;

  useEffect(() => {
    loadTasks();
  }, [opportunityId]);

  async function loadTasks() {
    try {
      const data = await getOpportunityTasks(opportunityId);
      setTasks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser || !newTask.title.trim()) return;
    setSaving(true);
    try {
      await createTask(
        contactId,
        {
          title: newTask.title.trim(),
          due_date: newTask.due_date || null,
          priority: newTask.priority,
          assigned_to_user_id: newTask.assigned_to_user_id || null,
          opportunity_id: opportunityId,
        },
        currentUser
      );
      setNewTask({ title: '', assigned_to_user_id: '', priority: 'medium', due_date: '' });
      setShowAddForm(false);
      await loadTasks();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete(taskId: string, currentStatus: string) {
    if (!currentUser) return;
    try {
      if (currentStatus === 'completed') {
        await updateTask(taskId, { status: 'pending' }, currentUser);
      } else {
        await completeTask(taskId, currentUser);
      }
      await loadTasks();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleStatusChange(taskId: string, status: string) {
    if (!currentUser) return;
    try {
      await updateTask(
        taskId,
        { status: status as ContactTask['status'] },
        currentUser
      );
      await loadTasks();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSaveTask(taskId: string, updates: Partial<ContactTask>) {
    if (!currentUser) return;
    setSaving(true);
    try {
      await updateTask(taskId, updates as Parameters<typeof updateTask>[1], currentUser);
      await loadTasks();
      setSelectedTaskId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTask(taskId: string) {
    if (!currentUser) return;
    try {
      await deleteTask(taskId, currentUser);
      await loadTasks();
      setSelectedTaskId(null);
    } catch (err) {
      console.error(err);
    }
  }

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
    <div className="flex h-full gap-0">
      <div
        className={`flex flex-col p-6 space-y-4 transition-all duration-200 ${
          selectedTask ? 'w-1/2' : 'w-full'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </span>
          {canEdit && (
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
          <form
            onSubmit={handleCreateTask}
            className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">New Task</h3>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              placeholder="Task title..."
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
              autoFocus
            />
            <div className="grid grid-cols-3 gap-3">
              <select
                value={newTask.assigned_to_user_id}
                onChange={(e) => setNewTask({ ...newTask, assigned_to_user_id: e.target.value })}
                className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <select
                value={newTask.priority}
                onChange={(e) =>
                  setNewTask({ ...newTask, priority: e.target.value as 'low' | 'medium' | 'high' })
                }
                className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <input
                type="date"
                value={newTask.due_date}
                onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-sm bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !newTask.title.trim()}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-cyan-600 text-white rounded-lg disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                Create
              </button>
            </div>
          </form>
        )}

        <div className="space-y-1">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              canManage={canModifyTask(task)}
              isSelected={selectedTaskId === task.id}
              onSelect={(id) => setSelectedTaskId(selectedTaskId === id ? null : id)}
              onComplete={handleComplete}
              onStatusChange={handleStatusChange}
            />
          ))}
          {tasks.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-sm">No tasks yet</div>
          )}
        </div>
      </div>

      {selectedTask && (
        <TaskEditPanel
          task={selectedTask}
          users={users}
          saving={saving}
          canManage={canModifyTask(selectedTask)}
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
  canManage,
  isSelected,
  onSelect,
  onComplete,
  onStatusChange,
}: {
  task: ContactTask;
  canManage: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onComplete: (id: string, status: string) => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const taskDate = task.due_date ? task.due_date.split('T')[0] : null;
  const overdue =
    taskDate &&
    taskDate < today &&
    task.status !== 'completed' &&
    task.status !== 'cancelled';

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
        onClick={(e) => {
          e.stopPropagation();
          if (canManage) onComplete(task.id, task.status);
        }}
        className="shrink-0"
      >
        {task.status === 'completed' ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        ) : (
          <Circle
            className={`w-4 h-4 ${canManage ? 'text-slate-500 hover:text-emerald-400' : 'text-slate-600'}`}
          />
        )}
      </button>
      <div
        className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOTS[task.priority] ?? 'bg-slate-500'}`}
      />
      <span
        className={`flex-1 text-sm min-w-0 truncate ${
          task.status === 'completed' ? 'text-slate-500 line-through' : 'text-white'
        }`}
      >
        {task.title}
      </span>
      {task.assigned_to ? (
        <span className="text-xs text-slate-500 w-24 truncate text-right shrink-0">
          {task.assigned_to.name}
        </span>
      ) : (
        <span className="w-24 shrink-0" />
      )}
      {task.due_date ? (
        <span
          className={`text-xs w-20 text-right shrink-0 ${
            overdue ? 'text-red-400' : 'text-slate-500'
          }`}
        >
          {new Date(task.due_date).toLocaleDateString()}
        </span>
      ) : (
        <span className="w-20 shrink-0" />
      )}
      <select
        value={task.status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          e.stopPropagation();
          onStatusChange(task.id, e.target.value);
        }}
        className="text-[10px] px-1.5 py-0.5 rounded shrink-0 text-white border-0 outline-none cursor-pointer appearance-none font-medium"
        style={{ backgroundColor: STATUS_BG_HEX[task.status] ?? '#475569' }}
      >
        {Object.entries(STATUS_LABELS).map(([val, label]) => (
          <option key={val} value={val} style={{ backgroundColor: '#1e293b' }}>
            {label}
          </option>
        ))}
      </select>
      <Pencil className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 shrink-0 transition-colors" />
    </div>
  );
}

function TaskEditPanel({
  task,
  users,
  saving,
  canManage,
  onSave,
  onDelete,
  onClose,
}: {
  task: ContactTask;
  users: User[];
  saving: boolean;
  canManage: boolean;
  onSave: (id: string, updates: Partial<ContactTask>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    title: task.title,
    description: task.description ?? '',
    status: task.status,
    priority: task.priority,
    assigned_to_user_id: task.assigned_to_user_id ?? '',
    due_date: task.due_date ? task.due_date.split('T')[0] : '',
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setForm({
      title: task.title,
      description: task.description ?? '',
      status: task.status,
      priority: task.priority,
      assigned_to_user_id: task.assigned_to_user_id ?? '',
      due_date: task.due_date ? task.due_date.split('T')[0] : '',
    });
    setConfirmDelete(false);
  }, [task.id]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave(task.id, {
      title: form.title.trim(),
      description: form.description || null,
      status: form.status as ContactTask['status'],
      priority: form.priority as ContactTask['priority'],
      assigned_to_user_id: form.assigned_to_user_id || null,
      due_date: form.due_date || null,
    });
  }

  return (
    <div className="w-1/2 border-l border-slate-700/60 flex flex-col bg-slate-900/40">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60">
        <h3 className="text-sm font-semibold text-white">Edit Task</h3>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            Title
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            disabled={!canManage}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-60"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            Description
          </label>
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
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Status
            </label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              disabled={!canManage}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-60"
            >
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Priority
            </label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              disabled={!canManage}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-60"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Assigned To
            </label>
            <select
              value={form.assigned_to_user_id}
              onChange={(e) => setForm({ ...form, assigned_to_user_id: e.target.value })}
              disabled={!canManage}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-60"
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Due Date
            </label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              disabled={!canManage}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-60"
            />
          </div>
        </div>

        <div className="pt-1 pb-2 border-t border-slate-700/60 space-y-1.5">
          <p className="text-[10px] text-slate-600 uppercase tracking-wide font-medium">
            Created
          </p>
          <p className="text-xs text-slate-500">
            {task.created_by?.name ?? 'Unknown'} &middot;{' '}
            {new Date(task.created_at).toLocaleDateString()}
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
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save Changes
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
