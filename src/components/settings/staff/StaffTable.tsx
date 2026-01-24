import { useCallback, useRef } from 'react';
import { Users as UsersIcon, UserCheck, UserX, Mail, Calendar } from 'lucide-react';
import { RoleBadge } from './RoleBadge';
import type { User, Department, Role } from '../../../types';

interface StaffTableProps {
  staff: User[];
  departments: Department[];
  roles: Role[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onRowClick: (member: User) => void;
  currentUserId?: string;
}

export function StaffTable({
  staff,
  departments,
  roles,
  selectedIds,
  onSelectionChange,
  onRowClick,
  currentUserId,
}: StaffTableProps) {
  const lastSelectedIndex = useRef<number | null>(null);

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
          label: 'Active',
        };
      case 'disabled':
        return {
          color: 'bg-red-500/10 text-red-400 border-red-500/20',
          icon: UserX,
          label: 'Disabled',
        };
      case 'invited':
        return {
          color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          icon: Mail,
          label: 'Invited',
        };
      default:
        return {
          color: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
          icon: UsersIcon,
          label: status,
        };
    }
  };

  const formatLastActive = (dateStr: string | null) => {
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

  const formatJoinedDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isAllSelected = staff.length > 0 && selectedIds.length === staff.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < staff.length;

  const handleSelectAll = () => {
    if (isAllSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(staff.map((m) => m.id));
    }
  };

  const handleRowSelect = useCallback(
    (member: User, index: number, event: React.MouseEvent) => {
      event.stopPropagation();

      const isSelected = selectedIds.includes(member.id);

      if (event.shiftKey && lastSelectedIndex.current !== null) {
        const start = Math.min(lastSelectedIndex.current, index);
        const end = Math.max(lastSelectedIndex.current, index);
        const rangeIds = staff.slice(start, end + 1).map((m) => m.id);
        const newSelection = new Set([...selectedIds, ...rangeIds]);
        onSelectionChange(Array.from(newSelection));
      } else {
        if (isSelected) {
          onSelectionChange(selectedIds.filter((id) => id !== member.id));
        } else {
          onSelectionChange([...selectedIds, member.id]);
        }
        lastSelectedIndex.current = index;
      }
    },
    [selectedIds, staff, onSelectionChange]
  );

  if (staff.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <UsersIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">No staff members found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-800">
            <th className="text-left px-4 py-3 w-10">
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={(el) => {
                  if (el) el.indeterminate = isSomeSelected;
                }}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 focus:ring-offset-slate-900"
              />
            </th>
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
              Last Active
            </th>
            <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3 hidden 2xl:table-cell">
              Joined Date
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {staff.map((member, index) => {
            const statusConfig = getStatusConfig(member.status);
            const StatusIcon = statusConfig.icon;
            const isCurrentUser = member.id === currentUserId;
            const isSelected = selectedIds.includes(member.id);

            return (
              <tr
                key={member.id}
                onClick={() => onRowClick(member)}
                className={`transition-colors cursor-pointer ${
                  isSelected ? 'bg-cyan-500/10' : 'hover:bg-slate-700'
                }`}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onClick={(e) => handleRowSelect(member, index, e)}
                    onChange={() => {}}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 focus:ring-offset-slate-900"
                  />
                </td>
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
                      <p className="text-sm text-slate-500 truncate md:hidden">{member.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <p className="text-slate-300 truncate max-w-[200px]">{member.email}</p>
                </td>
                <td className="px-4 py-3">
                  <RoleBadge roleName={getRoleName(member.role_id)} />
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
                    {statusConfig.label}
                  </span>
                </td>
                <td className="px-4 py-3 hidden xl:table-cell">
                  <span className="text-sm text-slate-500">
                    {formatLastActive(member.last_sign_in_at)}
                  </span>
                </td>
                <td className="px-4 py-3 hidden 2xl:table-cell">
                  <div className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatJoinedDate(member.created_at)}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
