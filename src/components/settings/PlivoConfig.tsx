import { useState, useEffect, useCallback } from 'react';
import {
  Eye, EyeOff, Copy, Check, AlertCircle, Loader2,
  Phone, MessageSquare, RefreshCw, User as UserIcon, Bot, Trash2,
  ChevronDown, ChevronRight, Wifi, WifiOff,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  connectPlivo, disconnectPlivo, getConnection, testConnection,
  setVapiSipCredentials, type PlivoConnection,
} from '../../services/plivoConnection';
import {
  getNumbers, syncNumbers, updateAssignment, deleteNumber, configureWebhooksForNumber,
  type PlivoNumber, type PlivoSmsRoute,
} from '../../services/plivoNumbers';

interface UserOption { id: string; name: string; email: string; }
interface VapiAssistantOption { id: string; name: string; slug: string; }

const inputClass =
  'w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-white ' +
  'placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent';
const selectClass =
  'w-full px-2 py-1.5 text-xs rounded bg-slate-800 border border-slate-700 text-white ' +
  'focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent ' +
  'disabled:opacity-50 disabled:bg-slate-900 disabled:text-slate-500';
const cardClass = 'bg-slate-900 rounded-xl border border-slate-800';
const labelClass = 'block text-xs font-medium text-slate-300 mb-1';
const primaryBtn =
  'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg ' +
  'bg-gradient-to-r from-cyan-500 to-teal-600 text-white ' +
  'hover:from-cyan-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
const subtleBtn =
  'inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg ' +
  'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
