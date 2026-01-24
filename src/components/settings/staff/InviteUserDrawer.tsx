import { useState, useEffect } from 'react';
import {
  UserPlus,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { SlideInDrawer } from '../../ui/SlideInDrawer';
import { useAuth } from '../../../contexts/AuthContext';
import { inviteStaff } from '../../../services/users';
import { getPermissions, getRolePermissions } from '../../../services/roles';
import type { Department, Role, Permission, InviteStaffInput } from '../../../types';

interface InviteUserDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  departments: Department[];
  roles: Role[];
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

type Step = 1 | 2 | 3;

export function InviteUserDrawer({
  isOpen,
  onClose,
  onSuccess,
  departments,
  roles,
}: InviteUserDrawerProps) {
  const { user, isSuperAdmin } = useAuth();
  const [step, setStep] = useState<Step>(1);
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

  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Set<string>>(new Set());
  const [permissionOverrides, setPermissionOverrides] = useState<Map<string, boolean>>(new Map());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const currentUserHierarchy = user?.role?.hierarchy_level ?? 999;
  const isAdmin = user?.role?.name === 'Admin' || isSuperAdmin;

  const availableRoles = roles.filter((role) => {
    if (isSuperAdmin) return true;
    return role.hierarchy_level > currentUserHierarchy;
  });

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setError(null);
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        role_id: '',
        department_id: null,
        phone: '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setPermissionOverrides(new Map());
      loadPermissions();
    }
  }, [isOpen]);

  useEffect(() => {
    if (formData.role_id) {
      loadRolePermissions(formData.role_id);
    }
  }, [formData.role_id]);

  const loadPermissions = async () => {
    try {
      const perms = await getPermissions();
      setAllPermissions(perms);
    } catch (err) {
      console.error('Failed to load permissions:', err);
    }
  };

  const loadRolePermissions = async (roleId: string) => {
    try {
      const perms = await getRolePermissions(roleId);
      setRolePermissions(new Set(perms.map((p) => p.id)));
      setPermissionOverrides(new Map());
    } catch (err) {
      console.error('Failed to load role permissions:', err);
    }
  };

  const permissionsByModule = allPermissions.reduce(
    (acc, perm) => {
      if (!acc[perm.module_name]) {
        acc[perm.module_name] = [];
      }
      acc[perm.module_name].push(perm);
      return acc;
    },
    {} as Record<string, Permission[]>
  );

  const toggleModule = (moduleName: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleName)) {
      newExpanded.delete(moduleName);
    } else {
      newExpanded.add(moduleName);
    }
    setExpandedModules(newExpanded);
  };

  const getEffectivePermission = (permissionId: string): boolean => {
    if (permissionOverrides.has(permissionId)) {
      return permissionOverrides.get(permissionId)!;
    }
    return rolePermissions.has(permissionId);
  };

  const togglePermissionOverride = (permissionId: string) => {
    const newOverrides = new Map(permissionOverrides);
    const currentEffective = getEffectivePermission(permissionId);
    const roleDefault = rolePermissions.has(permissionId);

    if (permissionOverrides.has(permissionId)) {
      if (currentEffective !== roleDefault) {
        newOverrides.delete(permissionId);
      } else {
        newOverrides.set(permissionId, !currentEffective);
      }
    } else {
      newOverrides.set(permissionId, !currentEffective);
    }

    setPermissionOverrides(newOverrides);
  };

  const handleSubmit = async () => {
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

  const isStep1Valid =
    formData.first_name.trim() && formData.last_name.trim() && formData.email.trim();

  const isStep2Valid = formData.role_id && formData.timezone;

  const canProceedToStep3 = isAdmin && formData.role_id;

  const goToNext = () => {
    if (step === 1 && isStep1Valid) {
      setStep(2);
    } else if (step === 2 && isStep2Valid) {
      if (canProceedToStep3) {
        setStep(3);
      } else {
        handleSubmit();
      }
    }
  };

  const goToPrev = () => {
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 py-4 border-b border-slate-800">
      {[1, 2, 3].map((s) => {
        const isActive = step === s;
        const isCompleted = step > s;
        const showStep = s <= 2 || canProceedToStep3;

        if (!showStep) return null;

        return (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-cyan-500 text-white'
                  : isCompleted
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'bg-slate-800 text-slate-500'
              }`}
            >
              {isCompleted ? <Check className="w-4 h-4" /> : s}
            </div>
            {s < (canProceedToStep3 ? 3 : 2) && (
              <div
                className={`w-12 h-0.5 mx-1 ${isCompleted ? 'bg-cyan-500/40' : 'bg-slate-700'}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  const renderStep1 = () => (
    <div className="p-6 space-y-4">
      <div>
        <h3 className="text-lg font-medium text-white mb-1">Basic Information</h3>
        <p className="text-sm text-slate-400">Enter the new user's contact details</p>
      </div>

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
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Phone (Optional)</label>
        <input
          type="tel"
          value={formData.phone || ''}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          placeholder="+1 (555) 123-4567"
        />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="p-6 space-y-4">
      <div>
        <h3 className="text-lg font-medium text-white mb-1">Role and Access</h3>
        <p className="text-sm text-slate-400">Assign a role and department to the new user</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Role <span className="text-red-400">*</span>
        </label>
        <select
          value={formData.role_id}
          onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
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
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Department</label>
        <select
          value={formData.department_id || ''}
          onChange={(e) => setFormData({ ...formData, department_id: e.target.value || null })}
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
          {canProceedToStep3
            ? 'You can customize permissions in the next step, or use the default role permissions.'
            : 'An email invitation will be sent to the user with a link to set their password.'}
        </p>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="p-6 space-y-4">
      <div>
        <h3 className="text-lg font-medium text-white mb-1">Permission Overrides</h3>
        <p className="text-sm text-slate-400">
          Customize permissions for this user (optional). Changes from role defaults are highlighted.
        </p>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {Object.entries(permissionsByModule).map(([moduleName, permissions]) => (
          <div key={moduleName} className="border border-slate-800 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleModule(moduleName)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 hover:bg-slate-800 transition-colors"
            >
              <span className="text-sm font-medium text-white capitalize">
                {moduleName.replace(/_/g, ' ')}
              </span>
              {expandedModules.has(moduleName) ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {expandedModules.has(moduleName) && (
              <div className="divide-y divide-slate-800">
                {permissions.map((perm) => {
                  const isGranted = getEffectivePermission(perm.id);
                  const isOverridden = permissionOverrides.has(perm.id);
                  const roleDefault = rolePermissions.has(perm.id);

                  return (
                    <div
                      key={perm.id}
                      className={`flex items-center justify-between px-4 py-2 ${
                        isOverridden ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{perm.key}</p>
                        {perm.description && (
                          <p className="text-xs text-slate-500 truncate">{perm.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        {isOverridden && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {roleDefault !== isGranted
                              ? roleDefault
                                ? 'Revoked'
                                : 'Granted'
                              : 'Modified'}
                          </span>
                        )}
                        <button
                          onClick={() => togglePermissionOverride(perm.id)}
                          className={`relative w-10 h-5 rounded-full transition-colors ${
                            isGranted ? 'bg-cyan-500' : 'bg-slate-700'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                              isGranted ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4">
        <p className="text-sm text-slate-400">
          An email invitation will be sent to the user with a link to set their password and
          complete their profile.
        </p>
      </div>
    </div>
  );

  const footer = (
    <div className="flex items-center justify-between">
      {error && (
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}
      <div className="flex items-center gap-3 ml-auto">
        {step > 1 && (
          <button
            type="button"
            onClick={goToPrev}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors font-medium disabled:opacity-50"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors font-medium disabled:opacity-50"
        >
          Cancel
        </button>
        {step < 3 && canProceedToStep3 ? (
          <button
            onClick={goToNext}
            disabled={isSubmitting || (step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={step === 2 && !canProceedToStep3 ? handleSubmit : handleSubmit}
            disabled={
              isSubmitting || (step === 1 && !isStep1Valid) || (step >= 2 && !isStep2Valid)
            }
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
        )}
      </div>
    </div>
  );

  return (
    <SlideInDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Invite User"
      subtitle="Send an invite to join your team"
      icon={<UserPlus className="w-5 h-5" />}
      footer={footer}
      width="lg"
    >
      {renderStepIndicator()}
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </SlideInDrawer>
  );
}
