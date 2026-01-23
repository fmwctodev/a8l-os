import { useState, useEffect } from 'react';
import { RefreshCw, Mic, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { getPhoneSettings, updatePhoneSettings } from '../../../services/phoneSettings';
import { usePermission } from '../../../hooks/usePermission';

export default function RecordingTab() {
  const [settings, setSettings] = useState({
    recordInboundCalls: false,
    recordOutboundCalls: false,
    recordVoicemail: true,
    recordingRetentionDays: 90,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canManage = usePermission('phone.settings.manage');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await getPhoneSettings();
      if (data.settings) {
        setSettings({
          recordInboundCalls: data.settings.record_inbound_calls,
          recordOutboundCalls: data.settings.record_outbound_calls,
          recordVoicemail: data.settings.record_voicemail,
          recordingRetentionDays: data.settings.recording_retention_days,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await updatePhoneSettings(settings);
      setSuccess('Recording settings saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

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

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-sky-100 rounded-lg">
            <Mic className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Call Recording</h3>
            <p className="text-sm text-gray-500">Configure automatic call recording</p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Record Inbound Calls</p>
              <p className="text-sm text-gray-500">Automatically record all incoming calls</p>
            </div>
            <input
              type="checkbox"
              checked={settings.recordInboundCalls}
              onChange={e => setSettings(prev => ({ ...prev, recordInboundCalls: e.target.checked }))}
              disabled={!canManage}
              className="w-5 h-5 text-sky-600 rounded focus:ring-sky-500"
            />
          </label>

          <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Record Outbound Calls</p>
              <p className="text-sm text-gray-500">Automatically record all outgoing calls</p>
            </div>
            <input
              type="checkbox"
              checked={settings.recordOutboundCalls}
              onChange={e => setSettings(prev => ({ ...prev, recordOutboundCalls: e.target.checked }))}
              disabled={!canManage}
              className="w-5 h-5 text-sky-600 rounded focus:ring-sky-500"
            />
          </label>

          <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Record Voicemail</p>
              <p className="text-sm text-gray-500">Save voicemail recordings</p>
            </div>
            <input
              type="checkbox"
              checked={settings.recordVoicemail}
              onChange={e => setSettings(prev => ({ ...prev, recordVoicemail: e.target.checked }))}
              disabled={!canManage}
              className="w-5 h-5 text-sky-600 rounded focus:ring-sky-500"
            />
          </label>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-medium text-gray-900 mb-4">Retention Policy</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Recording Retention (days)
          </label>
          <input
            type="number"
            value={settings.recordingRetentionDays}
            onChange={e => setSettings(prev => ({ ...prev, recordingRetentionDays: parseInt(e.target.value) || 90 }))}
            min={30}
            max={365}
            disabled={!canManage}
            className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
          />
          <p className="text-sm text-gray-500 mt-1">
            Recordings are stored as Twilio URL references and will be available for this duration
          </p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
          <div>
            <h4 className="font-medium text-amber-800">Compliance Notice</h4>
            <p className="text-sm text-amber-700 mt-1">
              Call recording may require consent from all parties depending on your jurisdiction.
              Ensure you comply with local laws and regulations regarding call recording disclosure.
            </p>
            <ul className="text-sm text-amber-700 mt-2 list-disc list-inside">
              <li>Many US states require two-party consent</li>
              <li>Inform callers that calls may be recorded</li>
              <li>Consider adding a recording disclosure to your IVR</li>
            </ul>
          </div>
        </div>
      </div>

      {canManage && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-sky-600 text-white font-medium rounded-lg hover:bg-sky-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      )}
    </div>
  );
}
