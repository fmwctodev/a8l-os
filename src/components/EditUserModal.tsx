import { useState } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import type { User, Role, Department } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { updateUser } from '../services/users';

interface EditUserModalProps {
  user: User;
  roles: Role[];
  departments: Department[];
  onClose: () => void;
  onSuccess: () => void;
}

export function EditUserModal({ user, roles, departments, onClose, onSuccess }: EditUserModalProps) {
  const { user: currentUser } = useAuth();
  const [roleId, setRoleId] = useState(user.role_id);
  const [departmentId, setDepartmentId] = useState(user.department_id || '');
  const [status, setStatus] = useState(user.status);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableRoles = roles.filter((r) => {
    if (currentUser?.role?.name === 'SuperAdmin') return true;
    return r.hierarchy_level > (currentUser?.role?.hierarchy_level || 100);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setIsLoading(true);
    setError(null);

    try {
      await updateUser(
        user.id,
        {
          role_id: roleId,
          department_id: departmentId || null,
          status,
        },
        currentUser
      );
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-slate-900 rounded-xl border border-slate-800 w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">Edit User</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center">
              <span className="text-sm font-semibold text-white">
                {user.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </span>
            </div>
            <div>
              <p className="text-white font-medium">{user.name}</p>
              <p className="text-sm text-slate-400">{user.email}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Role</label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              {availableRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Department</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              <option value="">No department</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'inactive' | 'pending')}
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
