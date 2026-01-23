import { useState, useEffect } from 'react';
import {
  RefreshCw,
  Phone,
  MessageSquare,
  PhoneCall,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Hash,
  Building2
} from 'lucide-react';
import { getNumbers, syncNumbers, enableNumber, disableNumber, setDefaultSms, setDefaultVoice, assignDepartment } from '../../../services/phoneNumbers';
import type { TwilioNumber } from '../../../services/phoneNumbers';
import { usePermission } from '../../../hooks/usePermission';
import { supabase } from '../../../lib/supabase';

export default function NumbersTab() {
  const [numbers, setNumbers] = useState<TwilioNumber[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const canManage = usePermission('phone.numbers.manage');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [numbersData, { data: depts }] = await Promise.all([
        getNumbers(),
        supabase.from('departments').select('id, name').eq('status', 'active').order('name')
      ]);
      setNumbers(numbersData);
      setDepartments(depts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load numbers');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      const result = await syncNumbers();
      setNumbers(result.numbers);
      setSuccess(`Synced ${result.count} phone number${result.count !== 1 ? 's' : ''}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync numbers');
    } finally {
      setSyncing(false);
    }
  };

  const handleAction = async (action: string, numberId: string, value?: string) => {
    try {
      setError(null);
      setOpenMenu(null);
      switch (action) {
        case 'enable':
          await enableNumber(numberId);
          break;
        case 'disable':
          await disableNumber(numberId);
          break;
        case 'set-default-sms':
          await setDefaultSms(numberId);
          break;
        case 'set-default-voice':
          await setDefaultVoice(numberId);
          break;
        case 'assign-department':
          await assignDepartment(numberId, value || null);
          break;
      }
      await loadData();
      setSuccess('Updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
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

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900">Phone Numbers</h3>
          <p className="text-sm text-gray-500">Manage your Twilio phone numbers</p>
        </div>
        {canManage && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white font-medium rounded-lg hover:bg-sky-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync from Twilio'}
          </button>
        )}
      </div>

      {numbers.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <Hash className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Phone Numbers</h3>
          <p className="text-gray-500 mb-4">
            Sync your Twilio phone numbers to get started
          </p>
          {canManage && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-4 py-2 bg-sky-600 text-white font-medium rounded-lg hover:bg-sky-700"
            >
              Sync Numbers
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Capabilities
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Default For
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Webhook
                </th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {numbers.map(number => (
                <tr key={number.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900">{number.phone_number}</span>
                    </div>
                    {number.friendly_name && (
                      <p className="text-sm text-gray-500 mt-0.5">{number.friendly_name}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {number.capabilities.sms && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-sky-100 text-sky-700 text-xs font-medium rounded">
                          <MessageSquare className="w-3 h-3" />
                          SMS
                        </span>
                      )}
                      {number.capabilities.mms && (
                        <span className="inline-flex items-center px-2 py-1 bg-sky-100 text-sky-700 text-xs font-medium rounded">
                          MMS
                        </span>
                      )}
                      {number.capabilities.voice && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">
                          <PhoneCall className="w-3 h-3" />
                          Voice
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      number.status === 'active'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {number.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {canManage ? (
                      <select
                        value={number.department_id || ''}
                        onChange={e => handleAction('assign-department', number.id, e.target.value)}
                        className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="">No department</option>
                        {departments.map(dept => (
                          <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-sm text-gray-600">
                        {number.department?.name || '-'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {number.is_default_sms && (
                        <span className="inline-flex items-center px-2 py-1 bg-sky-100 text-sky-700 text-xs font-medium rounded">
                          SMS
                        </span>
                      )}
                      {number.is_default_voice && (
                        <span className="inline-flex items-center px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">
                          Voice
                        </span>
                      )}
                      {!number.is_default_sms && !number.is_default_voice && (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {number.webhook_configured ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-300" />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {canManage && (
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenu(openMenu === number.id ? null : number.id)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <MoreVertical className="w-5 h-5 text-gray-400" />
                        </button>
                        {openMenu === number.id && (
                          <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                            {!number.is_default_sms && number.capabilities.sms && (
                              <button
                                onClick={() => handleAction('set-default-sms', number.id)}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                Set as Default SMS
                              </button>
                            )}
                            {!number.is_default_voice && number.capabilities.voice && (
                              <button
                                onClick={() => handleAction('set-default-voice', number.id)}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                Set as Default Voice
                              </button>
                            )}
                            {number.status === 'active' ? (
                              <button
                                onClick={() => handleAction('disable', number.id)}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                Disable
                              </button>
                            ) : (
                              <button
                                onClick={() => handleAction('enable', number.id)}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                Enable
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
