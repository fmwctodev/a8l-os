import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createTask, updateTask, deleteTask, completeTask, getPriorityColor, getStatusColor } from '../../services/contactTasks';
import type { ContactTask, User } from '../../types';
import { Plus, Check, Trash2, Loader2, Calendar, CheckSquare, Clock, Video } from 'lucide-react';

interface ContactTasksTabProps {
  contactId: string;
  tasks: ContactTask[];
  users: User[];
  onRefresh: () => void;
}

export function ContactTasksTab({ contactId, tasks, users, onRefresh }: ContactTasksTabProps) {
  const { user: currentUser, hasPermission, isSuperAdmin } = useAuth();
  const [isAdding, setIsAdding] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    assigned_to_user_id: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canEdit = hasPermission('contacts.edit');
  const isAdmin = isSuperAdmin || currentUser?.role?.hierarchy_level === 2;

  const handleAdd = async () => {
    if (!currentUser || !newTask.title.trim()) return;

    try {
      setIsSubmitting(true);
      await createTask(
        contactId,
        {
          title: newTask.title.trim(),
          description: newTask.description.trim() || null,
          due_date: newTask.due_date || null,
          priority: newTask.priority,
          assigned_to_user_id: newTask.assigned_to_user_id || null,
        },
        currentUser
      );
      setNewTask({ title: '', description: '', due_date: '', priority: 'medium', assigned_to_user_id: '' });
      setIsAdding(false);
      onRefresh();
    } catch {
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = async (task: ContactTask) => {
    if (!currentUser) return;

    try {
      if (task.status === 'completed') {
        await updateTask(task.id, { status: 'pending' }, currentUser);
      } else {
        await completeTask(task.id, currentUser);
      }
      onRefresh();
    } catch {
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!currentUser || !confirm('Are you sure you want to delete this task?')) return;

    try {
      await deleteTask(taskId, currentUser);
      onRefresh();
    } catch {
    }
  };

  const canModifyTask = (task: ContactTask) => {
    return (
      task.created_by_user_id === currentUser?.id ||
      task.assigned_to_user_id === currentUser?.id ||
      isAdmin
    );
  };

  const pendingTasks = tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  const isOverdue = (task: ContactTask) => {
    if (!task.due_date || task.status === 'completed') return false;
    return new Date(task.due_date) < new Date();
  };

  return (
    <div className="space-y-4">
      {canEdit && !isAdding && (
        <button
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      )}

      {isAdding && (
        <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
          <input
            type="text"
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            placeholder="Task title..."
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            autoFocus
          />
          <textarea
            value={newTask.description}
            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            placeholder="Description (optional)..."
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
          />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Due Date</label>
              <input
                type="datetime-local"
                value={newTask.due_date}
                onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Priority</label>
              <select
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as 'low' | 'medium' | 'high' })}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Assign To</label>
              <select
                value={newTask.assigned_to_user_id}
                onChange={(e) => setNewTask({ ...newTask, assigned_to_user_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setIsAdding(false);
                setNewTask({ title: '', description: '', due_date: '', priority: 'medium', assigned_to_user_id: '' });
              }}
              className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!newTask.title.trim() || isSubmitting}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Add Task
            </button>
          </div>
        </div>
      )}

      {pendingTasks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Open Tasks ({pendingTasks.length})
          </h4>
          {pendingTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              isOverdue={isOverdue(task)}
              canModify={canModifyTask(task)}
              onComplete={() => handleComplete(task)}
              onDelete={() => handleDelete(task.id)}
            />
          ))}
        </div>
      )}

      {completedTasks.length > 0 && (
        <div className="space-y-2 pt-4">
          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Completed ({completedTasks.length})
          </h4>
          {completedTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              isOverdue={false}
              canModify={canModifyTask(task)}
              onComplete={() => handleComplete(task)}
              onDelete={() => handleDelete(task.id)}
            />
          ))}
        </div>
      )}

      {tasks.length === 0 && !isAdding && (
        <div className="text-center py-8">
          <CheckSquare className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No tasks yet</p>
          {canEdit && (
            <button
              onClick={() => setIsAdding(true)}
              className="mt-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Create the first task
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface TaskItemProps {
  task: ContactTask;
  isOverdue: boolean;
  canModify: boolean;
  onComplete: () => void;
  onDelete: () => void;
}

function isMeetSourcedTask(task: ContactTask): boolean {
  return !!(task.description && task.description.includes('[meet:'));
}

function getCleanDescription(task: ContactTask): string | null {
  if (!task.description) return null;
  return task.description
    .replace(/\n\n\[Source: Google Meet -- [^\]]*\]\n\[meet:[^\]]*\]/, '')
    .trim() || null;
}

function TaskItem({ task, isOverdue, canModify, onComplete, onDelete }: TaskItemProps) {
  const isCompleted = task.status === 'completed';
  const isMeetTask = isMeetSourcedTask(task);
  const cleanDescription = getCleanDescription(task);

  return (
    <div className={`bg-slate-800/50 rounded-lg p-3 ${isCompleted ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={onComplete}
          className={`mt-0.5 w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
            isCompleted
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : 'border-slate-600 hover:border-cyan-500'
          }`}
        >
          {isCompleted && <Check className="w-3 h-3" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium ${isCompleted ? 'text-slate-400 line-through' : 'text-white'}`}>
              {task.title}
            </p>
            {isMeetTask && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 text-[10px] font-medium flex-shrink-0">
                <Video className="w-2.5 h-2.5" />
                Meet
              </span>
            )}
          </div>
          {cleanDescription && (
            <p className="text-xs text-slate-500 mt-0.5">{cleanDescription}</p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
              {task.priority}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getStatusColor(task.status)}`}>
              {task.status.replace('_', ' ')}
            </span>
            {task.due_date && (
              <span className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-red-400' : 'text-slate-500'}`}>
                <Clock className="w-3 h-3" />
                {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
            {task.assigned_to && (
              <span className="text-xs text-slate-500">
                Assigned to {task.assigned_to.name}
              </span>
            )}
          </div>
        </div>
        {canModify && (
          <button
            onClick={onDelete}
            className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Delete task"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
