import { useState, useEffect } from 'react';
import {
  RefreshCw,
  PhoneCall,
  Plus,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Trash2,
  GripVertical,
  X,
  Edit2
} from 'lucide-react';
import {
  getRoutingGroups,
  createRoutingGroup,
  updateRoutingGroup,
  deleteRoutingGroup,
  setDefaultRoutingGroup,
  addDestination,
  removeDestination,
  reorderDestinations
} from '../../../services/phoneRouting';
import { getNumbers } from '../../../services/phoneNumbers';
import { getPhoneSettings, updatePhoneSettings } from '../../../services/phoneSettings';
import type { VoiceRoutingGroup, VoiceRoutingDestination } from '../../../services/phoneRouting';
import type { TwilioNumber } from '../../../services/phoneNumbers';
import { usePermission } from '../../../hooks/usePermission';

export default function VoiceRoutingTab() {
  const [groups, setGroups] = useState<VoiceRoutingGroup[]>([]);
  const [numbers, setNumbers] = useState<TwilioNumber[]>([]);
  const [defaultVoiceNumberId, setDefaultVoiceNumberId] = useState<string>('');
  const [callTimeout, setCallTimeout] = useState(30);
  const [voicemailFallback, setVoicemailFallback] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<VoiceRoutingGroup | null>(null);
  const [groupForm, setGroupForm] = useState({
    name: '',
    strategy: 'simultaneous' as 'simultaneous' | 'sequential',
    ringTimeout: 30,
    fallbackNumber: ''
  });
  const [newDestination, setNewDestination] = useState({ phoneNumber: '', label: '' });

  const canManage = usePermission('phone.routing.manage');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [groupsData, numbersData, settingsData] = await Promise.all([
        getRoutingGroups(),
        getNumbers(),
        getPhoneSettings()
      ]);
      setGroups(groupsData);
      setNumbers(numbersData.filter(n => n.capabilities.voice && n.status === 'active'));
      if (settingsData.settings) {
        setDefaultVoiceNumberId(settingsData.settings.default_voice_number_id || '');
        setCallTimeout(settingsData.settings.call_timeout);
        setVoicemailFallback(settingsData.settings.voicemail_fallback_number || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDefaults = async () => {
    try {
      setSaving(true);
      setError(null);
      await updatePhoneSettings({
        defaultVoiceNumberId: defaultVoiceNumberId || null,
        callTimeout,
        voicemailFallbackNumber: voicemailFallback || null,
      });
      setSuccess('Voice settings saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupForm.name) return;
    try {
      setError(null);
      const group = await createRoutingGroup({
        name: groupForm.name,
        strategy: groupForm.strategy,
        ringTimeout: groupForm.ringTimeout,
        fallbackNumber: groupForm.fallbackNumber || undefined
      });
      setGroups([...groups, group]);
      setShowGroupModal(false);
      resetGroupForm();
      setSuccess('Ring group created');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ring group');
    }
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup || !groupForm.name) return;
    try {
      setError(null);
      const updated = await updateRoutingGroup(editingGroup.id, {
        name: groupForm.name,
        strategy: groupForm.strategy,
        ringTimeout: groupForm.ringTimeout,
        fallbackNumber: groupForm.fallbackNumber || undefined
      });
      setGroups(groups.map(g => g.id === updated.id ? { ...g, ...updated } : g));
      setEditingGroup(null);
      setShowGroupModal(false);
      resetGroupForm();
      setSuccess('Ring group updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update ring group');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this ring group?')) return;
    try {
      setError(null);
      setOpenMenu(null);
      await deleteRoutingGroup(groupId);
      setGroups(groups.filter(g => g.id !== groupId));
      setSuccess('Ring group deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete ring group');
    }
  };

  const handleSetDefaultGroup = async (groupId: string) => {
    try {
      setError(null);
      setOpenMenu(null);
      await setDefaultRoutingGroup(groupId);
      await loadData();
      setSuccess('Default ring group updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default');
    }
  };

  const handleAddDestination = async (groupId: string) => {
    if (!newDestination.phoneNumber) return;
    try {
      setError(null);
      const dest = await addDestination(groupId, newDestination.phoneNumber, newDestination.label || undefined);
      setGroups(groups.map(g => {
        if (g.id === groupId) {
          return { ...g, destinations: [...(g.destinations || []), dest] };
        }
        return g;
      }));
      setNewDestination({ phoneNumber: '', label: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add destination');
    }
  };

  const handleRemoveDestination = async (groupId: string, destId: string) => {
    try {
      setError(null);
      await removeDestination(destId);
      setGroups(groups.map(g => {
        if (g.id === groupId) {
          return { ...g, destinations: (g.destinations || []).filter(d => d.id !== destId) };
        }
        return g;
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove destination');
    }
  };

  const resetGroupForm = () => {
    setGroupForm({
      name: '',
      strategy: 'simultaneous',
      ringTimeout: 30,
      fallbackNumber: ''
    });
  };

  const openEditGroup = (group: VoiceRoutingGroup) => {
    setEditingGroup(group);
    setGroupForm({
      name: group.name,
      strategy: group.strategy,
      ringTimeout: group.ring_timeout,
      fallbackNumber: group.fallback_number || ''
    });
    setShowGroupModal(true);
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

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-medium text-gray-900 mb-4">Default Voice Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Caller ID</label>
            <select
              value={defaultVoiceNumberId}
              onChange={e => setDefaultVoiceNumberId(e.target.value)}
              disabled={!canManage}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Select a number</option>
              {numbers.map(n => (
                <option key={n.id} value={n.id}>
                  {n.phone_number} {n.friendly_name ? `(${n.friendly_name})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Call Timeout (seconds)
            </label>
            <input
              type="number"
              value={callTimeout}
              onChange={e => setCallTimeout(parseInt(e.target.value) || 30)}
              min={15}
              max={120}
              disabled={!canManage}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Voicemail Fallback Number
            </label>
            <input
              type="tel"
              value={voicemailFallback}
              onChange={e => setVoicemailFallback(e.target.value)}
              placeholder="+15551234567"
              disabled={!canManage}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
            />
            <p className="text-xs text-gray-500 mt-1">Calls will be forwarded here if no one answers</p>
          </div>
        </div>
        {canManage && (
          <button
            onClick={handleSaveDefaults}
            disabled={saving}
            className="mt-4 px-4 py-2 bg-sky-600 text-white font-medium rounded-lg hover:bg-sky-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Ring Groups</h3>
          {canManage && (
            <button
              onClick={() => {
                resetGroupForm();
                setEditingGroup(null);
                setShowGroupModal(true);
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-sky-600 rounded-lg hover:bg-sky-700"
            >
              <Plus className="w-4 h-4" />
              Create Ring Group
            </button>
          )}
        </div>

        {groups.length === 0 ? (
          <div className="p-12 text-center">
            <PhoneCall className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No ring groups configured</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {groups.map(group => (
              <div key={group.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">{group.name}</h4>
                      {group.is_default && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {group.strategy === 'simultaneous' ? 'Ring all at once' : 'Ring in sequence'} |
                      {group.ring_timeout}s timeout |
                      {(group.destinations?.length || 0)} destination{group.destinations?.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {canManage && (
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenu(openMenu === group.id ? null : group.id)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-400" />
                      </button>
                      {openMenu === group.id && (
                        <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              openEditGroup(group);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </button>
                          {!group.is_default && (
                            <button
                              onClick={() => handleSetDefaultGroup(group.id)}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              Set as Default
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteGroup(group.id)}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {group.destinations?.map((dest, idx) => (
                    <div key={dest.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <GripVertical className="w-4 h-4 text-gray-300" />
                      <span className="text-sm text-gray-500">{idx + 1}.</span>
                      <span className="font-medium text-gray-900">{dest.phone_number}</span>
                      {dest.label && (
                        <span className="text-sm text-gray-500">({dest.label})</span>
                      )}
                      {canManage && (
                        <button
                          onClick={() => handleRemoveDestination(group.id, dest.id)}
                          className="ml-auto text-gray-400 hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {canManage && (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="tel"
                      value={newDestination.phoneNumber}
                      onChange={e => setNewDestination(prev => ({ ...prev, phoneNumber: e.target.value }))}
                      placeholder="+15551234567"
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                    />
                    <input
                      type="text"
                      value={newDestination.label}
                      onChange={e => setNewDestination(prev => ({ ...prev, label: e.target.value }))}
                      placeholder="Label (optional)"
                      className="w-32 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                    />
                    <button
                      onClick={() => handleAddDestination(group.id)}
                      disabled={!newDestination.phoneNumber}
                      className="px-3 py-1.5 text-sm text-sky-600 font-medium hover:bg-sky-50 rounded-lg disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingGroup ? 'Edit Ring Group' : 'Create Ring Group'}
              </h3>
              <button onClick={() => setShowGroupModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={groupForm.name}
                  onChange={e => setGroupForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  placeholder="Sales Team"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Strategy</label>
                <select
                  value={groupForm.strategy}
                  onChange={e => setGroupForm(prev => ({ ...prev, strategy: e.target.value as 'simultaneous' | 'sequential' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                >
                  <option value="simultaneous">Ring All (Simultaneous)</option>
                  <option value="sequential">Ring in Order (Sequential)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ring Timeout (seconds)</label>
                <input
                  type="number"
                  value={groupForm.ringTimeout}
                  onChange={e => setGroupForm(prev => ({ ...prev, ringTimeout: parseInt(e.target.value) || 30 }))}
                  min={15}
                  max={120}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fallback Number (optional)</label>
                <input
                  type="tel"
                  value={groupForm.fallbackNumber}
                  onChange={e => setGroupForm(prev => ({ ...prev, fallbackNumber: e.target.value }))}
                  placeholder="+15551234567"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowGroupModal(false)}
                className="px-4 py-2 text-gray-700 font-medium rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={editingGroup ? handleUpdateGroup : handleCreateGroup}
                disabled={!groupForm.name}
                className="px-4 py-2 bg-sky-600 text-white font-medium rounded-lg hover:bg-sky-700 disabled:opacity-50"
              >
                {editingGroup ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
