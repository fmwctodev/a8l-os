import { useState, useEffect } from 'react';
import {
  Phone,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Hash,
  MessageSquare,
  PhoneCall,
  Mic,
  Activity,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { getPhoneSettings } from '../../../services/phoneSettings';
import { getWebhookHealth } from '../../../services/phoneTest';
import type { PhoneSettingsResponse, WebhookHealthStatus } from '../../../services/phoneSettings';

interface OverviewTabProps {
  onNavigate: (tab: string) => void;
}

export default function OverviewTab({ onNavigate }: OverviewTabProps) {
  const [data, setData] = useState<PhoneSettingsResponse | null>(null);
  const [webhookHealth, setWebhookHealth] = useState<Record<string, WebhookHealthStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [settingsData, healthData] = await Promise.all([
        getPhoneSettings(),
        getWebhookHealth()
      ]);
      setData(settingsData);
      setWebhookHealth(healthData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  const isConnected = data?.connection?.status === 'connected';
  const defaultSmsSender = data?.settings?.default_sms_mode === 'messaging_service'
    ? data?.settings?.default_messaging_service?.name
    : data?.settings?.default_sms_number?.phone_number;
  const defaultVoice = data?.settings?.default_voice_number?.phone_number;
  const recordingEnabled = data?.settings?.record_inbound_calls || data?.settings?.record_outbound_calls;

  const StatusIcon = ({ status }: { status: 'connected' | 'warning' | 'disconnected' }) => {
    if (status === 'connected') return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    if (status === 'warning') return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    return <XCircle className="w-5 h-5 text-red-500" />;
  };

  const getWebhookStatus = (type: string) => {
    const health = webhookHealth[type];
    if (!health) return 'never_received';
    return health.status;
  };

  return (
    <div className="space-y-6">
      {data?.blockingReasons && data.blockingReasons.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-800">Configuration Required</h3>
              <ul className="mt-2 text-sm text-amber-700 space-y-1">
                {data.blockingReasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isConnected ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                <Phone className={`w-5 h-5 ${isConnected ? 'text-emerald-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Twilio Connection</h3>
                <p className="text-sm text-gray-500">
                  {isConnected ? `Account: ${data?.connection?.accountSid?.slice(0, 10)}...` : 'Not connected'}
                </p>
              </div>
            </div>
            <StatusIcon status={isConnected ? 'connected' : 'disconnected'} />
          </div>
          {!isConnected && (
            <button
              onClick={() => onNavigate('connection')}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700"
            >
              Connect Twilio
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${data?.numberCount ? 'bg-sky-100' : 'bg-gray-100'}`}>
                <Hash className={`w-5 h-5 ${data?.numberCount ? 'text-sky-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Phone Numbers</h3>
                <p className="text-sm text-gray-500">
                  {data?.numberCount || 0} active number{data?.numberCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <StatusIcon status={data?.numberCount ? 'connected' : 'warning'} />
          </div>
          <button
            onClick={() => onNavigate('numbers')}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
          >
            Manage Numbers
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${defaultSmsSender ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                <MessageSquare className={`w-5 h-5 ${defaultSmsSender ? 'text-emerald-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Default SMS Sender</h3>
                <p className="text-sm text-gray-500 truncate max-w-[180px]">
                  {defaultSmsSender || 'Not configured'}
                </p>
              </div>
            </div>
            <StatusIcon status={defaultSmsSender ? 'connected' : 'warning'} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${defaultVoice ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                <PhoneCall className={`w-5 h-5 ${defaultVoice ? 'text-emerald-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Default Caller ID</h3>
                <p className="text-sm text-gray-500">
                  {defaultVoice || 'Not configured'}
                </p>
              </div>
            </div>
            <StatusIcon status={defaultVoice ? 'connected' : 'warning'} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${recordingEnabled ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                <Mic className={`w-5 h-5 ${recordingEnabled ? 'text-emerald-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Call Recording</h3>
                <p className="text-sm text-gray-500">
                  {recordingEnabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>
            <StatusIcon status={recordingEnabled ? 'connected' : 'warning'} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-100">
                <Activity className="w-5 h-5 text-gray-500" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Webhook Health</h3>
                <p className="text-sm text-gray-500">
                  SMS: {getWebhookStatus('sms')} | Voice: {getWebhookStatus('voice')}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigate('test')}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
          >
            Test Tools
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-medium text-gray-900 mb-4">Integration Usage</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <MessageSquare className="w-5 h-5 text-sky-600" />
            <div>
              <p className="font-medium text-gray-900">Conversations</p>
              <p className="text-sm text-gray-500">SMS & Voice messaging</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Activity className="w-5 h-5 text-sky-600" />
            <div>
              <p className="font-medium text-gray-900">Workflows</p>
              <p className="text-sm text-gray-500">Automated SMS actions</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Phone className="w-5 h-5 text-sky-600" />
            <div>
              <p className="font-medium text-gray-900">AI Agents</p>
              <p className="text-sm text-gray-500">AI-powered SMS & calls</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
