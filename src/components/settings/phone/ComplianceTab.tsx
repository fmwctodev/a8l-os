import { useState, useEffect, useRef } from 'react';
import {
  RefreshCw,
  Shield,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Upload,
  Download,
  Clock,
  AlertCircle
} from 'lucide-react';
import { getPhoneSettings, updatePhoneSettings } from '../../../services/phoneSettings';
import { getDncNumbers, addDncNumber, removeDncNumber, importDncNumbers, exportDncList } from '../../../services/phoneCompliance';
import type { DncNumber, DncListResponse } from '../../../services/phoneCompliance';
import { usePermission } from '../../../hooks/usePermission';

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC'
];

export default function ComplianceTab() {
  const [settings, setSettings] = useState({
    businessName: '',
    optOutLanguage: 'Reply STOP to unsubscribe',
    autoAppendOptOut: false,
    quietHoursEnabled: false,
    quietHoursStart: '21:00',
    quietHoursEnd: '09:00',
    quietHoursTimezone: 'America/New_York',
  });
  const [dncData, setDncData] = useState<DncListResponse>({ numbers: [], total: 0, page: 1, limit: 50 });
  const [newDncNumber, setNewDncNumber] = useState({ phoneNumber: '', reason: '' });
  const [dncSearch, setDncSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canManage = usePermission('phone.compliance.manage');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [settingsData, dncListData] = await Promise.all([
        getPhoneSettings(),
        getDncNumbers({ page: 1, limit: 50, search: dncSearch || undefined })
      ]);
      if (settingsData.settings) {
        setSettings({
          businessName: settingsData.settings.business_name || '',
          optOutLanguage: settingsData.settings.opt_out_language,
          autoAppendOptOut: settingsData.settings.auto_append_opt_out,
          quietHoursEnabled: settingsData.settings.quiet_hours_enabled,
          quietHoursStart: settingsData.settings.quiet_hours_start || '21:00',
          quietHoursEnd: settingsData.settings.quiet_hours_end || '09:00',
          quietHoursTimezone: settingsData.settings.quiet_hours_timezone,
        });
      }
      setDncData(dncListData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await updatePhoneSettings({
        businessName: settings.businessName || null,
        optOutLanguage: settings.optOutLanguage,
        autoAppendOptOut: settings.autoAppendOptOut,
        quietHoursEnabled: settings.quietHoursEnabled,
        quietHoursStart: settings.quietHoursEnabled ? settings.quietHoursStart : null,
        quietHoursEnd: settings.quietHoursEnabled ? settings.quietHoursEnd : null,
        quietHoursTimezone: settings.quietHoursTimezone,
      });
      setSuccess('Compliance settings saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleAddDnc = async () => {
    if (!newDncNumber.phoneNumber) return;
    try {
      setError(null);
      await addDncNumber(newDncNumber.phoneNumber, newDncNumber.reason || undefined);
      setNewDncNumber({ phoneNumber: '', reason: '' });
      await loadDncList();
      setSuccess('Number added to DNC list');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add number');
    }
  };

  const handleRemoveDnc = async (id: string, source: 'manual' | 'contact') => {
    try {
      setError(null);
      await removeDncNumber(id, source);
      await loadDncList();
      setSuccess('Number removed from DNC list');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove number');
    }
  };

  const loadDncList = async () => {
    const data = await getDncNumbers({ page: 1, limit: 50, search: dncSearch || undefined });
    setDncData(data);
  };

  const handleSearchDnc = async () => {
    await loadDncList();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      setError(null);
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      const numbers = lines.slice(1).map(line => {
        const [phoneNumber, reason] = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        return { phoneNumber, reason };
      }).filter(n => n.phoneNumber);

      const result = await importDncNumbers(numbers);
      await loadDncList();
      setSuccess(`Imported ${result.imported} numbers`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import numbers');
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExport = async () => {
    try {
      const csv = await exportDncList();
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dnc-list.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export');
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
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-sky-100 rounded-lg">
              <Shield className="w-5 h-5 text-sky-600" />
            </div>
            <h3 className="font-medium text-gray-900">SMS Compliance</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
              <input
                type="text"
                value={settings.businessName}
                onChange={e => setSettings(prev => ({ ...prev, businessName: e.target.value }))}
                placeholder="Your Business Name"
                disabled={!canManage}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              />
              <p className="text-xs text-gray-500 mt-1">Used in message footers</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Opt-Out Language</label>
              <textarea
                value={settings.optOutLanguage}
                onChange={e => setSettings(prev => ({ ...prev, optOutLanguage: e.target.value }))}
                rows={2}
                disabled={!canManage}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.autoAppendOptOut}
                onChange={e => setSettings(prev => ({ ...prev, autoAppendOptOut: e.target.checked }))}
                disabled={!canManage}
                className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
              />
              <span className="text-sm text-gray-700">Auto-append opt-out to SMS messages</span>
            </label>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="font-medium text-gray-900">Quiet Hours</h3>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.quietHoursEnabled}
                onChange={e => setSettings(prev => ({ ...prev, quietHoursEnabled: e.target.checked }))}
                disabled={!canManage}
                className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
              />
              <span className="text-sm text-gray-700">Enable quiet hours</span>
            </label>

            {settings.quietHoursEnabled && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                    <input
                      type="time"
                      value={settings.quietHoursStart}
                      onChange={e => setSettings(prev => ({ ...prev, quietHoursStart: e.target.value }))}
                      disabled={!canManage}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                    <input
                      type="time"
                      value={settings.quietHoursEnd}
                      onChange={e => setSettings(prev => ({ ...prev, quietHoursEnd: e.target.value }))}
                      disabled={!canManage}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                  <select
                    value={settings.quietHoursTimezone}
                    onChange={e => setSettings(prev => ({ ...prev, quietHoursTimezone: e.target.value }))}
                    disabled={!canManage}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  >
                    {TIMEZONES.map(tz => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                  <p className="text-sm text-amber-700">
                    Messages will be blocked during quiet hours ({settings.quietHoursStart} - {settings.quietHoursEnd} {settings.quietHoursTimezone})
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {canManage && (
        <div className="flex justify-end">
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="px-4 py-2 bg-sky-600 text-white font-medium rounded-lg hover:bg-sky-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Compliance Settings'}
          </button>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">Do Not Call (DNC) List</h3>
            {canManage && (
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleImport}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Upload className="w-4 h-4" />
                  {importing ? 'Importing...' : 'Import CSV'}
                </button>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-500">
            <AlertCircle className="w-4 h-4" />
            <span>Numbers in this list and contacts marked as DNC will be blocked from receiving SMS/calls</span>
          </div>
        </div>

        {canManage && (
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <input
                type="tel"
                value={newDncNumber.phoneNumber}
                onChange={e => setNewDncNumber(prev => ({ ...prev, phoneNumber: e.target.value }))}
                placeholder="+15551234567"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              />
              <input
                type="text"
                value={newDncNumber.reason}
                onChange={e => setNewDncNumber(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Reason (optional)"
                className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              />
              <button
                onClick={handleAddDnc}
                disabled={!newDncNumber.phoneNumber}
                className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white font-medium rounded-lg hover:bg-sky-700 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>
        )}

        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={dncSearch}
              onChange={e => setDncSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearchDnc()}
              placeholder="Search phone numbers..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
            />
            <button
              onClick={handleSearchDnc}
              className="px-4 py-2 text-gray-700 font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Search
            </button>
          </div>
        </div>

        {dncData.numbers.length === 0 ? (
          <div className="p-12 text-center">
            <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No numbers in DNC list</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {dncData.numbers.map(dnc => (
                <tr key={`${dnc.source}-${dnc.id}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                    {dnc.phoneNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {dnc.reason || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      dnc.source === 'manual'
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-sky-100 text-sky-800'
                    }`}>
                      {dnc.source === 'manual' ? 'Manual' : 'Contact'}
                    </span>
                    {dnc.contactName && (
                      <span className="ml-2 text-sm text-gray-500">{dnc.contactName}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {canManage && (
                      <button
                        onClick={() => handleRemoveDnc(dnc.id, dnc.source)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {dncData.total > dncData.limit && (
          <div className="p-4 border-t border-gray-200 text-center text-sm text-gray-500">
            Showing {dncData.numbers.length} of {dncData.total} numbers
          </div>
        )}
      </div>
    </div>
  );
}
