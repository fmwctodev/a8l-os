import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { TimezoneSelect } from './TimezoneSelect';
import { ProfileAvatarUploader } from './ProfileAvatarUploader';
import { updateUserProfile } from '../../../services/profile';

export function PersonalInfoTab() {
  const { user, refreshUser } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    timezone: 'America/New_York',
  });

  useEffect(() => {
    if (user) {
      const nameParts = (user.name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      setFormData({
        firstName,
        lastName,
        email: user.email || '',
        phone: user.phone || '',
        timezone: user.timezone || 'America/New_York',
      });
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setError(null);

    try {
      const fullName = `${formData.firstName} ${formData.lastName}`.trim();
      await updateUserProfile(user.id, {
        name: fullName,
        phone: formData.phone,
        timezone: formData.timezone,
      });
      await refreshUser();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save profile:', err);
      setError('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (url: string) => {
    if (!user) return;

    try {
      await updateUserProfile(user.id, { profile_photo: url });
      await refreshUser();
    } catch (err) {
      console.error('Failed to update profile photo:', err);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <div className="flex items-start gap-6 mb-6">
          <ProfileAvatarUploader
            currentUrl={user.profile_photo || user.avatar_url}
            userId={user.id}
            userName={user.name || 'User'}
            onUploadComplete={handlePhotoUpload}
            size="lg"
          />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-1">Profile Photo</h3>
            <p className="text-sm text-slate-400">
              This photo will be displayed on your profile and in conversations
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              First Name
            </label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Last Name
            </label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={formData.email}
              disabled
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 placeholder-slate-500 opacity-50 cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+1 (555) 123-4567"
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Role
            </label>
            <input
              type="text"
              value={user.role?.name || 'No role assigned'}
              disabled
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 placeholder-slate-500 opacity-50 cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-1">Contact an admin to change your role</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Department
            </label>
            <input
              type="text"
              value={user.department?.name || 'No department assigned'}
              disabled
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 placeholder-slate-500 opacity-50 cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-1">Contact an admin to change your department</p>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Timezone
            </label>
            <TimezoneSelect
              value={formData.timezone}
              onChange={(timezone) => setFormData({ ...formData, timezone })}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saveSuccess ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saveSuccess ? 'Saved' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
