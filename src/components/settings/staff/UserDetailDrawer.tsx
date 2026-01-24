import { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Mail,
  Phone,
  Calendar,
  Clock,
  Shield,
  Building2,
  AlertCircle,
  Save,
  Loader2,
  MoreVertical,
  KeyRound,
  UserX,
  UserCheck,
  Send,
  Activity,
  RotateCcw,
} from 'lucide-react';
import { SlideInDrawer } from '../../ui/SlideInDrawer';
import { RoleBadge } from './RoleBadge';
import { PermissionMatrix } from './PermissionMatrix';
import { useAuth } from '../../../contexts/AuthContext';
import {
  updateUser,
  disableUser,
  enableUser,
  resetUserPassword,
  resendInvite,
  getUserActivity,
} from '../../../services/users';
import type { User, Department, Role, AuditLog } from '../../../types';

interface UserDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  member: User | null;
  departments: Department[];
  roles: Role[];
  onUpdate: () => void;
}

type Tab = 'profile' | 'permissions' | 'activity';

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

export function UserDetailDrawer({
  isOpen,
  onClose,
  member,
  departments,
  roles,
  onUpdate,
}: UserDetailDrawerProps) {
  const { user, isSuperAdmin, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [showConfirmDisable, setShowConfirmDisable] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [activityLogs, setActivityLogs] = useState<AuditLog[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    role_id: '',
    department_id: null as string | null,
    phone: '',
    timezone: '',
  });

  useEffect(() => {
    if (member && isOpen) {
      setFormData({
        name: member.name,
        role_id: member.role_id,
        department_id: member.department_id,
        phone: member.phone || '',
        timezone: member.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setActiveTab('profile');
      setError(null);
      setSuccess(null);
    }
  }, [member, isOpen]);

  useEffect(() => {
    if (activeTab === 'activity' && member) {
      loadActivity();
    }
  }, [activeTab, member]);

  const loadActivity = async () => {
    if (!member) return;
    setIsLoadingActivity(true);
    try {
      const logs = await getUserActivity(member.id, { limit: 50 });
      setActivityLogs(logs);
    } catch (err) {
      console.error('Failed to load activity:', err);
    } finally {
      setIsLoadingActivity(false);
    }
  };

  const currentUserHierarchy = user?.role?.hierarchy_level ?? 999;
  const memberHierarchy = member?.role?.hierarchy_level ?? 999;

  const canManage = hasPermission('staff.manage') || isSuperAdmin;
  const canDisable = hasPermission('staff.disable') || isSuperAdmin;
  const canResetPassword = hasPermission('staff.reset_password') || isSuperAdmin;
  const isAdmin = user?.role?.name === 'Admin' || isSuperAdmin;
  const isManager = user?.role?.name === 'Manager';

  const canEditRole = isSuperAdmin || (canManage && memberHierarchy > currentUserHierarchy);
  const canEditPermissions = isAdmin && !isManager;

  const availableRoles = roles.filter((role) => {
    if (isSuperAdmin) return true;
    return role.hierarchy_level > currentUserHierarchy;
  });

  const isOwnProfile = member?.id === user?.id;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return {
          color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          label: 'Active',
        };
      case 'disabled':
        return { color: 'bg-red-500/10 text-red-400 border-red-500/20', label: 'Disabled' };
      case 'invited':
        return { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'Invited' };
      default:
        return { color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', label: status };
    }
  };

  const handleSave = async () => {
    if (!user || !member || !canManage) return;
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      await updateUser(member.id, formData, user);
      setSuccess('User updated successfully');
      onUpdate();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisable = async () => {
    if (!user || !member || !canDisable) return;
    setError(null);
    setIsSubmitting(true);

    try {
      await disableUser(member.id, user);
      setSuccess('User disabled');
      setShowConfirmDisable(false);
      onUpdate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnable = async () => {
    if (!user || !member || !canDisable) return;
    setError(null);
    setIsSubmitting(true);

    try {
      await enableUser(member.id, user);
      setSuccess('User enabled');
      onUpdate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user || !member || !canResetPassword) return;
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
    if (!user || !member) return;
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

  if (!member) return null;

  const statusConfig = getStatusConfig(member.status);

  const tabs = [
    { id: 'profile' as Tab, label: 'Profile', icon: UserIcon },
    { id: 'permissions' as Tab, label: 'Permissions', icon: Shield },
    { id: 'activity' as Tab, label: 'Activity', icon: Activity },
  ];

  const renderHeader = () => (
    <div className="p-6 border-b border-slate-800">
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center text-white text-xl font-semibold flex-shrink-0">
          {member.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xl font-semibold text-white">{member.name}</h3>
            {isOwnProfile && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                You
              </span>
            )}
          </div>
          <p className="text-slate-400 mt-0.5">{member.email}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs px-2 py-1 rounded-full border ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
            <RoleBadge roleName={member.role?.name || 'Unknown'} />
          </div>
        </div>

        {(canDisable || canResetPassword) && (
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <MoreVertical className="w-5 h-5 text-slate-400" />
            </button>
            {showActions && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
                {member.status === 'invited' && (
                  <button
                    onClick={() => {
                      setShowActions(false);
                      handleResendInvite();
                    }}
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
                {canDisable && !isOwnProfile && (
                  <>
                    <div className="border-t border-slate-700 my-1" />
                    {member.status === 'disabled' ? (
                      <button
                        onClick={() => {
                          setShowActions(false);
                          handleEnable();
                        }}
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
      </div>

      <div className="flex gap-1 mt-4 border-b border-slate-800 -mx-6 px-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.id
                  ? 'text-cyan-400 border-cyan-400'
                  : 'text-slate-400 border-transparent hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderProfileTab = () => (
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <UserIcon className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-slate-300">Name</span>
          </div>
          {canManage ? (
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="text-white bg-transparent w-full focus:outline-none border-b border-transparent hover:border-slate-600 focus:border-cyan-500 pb-1"
            />
          ) : (
            <p className="text-white">{member.name}</p>
          )}
        </div>

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
              className="text-white bg-transparent w-full focus:outline-none border-b border-transparent hover:border-slate-600 focus:border-cyan-500 pb-1 placeholder-slate-500"
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
            <Building2 className="w-4 h-4 text-cyan-400" />
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

        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-slate-300">Last Active</span>
          </div>
          <p className="text-white">
            {member.last_sign_in_at
              ? new Date(member.last_sign_in_at).toLocaleString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Never'}
          </p>
        </div>
      </div>
    </div>
  );

  const renderPermissionsTab = () => (
    <div className="p-6">
      {!canEditPermissions && (
        <div className="mb-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
          <p className="text-sm text-slate-400">
            You can view this user's permissions but cannot modify them.
          </p>
        </div>
      )}
      <PermissionMatrix
        userId={member.id}
        roleId={member.role_id}
        canEdit={canEditPermissions}
        onUpdate={onUpdate}
      />
    </div>
  );

  const renderActivityTab = () => (
    <div className="p-6">
      {isLoadingActivity ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
        </div>
      ) : activityLogs.length === 0 ? (
        <div className="text-center py-12">
          <Activity className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No activity recorded</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-white">Recent Activity</h4>
            <button
              onClick={loadActivity}
              className="p-1.5 rounded hover:bg-slate-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          {activityLogs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-800"
            >
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                <Activity className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">
                  <span className="font-medium">{log.action}</span>
                  {log.entity_type && (
                    <span className="text-slate-400"> on {log.entity_type}</span>
                  )}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {new Date(log.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const footer = canManage && activeTab === 'profile' ? (
    <div className="flex justify-end gap-3">
      <button
        onClick={onClose}
        className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors font-medium"
      >
        Cancel
      </button>
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
    </div>
  ) : (
    <div className="flex justify-end">
      <button
        onClick={onClose}
        className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors font-medium"
      >
        Close
      </button>
    </div>
  );

  return (
    <>
      <SlideInDrawer isOpen={isOpen} onClose={onClose} footer={footer} width="xl">
        {renderHeader()}
        {activeTab === 'profile' && renderProfileTab()}
        {activeTab === 'permissions' && renderPermissionsTab()}
        {activeTab === 'activity' && renderActivityTab()}
      </SlideInDrawer>

      {showConfirmDisable && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-800 max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Disable User</h3>
            <p className="text-slate-400 mb-4">
              Are you sure you want to disable <strong>{member.name}</strong>? They will lose
              access immediately. Their sessions will be revoked. Historical data will be preserved.
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
              A password reset email will be sent to <strong>{member.email}</strong>. They will
              need to click the link to set a new password.
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
    </>
  );
}
