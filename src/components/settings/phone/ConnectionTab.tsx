import { useState, useEffect } from 'react';
import { Link2, Eye, EyeOff, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Unlink } from 'lucide-react';
import { getConnection, connectTwilio, testConnection, disconnectTwilio } from '../../../services/phoneConnection';
import type { TwilioConnection } from '../../../services/phoneConnection';
import { usePermission } from '../../../hooks/usePermission';

interface ConnectionTabProps {
  onRefresh: () => void;
}

export default function ConnectionTab({ onRefresh }: ConnectionTabProps) {
  const [connection, setConnection] = useState<TwilioConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  const [formData, setFormData] = useState({
    accountSid: '',
    authToken: '',
    subaccountSid: '',
    friendlyName: '',
  });

  const canManage = usePermission('phone.settings.manage');

  useEffect(() => {
    loadConnection();
  }, []);

  const loadConnection = async () => {
    try {
      setLoading(true);
      const conn = await getConnection();
      setConnection(conn);
      if (conn) {
        setFormData({
          accountSid: conn.accountSid,
          authToken: '',
          subaccountSid: conn.subaccountSid || '',
          friendlyName: conn.friendlyName || '',
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connection');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.accountSid || !formData.authToken) {
      setError('Account SID and Auth Token are required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const conn = await connectTwilio({
        accountSid: formData.accountSid,
        authToken: formData.authToken,
        subaccountSid: formData.subaccountSid || undefined,
        friendlyName: formData.friendlyName || undefined,
      });
      setConnection(conn);
      setFormData(prev => ({ ...prev, authToken: '' }));
      setSuccess('Twilio connected successfully');
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setError(null);
      setSuccess(null);
      const result = await testConnection();
      if (result.success) {
        setSuccess('Connection test successful');
      } else {
        setError('Connection test failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setDisconnecting(true);
      setError(null);
      await disconnectTwilio();
      setConnection(null);
      setFormData({
        accountSid: '',
        authToken: '',
        subaccountSid: '',
        friendlyName: '',
      });
      setShowDisconnectModal(false);
      setSuccess('Twilio disconnected');
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  const isConnected = connection?.status === 'connected';

  return (
    <div className="max-w-2xl space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" />
          <p className="text-emerald-700">{success}</p>
        </div>
      )}

      {isConnected && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <div>
                <p className="font-medium text-emerald-800">Twilio Connected</p>
                <p className="text-sm text-emerald-600">
                  Connected {connection.connectedAt ? new Date(connection.connectedAt).toLocaleDateString() : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleTest}
                disabled={testing}
                className="px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-100 rounded-lg hover:bg-emerald-200 disabled:opacity-50"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-100 rounded-lg">
              <Link2 className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Twilio Credentials</h3>
              <p className="text-sm text-gray-500">
                Find your credentials at{' '}
                <a
                  href="https://console.twilio.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-600 hover:underline"
                >
                  console.twilio.com
                </a>
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleConnect} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account SID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.accountSid}
              onChange={e => setFormData(prev => ({ ...prev, accountSid: e.target.value }))}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              disabled={!canManage}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Auth Token <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={formData.authToken}
                onChange={e => setFormData(prev => ({ ...prev, authToken: e.target.value }))}
                placeholder={isConnected ? '(unchanged)' : 'Enter your auth token'}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                disabled={!canManage}
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {isConnected && (
              <p className="text-xs text-gray-500 mt-1">Leave blank to keep existing token</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subaccount SID (Optional)
            </label>
            <input
              type="text"
              value={formData.subaccountSid}
              onChange={e => setFormData(prev => ({ ...prev, subaccountSid: e.target.value }))}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              disabled={!canManage}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Friendly Name (Optional)
            </label>
            <input
              type="text"
              value={formData.friendlyName}
              onChange={e => setFormData(prev => ({ ...prev, friendlyName: e.target.value }))}
              placeholder="My Twilio Account"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              disabled={!canManage}
            />
          </div>

          {canManage && (
            <div className="flex items-center justify-between pt-4">
              <button
                type="submit"
                disabled={saving || (!formData.accountSid || (!isConnected && !formData.authToken))}
                className="px-4 py-2 bg-sky-600 text-white font-medium rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Connecting...' : isConnected ? 'Update Connection' : 'Connect Twilio'}
              </button>

              {isConnected && (
                <button
                  type="button"
                  onClick={() => setShowDisconnectModal(true)}
                  className="px-4 py-2 text-red-600 font-medium rounded-lg hover:bg-red-50"
                >
                  Disconnect
                </button>
              )}
            </div>
          )}
        </form>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
          <div>
            <h4 className="font-medium text-amber-800">Security Notice</h4>
            <p className="text-sm text-amber-700 mt-1">
              Your Auth Token is encrypted before storage and never exposed after saving.
              Keep your Twilio credentials secure and rotate them periodically.
            </p>
          </div>
        </div>
      </div>

      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <Unlink className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Disconnect Twilio?</h3>
            </div>
            <p className="text-gray-600 mb-6">
              This will disable all SMS and Voice functionality across the entire system.
              Conversations, workflows, and AI agents will no longer be able to send messages or make calls.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDisconnectModal(false)}
                className="px-4 py-2 text-gray-700 font-medium rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
