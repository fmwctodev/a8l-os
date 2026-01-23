import { useState, useEffect } from 'react';
import { Copy, Check, AlertCircle, Loader2, Code, Eye } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getChannelConfiguration, saveChannelConfiguration } from '../../services/channelConfigurations';
import type { WebchatConfig as WebchatConfigType } from '../../types';

export function WebchatConfig() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [config, setConfig] = useState<WebchatConfigType>({
    enabled: true,
    primary_color: '#0066cc',
    welcome_message: 'Hi! How can we help you today?',
    pre_chat_form: false,
    required_fields: [],
  });

  useEffect(() => {
    async function loadConfig() {
      if (!user?.organization_id) return;

      try {
        setLoading(true);
        const data = await getChannelConfiguration(user.organization_id, 'webchat');
        if (data) {
          setConfig(data.config as WebchatConfigType);
          setIsActive(data.is_active);
        }
      } catch (err) {
        console.error('Failed to load webchat config:', err);
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
      await saveChannelConfiguration(user.organization_id, 'webchat', config, isActive);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const toggleRequiredField = (field: 'name' | 'email') => {
    const current = config.required_fields || [];
    const newFields = current.includes(field)
      ? current.filter((f) => f !== field)
      : [...current, field];
    setConfig({ ...config, required_fields: newFields as ('name' | 'email')[] });
  };

  const embedCode = `<script src="${window.location.origin}/webchat-widget.js"></script>
<script>
  window.initWebchat({
    orgId: '${user?.organization_id || 'YOUR_ORG_ID'}',
    apiUrl: '${import.meta.env.VITE_SUPABASE_URL}/functions/v1'
  });
</script>`;

  const copyEmbedCode = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
          <h3 className="text-lg font-medium text-gray-900">Webchat Widget</h3>
          <p className="text-sm text-gray-500">Embed a chat widget on your website</p>
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

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Primary Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={config.primary_color}
                onChange={(e) => setConfig({ ...config, primary_color: e.target.value })}
                className="w-10 h-10 rounded border border-gray-200 cursor-pointer"
              />
              <input
                type="text"
                value={config.primary_color}
                onChange={(e) => setConfig({ ...config, primary_color: e.target.value })}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Welcome Message
            </label>
            <textarea
              value={config.welcome_message}
              onChange={(e) => setConfig({ ...config, welcome_message: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Hi! How can we help you today?"
            />
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.pre_chat_form}
                onChange={(e) => setConfig({ ...config, pre_chat_form: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Show pre-chat form
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              Collect visitor information before starting the chat
            </p>
          </div>

          {config.pre_chat_form && (
            <div className="ml-6 space-y-2">
              <p className="text-sm font-medium text-gray-700">Required fields:</p>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.required_fields?.includes('name')}
                  onChange={() => toggleRequiredField('name')}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">Name</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.required_fields?.includes('email')}
                  onChange={() => toggleRequiredField('email')}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">Email</span>
              </label>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700">Preview</label>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Eye size={14} />
              {showPreview ? 'Hide' : 'Show'} Preview
            </button>
          </div>

          {showPreview && (
            <div className="border border-gray-200 rounded-lg bg-gray-50 h-[400px] relative overflow-hidden">
              <div className="absolute bottom-4 right-4">
                <button
                  className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white"
                  style={{ backgroundColor: config.primary_color }}
                >
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </button>
              </div>

              <div className="absolute bottom-20 right-4 w-80 bg-white rounded-xl shadow-xl overflow-hidden">
                <div
                  className="px-5 py-4 text-white font-semibold"
                  style={{ backgroundColor: config.primary_color }}
                >
                  Chat with us
                </div>
                <div className="p-4 h-48 flex items-center justify-center text-gray-400 text-sm">
                  {config.welcome_message}
                </div>
                <div className="p-3 border-t border-gray-100">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type a message..."
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-full text-sm"
                      disabled
                    />
                    <button
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                      style={{ backgroundColor: config.primary_color }}
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="22" y1="2" x2="11" y2="13"/>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {saving && <Loader2 size={18} className="animate-spin" />}
          Save Configuration
        </button>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Embed Code</h4>
            <p className="text-xs text-gray-500">Add this code to your website</p>
          </div>
          <button
            onClick={copyEmbedCode}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {copied ? (
              <>
                <Check size={14} className="text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy size={14} />
                Copy Code
              </>
            )}
          </button>
        </div>

        <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto text-sm">
          <code>{embedCode}</code>
        </pre>
      </div>
    </div>
  );
}
