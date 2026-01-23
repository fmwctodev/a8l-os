import { useState } from 'react';
import { Save, Loader2, CheckCircle2, Eye, EyeOff, Shield, Smartphone } from 'lucide-react';

export function SecurityTab() {
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
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

  const handleSave = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('New passwords do not match');
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // TODO: Implement password change service
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSaveSuccess(true);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to change password:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-cyan-400" />
          Change Password
        </h3>

        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={passwordData.currentPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, currentPassword: e.target.value })
                }
                className="w-full px-4 py-2 pr-10 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showCurrentPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
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
                onChange={(e) =>
                  setPasswordData({ ...passwordData, newPassword: e.target.value })
                }
                className="w-full px-4 py-2 pr-10 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showNewPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
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
                          : passwordStrength.strength === 4
                          ? 'bg-emerald-500'
                          : 'bg-emerald-400'
                      }`}
                      style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${passwordStrength.color}`}>
                    {passwordStrength.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Use 12+ characters with a mix of letters, numbers & symbols
                </p>
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
                onChange={(e) =>
                  setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                }
                className="w-full px-4 py-2 pr-10 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handleSave}
            disabled={
              isSaving ||
              !passwordData.currentPassword ||
              !passwordData.newPassword ||
              !passwordData.confirmPassword
            }
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saveSuccess ? 'Password Changed' : 'Change Password'}
          </button>
        </div>
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
