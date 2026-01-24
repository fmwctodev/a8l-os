import { useState, useEffect } from 'react';
import { Save, CheckCircle, Mail } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getEmailDefaults, updateEmailDefaults } from '../../../services/emailDefaults';
import { getFromAddresses } from '../../../services/emailFromAddresses';
import { getUnsubscribeGroups } from '../../../services/emailUnsubscribeGroups';
import type { EmailFromAddress, EmailUnsubscribeGroup, EmailDefaults } from '../../../types';

export function DefaultsTab() {
  const { user, hasPermission } = useAuth();
  const [defaults, setDefaults] = useState<EmailDefaults | null>(null);
  const [fromAddresses, setFromAddresses] = useState<EmailFromAddress[]>([]);
  const [unsubscribeGroups, setUnsubscribeGroups] = useState<EmailUnsubscribeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    default_from_address_id: '',
    default_reply_to: '',
    default_unsubscribe_group_id: '',
    track_opens: true,
    track_clicks: true,
  });

  const isAdmin = hasPermission('email.settings.manage');
  const activeFromAddresses = fromAddresses.filter(a => a.active);

  useEffect(() => {
    loadData();
  }, [user?.organization_id]);

  const loadData = async () => {
    if (!user?.organization_id) return;
    try {
      const [defaultsData, addressData, groupData] = await Promise.all([
        getEmailDefaults(user.organization_id),
        getFromAddresses(user.organization_id),
        getUnsubscribeGroups(user.organization_id),
      ]);
      setDefaults(defaultsData);
      setFromAddresses(addressData);
      setUnsubscribeGroups(groupData);

      if (defaultsData) {
        setFormData({
          default_from_address_id: defaultsData.default_from_address_id || '',
          default_reply_to: defaultsData.default_reply_to || '',
          default_unsubscribe_group_id: defaultsData.default_unsubscribe_group_id || '',
          track_opens: defaultsData.track_opens,
          track_clicks: defaultsData.track_clicks,
        });
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.organization_id) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await updateEmailDefaults(user.organization_id, {
        default_from_address_id: formData.default_from_address_id || null,
        default_reply_to: formData.default_reply_to || null,
        default_unsubscribe_group_id: formData.default_unsubscribe_group_id || null,
        track_opens: formData.track_opens,
        track_clicks: formData.track_clicks,
      });

      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || 'Failed to save defaults');
      }
    } catch (err) {
      setError('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <form onSubmit={handleSubmit}>
        <div className="bg-slate-800 border border-slate-700 rounded-lg">
          <div className="px-6 py-4 border-b border-slate-700">
            <h3 className="text-lg font-medium text-white">Email Defaults</h3>
            <p className="mt-1 text-sm text-slate-400">
              Configure default settings for all outgoing emails
            </p>
          </div>

          {error && (
            <div className="px-6 py-3 bg-red-500/10 border-b border-red-500/20">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className="px-6 py-3 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center">
              <CheckCircle className="h-5 w-5 text-emerald-400 mr-2" />
              <p className="text-sm text-emerald-400">Settings saved successfully</p>
            </div>
          )}

          <div className="px-6 py-6 space-y-6">
            <div>
              <h4 className="text-sm font-medium text-white mb-4">Sender Settings</h4>
              <div className="space-y-4">
                <div>
                  <label htmlFor="default_from_address_id" className="block text-sm font-medium text-slate-300">
                    Default From Address
                  </label>
                  <select
                    id="default_from_address_id"
                    value={formData.default_from_address_id}
                    onChange={(e) => setFormData({ ...formData, default_from_address_id: e.target.value })}
                    disabled={!isAdmin}
                    className="mt-1 block w-full bg-slate-900 border-slate-600 rounded-md text-white focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm disabled:opacity-50"
                  >
                    <option value="">Select a from address...</option>
                    {activeFromAddresses.map((address) => (
                      <option key={address.id} value={address.id}>
                        {address.display_name} &lt;{address.email}&gt;
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">
                    Used when no specific from address is selected
                  </p>
                </div>

                <div>
                  <label htmlFor="default_reply_to" className="block text-sm font-medium text-slate-300">
                    Default Reply-To Address
                  </label>
                  <input
                    type="email"
                    id="default_reply_to"
                    value={formData.default_reply_to}
                    onChange={(e) => setFormData({ ...formData, default_reply_to: e.target.value })}
                    disabled={!isAdmin}
                    placeholder="replies@example.com"
                    className="mt-1 block w-full bg-slate-900 border-slate-600 rounded-md text-white placeholder-slate-500 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm disabled:opacity-50"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Used when no reply-to is specified on the from address
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-700 pt-6">
              <h4 className="text-sm font-medium text-white mb-4">Tracking Settings</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="track_opens" className="text-sm font-medium text-slate-300">
                      Track email opens
                    </label>
                    <p className="text-xs text-slate-500">
                      Adds a tracking pixel to detect when recipients open emails
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => isAdmin && setFormData({ ...formData, track_opens: !formData.track_opens })}
                    disabled={!isAdmin}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                      formData.track_opens ? 'bg-cyan-600' : 'bg-slate-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.track_opens ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="track_clicks" className="text-sm font-medium text-slate-300">
                      Track link clicks
                    </label>
                    <p className="text-xs text-slate-500">
                      Rewrites links to track when recipients click them
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => isAdmin && setFormData({ ...formData, track_clicks: !formData.track_clicks })}
                    disabled={!isAdmin}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                      formData.track_clicks ? 'bg-cyan-600' : 'bg-slate-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.track_clicks ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-700 pt-6">
              <h4 className="text-sm font-medium text-white mb-4">Unsubscribe Settings</h4>
              <div>
                <label htmlFor="default_unsubscribe_group_id" className="block text-sm font-medium text-slate-300">
                  Default Unsubscribe Group
                </label>
                <select
                  id="default_unsubscribe_group_id"
                  value={formData.default_unsubscribe_group_id}
                  onChange={(e) => setFormData({ ...formData, default_unsubscribe_group_id: e.target.value })}
                  disabled={!isAdmin}
                  className="mt-1 block w-full bg-slate-900 border-slate-600 rounded-md text-white focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm disabled:opacity-50"
                >
                  <option value="">Select an unsubscribe group...</option>
                  {unsubscribeGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Emails will include an unsubscribe link for this group
                </p>
              </div>
            </div>

            <div className="border-t border-slate-700 pt-6">
              <h4 className="text-sm font-medium text-white mb-4">Usage Information</h4>
              <p className="text-sm text-slate-400 mb-3">
                These defaults are used by the following features:
              </p>
              <ul className="text-sm text-slate-400 space-y-2">
                <li className="flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-slate-500" />
                  Conversations - when sending emails through the inbox
                </li>
                <li className="flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-slate-500" />
                  Workflow automations - email actions in automated workflows
                </li>
                <li className="flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-slate-500" />
                  AI Agents - when agents send emails using the send_email tool
                </li>
                <li className="flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-slate-500" />
                  Reputation - review request emails
                </li>
                <li className="flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-slate-500" />
                  Reports - scheduled report delivery emails
                </li>
              </ul>
            </div>
          </div>

          {isAdmin && (
            <div className="px-6 py-4 bg-slate-700/30 rounded-b-lg">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Defaults'}
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
