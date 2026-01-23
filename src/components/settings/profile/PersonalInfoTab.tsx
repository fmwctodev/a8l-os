import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Save, Loader2, CheckCircle2, Upload } from 'lucide-react';
import { TimezoneSelect } from './TimezoneSelect';

export function PersonalInfoTab() {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    timezone: 'America/New_York',
    title: '',
    emailSignature: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: (user as any).phone || '',
        timezone: (user as any).timezone || 'America/New_York',
        title: (user as any).title || '',
        emailSignature: (user as any).email_signature || '',
      });
    }
  }, [user]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // TODO: Implement profile update service
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <div className="flex items-start gap-6 mb-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center text-white text-3xl font-semibold">
              {formData.name.charAt(0).toUpperCase() || 'U'}
            </div>
            <button className="absolute bottom-0 right-0 p-2 rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors">
              <Upload className="w-4 h-4 text-slate-300" />
            </button>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-1">Profile Photo</h3>
            <p className="text-sm text-slate-400 mb-3">
              This photo will be displayed on your profile and in conversations
            </p>
            <button className="text-sm text-cyan-400 hover:text-cyan-300 font-medium">
              Change Photo
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
              Timezone
            </label>
            <TimezoneSelect
              value={formData.timezone}
              onChange={(timezone) => setFormData({ ...formData, timezone })}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Job Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Sales Manager"
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Email Signature
            </label>
            <textarea
              value={formData.emailSignature}
              onChange={(e) => setFormData({ ...formData, emailSignature: e.target.value })}
              placeholder="Best regards,&#10;John Doe&#10;Sales Manager"
              rows={4}
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
            />
            <p className="text-xs text-slate-500 mt-1">
              This signature will be added to your outgoing emails
            </p>
          </div>
        </div>
      </div>

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
