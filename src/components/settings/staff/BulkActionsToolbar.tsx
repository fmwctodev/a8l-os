import { useState } from 'react';
import {
  UserCheck,
  UserX,
  Building2,
  Download,
  X,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import type { Department, User } from '../../../types';

interface BulkActionsToolbarProps {
  selectedCount: number;
  selectedUsers: User[];
  departments: Department[];
  onClearSelection: () => void;
  onBulkEnable: () => Promise<void>;
  onBulkDisable: () => Promise<void>;
  onBulkAssignDepartment: (departmentId: string | null) => Promise<void>;
  onExport: () => void;
  canDisable: boolean;
}

export function BulkActionsToolbar({
  selectedCount,
  selectedUsers,
  departments,
  onClearSelection,
  onBulkEnable,
  onBulkDisable,
  onBulkAssignDepartment,
  onExport,
  canDisable,
}: BulkActionsToolbarProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);

  const hasDisabledUsers = selectedUsers.some((u) => u.status === 'disabled');
  const hasActiveUsers = selectedUsers.some((u) => u.status === 'active' || u.status === 'invited');

  const handleBulkEnable = async () => {
    setIsLoading(true);
    setLoadingAction('enable');
    try {
      await onBulkEnable();
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  const handleBulkDisable = async () => {
    setIsLoading(true);
    setLoadingAction('disable');
    try {
      await onBulkDisable();
      setShowDisableConfirm(false);
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  const handleAssignDepartment = async (departmentId: string | null) => {
    setIsLoading(true);
    setLoadingAction('department');
    try {
      await onBulkAssignDepartment(departmentId);
      setShowDepartmentDropdown(false);
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  if (selectedCount === 0) return null;

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 bg-cyan-500/10 border-b border-cyan-500/20">
        <span className="text-sm font-medium text-cyan-400">
          {selectedCount} user{selectedCount !== 1 ? 's' : ''} selected
        </span>

        <div className="h-4 w-px bg-slate-700" />

        {hasDisabledUsers && (
          <button
            onClick={handleBulkEnable}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors disabled:opacity-50"
          >
            {loadingAction === 'enable' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <UserCheck className="w-3.5 h-3.5" />
            )}
            Enable
          </button>
        )}

        {canDisable && hasActiveUsers && (
          <button
            onClick={() => setShowDisableConfirm(true)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors disabled:opacity-50"
          >
            {loadingAction === 'disable' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <UserX className="w-3.5 h-3.5" />
            )}
            Disable
          </button>
        )}

        <div className="relative">
          <button
            onClick={() => setShowDepartmentDropdown(!showDepartmentDropdown)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 transition-colors disabled:opacity-50"
          >
            {loadingAction === 'department' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Building2 className="w-3.5 h-3.5" />
            )}
            Assign Department
          </button>

          {showDepartmentDropdown && (
            <div className="absolute left-0 top-full mt-1 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
              <div className="py-1">
                <button
                  onClick={() => handleAssignDepartment(null)}
                  className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700"
                >
                  No Department
                </button>
                {departments.map((dept) => (
                  <button
                    key={dept.id}
                    onClick={() => handleAssignDepartment(dept.id)}
                    className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700"
                  >
                    {dept.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onExport}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 transition-colors disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          Export
        </button>

        <div className="flex-1" />

        <button
          onClick={onClearSelection}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Clear Selection
        </button>
      </div>

      {showDisableConfirm && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-800 max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Disable {selectedCount} User{selectedCount !== 1 ? 's' : ''}
                </h3>
                <p className="text-sm text-slate-400">This action will revoke their access</p>
              </div>
            </div>

            <p className="text-slate-400 mb-4">
              The selected users will lose access immediately. Their sessions will be revoked and
              they won't be able to log in. Their historical data will be preserved.
            </p>

            {selectedCount <= 5 && (
              <div className="mb-4 p-3 bg-slate-800/50 rounded-lg">
                <p className="text-xs text-slate-500 mb-2">Users to be disabled:</p>
                <ul className="space-y-1">
                  {selectedUsers
                    .filter((u) => u.status !== 'disabled')
                    .slice(0, 5)
                    .map((user) => (
                      <li key={user.id} className="text-sm text-slate-300">
                        {user.name} ({user.email})
                      </li>
                    ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDisableConfirm(false)}
                disabled={isLoading}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDisable}
                disabled={isLoading}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors inline-flex items-center gap-2 disabled:opacity-50"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Disable Users
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