const dangerBtn =
  'inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg ' +
  'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 ' +
  'disabled:opacity-50 transition-colors';

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
  const [showWebhookUrls, setShowWebhookUrls] = useState(false);
  const [reconfiguringId, setReconfiguringId] = useState<string | null>(null);

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
      const webhookSummary = r.webhooks_failed > 0
        ? ` · ${r.webhooks_configured} webhook(s) configured, ${r.webhooks_failed} failed`
        : ` · ${r.webhooks_configured} webhook(s) configured`;
      flash(`Synced ${r.added} new + ${r.synced} existing (${r.total} total)${webhookSummary}`,
        r.webhooks_failed > 0 ? 'error' : 'success');
      await load();
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Sync failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReconfigureWebhooks(num: PlivoNumber) {
    setReconfiguringId(num.id);
    try {
      await configureWebhooksForNumber(num.id);
      flash(`Webhooks reconfigured for ${num.phone_number}`);
      await load();
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Reconfigure failed', 'error');
    } finally {
      setReconfiguringId(null);
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
        <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle size={16} className="flex-shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
          <Check size={16} className="flex-shrink-0" /> {success}
        </div>
      )}

      {/* Connection */}
      <div className={cardClass}>
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-lg font-semibold text-white">Connection</h3>
        </div>
        <div className="p-4 space-y-3">
          {connection?.status === 'connected' ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full text-xs font-medium">
                  <Check size={12} /> Connected
                </span>
                <span className="text-slate-200">{connection.friendlyName || connection.authId}</span>
                {connection.connectedAt && (
                  <span className="text-xs text-slate-500">
                    · since {new Date(connection.connectedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={handleTest} disabled={submitting} className={subtleBtn}>
                  Test
                </button>
                <button onClick={handleDisconnect} disabled={submitting} className={dangerBtn}>
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Auth ID</label>
                <input type="text" value={authId} onChange={e => setAuthId(e.target.value)}
                  placeholder="MAxxxxxxxxxxxxxxxxxx" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Auth Token</label>
                <div className="relative">
                  <input type={showToken ? 'text' : 'password'} value={authToken} onChange={e => setAuthToken(e.target.value)}
                    className={`${inputClass} pr-10`} />
                  <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                    {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Friendly Name (optional)</label>
                <input type="text" value={friendlyName} onChange={e => setFriendlyName(e.target.value)}
                  placeholder="My Plivo Account" className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <button onClick={handleConnect} disabled={submitting || !authId.trim() || !authToken.trim()}
                  className={primaryBtn}>
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  Connect Plivo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Vapi SIP credentials */}
      {connection?.status === 'connected' && (
        <div className={cardClass}>
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-lg font-semibold text-white">Vapi SIP Trunk Credentials</h3>
            <p className="text-xs text-slate-400 mt-1">
              These let Vapi place outbound calls through Plivo. Create a SIP endpoint in Plivo
              (Voice → SIP Endpoints) and paste the username + password here.
            </p>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>SIP Username</label>
                <input type="text" value={sipUsername} onChange={e => setSipUsername(e.target.value)}
                  className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>SIP Password</label>
                <div className="relative">
                  <input type={showSipPassword ? 'text' : 'password'} value={sipPassword} onChange={e => setSipPassword(e.target.value)}
                    placeholder={connection.vapiSipUsername ? 'Re-enter to update' : ''}
                    className={`${inputClass} pr-10`} />
                  <button type="button" onClick={() => setShowSipPassword(!showSipPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                    {showSipPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
            <button onClick={handleSaveSip} disabled={submitting || !sipUsername.trim() || !sipPassword.trim()}
              className={subtleBtn}>
              Save SIP Credentials
            </button>
          </div>
        </div>
      )}

      {/* Numbers + assignments */}
      {connection?.status === 'connected' && (
        <div className={`${cardClass} overflow-hidden`}>
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Phone Numbers</h3>
              <p className="text-xs text-slate-400 mt-0.5">{numbers.length} synced from Plivo</p>
            </div>
            <button onClick={handleSync} disabled={submitting} className={primaryBtn}>
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Sync from Plivo
            </button>
          </div>

          {numbers.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              No numbers yet. Click <strong className="text-slate-200">Sync from Plivo</strong> to import your rented numbers.
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {numbers.map(num => (
                <div key={num.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">{num.phone_number}</div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                        {num.capabilities.sms && <span className="inline-flex items-center gap-1"><MessageSquare size={11} /> SMS</span>}
                        {num.capabilities.mms && <span className="inline-flex items-center gap-1"><MessageSquare size={11} /> MMS</span>}
                        {num.capabilities.voice && <span className="inline-flex items-center gap-1"><Phone size={11} /> Voice</span>}
                        {num.country_code && <span>· {num.country_code}</span>}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide font-medium ${
                          num.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-500 border border-slate-700'
                        }`}>
                          {num.status}
                        </span>
                        {num.webhook_configured ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" title="Webhooks point at our edge functions">
                            <Wifi size={11} /> Webhooks configured
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30" title="Webhook URLs are not yet configured on this number">
                            <WifiOff size={11} /> Webhooks pending
                            <button
                              onClick={() => handleReconfigureWebhooks(num)}
                              disabled={reconfiguringId === num.id}
                              className="underline hover:no-underline disabled:opacity-50"
                            >
                              {reconfiguringId === num.id ? 'Configuring…' : 'Configure now'}
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => handleDelete(num)} disabled={submitting}
                      className="p-1.5 text-slate-500 hover:text-red-400 rounded transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* SMS routing */}
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-2">
                        <MessageSquare size={12} /> SMS routing
                      </div>
                      <select value={num.sms_route} disabled={submitting}
                        onChange={e => handleAssignmentChange(num, { smsRoute: e.target.value as PlivoSmsRoute })}
                        className={selectClass}>
                        <option value="clara">Clara (auto-reply)</option>
                        <option value="user">User inbox</option>
                      </select>
                      {num.sms_route === 'user' && (
                        <select value={num.assigned_user_id || ''} disabled={submitting}
                          onChange={e => handleAssignmentChange(num, { smsRoute: 'user', assignedUserId: e.target.value || null })}
                          className={`${selectClass} mt-2`}>
                          <option value="">Choose a user…</option>
                          {users.map(u => (
                            <option key={u.id} value={u.id}>{u.name || u.email}</option>
                          ))}
                        </select>
                      )}
                      {num.sms_route === 'user' && num.assigned_user && (
                        <div className="text-[10px] text-slate-500 mt-1.5 inline-flex items-center gap-1">
                          <UserIcon size={10} /> Owned by {num.assigned_user.name}
                        </div>
                      )}
                    </div>

                    {/* Voice routing */}
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-2">
                        <Phone size={12} /> Voice routing (Vapi)
                      </div>
                      <select value={num.vapi_assistant_id || ''} disabled={submitting || !num.capabilities.voice}
                        onChange={e => handleAssignmentChange(num, { vapiAssistantId: e.target.value || null })}
                        className={selectClass}>
                        <option value="">No assistant (caller hears voicemail message)</option>
                        {assistants.map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                      {num.vapi_assistant && (
                        <div className="text-[10px] text-slate-500 mt-1.5 inline-flex items-center gap-1">
                          <Bot size={10} /> Calls forward to {num.vapi_assistant.name}
                        </div>
                      )}
                      {!num.capabilities.voice && (
                        <div className="text-[10px] text-amber-400 mt-1.5">This number is not voice-capable in Plivo.</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Webhook URLs — auto-configured on sync; collapsed by default */}
      {connection?.status === 'connected' && (
        <div className={cardClass}>
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Check size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-white">Webhooks auto-configured on sync</h3>
                <p className="text-xs text-slate-400 mt-1">
                  When you click <strong className="text-slate-200">Sync from Plivo</strong>, each number is automatically
                  pointed at our edge functions via a Plivo Application named{' '}
                  <code className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">Autom8ion Lab Webhooks</code>.
                  You don't need to set anything in the Plivo console.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowWebhookUrls(!showWebhookUrls)}
              className="text-xs text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
            >
              {showWebhookUrls ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {showWebhookUrls ? 'Hide URLs' : 'Show URLs (advanced / fallback)'}
            </button>
            {showWebhookUrls && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                {[
                  { label: 'Inbound SMS', path: '/plivo-sms-inbound', key: 'sms' },
                  { label: 'SMS Status Callback', path: '/plivo-sms-status', key: 'sms-status' },
                  { label: 'Inbound Voice (Answer URL)', path: '/plivo-voice-answer', key: 'voice' },
                  { label: 'Voice Status / Hangup Callback', path: '/plivo-voice-status', key: 'voice-status' },
                ].map(w => (
                  <div key={w.key}>
                    <label className="block text-xs font-medium text-slate-400 mb-1">{w.label}</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 overflow-x-auto">
                        {webhookBaseUrl}{w.path}
                      </code>
                      <button onClick={() => copy(`${webhookBaseUrl}${w.path}`, w.key)}
                        className="p-2 text-slate-400 hover:text-slate-200 rounded transition-colors">
                        {copied === w.key ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
