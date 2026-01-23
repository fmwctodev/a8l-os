import { useState, useEffect } from 'react';
import { Eye, EyeOff, Copy, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getChannelConfiguration, saveChannelConfiguration } from '../../services/channelConfigurations';
import type { TwilioConfig as TwilioConfigType } from '../../types';

export function TwilioConfig() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [config, setConfig] = useState<TwilioConfigType>({
    account_sid: '',
    auth_token: '',
    phone_numbers: [],
  });

  const [newPhoneNumber, setNewPhoneNumber] = useState('');

  useEffect(() => {
    async function loadConfig() {
      if (!user?.organization_id) return;

      try {
        setLoading(true);
        const data = await getChannelConfiguration(user.organization_id, 'twilio');
        if (data) {
          setConfig(data.config as TwilioConfigType);
          setIsActive(data.is_active);
        }
      } catch (err) {
        console.error('Failed to load Twilio config:', err);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, [user?.organization_id]);

  const handleSave = async () => {
    if (!user?.organization_id) return;

    try {
      setSaving(true);
      setError(null);
      await saveChannelConfiguration(user.organization_id, 'twilio', config, isActive);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPhoneNumber = () => {
    if (!newPhoneNumber.trim()) return;

    const normalized = newPhoneNumber.replace(/\D/g, '');
    const formatted = normalized.length === 10 ? `+1${normalized}` : `+${normalized}`;

    if (!config.phone_numbers.includes(formatted)) {
      setConfig({
        ...config,
        phone_numbers: [...config.phone_numbers, formatted],
      });
    }
    setNewPhoneNumber('');
  };

  const handleRemovePhoneNumber = (phone: string) => {
    setConfig({
      ...config,
      phone_numbers: config.phone_numbers.filter((p) => p !== phone),
    });
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const webhookBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Twilio Configuration</h3>
          <p className="text-sm text-gray-500">Configure Twilio for SMS and voice calls</p>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">Enabled</span>
        </label>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <Check size={18} />
          Configuration saved successfully
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Account SID
          </label>
          <input
            type="text"
            value={config.account_sid}
            onChange={(e) => setConfig({ ...config, account_sid: e.target.value })}
            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Auth Token
          </label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={config.auth_token}
              onChange={(e) => setConfig({ ...config, auth_token: e.target.value })}
              placeholder="Enter your auth token"
              className="w-full px-4 py-2 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Numbers
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="tel"
              value={newPhoneNumber}
              onChange={(e) => setNewPhoneNumber(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAddPhoneNumber}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Add
            </button>
          </div>
          {config.phone_numbers.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {config.phone_numbers.map((phone) => (
                <span
                  key={phone}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm"
                >
                  {phone}
                  <button
                    onClick={() => handleRemovePhoneNumber(phone)}
                    className="ml-1 text-gray-400 hover:text-gray-600"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No phone numbers added</p>
          )}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Webhook URLs</h4>
        <p className="text-sm text-gray-500 mb-4">
          Configure these URLs in your Twilio console for incoming messages and calls.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              SMS Webhook (Inbound)
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-600 overflow-x-auto">
                {webhookBaseUrl}/twilio-sms-inbound
              </code>
              <button
                onClick={() => copyToClipboard(`${webhookBaseUrl}/twilio-sms-inbound`, 'sms')}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                {copied === 'sms' ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              SMS Status Callback
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-600 overflow-x-auto">
                {webhookBaseUrl}/twilio-sms-status
              </code>
              <button
                onClick={() => copyToClipboard(`${webhookBaseUrl}/twilio-sms-status`, 'status')}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                {copied === 'status' ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Voice Webhook
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-600 overflow-x-auto">
                {webhookBaseUrl}/twilio-voice-webhook
              </code>
              <button
                onClick={() => copyToClipboard(`${webhookBaseUrl}/twilio-voice-webhook`, 'voice')}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                {copied === 'voice' ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {saving && <Loader2 size={18} className="animate-spin" />}
          Save Configuration
        </button>
      </div>
    </div>
  );
}
