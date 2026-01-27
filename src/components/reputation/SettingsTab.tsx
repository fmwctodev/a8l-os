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
  Plus,
  AlertTriangle,
  Bell,
  Users,
  RefreshCw,
  Settings,
  Clock,
  Loader2,
  Trash2,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { ReputationSettings, ReviewProviderConfig, User } from '../../types';
import {
  getSettings,
  updateSettings,
  updateAISettings,
  updateNegativeReviewSettings,
  getAvailableRecipients,
  updateNotificationRecipients
} from '../../services/reputationSettings';
import {
  getProviders,
  updateProvider,
  initiateOAuthFlow,
  connectYelpWithApiKey,
  disconnectProvider,
  toggleSync,
  updateSyncInterval,
  syncProviderNow,
  getSyncHistory
} from '../../services/reviewProviders';

type SettingsSection =
  | 'integrations'
  | 'reviews_ai'
  | 'negative_reviews'
  | 'notifications'
  | 'review_link'
  | 'sms_requests'
  | 'email_requests'
  | 'reviews_qr'
  | 'spam_reviews';

interface AvailableUser {
  id: string;
  name: string;
  email: string;
  role_name: string;
}

export function SettingsTab() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<SettingsSection>('integrations');
  const [settings, setSettings] = useState<ReputationSettings | null>(null);
  const [providers, setProviders] = useState<ReviewProviderConfig[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);
  const [showYelpModal, setShowYelpModal] = useState(false);
  const [yelpBusinessId, setYelpBusinessId] = useState('');
  const [yelpDisplayName, setYelpDisplayName] = useState('');
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [providerSyncHistory, setProviderSyncHistory] = useState<Record<string, Array<{
    id: string;
    status: string;
    started_at: string | null;
    completed_at: string | null;
    reviews_synced: number;
    error_message: string | null;
    created_at: string;
  }>>>({});

  useEffect(() => {
    loadData();
  }, [user?.organization_id]);

  async function loadData() {
    if (!user?.organization_id) return;
    try {
      setLoading(true);
      const [settingsData, providersData, usersData] = await Promise.all([
        getSettings(user.organization_id),
        getProviders(user.organization_id),
        getAvailableRecipients(user.organization_id),
      ]);
      setSettings(settingsData);
      setProviders(providersData);
      setAvailableUsers(usersData);
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

  async function handleSaveAISettings(aiSettings: Parameters<typeof updateAISettings>[1]) {
    if (!user?.organization_id || !user?.id) return;
    try {
      setSaving(true);
      const updated = await updateAISettings(user.organization_id, aiSettings, user.id);
      setSettings(updated);
    } catch (error) {
      console.error('Failed to save AI settings:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveNegativeReviewSettings(negSettings: Parameters<typeof updateNegativeReviewSettings>[1]) {
    if (!user?.organization_id || !user?.id) return;
    try {
      setSaving(true);
      const updated = await updateNegativeReviewSettings(user.organization_id, negSettings, user.id);
      setSettings(updated);
    } catch (error) {
      console.error('Failed to save negative review settings:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateNotificationRecipients(recipientIds: string[]) {
    if (!user?.organization_id || !user?.id) return;
    try {
      setSaving(true);
      await updateNotificationRecipients(user.organization_id, recipientIds, user.id);
      setSettings(prev => prev ? { ...prev, notification_recipients: recipientIds } : null);
    } catch (error) {
      console.error('Failed to update notification recipients:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleConnectOAuth(provider: 'google' | 'facebook') {
    if (!user?.organization_id) return;
    try {
      const redirectUri = `${window.location.origin}/settings/integrations/oauth-callback`;
      const authUrl = await initiateOAuthFlow(provider, user.organization_id, redirectUri);
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to initiate OAuth:', error);
      alert(error instanceof Error ? error.message : 'Failed to connect');
    }
  }

  async function handleConnectYelp() {
    if (!user?.organization_id || !yelpBusinessId.trim()) return;
    try {
      setSaving(true);
      const provider = await connectYelpWithApiKey(
        user.organization_id,
        yelpBusinessId.trim(),
        yelpDisplayName.trim() || 'Yelp Business'
      );
      setProviders(prev => {
        const existing = prev.findIndex(p => p.provider === 'yelp');
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = provider;
          return updated;
        }
        return [...prev, provider];
      });
      setShowYelpModal(false);
      setYelpBusinessId('');
      setYelpDisplayName('');
    } catch (error) {
      console.error('Failed to connect Yelp:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnectProvider(providerId: string) {
    if (!confirm('Are you sure you want to disconnect this provider?')) return;
    try {
      await disconnectProvider(providerId);
      setProviders(prev => prev.map(p =>
        p.id === providerId ? { ...p, status: 'disconnected', sync_enabled: false } : p
      ));
    } catch (error) {
      console.error('Failed to disconnect provider:', error);
    }
  }

  async function handleToggleSync(providerId: string, enabled: boolean) {
    try {
      await toggleSync(providerId, enabled);
      setProviders(prev => prev.map(p =>
        p.id === providerId ? { ...p, sync_enabled: enabled } : p
      ));
    } catch (error) {
      console.error('Failed to toggle sync:', error);
    }
  }

  async function handleSyncNow(providerId: string) {
    try {
      setSyncingProvider(providerId);
      const result = await syncProviderNow(providerId);
      alert(`Synced ${result.synced} reviews${result.errors.length > 0 ? `. Errors: ${result.errors.join(', ')}` : ''}`);
      await loadData();
    } catch (error) {
      console.error('Failed to sync:', error);
      alert(error instanceof Error ? error.message : 'Sync failed');
    } finally {
      setSyncingProvider(null);
    }
  }

  async function handleLoadSyncHistory(providerId: string) {
    if (providerSyncHistory[providerId]) return;
    try {
      const history = await getSyncHistory(providerId);
      setProviderSyncHistory(prev => ({ ...prev, [providerId]: history }));
    } catch (error) {
      console.error('Failed to load sync history:', error);
    }
  }

  async function handleUpdateSyncInterval(providerId: string, hours: number) {
    try {
      await updateSyncInterval(providerId, hours);
      setProviders(prev => prev.map(p =>
        p.id === providerId ? { ...p, sync_interval_hours: hours } : p
      ));
    } catch (error) {
      console.error('Failed to update sync interval:', error);
    }
  }

  const sections = [
    { id: 'integrations' as const, label: 'Integrations', icon: Plug },
    { id: 'reviews_ai' as const, label: 'AI Settings', icon: Sparkles },
    { id: 'negative_reviews' as const, label: 'Negative Reviews', icon: AlertTriangle },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'review_link' as const, label: 'Review Link', icon: Link },
    { id: 'sms_requests' as const, label: 'SMS Requests', icon: MessageSquare },
    { id: 'email_requests' as const, label: 'Email Requests', icon: Mail },
    { id: 'reviews_qr' as const, label: 'Reviews QR', icon: QrCode },
    { id: 'spam_reviews' as const, label: 'Spam Reviews', icon: Ban },
  ];

  const platformIntegrations = [
    {
      id: 'google',
      name: 'Google Business Profile',
      icon: () => (
        <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
          <span className="text-lg font-bold text-red-500">G</span>
        </div>
      ),
      description: 'Sync reviews from Google',
      provider: providers.find(p => p.provider === 'google'),
      supportsOAuth: true,
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
      provider: providers.find(p => p.provider === 'facebook'),
      supportsOAuth: true,
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
      provider: providers.find(p => p.provider === 'yelp'),
      supportsOAuth: false,
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

      <div className="lg:col-span-3 space-y-6">
        {activeSection === 'integrations' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Platform Integrations</h3>
              <p className="text-sm text-gray-500 mt-1">
                Connect your review platforms to automatically sync reviews.
              </p>
            </div>

            <div className="space-y-4">
              {platformIntegrations.map((platform) => {
                const IconComponent = platform.icon;
                const isConnected = platform.provider?.status === 'connected';
                const isExpanded = expandedProvider === platform.id;

                return (
                  <div
                    key={platform.id}
                    className="border border-gray-200 rounded-xl overflow-hidden"
                  >
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <IconComponent />
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">{platform.name}</h4>
                          <p className="text-sm text-gray-500">{platform.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {isConnected ? (
                          <>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full">
                              <Check className="w-3.5 h-3.5" />
                              Connected
                            </span>
                            <button
                              onClick={() => {
                                setExpandedProvider(isExpanded ? null : platform.id);
                                if (!isExpanded && platform.provider) {
                                  handleLoadSyncHistory(platform.provider.id);
                                }
                              }}
                              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <ChevronRight className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            </button>
                          </>
                        ) : platform.supportsOAuth ? (
                          <button
                            onClick={() => handleConnectOAuth(platform.id as 'google' | 'facebook')}
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Connect with OAuth
                          </button>
                        ) : (
                          <button
                            onClick={() => setShowYelpModal(true)}
                            className="px-4 py-2 border border-blue-600 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-50 transition-colors"
                          >
                            Connect
                          </button>
                        )}
                      </div>
                    </div>

                    {isConnected && isExpanded && platform.provider && (
                      <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-600">Auto-sync</span>
                              <button
                                onClick={() => handleToggleSync(platform.provider!.id, !platform.provider!.sync_enabled)}
                                className={`relative w-10 h-5 rounded-full transition-colors ${
                                  platform.provider.sync_enabled ? 'bg-blue-600' : 'bg-gray-300'
                                }`}
                              >
                                <span
                                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                    platform.provider.sync_enabled ? 'translate-x-5' : ''
                                  }`}
                                />
                              </button>
                            </div>
                            {platform.provider.sync_enabled && (
                              <select
                                value={platform.provider.sync_interval_hours || 6}
                                onChange={(e) => handleUpdateSyncInterval(platform.provider!.id, Number(e.target.value))}
                                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                              >
                                <option value={1}>Every hour</option>
                                <option value={3}>Every 3 hours</option>
                                <option value={6}>Every 6 hours</option>
                                <option value={12}>Every 12 hours</option>
                                <option value={24}>Every 24 hours</option>
                              </select>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSyncNow(platform.provider!.id)}
                              disabled={syncingProvider === platform.provider.id}
                              className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-white transition-colors disabled:opacity-50"
                            >
                              {syncingProvider === platform.provider.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RefreshCw className="w-4 h-4" />
                              )}
                              Sync Now
                            </button>
                            <button
                              onClick={() => handleDisconnectProvider(platform.provider!.id)}
                              className="inline-flex items-center gap-2 px-3 py-1.5 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors"
                            >
                              <X className="w-4 h-4" />
                              Disconnect
                            </button>
                          </div>
                        </div>

                        {platform.provider.last_sync_at && (
                          <p className="text-xs text-gray-500">
                            Last synced: {new Date(platform.provider.last_sync_at).toLocaleString()}
                          </p>
                        )}

                        {providerSyncHistory[platform.provider.id]?.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Sync History</h5>
                            <div className="space-y-2">
                              {providerSyncHistory[platform.provider.id].slice(0, 5).map((sync) => (
                                <div
                                  key={sync.id}
                                  className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2"
                                >
                                  <span className="text-gray-500">
                                    {new Date(sync.created_at).toLocaleString()}
                                  </span>
                                  <span className={`font-medium ${
                                    sync.status === 'completed' ? 'text-green-600' :
                                    sync.status === 'failed' ? 'text-red-600' :
                                    'text-yellow-600'
                                  }`}>
                                    {sync.status === 'completed' ? `${sync.reviews_synced} reviews` : sync.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
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
              <h3 className="text-lg font-semibold text-gray-900">AI Settings</h3>
              <p className="text-sm text-gray-500 mt-1">
                Configure AI-powered review analysis and reply generation.
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  AI Provider
                </label>
                <select
                  value={settings?.ai_provider || 'openai'}
                  onChange={(e) => handleSaveAISettings({ ai_provider: e.target.value as 'openai' | 'anthropic' | 'both' })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="openai">OpenAI (GPT-4o Mini)</option>
                  <option value="anthropic">Anthropic (Claude 3 Haiku)</option>
                  <option value="both">Both (OpenAI primary, Anthropic fallback)</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">AI-Generated Replies</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    Enable AI to suggest reply drafts for incoming reviews
                  </p>
                </div>
                <button
                  onClick={() => handleSaveAISettings({ ai_replies_enabled: !settings?.ai_replies_enabled })}
                  disabled={saving}
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
                  <h4 className="text-sm font-medium text-gray-900">Auto-Analyze Reviews</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    Automatically analyze sentiment, themes, and extract insights
                  </p>
                </div>
                <button
                  onClick={() => handleSaveAISettings({ auto_analyze_reviews: !settings?.auto_analyze_reviews })}
                  disabled={saving}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    settings?.auto_analyze_reviews ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      settings?.auto_analyze_reviews ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Response Tone
                </label>
                <select
                  value={settings?.response_tone || 'professional'}
                  onChange={(e) => handleSaveAISettings({ response_tone: e.target.value as 'professional' | 'friendly' | 'apologetic' | 'casual' })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="casual">Casual</option>
                  <option value="apologetic">Apologetic</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Brand Voice Description
                </label>
                <textarea
                  value={settings?.brand_voice_description || ''}
                  onChange={(e) => handleSaveAISettings({ brand_voice_description: e.target.value || null })}
                  rows={4}
                  placeholder="Describe your brand's voice and personality. E.g., 'We're a friendly, family-owned restaurant that values personal connections with our guests...'"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This helps the AI generate replies that match your brand's personality.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'negative_reviews' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Negative Review Automation</h3>
              <p className="text-sm text-gray-500 mt-1">
                Automatically create tasks and send notifications for negative reviews.
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Negative Review Threshold
                </label>
                <p className="text-sm text-gray-500 mb-2">
                  Reviews with this rating or below will trigger automation.
                </p>
                <select
                  value={settings?.negative_review_threshold || 3}
                  onChange={(e) => handleSaveNegativeReviewSettings({ negative_review_threshold: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1}>1 Star only</option>
                  <option value={2}>2 Stars or below</option>
                  <option value={3}>3 Stars or below</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Create Task Automatically</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    Create a follow-up task when a negative review is received
                  </p>
                </div>
                <button
                  onClick={() => handleSaveNegativeReviewSettings({ negative_review_create_task: !settings?.negative_review_create_task })}
                  disabled={saving}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    settings?.negative_review_create_task ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      settings?.negative_review_create_task ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>

              {settings?.negative_review_create_task && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Default Task Assignee
                    </label>
                    <select
                      value={settings?.negative_review_task_assignee || ''}
                      onChange={(e) => handleSaveNegativeReviewSettings({ negative_review_task_assignee: e.target.value || null })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Unassigned</option>
                      {availableUsers.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role_name})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Task Due Time
                    </label>
                    <select
                      value={settings?.negative_review_task_due_hours || 24}
                      onChange={(e) => handleSaveNegativeReviewSettings({ negative_review_task_due_hours: Number(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={1}>1 hour</option>
                      <option value={4}>4 hours</option>
                      <option value={8}>8 hours</option>
                      <option value={24}>24 hours</option>
                      <option value={48}>48 hours</option>
                      <option value={72}>72 hours</option>
                    </select>
                  </div>
                </>
              )}

              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-sm font-medium text-gray-900 mb-4">Notification Channels</h4>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-gray-400" />
                      <div>
                        <h5 className="text-sm font-medium text-gray-900">Email Notifications</h5>
                        <p className="text-sm text-gray-500">Send email alerts for negative reviews</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSaveNegativeReviewSettings({ negative_review_notify_email: !settings?.negative_review_notify_email })}
                      disabled={saving}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        settings?.negative_review_notify_email ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          settings?.negative_review_notify_email ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <MessageSquare className="w-5 h-5 text-gray-400" />
                      <div>
                        <h5 className="text-sm font-medium text-gray-900">SMS Notifications</h5>
                        <p className="text-sm text-gray-500">Send SMS alerts for negative reviews</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSaveNegativeReviewSettings({ negative_review_notify_sms: !settings?.negative_review_notify_sms })}
                      disabled={saving}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        settings?.negative_review_notify_sms ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          settings?.negative_review_notify_sms ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'notifications' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Notification Recipients</h3>
              <p className="text-sm text-gray-500 mt-1">
                Select team members who should receive notifications about reviews.
              </p>
            </div>

            <div className="space-y-4">
              {availableUsers.map((u) => {
                const isSelected = settings?.notification_recipients?.includes(u.id) || false;
                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600">
                          {u.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">{u.name}</h4>
                        <p className="text-sm text-gray-500">{u.email}</p>
                      </div>
                      <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs font-medium rounded">
                        {u.role_name}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const current = settings?.notification_recipients || [];
                        const updated = isSelected
                          ? current.filter(id => id !== u.id)
                          : [...current, u.id];
                        handleUpdateNotificationRecipients(updated);
                      }}
                      disabled={saving}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        isSelected ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          isSelected ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>
                );
              })}

              {availableUsers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No team members found</p>
                </div>
              )}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Response Time Goal (Hours)
                </label>
                <input
                  type="number"
                  value={settings?.response_time_goal_hours || 24}
                  onChange={(e) => handleSaveSettings({ response_time_goal_hours: Number(e.target.value) })}
                  min={1}
                  max={168}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Target time to respond to reviews (for analytics tracking)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monthly Review Goal
                </label>
                <input
                  type="number"
                  value={settings?.review_goal || 20}
                  onChange={(e) => handleSaveSettings({ review_goal: Number(e.target.value) })}
                  min={1}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Channel
                </label>
                <select
                  value={settings?.default_channel || 'sms'}
                  onChange={(e) => handleSaveSettings({ default_channel: e.target.value as 'sms' | 'email' })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </select>
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

      {showYelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowYelpModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Connect Yelp Business</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business ID
                </label>
                <input
                  type="text"
                  value={yelpBusinessId}
                  onChange={(e) => setYelpBusinessId(e.target.value)}
                  placeholder="your-business-name-city"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Find this in your Yelp business URL: yelp.com/biz/<strong>your-business-id</strong>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={yelpDisplayName}
                  onChange={(e) => setYelpDisplayName(e.target.value)}
                  placeholder="My Business on Yelp"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowYelpModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConnectYelp}
                disabled={!yelpBusinessId.trim() || saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
