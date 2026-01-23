import { useState, useEffect } from 'react';
import { Save, CheckCircle } from 'lucide-react';
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
  }, [user?.org_id]);

  const loadData = async () => {
    if (!user?.org_id) return;
    try {
      const [defaultsData, addressData, groupData] = await Promise.all([
        getEmailDefaults(user.org_id),
        getFromAddresses(user.org_id),
        getUnsubscribeGroups(user.org_id),
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
    if (!user?.org_id) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await updateEmailDefaults(user.org_id, {
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <form onSubmit={handleSubmit}>
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Email Defaults</h3>
            <p className="mt-1 text-sm text-gray-500">
              Configure default settings for all outgoing emails
            </p>
          </div>

          {error && (
            <div className="px-6 py-3 bg-red-50 border-b border-red-100">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="px-6 py-3 bg-green-50 border-b border-green-100 flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              <p className="text-sm text-green-700">Settings saved successfully</p>
            </div>
          )}

          <div className="px-6 py-6 space-y-6">
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-4">Sender Settings</h4>
              <div className="space-y-4">
                <div>
                  <label htmlFor="default_from_address_id" className="block text-sm font-medium text-gray-700">
                    Default From Address
                  </label>
                  <select
                    id="default_from_address_id"
                    value={formData.default_from_address_id}
                    onChange={(e) => setFormData({ ...formData, default_from_address_id: e.target.value })}
                    disabled={!isAdmin}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"
                  >
                    <option value="">Select a from address...</option>
                    {activeFromAddresses.map((address) => (
                      <option key={address.id} value={address.id}>
                        {address.display_name} &lt;{address.email}&gt;
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Used when no specific from address is selected
                  </p>
                </div>

                <div>
                  <label htmlFor="default_reply_to" className="block text-sm font-medium text-gray-700">
                    Default Reply-To Address
                  </label>
                  <input
                    type="email"
                    id="default_reply_to"
                    value={formData.default_reply_to}
                    onChange={(e) => setFormData({ ...formData, default_reply_to: e.target.value })}
                    disabled={!isAdmin}
                    placeholder="replies@example.com"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Used when no reply-to is specified on the from address
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h4 className="text-sm font-medium text-gray-900 mb-4">Tracking Settings</h4>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="track_opens"
                      type="checkbox"
                      checked={formData.track_opens}
                      onChange={(e) => setFormData({ ...formData, track_opens: e.target.checked })}
                      disabled={!isAdmin}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                    />
                  </div>
                  <div className="ml-3">
                    <label htmlFor="track_opens" className="text-sm font-medium text-gray-700">
                      Track email opens
                    </label>
                    <p className="text-xs text-gray-500">
                      Adds a tracking pixel to detect when recipients open emails
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="track_clicks"
                      type="checkbox"
                      checked={formData.track_clicks}
                      onChange={(e) => setFormData({ ...formData, track_clicks: e.target.checked })}
                      disabled={!isAdmin}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                    />
                  </div>
                  <div className="ml-3">
                    <label htmlFor="track_clicks" className="text-sm font-medium text-gray-700">
                      Track link clicks
                    </label>
                    <p className="text-xs text-gray-500">
                      Rewrites links to track when recipients click them
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h4 className="text-sm font-medium text-gray-900 mb-4">Unsubscribe Settings</h4>
              <div>
                <label htmlFor="default_unsubscribe_group_id" className="block text-sm font-medium text-gray-700">
                  Default Unsubscribe Group
                </label>
                <select
                  id="default_unsubscribe_group_id"
                  value={formData.default_unsubscribe_group_id}
                  onChange={(e) => setFormData({ ...formData, default_unsubscribe_group_id: e.target.value })}
                  disabled={!isAdmin}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"
                >
                  <option value="">Select an unsubscribe group...</option>
                  {unsubscribeGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Emails will include an unsubscribe link for this group
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h4 className="text-sm font-medium text-gray-900 mb-4">Usage Information</h4>
              <p className="text-sm text-gray-600 mb-3">
                These defaults are used by the following features:
              </p>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2" />
                  Conversations - when sending emails through the inbox
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2" />
                  Workflow automations - email actions in automated workflows
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2" />
                  AI Agents - when agents send emails using the send_email tool
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2" />
                  Reputation - review request emails
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2" />
                  Reports - scheduled report delivery emails
                </li>
              </ul>
            </div>
          </div>

          {isAdmin && (
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
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
