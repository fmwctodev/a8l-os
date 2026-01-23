import { useState, useEffect } from 'react';
import {
  RefreshCw,
  MessageSquare,
  Plus,
  Link2,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Trash2,
  Users,
  X
} from 'lucide-react';
import {
  getMessagingServices,
  syncMessagingServices,
  createMessagingService,
  linkService,
  setDefaultService,
  getServiceSenders,
  addSender,
  removeSender,
  deleteService
} from '../../../services/phoneMessaging';
import { getNumbers } from '../../../services/phoneNumbers';
import { getPhoneSettings, updatePhoneSettings } from '../../../services/phoneSettings';
import type { MessagingService, MessagingServiceSender } from '../../../services/phoneMessaging';
import type { TwilioNumber } from '../../../services/phoneNumbers';
import { usePermission } from '../../../hooks/usePermission';

export default function MessagingTab() {
  const [services, setServices] = useState<MessagingService[]>([]);
  const [numbers, setNumbers] = useState<TwilioNumber[]>([]);
  const [smsMode, setSmsMode] = useState<'number' | 'messaging_service'>('number');
  const [defaultNumberId, setDefaultNumberId] = useState<string>('');
  const [defaultServiceId, setDefaultServiceId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showSendersModal, setShowSendersModal] = useState<string | null>(null);
  const [senders, setSenders] = useState<MessagingServiceSender[]>([]);
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [linkForm, setLinkForm] = useState({ serviceSid: '', name: '' });

  const canManage = usePermission('phone.settings.manage');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [servicesData, numbersData, settingsData] = await Promise.all([
        getMessagingServices(),
        getNumbers(),
        getPhoneSettings()
      ]);
      setServices(servicesData);
      setNumbers(numbersData.filter(n => n.capabilities.sms && n.status === 'active'));
      if (settingsData.settings) {
        setSmsMode(settingsData.settings.default_sms_mode);
        setDefaultNumberId(settingsData.settings.default_sms_number_id || '');
        setDefaultServiceId(settingsData.settings.default_messaging_service_id || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMode = async () => {
    try {
      setSaving(true);
      setError(null);
      await updatePhoneSettings({
        defaultSmsMode: smsMode,
        defaultSmsNumberId: smsMode === 'number' ? defaultNumberId || null : null,
        defaultMessagingServiceId: smsMode === 'messaging_service' ? defaultServiceId || null : null,
      });
      setSuccess('SMS settings saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      const result = await syncMessagingServices();
      setServices(result.services);
      setSuccess(`Synced ${result.count} messaging service${result.count !== 1 ? 's' : ''}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync services');
    } finally {
      setSyncing(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.name) return;
    try {
      setError(null);
      const service = await createMessagingService(createForm.name, createForm.description);
      setServices([...services, service]);
      setShowCreateModal(false);
      setCreateForm({ name: '', description: '' });
      setSuccess('Messaging service created');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create service');
    }
  };

  const handleLink = async () => {
    if (!linkForm.serviceSid) return;
    try {
      setError(null);
      const service = await linkService(linkForm.serviceSid, linkForm.name);
      setServices([...services, service]);
      setShowLinkModal(false);
      setLinkForm({ serviceSid: '', name: '' });
      setSuccess('Messaging service linked');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link service');
    }
  };

  const handleSetDefault = async (serviceId: string) => {
    try {
      setError(null);
      setOpenMenu(null);
      await setDefaultService(serviceId);
      await loadData();
      setSuccess('Default service updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default');
    }
  };

  const handleDelete = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this messaging service?')) return;
    try {
      setError(null);
      setOpenMenu(null);
      await deleteService(serviceId);
      setServices(services.filter(s => s.id !== serviceId));
      setSuccess('Messaging service deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete service');
    }
  };

  const handleViewSenders = async (serviceId: string) => {
    try {
      setOpenMenu(null);
      const data = await getServiceSenders(serviceId);
      setSenders(data);
      setShowSendersModal(serviceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load senders');
    }
  };

  const handleAddSender = async (numberId: string) => {
    if (!showSendersModal) return;
    try {
      await addSender(showSendersModal, numberId);
      const data = await getServiceSenders(showSendersModal);
      setSenders(data);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add sender');
    }
  };

  const handleRemoveSender = async (numberId: string) => {
    if (!showSendersModal) return;
    try {
      await removeSender(showSendersModal, numberId);
      const data = await getServiceSenders(showSendersModal);
      setSenders(data);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove sender');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  const senderNumberIds = senders.map(s => s.number_id);
  const availableNumbers = numbers.filter(n => !senderNumberIds.includes(n.id));

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

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-medium text-gray-900 mb-4">Default SMS Mode</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={smsMode === 'number'}
                onChange={() => setSmsMode('number')}
                disabled={!canManage}
                className="w-4 h-4 text-sky-600 focus:ring-sky-500"
              />
              <span className="text-sm text-gray-700">Single Number</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={smsMode === 'messaging_service'}
                onChange={() => setSmsMode('messaging_service')}
                disabled={!canManage}
                className="w-4 h-4 text-sky-600 focus:ring-sky-500"
              />
              <span className="text-sm text-gray-700">Messaging Service</span>
            </label>
          </div>

          {smsMode === 'number' && (
            <select
              value={defaultNumberId}
              onChange={e => setDefaultNumberId(e.target.value)}
              disabled={!canManage}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Select a number</option>
              {numbers.map(n => (
                <option key={n.id} value={n.id}>
                  {n.phone_number} {n.friendly_name ? `(${n.friendly_name})` : ''}
                </option>
              ))}
            </select>
          )}

          {smsMode === 'messaging_service' && (
            <select
              value={defaultServiceId}
              onChange={e => setDefaultServiceId(e.target.value)}
              disabled={!canManage}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Select a service</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.sender_count || 0} senders)
                </option>
              ))}
            </select>
          )}

          {canManage && (
            <button
              onClick={handleSaveMode}
              disabled={saving}
              className="px-4 py-2 bg-sky-600 text-white font-medium rounded-lg hover:bg-sky-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Messaging Services</h3>
          {canManage && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                Sync
              </button>
              <button
                onClick={() => setShowLinkModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Link2 className="w-4 h-4" />
                Link Existing
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-sky-600 rounded-lg hover:bg-sky-700"
              >
                <Plus className="w-4 h-4" />
                Create New
              </button>
            </div>
          )}
        </div>

        {services.length === 0 ? (
          <div className="p-12 text-center">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No messaging services configured</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service SID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Senders</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Default</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {services.map(service => (
                <tr key={service.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                    {service.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                    {service.service_sid.slice(0, 20)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {service.sender_count || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      service.status === 'active'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {service.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {service.is_default ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {canManage && (
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenu(openMenu === service.id ? null : service.id)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <MoreVertical className="w-5 h-5 text-gray-400" />
                        </button>
                        {openMenu === service.id && (
                          <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                            <button
                              onClick={() => handleViewSenders(service.id)}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Users className="w-4 h-4" />
                              Manage Senders
                            </button>
                            {!service.is_default && (
                              <button
                                onClick={() => handleSetDefault(service.id)}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                Set as Default
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(service.id)}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Create Messaging Service</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={e => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  placeholder="My Messaging Service"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={createForm.description}
                  onChange={e => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  placeholder="Description"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 font-medium rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!createForm.name}
                className="px-4 py-2 bg-sky-600 text-white font-medium rounded-lg hover:bg-sky-700 disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Link Existing Service</h3>
              <button onClick={() => setShowLinkModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service SID</label>
                <input
                  type="text"
                  value={linkForm.serviceSid}
                  onChange={e => setLinkForm(prev => ({ ...prev, serviceSid: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (optional)</label>
                <input
                  type="text"
                  value={linkForm.name}
                  onChange={e => setLinkForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  placeholder="Display name"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowLinkModal(false)}
                className="px-4 py-2 text-gray-700 font-medium rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleLink}
                disabled={!linkForm.serviceSid}
                className="px-4 py-2 bg-sky-600 text-white font-medium rounded-lg hover:bg-sky-700 disabled:opacity-50"
              >
                Link
              </button>
            </div>
          </div>
        </div>
      )}

      {showSendersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Manage Senders</h3>
              <button onClick={() => setShowSendersModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              {senders.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No senders assigned</p>
              ) : (
                <div className="space-y-2">
                  {senders.map(sender => (
                    <div key={sender.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-900">
                        {sender.number?.phone_number}
                      </span>
                      <button
                        onClick={() => handleRemoveSender(sender.number_id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {availableNumbers.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Add Sender</label>
                  <select
                    onChange={e => e.target.value && handleAddSender(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                    value=""
                  >
                    <option value="">Select a number</option>
                    {availableNumbers.map(n => (
                      <option key={n.id} value={n.id}>{n.phone_number}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowSendersModal(null)}
                className="px-4 py-2 text-gray-700 font-medium rounded-lg hover:bg-gray-100"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
