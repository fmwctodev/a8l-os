import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, Eye, EyeOff, Shield, Smartphone, Monitor, Globe, Check, X, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { changePassword, verifyCurrentPassword, getUserSessions, type UserSession } from '../../../services/profile';

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const passwordRequirements: PasswordRequirement[] = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'Contains uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'Contains lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'Contains a number', test: (p) => /\d/.test(p) },
  { label: 'Contains special character', test: (p) => /[^a-zA-Z0-9]/.test(p) },
];

function SecuritySessionList({ userId }: { userId: string }) {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadSessions() {
      try {
        const data = await getUserSessions(userId);
        setSessions(data);
      } catch (error) {
        console.error('Failed to load sessions:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSessions();
  }, [userId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <p className="text-slate-400 text-sm">No active sessions found.</p>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => (
        <div
          key={session.id}
          className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-700">
              <Monitor className="w-5 h-5 text-slate-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white">{session.device}</p>
                {session.is_current && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400">
                    Current
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                <Globe className="w-3 h-3" />
                <span>{session.ip_address}</span>
                <span>-</span>
                <span>Last active {new Date(session.last_active_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SecurityTab() {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const getPasswordStrength = (password: string): { strength: number; label: string; color: string } => {
    if (!password) return { strength: 0, label: '', color: '' };

    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    if (strength <= 2) return { strength, label: 'Weak', color: 'text-red-400' };
    if (strength <= 3) return { strength, label: 'Fair', color: 'text-amber-400' };
    if (strength === 4) return { strength, label: 'Good', color: 'text-emerald-400' };
    return { strength, label: 'Strong', color: 'text-emerald-400' };
  };

  const passwordStrength = getPasswordStrength(passwordData.newPassword);
  const passwordsMatch = passwordData.newPassword === passwordData.confirmPassword;
  const allRequirementsMet = passwordRequirements.every(req => req.test(passwordData.newPassword));

  const handleSave = async () => {
    setError(null);

    if (!user) return;

    if (!passwordsMatch) {
      setError('Passwords do not match');
      return;
    }

    if (!allRequirementsMet) {
      setError('Password does not meet all requirements');
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const isValid = await verifyCurrentPassword(user.email, passwordData.currentPassword);
      if (!isValid) {
        setError('Current password is incorrect');
        setIsSaving(false);
        return;
      }

      await changePassword(passwordData.newPassword);
      setSaveSuccess(true);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to change password:', err);
      setError(err.message || 'Failed to change password. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-cyan-400" />
          Change Password
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={passwordData.currentPassword}
                  onChange={(e) => {
                    setPasswordData({ ...passwordData, currentPassword: e.target.value });
                    setError(null);
                  }}
                  className="w-full px-4 py-2 pr-10 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordData.newPassword}
                  onChange={(e) => {
                    setPasswordData({ ...passwordData, newPassword: e.target.value });
                    setError(null);
                  }}
                  className="w-full px-4 py-2 pr-10 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordData.newPassword && (
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          passwordStrength.strength <= 2
                            ? 'bg-red-500'
                            : passwordStrength.strength === 3
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                      />
                    </div>
                    <span className={`text-xs font-medium ${passwordStrength.color}`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={passwordData.confirmPassword}
                  onChange={(e) => {
                    setPasswordData({ ...passwordData, confirmPassword: e.target.value });
                    setError(null);
                  }}
                  className={`w-full px-4 py-2 pr-10 rounded-lg bg-slate-800 border text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${
                    passwordData.confirmPassword && !passwordsMatch
                      ? 'border-red-500'
                      : 'border-slate-700'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordData.confirmPassword && !passwordsMatch && (
                <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={
                isSaving ||
                !passwordData.currentPassword ||
                !passwordData.newPassword ||
                !passwordData.confirmPassword ||
                !passwordsMatch ||
                !allRequirementsMet
              }
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : saveSuccess ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              {saveSuccess ? 'Password Changed' : 'Update Password'}
            </button>
          </div>

          <div className="lg:border-l lg:border-slate-800 lg:pl-6">
            <h4 className="text-sm font-medium text-slate-300 mb-3">Password Requirements</h4>
            <ul className="space-y-2">
              {passwordRequirements.map((req, index) => {
                const isMet = passwordData.newPassword ? req.test(passwordData.newPassword) : false;
                return (
                  <li
                    key={index}
                    className={`flex items-center gap-2 text-sm ${
                      passwordData.newPassword
                        ? isMet
                          ? 'text-emerald-400'
                          : 'text-slate-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {passwordData.newPassword ? (
                      isMet ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <X className="w-4 h-4" />
                      )
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-600" />
                    )}
                    {req.label}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Monitor className="w-5 h-5 text-cyan-400" />
          Active Sessions
        </h3>
        <p className="text-sm text-slate-400 mb-4">
          Manage your active sessions. Your current session is shown below.
        </p>
        <SecuritySessionList userId={user.id} />
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-cyan-400" />
          Two-Factor Authentication
        </h3>
        <p className="text-slate-400 mb-4">
          Add an extra layer of security to your account by enabling two-factor authentication.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-slate-400 text-sm">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          Coming Soon
        </div>
      </div>
    </div>
  );
}
