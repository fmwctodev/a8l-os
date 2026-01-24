import { useState, useEffect } from 'react';
import {
  Sparkles,
  Link,
  MessageSquare,
  Mail,
  QrCode,
  Ban,
  Plug,
  ExternalLink,
  Check,
  X,
  Plus
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { ReputationSettings, ReviewProviderConfig } from '../../types';
import { getSettings, updateSettings } from '../../services/reputationSettings';
import { getProviders, updateProvider } from '../../services/reviewProviders';

type SettingsSection = 'reviews_ai' | 'review_link' | 'sms_requests' | 'email_requests' | 'reviews_qr' | 'spam_reviews' | 'integrations';

export function SettingsTab() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<SettingsSection>('integrations');
  const [settings, setSettings] = useState<ReputationSettings | null>(null);
  const [providers, setProviders] = useState<ReviewProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [user?.organization_id]);

  async function loadData() {
    if (!user?.organization_id) return;
    try {
      setLoading(true);
      const [settingsData, providersData] = await Promise.all([
        getSettings(user.organization_id),
        getProviders(user.organization_id),
      ]);
      setSettings(settingsData);
      setProviders(providersData);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings(updates: Partial<ReputationSettings>) {
    if (!user?.organization_id || !user?.id) return;
    try {
      setSaving(true);
      const updated = await updateSettings(user.organization_id, updates, user.id);
      setSettings(updated);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  }

  const sections = [
    { id: 'reviews_ai' as const, label: 'Reviews AI', icon: Sparkles },
    { id: 'review_link' as const, label: 'Review Link', icon: Link },
    { id: 'sms_requests' as const, label: 'SMS Requests', icon: MessageSquare },
    { id: 'email_requests' as const, label: 'Email Requests', icon: Mail },
    { id: 'reviews_qr' as const, label: 'Reviews QR', icon: QrCode },
    { id: 'spam_reviews' as const, label: 'Spam Reviews', icon: Ban },
    { id: 'integrations' as const, label: 'Integrations', icon: Plug },
  ];

  const platformIntegrations = [
    {
      id: 'custom',
      name: 'Custom Links',
      icon: Plus,
      description: 'Add custom review platform links',
      isCustom: true,
    },
    {
      id: 'google',
      name: 'Google Business Profile',
      icon: () => (
        <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
          <span className="text-lg font-bold text-red-500">G</span>
        </div>
      ),
      description: 'Sync reviews from Google',
      connected: providers.some(p => p.provider === 'google' && p.status === 'connected'),
    },
    {
      id: 'facebook',
      name: 'Facebook',
      icon: () => (
        <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
          <span className="text-lg font-bold text-white">f</span>
        </div>
      ),
      description: 'Sync reviews from Facebook',
      connected: providers.some(p => p.provider === 'facebook' && p.status === 'connected'),
    },
    {
      id: 'yelp',
      name: 'Yelp',
      icon: () => (
        <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center">
          <span className="text-lg font-bold text-white">Y</span>
        </div>
      ),
      description: 'Sync reviews from Yelp',
      connected: providers.some(p => p.provider === 'yelp' && p.status === 'connected'),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1">
        <nav className="bg-white rounded-xl border border-gray-200 p-2">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="w-5 h-5" />
                {section.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="lg:col-span-3">
        {activeSection === 'integrations' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Integrations</h3>
              <p className="text-sm text-gray-500 mt-1">
                Add review platforms by entering the page link to import reviews.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {platformIntegrations.map((platform) => {
                const IconComponent = platform.icon;
                return (
                  <div
                    key={platform.id}
                    className="border border-gray-200 rounded-xl p-6 flex flex-col items-center text-center"
                  >
                    {platform.isCustom ? (
                      <div className="w-10 h-10 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center mb-4">
                        <Plus className="w-5 h-5 text-gray-400" />
                      </div>
                    ) : (
                      <div className="mb-4">
                        {typeof IconComponent === 'function' ? <IconComponent /> : <IconComponent className="w-10 h-10" />}
                      </div>
                    )}
                    <h4 className="text-sm font-medium text-gray-900 mb-2">{platform.name}</h4>
                    {platform.isCustom ? (
                      <button className="w-full px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                        Add Platform
                      </button>
                    ) : platform.connected ? (
                      <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-50 text-green-700 text-sm font-medium rounded-lg">
                        <Check className="w-4 h-4" />
                        Connected
                      </button>
                    ) : (
                      <button className="w-full px-4 py-2 border border-blue-600 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-50 transition-colors">
                        Integrate
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeSection === 'reviews_ai' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Reviews AI</h3>
              <p className="text-sm text-gray-500 mt-1">
                Configure AI-powered review features.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">AI-Generated Replies</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    Enable AI to suggest reply drafts for incoming reviews
                  </p>
                </div>
                <button
                  onClick={() => handleSaveSettings({ ai_replies_enabled: !settings?.ai_replies_enabled })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    settings?.ai_replies_enabled ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      settings?.ai_replies_enabled ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">AI Summary</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    Generate AI summaries of your reviews
                  </p>
                </div>
                <button
                  className="relative w-11 h-6 rounded-full transition-colors bg-blue-600"
                >
                  <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow translate-x-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'review_link' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Review Link</h3>
              <p className="text-sm text-gray-500 mt-1">
                Configure where customers are directed to leave reviews.
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Google Business Profile URL
                </label>
                <input
                  type="url"
                  value={settings?.google_review_url || ''}
                  onChange={(e) => handleSaveSettings({ google_review_url: e.target.value || null })}
                  placeholder="https://g.page/your-business/review"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Facebook Page URL
                </label>
                <input
                  type="url"
                  value={settings?.facebook_review_url || ''}
                  onChange={(e) => handleSaveSettings({ facebook_review_url: e.target.value || null })}
                  placeholder="https://facebook.com/your-business/reviews"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Yelp Business URL
                </label>
                <input
                  type="url"
                  value={settings?.yelp_review_url || ''}
                  onChange={(e) => handleSaveSettings({ yelp_review_url: e.target.value || null })}
                  placeholder="https://yelp.com/biz/your-business"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Smart Threshold (Stars)
                </label>
                <p className="text-sm text-gray-500 mb-2">
                  Customers rating below this threshold will be directed to private feedback instead of public review.
                </p>
                <select
                  value={settings?.smart_threshold || 4}
                  onChange={(e) => handleSaveSettings({ smart_threshold: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={3}>3 Stars</option>
                  <option value={4}>4 Stars</option>
                  <option value={5}>5 Stars</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'sms_requests' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900">SMS Requests</h3>
              <p className="text-sm text-gray-500 mt-1">
                Configure the default SMS template for review requests.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SMS Template
                </label>
                <textarea
                  value={settings?.default_sms_template || ''}
                  onChange={(e) => handleSaveSettings({ default_sms_template: e.target.value })}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Available merge fields: {'{first_name}'}, {'{company_name}'}, {'{review_link}'}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'email_requests' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Email Requests</h3>
              <p className="text-sm text-gray-500 mt-1">
                Configure the default email template for review requests.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Subject
                </label>
                <input
                  type="text"
                  value={settings?.default_email_subject || ''}
                  onChange={(e) => handleSaveSettings({ default_email_subject: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Body
                </label>
                <textarea
                  value={settings?.default_email_template || ''}
                  onChange={(e) => handleSaveSettings({ default_email_template: e.target.value })}
                  rows={8}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Available merge fields: {'{first_name}'}, {'{company_name}'}, {'{review_link}'}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'reviews_qr' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Reviews QR Code</h3>
              <p className="text-sm text-gray-500 mt-1">
                Generate a QR code that links to your review page.
              </p>
            </div>

            <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="w-48 h-48 bg-white border border-gray-200 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <QrCode className="w-32 h-32 text-gray-300" />
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  Configure your review link first to generate a QR code
                </p>
                <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                  Generate QR Code
                </button>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'spam_reviews' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Spam Reviews</h3>
              <p className="text-sm text-gray-500 mt-1">
                Configure spam detection settings for incoming reviews.
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Blocked Keywords
                </label>
                <p className="text-sm text-gray-500 mb-2">
                  Reviews containing these keywords will be flagged as spam.
                </p>
                <textarea
                  value={(settings?.spam_keywords || []).join('\n')}
                  onChange={(e) => handleSaveSettings({
                    spam_keywords: e.target.value.split('\n').filter(k => k.trim())
                  })}
                  rows={6}
                  placeholder="Enter one keyword per line"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
