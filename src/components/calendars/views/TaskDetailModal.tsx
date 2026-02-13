import { useState } from 'react';
import {
  X, CheckSquare, Clock, Flag, Edit3, Trash2, Save, Loader2,
  AlertTriangle, Check, RotateCcw,
} from 'lucide-react';
import type { CalendarTask, TaskPriority } from '../../../types';
import { updateCalendarTask, deleteCalendarTask, completeCalendarTask, reopenCalendarTask } from '../../../services/calendarTasks';
import { useAuth } from '../../../contexts/AuthContext';

interface TaskDetailModalProps {
  task: CalendarTask;
  onClose: () => void;
  onUpdated: () => void;
}

export function TaskDetailModal({ task, onClose, onUpdated }: TaskDetailModalProps) {
  const { user: currentUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localTask, setLocalTask] = useState(task);

  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description || '');
  const [editDueDate, setEditDueDate] = useState(
    new Date(task.due_at_utc).toISOString().slice(0, 16)
  );
  const [editDuration, setEditDuration] = useState(task.duration_minutes);
  const [editPriority, setEditPriority] = useState<TaskPriority>(task.priority);

  const canEdit = currentUser?.id === task.user_id ||
    currentUser?.role?.name === 'SuperAdmin' ||
    currentUser?.role?.name === 'Admin';

  const dateDisplay = new Date(localTask.due_at_utc).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const timeDisplay = new Date(localTask.due_at_utc).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  });

  const priorityColors: Record<TaskPriority, string> = {
    low: 'text-slate-400 bg-slate-500/20',
    medium: 'text-amber-400 bg-amber-500/20',
    high: 'text-red-400 bg-red-500/20',
  };

  const handleToggleComplete = async () => {
    if (!currentUser) return;
    setIsToggling(true);
    setError(null);
    try {
      const updated = localTask.completed
        ? await reopenCalendarTask(localTask.id, currentUser)
        : await completeCalendarTask(localTask.id, currentUser);
      setLocalTask(updated);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setIsToggling(false);
    }
  };

  const handleSave = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateCalendarTask(localTask.id, {
        title: editTitle,
        description: editDescription || null,
        due_at_utc: new Date(editDueDate).toISOString(),
        duration_minutes: editDuration,
        priority: editPriority,
      }, currentUser);
      setLocalTask(updated);
      setIsEditing(false);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentUser) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteCalendarTask(localTask.id, currentUser);
      onClose();
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 bg-slate-900 rounded-xl border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <CheckSquare className="w-4 h-4 text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">
              {isEditing ? 'Edit Task' : 'Task Details'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <div className="p-4 space-y-4">
          {isEditing ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Title</label>
                <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Due</label>
                <input type="datetime-local" value={editDueDate} onChange={e => setEditDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Duration</label>
                <select value={editDuration} onChange={e => setEditDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Priority</label>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as TaskPriority[]).map(p => (
                    <button key={p} onClick={() => setEditPriority(p)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                        editPriority === p
                          ? p === 'high' ? 'bg-red-500/20 text-red-400 border-red-500/40'
                            : p === 'medium' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                            : 'bg-slate-600/30 text-slate-300 border-slate-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <button onClick={handleToggleComplete} disabled={isToggling}
                  className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border transition-colors flex-shrink-0 ${
                    localTask.completed
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-slate-600 hover:border-amber-500'
                  }`}>
                  {isToggling ? <Loader2 className="w-3 h-3 animate-spin" /> :
                    localTask.completed ? <Check className="w-3 h-3" /> : null}
                </button>
                <h4 className={`text-xl font-semibold ${localTask.completed ? 'text-slate-500 line-through' : 'text-white'}`}>
                  {localTask.title}
                </h4>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-white">{dateDisplay}</p>
                    <p className="text-sm text-slate-400">{timeDisplay} ({localTask.duration_minutes} min)</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Flag className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[localTask.priority]}`}>
                    {localTask.priority.charAt(0).toUpperCase() + localTask.priority.slice(1)} Priority
                  </span>
                </div>
                {localTask.completed && localTask.completed_at && (
                  <div className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <p className="text-sm text-emerald-400">
                      Completed {new Date(localTask.completed_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {localTask.description && (
                  <div className="pt-2 border-t border-slate-800">
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{localTask.description}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {showDeleteConfirm && (
          <div className="mx-4 mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <p className="text-sm text-red-300 mb-3">Delete this task? It will also be removed from Google Calendar.</p>
            <div className="flex items-center gap-2">
              <button onClick={handleDelete} disabled={isDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete
              </button>
              <button onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-sm hover:bg-slate-700">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 p-4 border-t border-slate-800">
          <div>
            {!isEditing && canEdit && !localTask.completed && (
              <button onClick={handleToggleComplete} disabled={isToggling}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 text-sm font-medium hover:bg-emerald-600/30 transition-colors">
                <Check className="w-3.5 h-3.5" /> Mark Complete
              </button>
            )}
            {!isEditing && canEdit && localTask.completed && (
              <button onClick={handleToggleComplete} disabled={isToggling}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition-colors">
                <RotateCcw className="w-3.5 h-3.5" /> Reopen
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-sm hover:bg-slate-700">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={isSaving}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save
                </button>
              </>
            ) : canEdit ? (
              <>
                <button onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-red-400 text-sm hover:bg-red-500/10">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
                <button onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700">
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
