import { useState } from 'react';
import { X, Loader2, UserPlus, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { inviteStaff } from '../../../services/users';
import type { Department, Role, InviteStaffInput } from '../../../types';

interface InviteStaffModalProps {
  departments: Department[];
  roles: Role[];
  onClose: () => void;
  onSuccess: () => void;
}

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Australia/Sydney',
  'Pacific/Auckland',
];

export function InviteStaffModal({
  departments,
  roles,
  onClose,
  onSuccess,
}: InviteStaffModalProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<InviteStaffInput>({
    first_name: '',
    last_name: '',
    email: '',
    role_id: '',
    department_id: null,
    phone: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const currentUserHierarchy = user?.role?.hierarchy_level ?? 999;

  const availableRoles = roles.filter((role) => {
    if (user?.role?.name === 'SuperAdmin') return true;
    return role.hierarchy_level > currentUserHierarchy;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.organization_id) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await inviteStaff(formData, user.organization_id, user);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid =
    formData.first_name.trim() &&
    formData.last_name.trim() &&
    formData.email.trim() &&
    formData.role_id &&
    formData.timezone;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-800 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Invite Staff Member</h2>
              <p className="text-sm text-slate-400">Send an invite to join your team</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                First Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                placeholder="John"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Last Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                placeholder="Doe"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Email Address <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="john@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Phone (Optional)
            </label>
            <input
              type="tel"
              value={formData.phone || ''}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="+1 (555) 123-4567"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Role <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.role_id}
              onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              required
            >
              <option value="">Select a role</option>
              {availableRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            {availableRoles.length === 0 && (
              <p className="text-xs text-amber-400 mt-1">
                No roles available to assign based on your permission level.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Department
            </label>
            <select
              value={formData.department_id || ''}
              onChange={(e) =>
                setFormData({ ...formData, department_id: e.target.value || null })
              }
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              <option value="">No Department</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Timezone <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              required
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-4 mt-4">
            <p className="text-sm text-slate-400">
              An email invitation will be sent to the user with a link to set their password
              and complete their profile.
            </p>
          </div>
        </form>

        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 p-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !isValid}
            className="px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending Invite...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Send Invite
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
