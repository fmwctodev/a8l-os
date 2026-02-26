import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Save, Video, Mail, MessageSquare, Clock, Shield, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  getFollowUpSettings,
  upsertFollowUpSettings,
  type MeetingFollowUpSettings,
} from '../../services/meetingFollowUps';

const DELAY_OPTIONS = [
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
  { value: 480, label: '8 hours' },
  { value: 1440, label: '24 hours' },
];

const CHANNEL_OPTIONS: { value: MeetingFollowUpSettings['default_channel']; label: string; icon: typeof Mail }[] = [
  { value: 'email', label: 'Email Only', icon: Mail },
  { value: 'sms', label: 'SMS Only', icon: MessageSquare },
  { value: 'both', label: 'Email + SMS', icon: Mail },
];

export function MeetingFollowUpSettingsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [defaultDelayMinutes, setDefaultDelayMinutes] = useState(120);
  const [defaultChannel, setDefaultChannel] = useState<MeetingFollowUpSettings['default_channel']>('email');
  const [autoSend, setAutoSend] = useState(false);
  const [respectQuietHours, setRespectQuietHours] = useState(true);
  const [excludeInternal, setExcludeInternal] = useState(true);
  const [internalDomains, setInternalDomains] = useState('');
  const [aiInstructions, setAiInstructions] = useState('');

  const orgId = user?.organization_id;

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      try {
        const settings = await getFollowUpSettings(orgId);
        if (settings) {
          setEnabled(settings.enabled);
          setDefaultDelayMinutes(settings.default_delay_minutes);
          setDefaultChannel(settings.default_channel);
          setAutoSend(settings.auto_send);
          setRespectQuietHours(settings.respect_quiet_hours);
          setExcludeInternal(settings.exclude_internal);
          setInternalDomains(settings.internal_domains.join(', '));
          setAiInstructions(settings.ai_instructions || '');
        }
      } catch {
        showToast('warning', 'Failed to load follow-up settings');
      } finally {
        setLoading(false);
      }
    })();
  }, [orgId, showToast]);

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      const domains = internalDomains
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);

      await upsertFollowUpSettings(orgId, {
        enabled,
        default_delay_minutes: defaultDelayMinutes,
        default_channel: defaultChannel,
        auto_send: autoSend,
        respect_quiet_hours: respectQuietHours,
        exclude_internal: excludeInternal,
        internal_domains: domains,
        ai_instructions: aiInstructions || null,
      });
      showToast('success', 'Follow-up settings saved');
    } catch {
      showToast('warning', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/settings')}
          className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
            <Video className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Meeting Follow-Up Settings</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Configure automated follow-up messages after meetings
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800/50 divide-y divide-slate-700/50">
        <div className="p-6 flex items-center justify-between">
          <div>
            <h2 className="text-base font-medium text-white">Enable Auto Follow-Ups</h2>
            <p className="text-sm text-slate-400 mt-1">
              Automatically generate AI-powered follow-up messages after meetings are processed
            </p>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              enabled ? 'bg-cyan-600' : 'bg-slate-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className={`p-6 space-y-6 ${!enabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-3">
              <Mail className="w-4 h-4 text-slate-400" />
              Default Channel
            </label>
            <div className="grid grid-cols-3 gap-3">
              {CHANNEL_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => setDefaultChannel(option.value)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                      defaultChannel === option.value
                        ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400'
                        : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {option.value === 'both' ? (
                      <div className="flex -space-x-1">
                        <Mail className="w-4 h-4" />
                        <MessageSquare className="w-4 h-4" />
                      </div>
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-3">
              <Clock className="w-4 h-4 text-slate-400" />
              Send Delay
            </label>
            <p className="text-xs text-slate-500 mb-2">
              How long after meeting ends before follow-ups are sent
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DELAY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDefaultDelayMinutes(opt.value)}
                  className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                    defaultDelayMinutes === opt.value
                      ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-slate-300">Auto-Send Without Review</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Send follow-ups automatically. If off, drafts require manual approval.
                </p>
              </div>
              <button
                onClick={() => setAutoSend(!autoSend)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoSend ? 'bg-cyan-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    autoSend ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-slate-300">Respect Quiet Hours</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Delay sending if outside business hours (9 AM - 6 PM)
                </p>
              </div>
              <button
                onClick={() => setRespectQuietHours(!respectQuietHours)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  respectQuietHours ? 'bg-cyan-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    respectQuietHours ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-slate-300">Exclude Internal Participants</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Skip follow-ups for team members and internal email domains
                </p>
              </div>
              <button
                onClick={() => setExcludeInternal(!excludeInternal)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  excludeInternal ? 'bg-cyan-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    excludeInternal ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {excludeInternal && (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                <Shield className="w-4 h-4 text-slate-400" />
                Internal Domains
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Comma-separated list of email domains to exclude (e.g. yourcompany.com, contractor.io)
              </p>
              <input
                type="text"
                value={internalDomains}
                onChange={(e) => setInternalDomains(e.target.value)}
                placeholder="yourcompany.com, partner.io"
                className="w-full px-4 py-2.5 rounded-lg bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-colors"
              />
            </div>
          )}

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              AI Tone Instructions
            </label>
            <p className="text-xs text-slate-500 mb-2">
              Guide the AI on how follow-ups should sound (optional)
            </p>
            <textarea
              value={aiInstructions}
              onChange={(e) => setAiInstructions(e.target.value)}
              rows={4}
              placeholder="E.g., Use a warm, professional tone. Reference specific discussion topics. Keep emails concise. Always include next steps."
              className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-colors resize-y"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Settings
        </button>
      </div>
    </div>
  );
}
