import { useState } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import type { Role, Department } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { logAudit } from '../services/audit';

interface InviteUserModalProps {
  roles: Role[];
  departments: Department[];
  onClose: () => void;
  onSuccess: () => void;
}

export function InviteUserModal({ roles, departments, onClose, onSuccess }: InviteUserModalProps) {
  const { user: currentUser } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [roleId, setRoleId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
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
      const tempPassword = Math.random().toString(36).slice(-12) + 'Aa1!';

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: tempPassword,
        options: {
          data: {
            name,
          },
        },
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('Failed to create user');

      const { data: userData, error: insertError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email,
          name,
          role_id: roleId,
          organization_id: currentUser.organization_id,
          department_id: departmentId || null,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      await logAudit({
        userId: currentUser.id,
        action: 'create',
        entityType: 'user',
        entityId: userData.id,
        afterState: userData,
      });

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite user');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-slate-900 rounded-xl border border-slate-800 w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">Invite User</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="john@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Role</label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              <option value="">Select role</option>
              {availableRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Department (optional)
            </label>
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
                  Inviting...
                </span>
              ) : (
                'Send Invite'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
