import { X, Mail, Phone, Calendar, Shield } from 'lucide-react';
import type { User, Department, Role } from '../../../types';

interface StaffMemberModalProps {
  member: User;
  departments: Department[];
  roles: Role[];
  onClose: () => void;
  onUpdate: () => void;
}

export function StaffMemberModal({
  member,
  departments,
  roles,
  onClose,
}: StaffMemberModalProps) {
  const getDepartmentName = (departmentId: string | null) => {
    if (!departmentId) return 'No Department';
    const dept = departments.find((d) => d.id === departmentId);
    return dept?.name || 'Unknown';
  };

  const getRoleName = (roleId: string) => {
    const role = roles.find((r) => r.id === roleId);
    return role?.name || 'Unknown';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'inactive':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      case 'pending':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 p-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Staff Member Details</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center text-white text-2xl font-semibold">
              {member.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-white mb-1">{member.name}</h3>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(
                    member.status
                  )}`}
                >
                  {member.status}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-slate-300">Email</span>
              </div>
              <p className="text-white">{member.email}</p>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-slate-300">Phone</span>
              </div>
              <p className="text-white">{(member as any).phone || 'Not provided'}</p>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-slate-300">Role</span>
              </div>
              <p className="text-white">{getRoleName(member.role_id)}</p>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-slate-300">Department</span>
              </div>
              <p className="text-white">{getDepartmentName(member.department_id)}</p>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4 md:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-slate-300">Joined</span>
              </div>
              <p className="text-white">
                {new Date(member.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>

          {(member as any).title && (
            <div className="bg-slate-800/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-slate-300 mb-2">Job Title</h4>
              <p className="text-white">{(member as any).title}</p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 p-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
