import { useState, useEffect, useCallback } from 'react';
import {
  Eye, EyeOff, Copy, Check, AlertCircle, Loader2,
  Phone, MessageSquare, RefreshCw, User as UserIcon, Bot, Trash2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  connectPlivo, disconnectPlivo, getConnection, testConnection,
  setVapiSipCredentials, type PlivoConnection,
} from '../../services/plivoConnection';
import {
  getNumbers, syncNumbers, updateAssignment, deleteNumber,
  type PlivoNumber, type PlivoSmsRoute,
} from '../../services/plivoNumbers';

interface UserOption { id: string; name: string; email: string; }
interface VapiAssistantOption { id: string; name: string; slug: string; }

export function PlivoConfig() {
  const { user } = useAuth();
  const orgId = user?.organization_id;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [connection, setConnection] = useState<PlivoConnection | null>(null);
  const [authId, setAuthId] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [friendlyName, setFriendlyName] = useState('');

  const [numbers, setNumbers] = useState<PlivoNumber[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [assistants, setAssistants] = useState<VapiAssistantOption[]>([]);

  const [sipUsername, setSipUsername] = useState('');
  const [sipPassword, setSipPassword] = useState('');
  const [showSipPassword, setShowSipPassword] = useState(false);

  const webhookBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [conn, nums, usersData, assistantsData] = await Promise.all([
        getConnection().catch(() => null),
        getNumbers().catch(() => []),
        supabase.from('users').select('id, name, email').eq('organization_id', orgId).order('name'),
        supabase.from('vapi_assistants').select('id, name, slug').eq('org_id', orgId).order('name'),
      ]);
      setConnection(conn);
      setNumbers(nums);
      setUsers((usersData.data as UserOption[]) || []);
      setAssistants((assistantsData.data as VapiAssistantOption[]) || []);
      if (conn?.vapiSipUsername) setSipUsername(conn.vapiSipUsername);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  function flash(msg: string, kind: 'success' | 'error' = 'success') {
    if (kind === 'success') {
      setSuccess(msg);
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(msg);
      setTimeout(() => setError(null), 5000);
    }
  }

  async function handleConnect() {
    if (!authId.trim() || !authToken.trim()) return;
    setSubmitting(true); setError(null);
    try {
      const conn = await connectPlivo({
        authId: authId.trim(),
        authToken: authToken.trim(),
        friendlyName: friendlyName.trim() || undefined,
      });
      setConnection(conn);
      setAuthToken('');
      flash('Plivo connected');
      await load();
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Connection failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect Plivo? Inbound SMS and calls will stop being received until you reconnect.')) return;
    setSubmitting(true);
    try {
      await disconnectPlivo();
      setConnection(null);
      setNumbers([]);
      flash('Plivo disconnected');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Disconnect failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTest() {
    setSubmitting(true);
    try {
      const r = await testConnection();
      flash(r.success ? 'Plivo credentials valid' : 'Plivo test failed', r.success ? 'success' : 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSync() {
    setSubmitting(true);
    try {
      const r = await syncNumbers();
      flash(`Synced ${r.added} new + ${r.synced} existing (${r.total} total)`);
      await load();
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Sync failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveSip() {
    if (!sipUsername.trim() || !sipPassword.trim()) return;
    setSubmitting(true);
    try {
      await setVapiSipCredentials({ sipUsername: sipUsername.trim(), sipPassword: sipPassword.trim() });
      setSipPassword('');
      flash('SIP credentials saved (Vapi will use these for outbound calls)');
      await load();
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Save failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssignmentChange(num: PlivoNumber, patch: {
    smsRoute?: PlivoSmsRoute; assignedUserId?: string | null; vapiAssistantId?: string | null;
  }) {
    setSubmitting(true);
    try {
      const updated = await updateAssignment({ numberId: num.id, ...patch });
      setNumbers(prev => prev.map(n => n.id === num.id ? { ...n, ...updated } : n));
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Update failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(num: PlivoNumber) {
    if (!confirm(`Disable ${num.phone_number}? You can re-enable by re-syncing from Plivo.`)) return;
    setSubmitting(true);
    try {
      await deleteNumber(num.id);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Plivo Configuration</h3>
        <p className="text-sm text-gray-500">
          Connect your Plivo account, sync numbers, then route SMS to Clara or to a user inbox,
          and bind voice numbers 1:1 to Vapi assistants.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 text-sm">
          <Check size={16} /> {success}
        </div>
      )}

      {/* Connection */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-medium text-gray-900">Connection</h4>
        {connection?.status === 'connected' ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-xs font-medium">
                <Check size={12} /> Connected
              </span>
              <span className="text-gray-700">{connection.friendlyName || connection.authId}</span>
              {connection.connectedAt && (
                <span className="text-xs text-gray-400">
                  · since {new Date(connection.connectedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={handleTest} disabled={submitting} className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50">
                Test
              </button>
              <button onClick={handleDisconnect} disabled={submitting} className="px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50">
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Auth ID</label>
              <input type="text" value={authId} onChange={e => setAuthId(e.target.value)}
                placeholder="MAxxxxxxxxxxxxxxxxxx"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Auth Token</label>
              <div className="relative">
                <input type={showToken ? 'text' : 'password'} value={authToken} onChange={e => setAuthToken(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Friendly Name (optional)</label>
              <input type="text" value={friendlyName} onChange={e => setFriendlyName(e.target.value)}
                placeholder="My Plivo Account"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="sm:col-span-2">
              <button onClick={handleConnect} disabled={submitting || !authId.trim() || !authToken.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2">
                {submitting && <Loader2 size={16} className="animate-spin" />}
                Connect Plivo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Vapi SIP credentials */}
      {connection?.status === 'connected' && (
        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Vapi SIP Trunk Credentials</h4>
            <p className="text-xs text-gray-500 mt-1">
              These let Vapi place outbound calls through Plivo. Create a SIP endpoint in Plivo
              (Voice → SIP Endpoints) and paste the username + password here.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">SIP Username</label>
              <input type="text" value={sipUsername} onChange={e => setSipUsername(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">SIP Password</label>
              <div className="relative">
                <input type={showSipPassword ? 'text' : 'password'} value={sipPassword} onChange={e => setSipPassword(e.target.value)}
                  placeholder={connection.vapiSipUsername ? 'Re-enter to update' : ''}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="button" onClick={() => setShowSipPassword(!showSipPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showSipPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>
          <button onClick={handleSaveSip} disabled={submitting || !sipUsername.trim() || !sipPassword.trim()}
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50">
            Save SIP Credentials
          </button>
        </div>
      )}

      {/* Numbers + assignments */}
      {connection?.status === 'connected' && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Phone Numbers</h4>
              <p className="text-xs text-gray-500 mt-0.5">{numbers.length} synced from Plivo</p>
            </div>
            <button onClick={handleSync} disabled={submitting}
              className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50 inline-flex items-center gap-2">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Sync from Plivo
            </button>
          </div>

          {numbers.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              No numbers yet. Click <strong>Sync from Plivo</strong> to import your rented numbers.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {numbers.map(num => (
                <div key={num.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{num.phone_number}</div>
                      <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3">
                        {num.capabilities.sms && <span className="inline-flex items-center gap-1"><MessageSquare size={11} /> SMS</span>}
                        {num.capabilities.mms && <span className="inline-flex items-center gap-1"><MessageSquare size={11} /> MMS</span>}
                        {num.capabilities.voice && <span className="inline-flex items-center gap-1"><Phone size={11} /> Voice</span>}
                        {num.country_code && <span>· {num.country_code}</span>}
                        <span className={`px-1.5 py-0.5 rounded ${num.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {num.status}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => handleDelete(num)} disabled={submitting}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded">
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* SMS routing */}
                    <div className="border border-gray-100 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-2">
                        <MessageSquare size={12} /> SMS routing
                      </div>
                      <select value={num.sms_route} disabled={submitting}
                        onChange={e => handleAssignmentChange(num, { smsRoute: e.target.value as PlivoSmsRoute })}
                        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded">
                        <option value="clara">Clara (auto-reply)</option>
                        <option value="user">User inbox</option>
                      </select>
                      {num.sms_route === 'user' && (
                        <select value={num.assigned_user_id || ''} disabled={submitting}
                          onChange={e => handleAssignmentChange(num, { smsRoute: 'user', assignedUserId: e.target.value || null })}
                          className="mt-2 w-full px-2 py-1.5 text-xs border border-gray-200 rounded">
                          <option value="">Choose a user…</option>
                          {users.map(u => (
                            <option key={u.id} value={u.id}>{u.name || u.email}</option>
                          ))}
                        </select>
                      )}
                      {num.sms_route === 'user' && num.assigned_user && (
                        <div className="text-[10px] text-gray-500 mt-1 inline-flex items-center gap-1">
                          <UserIcon size={10} /> Owned by {num.assigned_user.name}
                        </div>
                      )}
                    </div>

                    {/* Voice routing */}
                    <div className="border border-gray-100 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-2">
                        <Phone size={12} /> Voice routing (Vapi)
                      </div>
                      <select value={num.vapi_assistant_id || ''} disabled={submitting || !num.capabilities.voice}
                        onChange={e => handleAssignmentChange(num, { vapiAssistantId: e.target.value || null })}
                        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded disabled:bg-gray-50 disabled:text-gray-400">
                        <option value="">No assistant (caller hears voicemail message)</option>
                        {assistants.map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                      {num.vapi_assistant && (
                        <div className="text-[10px] text-gray-500 mt-1 inline-flex items-center gap-1">
                          <Bot size={10} /> Calls forward to {num.vapi_assistant.name}
                        </div>
                      )}
                      {!num.capabilities.voice && (
                        <div className="text-[10px] text-amber-600 mt-1">This number is not voice-capable in Plivo.</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Webhook URLs */}
      {connection?.status === 'connected' && (
        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Webhook URLs</h4>
            <p className="text-xs text-gray-500 mt-1">
              Paste these into your Plivo applications and SIP endpoint config.
            </p>
          </div>

          {[
            { label: 'Inbound SMS', path: '/plivo-sms-inbound', key: 'sms' },
            { label: 'SMS Status Callback', path: '/plivo-sms-status', key: 'sms-status' },
            { label: 'Inbound Voice (Answer URL)', path: '/plivo-voice-answer', key: 'voice' },
            { label: 'Voice Status / Hangup Callback', path: '/plivo-voice-status', key: 'voice-status' },
          ].map(w => (
            <div key={w.key}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{w.label}</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600 overflow-x-auto">
                  {webhookBaseUrl}{w.path}
                </code>
                <button onClick={() => copy(`${webhookBaseUrl}${w.path}`, w.key)}
                  className="p-2 text-gray-400 hover:text-gray-600">
                  {copied === w.key ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
