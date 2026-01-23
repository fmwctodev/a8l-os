import { useState, useEffect } from 'react';
import {
  X,
  Loader2,
  Building2,
  Plus,
  Edit2,
  Check,
  XCircle,
  Users,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getDepartmentWithUserCount,
  createDepartment,
  updateDepartment,
  disableDepartment,
  enableDepartment,
} from '../../../services/departments';
import type { Department } from '../../../types';

interface DepartmentWithCount extends Department {
  user_count: number;
}

interface DepartmentsModalProps {
  onClose: () => void;
  onUpdate: () => void;
}

export function DepartmentsModal({ onClose, onUpdate }: DepartmentsModalProps) {
  const { user, hasPermission, isSuperAdmin } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [departments, setDepartments] = useState<DepartmentWithCount[]>([]);
  const [showDisabled, setShowDisabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newDeptName, setNewDeptName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const canManage = hasPermission('departments.manage') || isSuperAdmin;

  useEffect(() => {
    loadDepartments();
  }, [user?.organization_id, showDisabled]);

  const loadDepartments = async () => {
    if (!user?.organization_id) return;
    setIsLoading(true);
    try {
      const data = await getDepartmentWithUserCount(user.organization_id, showDisabled);
      setDepartments(data as DepartmentWithCount[]);
    } catch (err) {
      console.error('Failed to load departments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!user?.organization_id || !newDeptName.trim()) return;
    setError(null);
    setIsCreating(true);

    try {
      await createDepartment(newDeptName.trim(), user.organization_id, user);
      setNewDeptName('');
      setShowCreateForm(false);
      setSuccess('Department created successfully');
      await loadDepartments();
      onUpdate();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create department');
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartEdit = (dept: DepartmentWithCount) => {
    setEditingId(dept.id);
    setEditingName(dept.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleSaveEdit = async () => {
    if (!user || !editingId || !editingName.trim()) return;
    setError(null);
    setIsSaving(true);

    try {
      await updateDepartment(editingId, { name: editingName.trim() }, user);
      setEditingId(null);
      setEditingName('');
      setSuccess('Department updated successfully');
      await loadDepartments();
      onUpdate();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update department');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (dept: DepartmentWithCount) => {
    if (!user) return;
    setError(null);

    try {
      if (dept.status === 'active') {
        await disableDepartment(dept.id, user);
        setSuccess('Department disabled');
      } else {
        await enableDepartment(dept.id, user);
        setSuccess('Department enabled');
      }
      await loadDepartments();
      onUpdate();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update department status');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-800 max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="border-b border-slate-800 p-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Departments</h2>
              <p className="text-sm text-slate-400">Manage organization departments</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          {canManage && (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Department
            </button>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showDisabled}
              onChange={(e) => setShowDisabled(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
            />
            Show disabled
          </label>
        </div>

        {showCreateForm && canManage && (
          <div className="p-4 border-b border-slate-800 bg-slate-800/30 flex-shrink-0">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                placeholder="Department name"
                className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') {
                    setShowCreateForm(false);
                    setNewDeptName('');
                  }
                }}
                autoFocus
              />
              <button
                onClick={handleCreate}
                disabled={isCreating || !newDeptName.trim()}
                className="p-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setNewDeptName('');
                }}
                className="p-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {(error || success) && (
          <div className="px-4 pt-4 flex-shrink-0">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <p className="text-sm text-emerald-400">{success}</p>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
            </div>
          ) : departments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="w-12 h-12 text-slate-600 mb-3" />
              <p className="text-slate-400">No departments found</p>
              {canManage && (
                <p className="text-sm text-slate-500 mt-1">
                  Create your first department to organize your team
                </p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {departments.map((dept) => (
                <div
                  key={dept.id}
                  className={`p-4 hover:bg-slate-800/30 transition-colors ${
                    dept.status === 'disabled' ? 'opacity-60' : ''
                  }`}
                >
                  {editingId === dept.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit();
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        autoFocus
                      />
                      <button
                        onClick={handleSaveEdit}
                        disabled={isSaving || !editingName.trim()}
                        className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        {isSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="p-1.5 rounded-lg bg-slate-700 text-white hover:bg-slate-600"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-slate-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-white font-medium">{dept.name}</p>
                            {dept.status === 'disabled' && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
                                Disabled
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Users className="w-3 h-3" />
                            {dept.user_count} member{dept.user_count !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      {canManage && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartEdit(dept)}
                            className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
                            title="Edit name"
                          >
                            <Edit2 className="w-4 h-4 text-slate-400" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(dept)}
                            className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
                            title={dept.status === 'active' ? 'Disable' : 'Enable'}
                          >
                            {dept.status === 'active' ? (
                              <ToggleRight className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <ToggleLeft className="w-5 h-5 text-slate-500" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-800 p-4 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
