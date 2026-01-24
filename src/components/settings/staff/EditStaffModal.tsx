import { useState } from 'react';
import {
  X,
  Loader2,
  Mail,
  Phone,
  Calendar,
  Shield,
  Clock,
  AlertCircle,
  Save,
  MoreVertical,
  KeyRound,
  UserX,
  UserCheck,
  Send,
  Activity,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  updateUser,
  disableUser,
  enableUser,
  resetUserPassword,
  resendInvite,
} from '../../../services/users';
import type { User, Department, Role } from '../../../types';

interface EditStaffModalProps {
  member: User;
  departments: Department[];
  roles: Role[];
  onClose: () => void;
  onUpdate: () => void;
  onViewActivity?: () => void;
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

export function EditStaffModal({
  member,
  departments,
  roles,
  onClose,
  onUpdate,
  onViewActivity,
}: EditStaffModalProps) {
  const { user, isSuperAdmin, hasPermission } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [showConfirmDisable, setShowConfirmDisable] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const [formData, setFormData] = useState({
    name: member.name,
    role_id: member.role_id,
    department_id: member.department_id,
    phone: member.phone || '',
    timezone: member.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const currentUserHierarchy = user?.role?.hierarchy_level ?? 999;
  const memberHierarchy = member.role?.hierarchy_level ?? 999;

  const canManage = hasPermission('staff.manage') || isSuperAdmin;
  const canDisable = hasPermission('staff.disable') || isSuperAdmin;
  const canResetPassword = hasPermission('staff.reset_password') || isSuperAdmin;
  const isAdmin = user?.role?.name === 'Admin';
  const canViewActivity = isSuperAdmin || isAdmin;

  const canEditRole =
    isSuperAdmin || (canManage && memberHierarchy > currentUserHierarchy);

  const availableRoles = roles.filter((role) => {
    if (isSuperAdmin) return true;
    return role.hierarchy_level > currentUserHierarchy;
  });

  const isOwnProfile = member.id === user?.id;

  const handleSave = async () => {
    if (!user || !canManage) return;
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      await updateUser(member.id, formData, user);
      setSuccess('Staff member updated successfully');
      onUpdate();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update staff member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisable = async () => {
    if (!user || !canDisable) return;
    setError(null);
    setIsSubmitting(true);

    try {
      await disableUser(member.id, user);
      setSuccess('Staff member disabled');
      setShowConfirmDisable(false);
      onUpdate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable staff member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnable = async () => {
    if (!user || !canDisable) return;
    setError(null);
    setIsSubmitting(true);

    try {
      await enableUser(member.id, user);
      setSuccess('Staff member enabled');
      onUpdate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable staff member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user || !canResetPassword) return;
    setError(null);
    setIsSubmitting(true);

    try {
      await resetUserPassword(member.id, user);
      setSuccess('Password reset email sent');
      setShowConfirmReset(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send password reset');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendInvite = async () => {
    if (!user) return;
    setError(null);
    setIsSubmitting(true);

    try {
      await resendInvite(member.id, user);
      setSuccess('Invite resent successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend invite');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'disabled':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'invited':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 p-6 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-white">
            {canManage ? 'Edit Staff Member' : 'Staff Member Details'}
          </h2>
          <div className="flex items-center gap-2">
            {(canDisable || canResetPassword || canViewActivity) && (
              <div className="relative">
                <button
                  onClick={() => setShowActions(!showActions)}
                  className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <MoreVertical className="w-5 h-5 text-slate-400" />
                </button>
                {showActions && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20">
                    {member.status === 'invited' && (
                      <button
                        onClick={handleResendInvite}
                        disabled={isSubmitting}
                        className="w-full px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2 disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                        Resend Invite
                      </button>
                    )}
                    {canResetPassword && member.status === 'active' && (
                      <button
                        onClick={() => {
                          setShowActions(false);
                          setShowConfirmReset(true);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                      >
                        <KeyRound className="w-4 h-4" />
                        Reset Password
                      </button>
                    )}
                    {canViewActivity && onViewActivity && (
                      <button
                        onClick={() => {
                          setShowActions(false);
                          onViewActivity();
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                      >
                        <Activity className="w-4 h-4" />
                        View Activity
                      </button>
                    )}
                    {canDisable && !isOwnProfile && (
                      <>
                        <div className="border-t border-slate-700 my-1" />
                        {member.status === 'disabled' ? (
                          <button
                            onClick={handleEnable}
                            disabled={isSubmitting}
                            className="w-full px-4 py-2.5 text-left text-sm text-emerald-400 hover:bg-slate-700 flex items-center gap-2 disabled:opacity-50"
                          >
                            <UserCheck className="w-4 h-4" />
                            Enable User
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setShowActions(false);
                              setShowConfirmDisable(true);
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2"
                          >
                            <UserX className="w-4 h-4" />
                            Disable User
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <AlertCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <p className="text-sm text-emerald-400">{success}</p>
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center text-white text-2xl font-semibold">
              {member.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              {canManage ? (
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="text-xl font-semibold text-white bg-transparent border-b border-transparent hover:border-slate-600 focus:border-cyan-500 focus:outline-none pb-1 w-full"
                />
              ) : (
                <h3 className="text-xl font-semibold text-white mb-1">{member.name}</h3>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(
                    member.status
                  )}`}
                >
                  {member.status}
                </span>
                {isOwnProfile && (
                  <span className="text-xs px-2 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    You
                  </span>
                )}
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
              <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-slate-300">Phone</span>
              </div>
              {canManage ? (
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Not provided"
                  className="text-white bg-transparent w-full focus:outline-none"
                />
              ) : (
                <p className="text-white">{member.phone || 'Not provided'}</p>
              )}
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-slate-300">Role</span>
              </div>
              {canEditRole ? (
                <select
                  value={formData.role_id}
                  onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                  className="text-white bg-slate-700 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {member.role && !availableRoles.find((r) => r.id === member.role_id) && (
                    <option value={member.role_id}>{member.role.name}</option>
                  )}
                  {availableRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-white">{member.role?.name || 'Unknown'}</p>
              )}
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-slate-300">Department</span>
              </div>
              {canManage ? (
                <select
                  value={formData.department_id || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, department_id: e.target.value || null })
                  }
                  className="text-white bg-slate-700 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">No Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-white">{member.department?.name || 'No Department'}</p>
              )}
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-slate-300">Timezone</span>
              </div>
              {canManage ? (
                <select
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  className="text-white bg-slate-700 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-white">{member.timezone?.replace(/_/g, ' ') || 'Not set'}</p>
              )}
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4">
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

          {member.last_sign_in_at && (
            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-slate-300">Last Login</span>
              </div>
              <p className="text-white">
                {new Date(member.last_sign_in_at).toLocaleString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 p-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors font-medium"
          >
            {canManage ? 'Cancel' : 'Close'}
          </button>
          {canManage && (
            <button
              onClick={handleSave}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-colors font-medium disabled:opacity-50 inline-flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {showConfirmDisable && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-800 max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Disable Staff Member</h3>
            <p className="text-slate-400 mb-4">
              Are you sure you want to disable <strong>{member.name}</strong>? They will no
              longer be able to log in and won't be assigned new work. Their historical data
              will be preserved.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmDisable(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDisable}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors inline-flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Disable User
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmReset && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-800 max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Reset Password</h3>
            <p className="text-slate-400 mb-4">
              A password reset email will be sent to <strong>{member.email}</strong>. They
              will need to click the link to set a new password.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmReset(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-colors inline-flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Send Reset Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
