import { useState, useEffect } from 'react';
import {
  Plug, Sparkles, Clock, AlertTriangle, Bell, Link, MessageSquare, Mail,
  QrCode, Ban, Check, Loader2, RefreshCw, Plus, Trash2,
  Shield, Users
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { ReputationSettings } from '../../types';
import {
  getSettings, updateSettings, updateAISettings, updateNegativeReviewSettings,
  getAvailableRecipients, updateNotificationRecipients
} from '../../services/reputationSettings';
import {
  getIntegrationStatus, disconnectIntegration, connectViaLate, testConnection,
  getRoutingRules, createRoutingRule, deleteRoutingRule,
  type IntegrationStatus, type RoutingRule
} from '../../services/reputationIntegration';

type Section =
  | 'integration' | 'ai_settings' | 'sla_routing' | 'escalation'
  | 'notifications' | 'review_link' | 'sms_requests' | 'email_requests'
  | 'reviews_qr' | 'spam_reviews';

interface AvailableUser {
  id: string;
  name: string;
  email: string;
  role_name: string;
}

export function ReputationSettingsTab() {
  const { user } = useAuth();
  const [section, setSection] = useState<Section>('integration');
  const [settings, setSettings] = useState<ReputationSettings | null>(null);
  const [integration, setIntegration] = useState<IntegrationStatus | null>(null);
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  useEffect(() => {
    loadData();
  }, [user?.organization_id]);

  async function loadData() {
    if (!user?.organization_id) return;
    try {
      setLoading(true);
      const [settingsData, integrationData, rulesData, usersData] = await Promise.all([
        getSettings(user.organization_id),
        getIntegrationStatus(user.organization_id),
        getRoutingRules(user.organization_id),
        getAvailableRecipients(user.organization_id),
      ]);
      setSettings(settingsData);
      setIntegration(integrationData);
      setRoutingRules(rulesData);
      setAvailableUsers(usersData);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function save(updates: Partial<ReputationSettings>) {
    if (!user?.organization_id || !user?.id) return;
    try {
      setSaving(true);
      const updated = await updateSettings(user.organization_id, updates, user.id);
      setSettings(updated);
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setSaving(false);
    }
  }

  async function saveAI(aiSettings: Parameters<typeof updateAISettings>[1]) {
    if (!user?.organization_id || !user?.id) return;
    try {
      setSaving(true);
      const updated = await updateAISettings(user.organization_id, aiSettings, user.id);
      setSettings(updated);
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleConnect(provider: 'google_business' | 'facebook') {
    setConnecting(true);
    try {
      const { url } = await connectViaLate(provider);
      window.location.href = url;
    } catch (error) {
      console.error('Connection failed:', error);
      alert(error instanceof Error ? error.message : 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!user?.organization_id || !confirm('Disconnect Late.dev integration?')) return;
    try {
      await disconnectIntegration(user.organization_id);
      setIntegration(prev => prev ? { ...prev, connected: false } : null);
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  }

  async function handleTestConnection() {
    if (!user?.organization_id) return;
    setTesting(true);
    setTestResult(null);
    try {
      const ok = await testConnection(user.organization_id);
      setTestResult(ok);
    } catch {
      setTestResult(false);
    } finally {
      setTesting(false);
    }
  }

  async function handleAddRoutingRule() {
    if (!user?.organization_id) return;
    try {
      const newRule = await createRoutingRule(user.organization_id, {
        platform: null,
        min_rating: null,
        max_rating: 2,
        assign_to_user_id: null,
        assign_to_role: null,
        priority: 'high',
        requires_manual_approval: false,
      });
      setRoutingRules(prev => [...prev, newRule]);
    } catch (error) {
      console.error('Failed to add rule:', error);
    }
  }

  async function handleDeleteRule(ruleId: string) {
    try {
      await deleteRoutingRule(ruleId);
      setRoutingRules(prev => prev.filter(r => r.id !== ruleId));
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  }

  const sections = [
    { id: 'integration' as const, label: 'Late.dev Integration', icon: Plug },
    { id: 'ai_settings' as const, label: 'AI Reply Settings', icon: Sparkles },
    { id: 'sla_routing' as const, label: 'SLA & Routing', icon: Clock },
    { id: 'escalation' as const, label: 'Escalation', icon: AlertTriangle },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'review_link' as const, label: 'Review Link', icon: Link },
    { id: 'sms_requests' as const, label: 'SMS Requests', icon: MessageSquare },
    { id: 'email_requests' as const, label: 'Email Requests', icon: Mail },
    { id: 'reviews_qr' as const, label: 'Reviews QR', icon: QrCode },
    { id: 'spam_reviews' as const, label: 'Spam Reviews', icon: Ban },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1">
        <nav className="bg-white rounded-xl border border-gray-200 p-2">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  section === s.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="w-5 h-5" />
                {s.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="lg:col-span-3 space-y-6">
        {section === 'integration' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Late.dev Integration</h3>
              <p className="text-sm text-gray-500 mt-1">
                Connect your review platforms through Late.dev to sync and manage reviews.
              </p>
            </div>

            {integration?.connected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <Check className="w-5 h-5 text-green-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800">Connected</p>
                    {integration.last_sync_at && (
                      <p className="text-xs text-green-600 mt-0.5">
                        Last synced: {new Date(integration.last_sync_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleTestConnection}
                      disabled={testing}
                      className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-white transition-colors disabled:opacity-50"
                    >
                      {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={handleDisconnect}
                      className="px-3 py-1.5 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>

                {testResult !== null && (
                  <div className={`p-3 rounded-lg text-sm ${
                    testResult ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {testResult ? 'Connection test passed - sync successful' : 'Connection test failed - please reconnect'}
                  </div>
                )}

                {integration.last_error && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                    Last error: {integration.last_error}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500">Successful Syncs</span>
                    <p className="text-lg font-semibold text-gray-900 mt-1">{integration.sync_success_count}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500">Failed Syncs</span>
                    <p className="text-lg font-semibold text-gray-900 mt-1">{integration.sync_failure_count}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
                  <Plug className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-4">
                    Connect your review platforms to start syncing reviews
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      onClick={() => handleConnect('google_business')}
                      disabled={connecting}
                      className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-800 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
                    >
                      <div className="w-5 h-5 rounded bg-white border border-gray-200 flex items-center justify-center">
                        <span className="text-xs font-bold text-red-500">G</span>
                      </div>
                      Connect Google Business
                    </button>
                    <button
                      onClick={() => handleConnect('facebook')}
                      disabled={connecting}
                      className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-800 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
                    >
                      <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center">
                        <span className="text-xs font-bold text-white">f</span>
                      </div>
                      Connect Facebook
                    </button>
                  </div>
                  {connecting && (
                    <p className="text-xs text-gray-500 mt-3 flex items-center justify-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Redirecting to authorization...
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {section === 'ai_settings' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">AI Reply Settings</h3>
              <p className="text-sm text-gray-500 mt-1">
                Configure GPT-5.1 powered reply generation with 3 tone variants.
              </p>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h4 className="text-sm font-medium text-gray-900">AI-Generated Replies</h4>
                <p className="text-sm text-gray-500 mt-1">Generate 3 tone variants per review</p>
              </div>
              <button
                onClick={() => saveAI({ ai_replies_enabled: !settings?.ai_replies_enabled })}
                disabled={saving}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  settings?.ai_replies_enabled ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  settings?.ai_replies_enabled ? 'translate-x-5' : ''
                }`} />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Brand Voice Description
              </label>
              <textarea
                value={settings?.brand_voice_description || ''}
                onChange={(e) => saveAI({ brand_voice_description: e.target.value || null })}
                rows={4}
                placeholder="Describe your brand's voice. E.g., 'We're a family-owned restaurant that values personal connections...'"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Response Tone</label>
                <select
                  value={settings?.response_tone || 'professional'}
                  onChange={(e) => saveAI({ response_tone: e.target.value as 'professional' | 'friendly' | 'apologetic' | 'casual' })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="casual">Casual</option>
                  <option value="apologetic">Apologetic</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Temperature</label>
                <input
                  type="number"
                  value={settings?.default_temperature ?? 0.4}
                  onChange={(e) => save({ default_temperature: Number(e.target.value) } as Partial<ReputationSettings>)}
                  min={0} max={1} step={0.1}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">0 = precise, 1 = creative</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Default Signature</label>
              <textarea
                value={settings?.default_signature || ''}
                onChange={(e) => save({ default_signature: e.target.value || null } as Partial<ReputationSettings>)}
                rows={2}
                placeholder="E.g., -- The Management Team at Your Business"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="autoAppendSig"
                  checked={settings?.auto_append_signature ?? true}
                  onChange={(e) => save({ auto_append_signature: e.target.checked } as Partial<ReputationSettings>)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="autoAppendSig" className="text-sm text-gray-600">
                  Auto-append signature to AI drafts
                </label>
              </div>
            </div>
          </div>
        )}

        {section === 'sla_routing' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">SLA Configuration</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Set response time targets for review replies.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Positive Reviews SLA (hours)
                  </label>
                  <input
                    type="number"
                    value={settings?.sla_hours_positive ?? 48}
                    onChange={(e) => save({ sla_hours_positive: Number(e.target.value) } as Partial<ReputationSettings>)}
                    min={1} max={168}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Negative Reviews SLA (hours)
                  </label>
                  <input
                    type="number"
                    value={settings?.sla_hours_negative ?? 4}
                    onChange={(e) => save({ sla_hours_negative: Number(e.target.value) } as Partial<ReputationSettings>)}
                    min={1} max={168}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                Reviews not replied to within the SLA window will be flagged as "SLA Breached" in the inbox.
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Routing Rules</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Automatically assign reviews based on platform and rating.
                  </p>
                </div>
                <button
                  onClick={handleAddRoutingRule}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Rule
                </button>
              </div>

              {routingRules.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Shield className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No routing rules configured</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {routingRules.map((rule) => (
                    <div key={rule.id} className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1 grid grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-xs text-gray-500">Platform</span>
                          <p className="font-medium text-gray-900">{rule.platform || 'Any'}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Rating</span>
                          <p className="font-medium text-gray-900">
                            {rule.min_rating || 1} - {rule.max_rating || 5}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Priority</span>
                          <p className="font-medium text-gray-900 capitalize">{rule.priority}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Approval</span>
                          <p className="font-medium text-gray-900">
                            {rule.requires_manual_approval ? 'Required' : 'Auto'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {section === 'escalation' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Escalation Settings</h3>
              <p className="text-sm text-gray-500 mt-1">
                Configure automatic escalation for critical reviews.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Escalation Email
              </label>
              <input
                type="email"
                value={settings?.escalation_email || ''}
                onChange={(e) => save({ escalation_email: e.target.value || null } as Partial<ReputationSettings>)}
                placeholder="manager@company.com"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Reviews with serious issues will direct the customer to contact this email.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Escalation Assigned User
              </label>
              <select
                value={settings?.escalation_user_id || ''}
                onChange={(e) => save({ escalation_user_id: e.target.value || null } as Partial<ReputationSettings>)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Unassigned</option>
                {availableUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role_name})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Escalation Keywords
              </label>
              <textarea
                value={settings?.escalation_keywords?.join('\n') || ''}
                onChange={(e) => save({
                  escalation_keywords: e.target.value.split('\n').filter(k => k.trim())
                } as Partial<ReputationSettings>)}
                rows={4}
                placeholder="lawyer&#10;health department&#10;food poisoning&#10;discrimination"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                One keyword per line. Reviews containing these words will be auto-escalated.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Auto-Route Negative</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Route low-rating reviews automatically</p>
                </div>
                <button
                  onClick={() => save({ auto_route_negative: !settings?.auto_route_negative } as Partial<ReputationSettings>)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    settings?.auto_route_negative ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    settings?.auto_route_negative ? 'translate-x-5' : ''
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Auto-Route Positive</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Route high-rating reviews automatically</p>
                </div>
                <button
                  onClick={() => save({ auto_route_positive: !settings?.auto_route_positive } as Partial<ReputationSettings>)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    settings?.auto_route_positive ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    settings?.auto_route_positive ? 'translate-x-5' : ''
                  }`} />
                </button>
              </div>
            </div>
          </div>
        )}

        {section === 'notifications' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Notification Recipients</h3>
              <p className="text-sm text-gray-500 mt-1">
                Select team members who should receive review notifications.
              </p>
            </div>
            <div className="space-y-3">
              {availableUsers.map((u) => {
                const isSelected = settings?.notification_recipients?.includes(u.id) || false;
                return (
                  <div key={u.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-600">
                          {u.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">{u.name}</h4>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!user?.organization_id || !user?.id) return;
                        const current = settings?.notification_recipients || [];
                        const updated = isSelected
                          ? current.filter(id => id !== u.id)
                          : [...current, u.id];
                        await updateNotificationRecipients(user.organization_id, updated, user.id);
                        setSettings(prev => prev ? { ...prev, notification_recipients: updated } : null);
                      }}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        isSelected ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        isSelected ? 'translate-x-5' : ''
                      }`} />
                    </button>
                  </div>
                );
              })}
              {availableUsers.length === 0 && (
                <div className="text-center py-8">
                  <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-500">No team members found</p>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 pt-6 space-y-4">
              <h4 className="text-sm font-medium text-gray-900">Negative Review Automation</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Threshold (stars)</label>
                  <select
                    value={settings?.negative_review_threshold || 3}
                    onChange={(e) => updateNegativeReviewSettings(
                      user!.organization_id,
                      { negative_review_threshold: Number(e.target.value) },
                      user!.id
                    ).then(setSettings)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>1 Star only</option>
                    <option value={2}>2 Stars or below</option>
                    <option value={3}>3 Stars or below</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Task Due (hours)</label>
                  <select
                    value={settings?.negative_review_task_due_hours || 24}
                    onChange={(e) => updateNegativeReviewSettings(
                      user!.organization_id,
                      { negative_review_task_due_hours: Number(e.target.value) },
                      user!.id
                    ).then(setSettings)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>1 hour</option>
                    <option value={4}>4 hours</option>
                    <option value={8}>8 hours</option>
                    <option value={24}>24 hours</option>
                    <option value={48}>48 hours</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {section === 'review_link' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Review Link</h3>
              <p className="text-sm text-gray-500 mt-1">Where customers are directed to leave reviews.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Google Business URL</label>
              <input
                type="url"
                value={settings?.google_review_url || ''}
                onChange={(e) => save({ google_review_url: e.target.value || null })}
                placeholder="https://g.page/your-business/review"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Facebook Page URL</label>
              <input
                type="url"
                value={settings?.facebook_review_url || ''}
                onChange={(e) => save({ facebook_review_url: e.target.value || null })}
                placeholder="https://facebook.com/your-business/reviews"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Review Goal</label>
              <input
                type="number"
                value={settings?.review_goal || 20}
                onChange={(e) => save({ review_goal: Number(e.target.value) })}
                min={1}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {section === 'sms_requests' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">SMS Requests</h3>
              <p className="text-sm text-gray-500 mt-1">Default SMS template for review requests.</p>
            </div>
            <textarea
              value={settings?.default_sms_template || ''}
              onChange={(e) => save({ default_sms_template: e.target.value })}
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <p className="text-xs text-gray-500">
              Merge fields: {'{first_name}'}, {'{company_name}'}, {'{review_link}'}
            </p>
          </div>
        )}

        {section === 'email_requests' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Email Requests</h3>
              <p className="text-sm text-gray-500 mt-1">Default email template for review requests.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
              <input
                type="text"
                value={settings?.default_email_subject || ''}
                onChange={(e) => save({ default_email_subject: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Body</label>
              <textarea
                value={settings?.default_email_template || ''}
                onChange={(e) => save({ default_email_template: e.target.value })}
                rows={8}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
        )}

        {section === 'reviews_qr' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Reviews QR Code</h3>
              <p className="text-sm text-gray-500 mt-1">Generate a QR code that links to your review page.</p>
            </div>
            <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg">
              <div className="text-center">
                <QrCode className="w-24 h-24 text-gray-300 mx-auto mb-4" />
                <p className="text-sm text-gray-500">Configure your review link first to generate a QR code</p>
              </div>
            </div>
          </div>
        )}

        {section === 'spam_reviews' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Spam Reviews</h3>
              <p className="text-sm text-gray-500 mt-1">Configure spam detection settings.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Blocked Keywords</label>
              <textarea
                value={(settings?.spam_keywords || []).join('\n')}
                onChange={(e) => save({
                  spam_keywords: e.target.value.split('\n').filter(k => k.trim())
                })}
                rows={6}
                placeholder="Enter one keyword per line"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
