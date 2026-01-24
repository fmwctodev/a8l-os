import { useState, useEffect } from 'react';
import { Save, RefreshCw } from 'lucide-react';
import { updateWarmupConfig, getWarmupConfig } from '../../../services/emailCampaignDomains';
import type { EmailWarmupConfig, UpdateEmailWarmupConfigInput } from '../../../types';

interface WarmUpConfigFormProps {
  domainId: string;
  config?: EmailWarmupConfig;
  onSaved: () => void;
}

export function WarmUpConfigForm({ domainId, config, onSaved }: WarmUpConfigFormProps) {
  const [formData, setFormData] = useState<UpdateEmailWarmupConfigInput>({
    start_daily_volume: config?.start_daily_volume ?? 25,
    ramp_duration_days: config?.ramp_duration_days ?? 21,
    daily_increase_type: config?.daily_increase_type ?? 'linear',
    pause_on_bounce_spike: config?.pause_on_bounce_spike ?? true,
    pause_on_spam_complaints: config?.pause_on_spam_complaints ?? true,
    auto_throttle_low_engagement: config?.auto_throttle_low_engagement ?? false,
    ai_recommendations_enabled: config?.ai_recommendations_enabled ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (config) {
      setFormData({
        start_daily_volume: config.start_daily_volume,
        ramp_duration_days: config.ramp_duration_days,
        daily_increase_type: config.daily_increase_type,
        pause_on_bounce_spike: config.pause_on_bounce_spike,
        pause_on_spam_complaints: config.pause_on_spam_complaints,
        auto_throttle_low_engagement: config.auto_throttle_low_engagement,
        ai_recommendations_enabled: config.ai_recommendations_enabled,
      });
    }
  }, [config]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await updateWarmupConfig(domainId, formData);
      if (result.success) {
        setSuccess(true);
        onSaved();
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || 'Failed to save configuration');
      }
    } catch (err) {
      setError('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
          <p className="text-sm text-emerald-400">Configuration saved successfully</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="startVolume" className="block text-sm font-medium text-slate-300">
            Start Daily Volume
          </label>
          <input
            type="number"
            id="startVolume"
            min={1}
            max={100}
            value={formData.start_daily_volume}
            onChange={(e) => setFormData({ ...formData, start_daily_volume: parseInt(e.target.value) || 25 })}
            className="mt-1 block w-full bg-slate-900 border-slate-600 rounded-md text-white placeholder-slate-500 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm"
          />
          <p className="mt-1 text-xs text-slate-500">Emails sent on day 1</p>
        </div>

        <div>
          <label htmlFor="rampDuration" className="block text-sm font-medium text-slate-300">
            Ramp Duration (days)
          </label>
          <input
            type="number"
            id="rampDuration"
            min={7}
            max={90}
            value={formData.ramp_duration_days}
            onChange={(e) => setFormData({ ...formData, ramp_duration_days: parseInt(e.target.value) || 21 })}
            className="mt-1 block w-full bg-slate-900 border-slate-600 rounded-md text-white placeholder-slate-500 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm"
          />
          <p className="mt-1 text-xs text-slate-500">Days to reach target volume</p>
        </div>
      </div>

      <div>
        <label htmlFor="increaseType" className="block text-sm font-medium text-slate-300">
          Volume Increase Type
        </label>
        <select
          id="increaseType"
          value={formData.daily_increase_type}
          onChange={(e) => setFormData({ ...formData, daily_increase_type: e.target.value as 'linear' | 'exponential' })}
          className="mt-1 block w-full bg-slate-900 border-slate-600 rounded-md text-white focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm"
        >
          <option value="linear">Linear (steady increase)</option>
          <option value="exponential">Exponential (slow start, fast finish)</option>
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Linear is safer for new domains; exponential is faster but riskier
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="text-sm font-medium text-white">Safety Guardrails</h4>

        <div className="flex items-center justify-between">
          <div>
            <label htmlFor="bounceGuard" className="text-sm font-medium text-slate-300">
              Pause on bounce spike
            </label>
            <p className="text-xs text-slate-500">Auto-pause if bounce rate exceeds 2%</p>
          </div>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, pause_on_bounce_spike: !formData.pause_on_bounce_spike })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.pause_on_bounce_spike ? 'bg-cyan-600' : 'bg-slate-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                formData.pause_on_bounce_spike ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label htmlFor="spamGuard" className="text-sm font-medium text-slate-300">
              Pause on spam complaints
            </label>
            <p className="text-xs text-slate-500">Auto-pause if spam rate exceeds 0.1%</p>
          </div>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, pause_on_spam_complaints: !formData.pause_on_spam_complaints })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.pause_on_spam_complaints ? 'bg-cyan-600' : 'bg-slate-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                formData.pause_on_spam_complaints ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label htmlFor="throttleGuard" className="text-sm font-medium text-slate-300">
              Auto-throttle on low engagement
            </label>
            <p className="text-xs text-slate-500">Slow down if open rates drop significantly</p>
          </div>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, auto_throttle_low_engagement: !formData.auto_throttle_low_engagement })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.auto_throttle_low_engagement ? 'bg-cyan-600' : 'bg-slate-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                formData.auto_throttle_low_engagement ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-sm font-medium text-white">AI Features</h4>

        <div className="flex items-center justify-between">
          <div>
            <label htmlFor="aiRecommendations" className="text-sm font-medium text-slate-300">
              AI recommendations
            </label>
            <p className="text-xs text-slate-500">Get intelligent suggestions based on metrics</p>
          </div>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, ai_recommendations_enabled: !formData.ai_recommendations_enabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.ai_recommendations_enabled ? 'bg-cyan-600' : 'bg-slate-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                formData.ai_recommendations_enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50"
        >
          {saving ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Configuration
            </>
          )}
        </button>
      </div>
    </form>
  );
}
