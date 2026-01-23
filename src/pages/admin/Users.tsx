import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getUsers } from '../../services/users';
import { getRoles } from '../../services/roles';
import { getDepartments } from '../../services/departments';
import type { User, Role, Department } from '../../types';
import {
  Users as UsersIcon,
  Search,
  Plus,
  MoreVertical,
  Loader2,
  AlertCircle,
  Shield,
  Building2,
} from 'lucide-react';
import { InviteUserModal } from '../../components/InviteUserModal';
import { EditUserModal } from '../../components/EditUserModal';

export function UsersPage() {
  const { user: currentUser, hasPermission } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const canInvite = hasPermission('users.invite');
  const canManage = hasPermission('users.manage');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [usersData, rolesData, departmentsData] = await Promise.all([
        getUsers(),
        getRoles(),
        currentUser?.organization_id ? getDepartments(currentUser.organization_id) : Promise.resolve([]),
      ]);
      setUsers(usersData);
      setRoles(rolesData);
      setDepartments(departmentsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/10 text-emerald-400';
      case 'pending':
        return 'bg-amber-500/10 text-amber-400';
      case 'inactive':
        return 'bg-red-500/10 text-red-400';
      default:
        return 'bg-slate-500/10 text-slate-400';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-white font-medium">Error loading users</p>
        <p className="text-slate-400 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Users</h1>
          <p className="text-slate-400 mt-1">Manage team members and their access</p>
        </div>
        {canInvite && (
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Invite User
          </button>
        )}
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800">
        <div className="p-4 border-b border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  User
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Role
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Department
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Joined
                </th>
                {canManage && (
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-white">
                          {u.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{u.name}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-300">{u.role?.name || '--'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-300">{u.department?.name || '--'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getStatusBadge(
                        u.status
                      )}`}
                    >
                      {u.status.charAt(0).toUpperCase() + u.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-400">
                      {new Date(u.created_at).toLocaleDateString()}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      {u.id !== currentUser?.id && (
                        <button
                          onClick={() => setEditingUser(u)}
                          className="p-1 rounded hover:bg-slate-700 transition-colors"
                        >
                          <MoreVertical className="w-4 h-4 text-slate-400" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="p-8 text-center">
              <UsersIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No users found</p>
            </div>
          )}
        </div>
      </div>

      {isInviteModalOpen && (
        <InviteUserModal
          roles={roles}
          departments={departments}
          onClose={() => setIsInviteModalOpen(false)}
          onSuccess={() => {
            setIsInviteModalOpen(false);
            loadData();
          }}
        />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          roles={roles}
          departments={departments}
          onClose={() => setEditingUser(null)}
          onSuccess={() => {
            setEditingUser(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
