import { useState, useEffect } from 'react';
import { RefreshCw, Send, Phone, CheckCircle2, XCircle, Clock, Activity, AlertTriangle } from 'lucide-react';
import { sendTestSms, sendTestCall, getTestLogs, getWebhookHealth } from '../../../services/phoneTest';
import type { WebhookHealthStatus, PhoneTestLog } from '../../../services/phoneTest';
import { getNumbers } from '../../../services/phoneNumbers';
import type { TwilioNumber } from '../../../services/phoneNumbers';
import { usePermission } from '../../../hooks/usePermission';

export default function TestToolsTab() {
  const [numbers, setNumbers] = useState<TwilioNumber[]>([]);
  const [testLogs, setTestLogs] = useState<PhoneTestLog[]>([]);
  const [webhookHealth, setWebhookHealth] = useState<Record<string, WebhookHealthStatus>>({});
  const [loading, setLoading] = useState(true);
  const [sendingSms, setSendingSms] = useState(false);
  const [sendingCall, setSendingCall] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [smsForm, setSmsForm] = useState({
    toNumber: '',
    fromNumberId: '',
    messageBody: 'This is a test message from your phone system.',
  });

  const [callForm, setCallForm] = useState({
    toNumber: '',
    fromNumberId: '',
    ttsMessage: 'Hello, this is a test call from your phone system. Goodbye.',
  });

  const canTest = usePermission('phone.test.run');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const numbersData = await getNumbers();
      const activeNumbers = numbersData.filter(n => n.status === 'active');
      setNumbers(activeNumbers);

      if (activeNumbers.length > 0) {
        const defaultSms = activeNumbers.find(n => n.is_default_sms);
        const defaultVoice = activeNumbers.find(n => n.is_default_voice);
        const firstActive = activeNumbers[0];

        setSmsForm(prev => ({ ...prev, fromNumberId: (defaultSms || firstActive).id }));
        setCallForm(prev => ({ ...prev, fromNumberId: (defaultVoice || firstActive).id }));
      }

      const [logsData, healthData] = await Promise.all([
        getTestLogs(),
        getWebhookHealth(),
      ]);
      setTestLogs(logsData);
      setWebhookHealth(healthData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestSms = async () => {
    if (!smsForm.toNumber || !smsForm.fromNumberId || !smsForm.messageBody) {
      setError('Please fill in all SMS fields');
      return;
    }

    try {
      setSendingSms(true);
      setError(null);
      setSuccess(null);
      await sendTestSms({
        toNumber: smsForm.toNumber,
        fromNumberId: smsForm.fromNumberId,
        messageBody: smsForm.messageBody,
      });
      setSuccess('Test SMS sent successfully');
      const logs = await getTestLogs();
      setTestLogs(logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send test SMS');
    } finally {
      setSendingSms(false);
    }
  };

  const handleSendTestCall = async () => {
    if (!callForm.toNumber || !callForm.fromNumberId || !callForm.ttsMessage) {
      setError('Please fill in all call fields');
      return;
    }

    try {
      setSendingCall(true);
      setError(null);
      setSuccess(null);
      await sendTestCall({
        toNumber: callForm.toNumber,
        fromNumberId: callForm.fromNumberId,
        ttsMessage: callForm.ttsMessage,
      });
      setSuccess('Test call initiated successfully');
      const logs = await getTestLogs();
      setTestLogs(logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate test call');
    } finally {
      setSendingCall(false);
    }
  };

  const formatPhoneNumber = (number: string) => {
    if (number.startsWith('+1') && number.length === 12) {
      return `(${number.slice(2, 5)}) ${number.slice(5, 8)}-${number.slice(8)}`;
    }
    return number;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
      case 'delivered':
        return <span className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">Success</span>;
      case 'failed':
      case 'undelivered':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">Failed</span>;
      case 'pending':
      case 'queued':
      case 'sent':
      case 'initiated':
        return <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">Pending</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">{status}</span>;
    }
  };

  const getWebhookStatusDisplay = (health: WebhookHealthStatus) => {
    switch (health.status) {
      case 'healthy':
        return { label: 'Healthy', color: 'emerald' };
      case 'degraded':
        return { label: 'Degraded', color: 'amber' };
      default:
        return { label: 'No data', color: 'gray' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (numbers.length === 0) {
    return (
      <div className="text-center py-12">
        <Phone className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Numbers</h3>
        <p className="text-gray-500">Sync and enable phone numbers to use test tools</p>
      </div>
    );
  }

  const webhookEntries = Object.entries(webhookHealth);

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
          <p className="text-emerald-700">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-sky-100 rounded-lg">
              <Send className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Test SMS</h3>
              <p className="text-sm text-gray-500">Send a test message</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Number</label>
              <input
                type="tel"
                value={smsForm.toNumber}
                onChange={e => setSmsForm(prev => ({ ...prev, toNumber: e.target.value }))}
                placeholder="+1234567890"
                disabled={!canTest}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Number</label>
              <select
                value={smsForm.fromNumberId}
                onChange={e => setSmsForm(prev => ({ ...prev, fromNumberId: e.target.value }))}
                disabled={!canTest}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              >
                {numbers.filter(n => n.capabilities.sms).map(num => (
                  <option key={num.id} value={num.id}>
                    {formatPhoneNumber(num.phone_number)} {num.friendly_name && `- ${num.friendly_name}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                value={smsForm.messageBody}
                onChange={e => setSmsForm(prev => ({ ...prev, messageBody: e.target.value }))}
                rows={3}
                disabled={!canTest}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <button
              onClick={handleSendTestSms}
              disabled={!canTest || sendingSms}
              className="w-full px-4 py-2 bg-sky-600 text-white font-medium rounded-lg hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sendingSms ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Test SMS
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Phone className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Test Call</h3>
              <p className="text-sm text-gray-500">Initiate a test voice call</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Number</label>
              <input
                type="tel"
                value={callForm.toNumber}
                onChange={e => setCallForm(prev => ({ ...prev, toNumber: e.target.value }))}
                placeholder="+1234567890"
                disabled={!canTest}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Number</label>
              <select
                value={callForm.fromNumberId}
                onChange={e => setCallForm(prev => ({ ...prev, fromNumberId: e.target.value }))}
                disabled={!canTest}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              >
                {numbers.filter(n => n.capabilities.voice).map(num => (
                  <option key={num.id} value={num.id}>
                    {formatPhoneNumber(num.phone_number)} {num.friendly_name && `- ${num.friendly_name}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">TTS Message</label>
              <textarea
                value={callForm.ttsMessage}
                onChange={e => setCallForm(prev => ({ ...prev, ttsMessage: e.target.value }))}
                rows={3}
                disabled={!canTest}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <button
              onClick={handleSendTestCall}
              disabled={!canTest || sendingCall}
              className="w-full px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sendingCall ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Initiating...
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4" />
                  Initiate Test Call
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Activity className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Webhook Health</h3>
              <p className="text-sm text-gray-500">Status of inbound webhook endpoints</p>
            </div>
          </div>
          <button
            onClick={loadData}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {webhookEntries.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No webhook data available yet</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {webhookEntries.map(([type, health]) => {
              const { label, color } = getWebhookStatusDisplay(health);
              return (
                <div key={type} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900 capitalize">{type}</span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${color}-100 text-${color}-700`}>
                      {label}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 space-y-1">
                    <p>Success: {health.successCount}</p>
                    <p>Failures: {health.failureCount}</p>
                    {health.lastReceived && (
                      <p>Last: {new Date(health.lastReceived).toLocaleString()}</p>
                    )}
                  </div>
                  {health.lastError && (
                    <p className="text-xs text-red-600 mt-2 truncate" title={health.lastError}>
                      {health.lastError}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Clock className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Recent Tests</h3>
            <p className="text-sm text-gray-500">History of test messages and calls</p>
          </div>
        </div>

        {testLogs.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No test history yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">To</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">From</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {testLogs.map(log => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full ${
                        log.test_type === 'sms' ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {log.test_type === 'sms' ? <Send className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
                        {log.test_type.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">{formatPhoneNumber(log.to_number)}</td>
                    <td className="py-3 px-4 text-sm text-gray-900">{formatPhoneNumber(log.from_number)}</td>
                    <td className="py-3 px-4">{getStatusBadge(log.status)}</td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-amber-800">Testing Notes</h4>
            <ul className="text-sm text-amber-700 mt-2 list-disc list-inside space-y-1">
              <li>Test messages and calls will use your Twilio account credits</li>
              <li>Ensure the destination number can receive SMS/calls</li>
              <li>Test calls play the TTS message and then hang up</li>
              <li>Status updates may take a few moments to reflect</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
