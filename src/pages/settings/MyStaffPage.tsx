import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getUsers, getUsersByDepartment, getStaffStats } from '../../services/users';
import { getDepartments } from '../../services/departments';
import { getRoles } from '../../services/roles';
import {
  Search,
  Filter,
  Loader2,
  Users as UsersIcon,
  UserPlus,
  Building2,
  UserCheck,
  UserX,
  Mail,
} from 'lucide-react';
import { InviteStaffModal } from '../../components/settings/staff/InviteStaffModal';
import { EditStaffModal } from '../../components/settings/staff/EditStaffModal';
import { StaffActivityModal } from '../../components/settings/staff/StaffActivityModal';
import { DepartmentsModal } from '../../components/settings/staff/DepartmentsModal';
import type { User, Department, Role, UserStatus } from '../../types';

type StatusFilter = 'all' | UserStatus;

export function MyStaffPage() {
  const { user, isSuperAdmin, hasPermission } = useAuth();
  const [staffMembers, setStaffMembers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDepartmentsModal, setShowDepartmentsModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityMember, setActivityMember] = useState<User | null>(null);

  const [stats, setStats] = useState({ total: 0, active: 0, invited: 0, disabled: 0 });

  const canInvite = hasPermission('staff.invite') || isSuperAdmin;
  const canManageDepartments = hasPermission('departments.manage') || isSuperAdmin;
  const isManager = user?.role?.name === 'Manager';
  const isAdmin = user?.role?.name === 'Admin';
  const canViewStaffActivity = isSuperAdmin || isAdmin;

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user?.organization_id) return;

    try {
      setIsLoading(true);

      const [depsData, rolesData, statsData] = await Promise.all([
        getDepartments(user.organization_id),
        getRoles(),
        getStaffStats(user.organization_id),
      ]);

      let usersData: User[];
      if (isManager && user.department_id) {
        usersData = await getUsersByDepartment(user.organization_id, user.department_id);
      } else {
        usersData = await getUsers(user.organization_id);
      }

      setStaffMembers(usersData);
      setDepartments(depsData);
      setRoles(rolesData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load staff data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStaff = staffMembers.filter((member) => {
    const matchesSearch =
      !searchQuery ||
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || member.status === statusFilter;

    const matchesDepartment =
      departmentFilter === 'all' || member.department_id === departmentFilter;

    const matchesRole = roleFilter === 'all' || member.role_id === roleFilter;

    return matchesSearch && matchesStatus && matchesDepartment && matchesRole;
  });

  const getDepartmentName = (departmentId: string | null) => {
    if (!departmentId) return 'No Department';
    const dept = departments.find((d) => d.id === departmentId);
    return dept?.name || 'Unknown';
  };

  const getRoleName = (roleId: string) => {
    const role = roles.find((r) => r.id === roleId);
    return role?.name || 'Unknown';
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return {
          color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          icon: UserCheck,
        };
      case 'disabled':
        return {
          color: 'bg-red-500/10 text-red-400 border-red-500/20',
          icon: UserX,
        };
      case 'invited':
        return {
          color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          icon: Mail,
        };
      default:
        return {
          color: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
          icon: UsersIcon,
        };
    }
  };

  const formatLastLogin = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const handleViewActivity = (member: User) => {
    setActivityMember(member);
    setShowActivityModal(true);
    setSelectedMember(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Staff Management</h2>
          <p className="text-slate-400 mt-1">
            {isManager ? 'Manage your department team members' : 'Manage your organization team'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManageDepartments && (
            <button
              onClick={() => setShowDepartmentsModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors font-medium"
            >
              <Building2 className="w-4 h-4" />
              Departments
            </button>
          )}
          {canInvite && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-colors font-medium"
            >
              <UserPlus className="w-4 h-4" />
              Add Staff
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-1">
            <UsersIcon className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-400">Total</span>
          </div>
          <p className="text-2xl font-semibold text-white">{stats.total}</p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-1">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-slate-400">Active</span>
          </div>
          <p className="text-2xl font-semibold text-emerald-400">{stats.active}</p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-slate-400">Invited</span>
          </div>
          <p className="text-2xl font-semibold text-amber-400">{stats.invited}</p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-1">
            <UserX className="w-4 h-4 text-red-400" />
            <span className="text-sm text-slate-400">Disabled</span>
          </div>
          <p className="text-2xl font-semibold text-red-400">{stats.disabled}</p>
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800">
        <div className="p-4 border-b border-slate-800">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                showFilters
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-800">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="invited">Invited</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>

              {!isManager && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Department
                  </label>
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  >
                    <option value="all">All Departments</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Role</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value="all">All Roles</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                  Name
                </th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                  Email
                </th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                  Role
                </th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">
                  Department
                </th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3 hidden xl:table-cell">
                  Last Login
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <UsersIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">No staff members found</p>
                  </td>
                </tr>
              ) : (
                filteredStaff.map((member) => {
                  const statusConfig = getStatusConfig(member.status);
                  const StatusIcon = statusConfig.icon;
                  const isCurrentUser = member.id === user?.id;

                  return (
                    <tr
                      key={member.id}
                      onClick={() => setSelectedMember(member)}
                      className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-white font-medium truncate">{member.name}</p>
                              {isCurrentUser && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-500 truncate md:hidden">
                              {member.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="text-slate-300 truncate max-w-[200px]">{member.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-300">{getRoleName(member.role_id)}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-sm text-slate-400">
                          {getDepartmentName(member.department_id)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${statusConfig.color}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {member.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <span className="text-sm text-slate-500">
                          {formatLastLogin(member.last_sign_in_at)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredStaff.length > 0 && (
          <div className="p-4 border-t border-slate-800">
            <p className="text-sm text-slate-500">
              Showing {filteredStaff.length} of {staffMembers.length} staff members
            </p>
          </div>
        )}
      </div>

      {showInviteModal && (
        <InviteStaffModal
          departments={departments}
          roles={roles}
          onClose={() => setShowInviteModal(false)}
          onSuccess={loadData}
        />
      )}

      {selectedMember && (
        <EditStaffModal
          member={selectedMember}
          departments={departments}
          roles={roles}
          onClose={() => setSelectedMember(null)}
          onUpdate={loadData}
          onViewActivity={canViewStaffActivity ? () => handleViewActivity(selectedMember) : undefined}
        />
      )}

      {showActivityModal && activityMember && (
        <StaffActivityModal
          member={activityMember}
          onClose={() => {
            setShowActivityModal(false);
            setActivityMember(null);
          }}
        />
      )}

      {showDepartmentsModal && (
        <DepartmentsModal
          onClose={() => setShowDepartmentsModal(false)}
          onUpdate={loadData}
        />
      )}
    </div>
  );
}
