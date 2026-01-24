import { useState, useEffect } from 'react';
import { Send, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getEmailSetupStatus, sendTestEmail, getTestEmailLogs } from '../../../services/emailSend';
import { getFromAddresses } from '../../../services/emailFromAddresses';
import type { EmailSetupStatus, EmailTestLog, EmailFromAddress } from '../../../types';

export function TestTab() {
  const { user } = useAuth();
  const [status, setStatus] = useState<EmailSetupStatus | null>(null);
  const [fromAddresses, setFromAddresses] = useState<EmailFromAddress[]>([]);
  const [testLogs, setTestLogs] = useState<EmailTestLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const [formData, setFormData] = useState({
    toEmail: '',
    fromAddressId: '',
    subject: '',
    body: '',
  });

  const activeFromAddresses = fromAddresses.filter(a => a.active);

  useEffect(() => {
    loadData();
  }, [user?.organization_id]);

  const loadData = async () => {
    if (!user?.organization_id) return;
    try {
      const [statusData, addressData, logsData] = await Promise.all([
        getEmailSetupStatus(),
        getFromAddresses(user.organization_id),
        getTestEmailLogs(user.organization_id, 10),
      ]);
      setStatus(statusData);
      setFromAddresses(addressData);
      setTestLogs(logsData);

      const activeAddresses = addressData.filter(a => a.active);
      const defaultAddress = activeAddresses.find(a => a.is_default) || activeAddresses[0];
      if (defaultAddress) {
        setFormData(prev => ({
          ...prev,
          fromAddressId: defaultAddress.id,
        }));
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setResult(null);

    try {
      const response = await sendTestEmail(
        formData.toEmail,
        formData.fromAddressId,
        formData.subject || undefined,
        formData.body || undefined
      );

      if (response.success) {
        setResult({ success: true, message: 'Test email sent successfully!' });
        setFormData(prev => ({ ...prev, toEmail: '' }));
        await loadData();
      } else {
        setResult({
          success: false,
          message: response.error || 'Failed to send test email',
        });
      }
    } catch (err) {
      setResult({ success: false, message: 'An error occurred while sending' });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  const isConfigured = status?.isConfigured ?? false;

  return (
    <div className="space-y-6">
      {!isConfigured && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-amber-400 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-amber-400">Email Not Configured</h3>
              <div className="mt-2 text-sm text-amber-300/80">
                <p>Complete the following before sending test emails:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  {status?.blockingReasons.map((reason, index) => (
                    <li key={index}>{reason}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 border border-slate-700 rounded-lg">
          <div className="px-6 py-4 border-b border-slate-700">
            <h3 className="text-lg font-medium text-white">Send Test Email</h3>
            <p className="mt-1 text-sm text-slate-400">
              Verify your email configuration is working correctly
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
            {result && (
              <div className={`rounded-md p-4 ${result.success ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                <div className="flex">
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-400" />
                  )}
                  <div className="ml-3">
                    <p className={`text-sm font-medium ${result.success ? 'text-emerald-400' : 'text-red-400'}`}>
                      {result.message}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="toEmail" className="block text-sm font-medium text-slate-300">
                To Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                id="toEmail"
                value={formData.toEmail}
                onChange={(e) => setFormData({ ...formData, toEmail: e.target.value })}
                required
                disabled={!isConfigured}
                placeholder="recipient@example.com"
                className="mt-1 block w-full bg-slate-900 border-slate-600 rounded-md text-white placeholder-slate-500 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm disabled:opacity-50"
              />
            </div>

            <div>
              <label htmlFor="fromAddressId" className="block text-sm font-medium text-slate-300">
                From Address <span className="text-red-400">*</span>
              </label>
              <select
                id="fromAddressId"
                value={formData.fromAddressId}
                onChange={(e) => setFormData({ ...formData, fromAddressId: e.target.value })}
                required
                disabled={!isConfigured}
                className="mt-1 block w-full bg-slate-900 border-slate-600 rounded-md text-white focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm disabled:opacity-50"
              >
                <option value="">Select a from address...</option>
                {activeFromAddresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {address.display_name} &lt;{address.email}&gt;
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-slate-300">
                Subject
              </label>
              <input
                type="text"
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                disabled={!isConfigured}
                placeholder="Test Email from Your Organization"
                className="mt-1 block w-full bg-slate-900 border-slate-600 rounded-md text-white placeholder-slate-500 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-slate-500">
                Leave blank to use default subject
              </p>
            </div>

            <div>
              <label htmlFor="body" className="block text-sm font-medium text-slate-300">
                Message Body
              </label>
              <textarea
                id="body"
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                rows={4}
                disabled={!isConfigured}
                placeholder="Leave blank for default test message"
                className="mt-1 block w-full bg-slate-900 border-slate-600 rounded-md text-white placeholder-slate-500 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-slate-500">
                Leave blank to use default test message
              </p>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={sending || !isConfigured || !formData.toEmail || !formData.fromAddressId}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50"
              >
                <Send className="h-4 w-4 mr-2" />
                {sending ? 'Sending...' : 'Send Test Email'}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg">
          <div className="px-6 py-4 border-b border-slate-700">
            <h3 className="text-lg font-medium text-white">Recent Test Emails</h3>
          </div>

          {testLogs.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-400">
              No test emails sent yet
            </div>
          ) : (
            <ul className="divide-y divide-slate-700 max-h-[500px] overflow-y-auto">
              {testLogs.map((log) => (
                <li key={log.id} className="px-6 py-4">
                  <div className="flex items-start">
                    {log.status === 'success' ? (
                      <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-400 mt-0.5" />
                    )}
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-medium text-white">{log.to_email}</p>
                      <p className="text-xs text-slate-400">
                        {log.from_address ? (
                          <>From: {log.from_address.display_name} &lt;{log.from_address.email}&gt;</>
                        ) : (
                          'From address removed'
                        )}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(log.sent_at).toLocaleString()}
                      </p>
                      {log.status === 'failed' && log.error_message && (
                        <p className="mt-1 text-xs text-red-400">{log.error_message}</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
