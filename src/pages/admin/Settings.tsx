import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getOrganization, updateOrganization } from '../../services/organizations';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '../../services/departments';
import { getFeatureFlags, isFeatureEnabled } from '../../services/featureFlags';
import { QBOConfig } from '../../components/settings/QBOConfig';
import { StripeConfig } from '../../components/settings/StripeConfig';
import DriveConfig from '../../components/settings/DriveConfig';
import type { Organization, Department, FeatureFlag } from '../../types';
import {
  Building2,
  Save,
  Plus,
  Trash2,
  Edit2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ToggleLeft,
  ToggleRight,
  X,
} from 'lucide-react';

export function SettingsPage() {
  const { user, hasPermission } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [orgName, setOrgName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newDeptName, setNewDeptName] = useState('');
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editDeptName, setEditDeptName] = useState('');
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [mediaEnabled, setMediaEnabled] = useState(false);

  const canManage = hasPermission('settings.manage');

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user?.organization_id) return;

    try {
      setIsLoading(true);
      const activeOrgId = user.organization?.id ?? user.organization_id;
      const [org, depts, flags, paymentsFlag, mediaFlag] = await Promise.all([
        getOrganization(user.organization_id),
        getDepartments(user.organization_id),
        getFeatureFlags(activeOrgId),
        isFeatureEnabled('payments', activeOrgId),
        isFeatureEnabled('media', activeOrgId),
      ]);
      setOrganization(org);
      setOrgName(org?.name || '');
      setDepartments(depts);
      setFeatureFlags(flags);
      setPaymentsEnabled(paymentsFlag);
      setMediaEnabled(mediaFlag);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveOrg = async () => {
    if (!organization || !user || !canManage) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setError(null);

    try {
      await updateOrganization(organization.id, { name: orgName }, user);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddDept = async () => {
    if (!user || !newDeptName.trim() || !canManage) return;

    try {
      await createDepartment(newDeptName.trim(), user.organization_id, user);
      setNewDeptName('');
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add department');
    }
  };

  const handleUpdateDept = async () => {
    if (!editingDept || !user || !editDeptName.trim() || !canManage) return;

    try {
      await updateDepartment(editingDept.id, { name: editDeptName.trim() }, user);
      setEditingDept(null);
      setEditDeptName('');
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update department');
    }
  };

  const handleDeleteDept = async (dept: Department) => {
    if (!user || !canManage) return;
    if (!confirm(`Are you sure you want to delete "${dept.name}"?`)) return;

    try {
      await deleteDepartment(dept.id, user);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete department');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="text-slate-400 mt-1">Manage organization settings and configuration</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-slate-900 rounded-xl border border-slate-800">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-cyan-400" />
            Organization
          </h2>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Organization Name
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={!canManage}
                className="flex-1 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:opacity-50"
              />
              {canManage && (
                <button
                  onClick={handleSaveOrg}
                  disabled={isSaving || orgName === organization?.name}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : saveSuccess ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saveSuccess ? 'Saved' : 'Save'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">Departments</h2>
        </div>
        <div className="p-4 space-y-4">
          {canManage && (
            <div className="flex gap-3">
              <input
                type="text"
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                placeholder="New department name"
                className="flex-1 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
              <button
                onClick={handleAddDept}
                disabled={!newDeptName.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          )}

          <div className="space-y-2">
            {departments.length === 0 ? (
              <p className="text-slate-400 text-sm py-4 text-center">No departments yet</p>
            ) : (
              departments.map((dept) => (
                <div
                  key={dept.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50"
                >
                  {editingDept?.id === dept.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editDeptName}
                        onChange={(e) => setEditDeptName(e.target.value)}
                        className="flex-1 px-3 py-1 rounded bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        autoFocus
                      />
                      <button
                        onClick={handleUpdateDept}
                        className="p-1 rounded hover:bg-slate-700 text-emerald-400"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingDept(null);
                          setEditDeptName('');
                        }}
                        className="p-1 rounded hover:bg-slate-700 text-slate-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-white">{dept.name}</span>
                      {canManage && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingDept(dept);
                              setEditDeptName(dept.name);
                            }}
                            className="p-1 rounded hover:bg-slate-700 text-slate-400"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteDept(dept)}
                            className="p-1 rounded hover:bg-slate-700 text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {paymentsEnabled && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Payment Providers</h3>
          <p className="text-sm text-slate-400">
            Connect either QuickBooks Online or Stripe (or both — invoices route to Stripe first if both are connected).
          </p>
          <StripeConfig />
          <QBOConfig />
        </div>
      )}

      {mediaEnabled && <DriveConfig />}

      <div className="bg-slate-900 rounded-xl border border-slate-800">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">Feature Flags</h2>
          <p className="text-sm text-slate-400 mt-1">Module activation status (read-only)</p>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {featureFlags.map((flag) => (
              <div
                key={flag.id}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50"
              >
                <div>
                  <p className="text-white capitalize">{flag.key.replace(/_/g, ' ')}</p>
                  {flag.description && (
                    <p className="text-xs text-slate-400">{flag.description}</p>
                  )}
                </div>
                {flag.enabled ? (
                  <ToggleRight className="w-6 h-6 text-emerald-400" />
                ) : (
                  <ToggleLeft className="w-6 h-6 text-slate-500" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
