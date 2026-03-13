import { useState, useEffect } from 'react';
import {
  Plus, Phone, MessageSquare, AlertTriangle, MoreVertical,
  Link2, Unlink, Loader2, X,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { listNumbers, createFreeNumber, importTwilioNumber, assignNumber, disableNumber, enableNumber } from '../../../services/vapiNumbers';
import { listAssistants } from '../../../services/vapiAssistants';
import type { VapiBinding } from '../../../services/vapiNumbers';
import type { VapiAssistant } from '../../../services/vapiAssistants';

export function VapiNumbersPage() {
  const { user, hasPermission } = useAuth();
  const canBind = hasPermission('ai_agents.voice.bind_numbers');
  const [numbers, setNumbers] = useState<VapiBinding[]>([]);
  const [assistants, setAssistants] = useState<VapiAssistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState<'free' | 'twilio' | null>(null);
  const [showAssignModal, setShowAssignModal] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [twilioForm, setTwilioForm] = useState({
    twilioAccountSid: '',
    twilioAuthToken: '',
    phoneNumber: '',
    assistantId: '',
    bindingType: 'voice_number' as 'voice_number' | 'sms_number',
  });
  const [freeAssistantId, setFreeAssistantId] = useState('');

  const load = async () => {
    if (!user?.organization_id) return;
    setLoading(true);
    try {
      const [nums, assts] = await Promise.all([
        listNumbers(user.organization_id),
        listAssistants(user.organization_id, { status: 'published' }),
      ]);
      setNumbers(nums);
      setAssistants(assts);
    } catch (e) {
      console.error('Failed to load:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user?.organization_id]);

  const handleCreateFree = async () => {
    if (!user?.organization_id || !user?.id || !freeAssistantId) return;
    setSaving(true);
    try {
      await createFreeNumber(user.organization_id, freeAssistantId, user.id);
      setShowAddModal(null);
      setFreeAssistantId('');
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to create number');
    } finally {
      setSaving(false);
    }
  };

  const handleImportTwilio = async () => {
    if (!user?.organization_id || !user?.id) return;
    setSaving(true);
    try {
      await importTwilioNumber(user.organization_id, twilioForm, user.id);
      setShowAddModal(null);
      setTwilioForm({ twilioAccountSid: '', twilioAuthToken: '', phoneNumber: '', assistantId: '', bindingType: 'voice_number' });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to import number');
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async (bindingId: string, assistantId: string) => {
    try {
      await assignNumber(bindingId, assistantId);
      setShowAssignModal(null);
      await load();
    } catch (e) {
      console.error('Failed to assign:', e);
    }
  };

  const handleToggle = async (binding: VapiBinding) => {
    try {
      if (binding.status === 'active') await disableNumber(binding.id);
      else await enableNumber(binding.id);
      await load();
    } catch (e) {
      console.error('Failed to toggle:', e);
    }
    setMenuOpen(null);
  };

  const getSource = (meta: Record<string, unknown>) => {
    return meta?.source === 'twilio_import' ? 'Twilio Import' : 'Vapi Free';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Phone Numbers</h2>
          <p className="text-sm text-slate-400 mt-0.5">Manage phone numbers for voice calls and SMS</p>
        </div>
        {canBind && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal('free')}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              <Phone className="w-3.5 h-3.5" /> Free US Number
            </button>
            <button
              onClick={() => setShowAddModal('twilio')}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Import Twilio Number
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
        </div>
      ) : numbers.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/50 border border-slate-700 rounded-xl">
          <Phone className="w-10 h-10 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No numbers yet</h3>
          <p className="text-sm text-slate-400 mb-6 max-w-sm mx-auto">
            Add a free US number from Vapi or import a Twilio number for voice and SMS.
          </p>
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Number</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Type</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Assistant</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Source</th>
                <th className="text-right text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {numbers.map(n => (
                <tr key={n.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium text-white">{n.display_name || n.external_binding_id}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-slate-700 text-slate-300 rounded">
                      {n.binding_type === 'sms_number' ? <MessageSquare className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
                      {n.binding_type === 'sms_number' ? 'SMS' : 'Voice'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">
                    {n.assistant?.name || <span className="text-slate-500">Unassigned</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${
                      n.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                    }`}>
                      {n.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{getSource(n.metadata)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={() => setMenuOpen(menuOpen === n.id ? null : n.id)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuOpen === n.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                          <div className="absolute right-0 mt-1 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-1">
                            {canBind && (
                              <button
                                onClick={() => { setShowAssignModal(n.id); setMenuOpen(null); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
                              >
                                <Link2 className="w-3.5 h-3.5" /> Assign
                              </button>
                            )}
                            <button
                              onClick={() => handleToggle(n)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
                            >
                              <Unlink className="w-3.5 h-3.5" /> {n.status === 'active' ? 'Disable' : 'Enable'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal === 'free' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">Get Free US Number</h3>
              <button onClick={() => setShowAddModal(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Assign to Assistant</label>
                <select
                  value={freeAssistantId}
                  onChange={e => setFreeAssistantId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="">Select assistant...</option>
                  {assistants.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-400">Free US numbers support voice only. For SMS, import a 10DLC-approved Twilio number.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-700">
              <button onClick={() => setShowAddModal(null)} className="px-4 py-2 text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg">Cancel</button>
              <button
                onClick={handleCreateFree}
                disabled={saving || !freeAssistantId}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Create Number
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal === 'twilio' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">Import Twilio Number</h3>
              <button onClick={() => setShowAddModal(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Twilio Account SID</label>
                <input
                  type="text" value={twilioForm.twilioAccountSid}
                  onChange={e => setTwilioForm(p => ({ ...p, twilioAccountSid: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="ACxxxxxxxx"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Twilio Auth Token</label>
                <input
                  type="password" value={twilioForm.twilioAuthToken}
                  onChange={e => setTwilioForm(p => ({ ...p, twilioAuthToken: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="Auth token"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Phone Number</label>
                <input
                  type="text" value={twilioForm.phoneNumber}
                  onChange={e => setTwilioForm(p => ({ ...p, phoneNumber: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="+1234567890"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Purpose</label>
                  <select
                    value={twilioForm.bindingType}
                    onChange={e => setTwilioForm(p => ({ ...p, bindingType: e.target.value as 'voice_number' | 'sms_number' }))}
                    className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="voice_number">Voice</option>
                    <option value="sms_number">SMS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Assistant</label>
                  <select
                    value={twilioForm.assistantId}
                    onChange={e => setTwilioForm(p => ({ ...p, assistantId: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="">Select...</option>
                    {assistants.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-700">
              <button onClick={() => setShowAddModal(null)} className="px-4 py-2 text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg">Cancel</button>
              <button
                onClick={handleImportTwilio}
                disabled={saving || !twilioForm.phoneNumber || !twilioForm.twilioAccountSid || !twilioForm.assistantId}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Import Number
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">Assign to Assistant</h3>
              <button onClick={() => setShowAssignModal(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-2">
              {assistants.map(a => (
                <button
                  key={a.id}
                  onClick={() => handleAssign(showAssignModal, a.id)}
                  className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  {a.name}
                </button>
              ))}
              {assistants.length === 0 && (
                <p className="text-sm text-slate-500 py-4 text-center">No published assistants available.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
