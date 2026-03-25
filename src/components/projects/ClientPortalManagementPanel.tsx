import { useState, useEffect, useCallback } from 'react';
import {
  Link2,
  Copy,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  ExternalLink,
  Plus,
  Calendar,
  EyeOff,
  Shield,
  Monitor,
  Trash2,
  ChevronDown,
  ChevronUp,
  History,
} from 'lucide-react';
import {
  createPortal,
  getPortalsByProject,
  revokePortal,
  extendPortalExpiration,
  regeneratePortalToken,
  buildPortalUrl,
  getPortalEvents,
} from '../../services/projectClientPortals';
import type { ClientPortalWithProject, PortalEvent } from '../../services/projectClientPortals';
import {
  listSessions,
  revokeSession,
  revokeAllSessions,
  type PortalSession,
} from '../../services/portalAuth';

interface Props {
  projectId: string;
  orgId: string;
  contactId?: string | null;
  currentUserId: string;
  canManage: boolean;
}

function PortalStatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; classes: string }> = {
    active: { label: 'Active', classes: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
    revoked: { label: 'Revoked', classes: 'bg-red-500/20 text-red-400 border border-red-500/30' },
    expired: { label: 'Expired', classes: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' },
  };
  const c = configs[status] ?? configs.active;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.classes}`}>
      {c.label}
    </span>
  );
}

function SessionCard({
  session,
  onRevoke,
  revoking,
}: {
  session: PortalSession;
  onRevoke: (id: string) => void;
  revoking: boolean;
}) {
  const isActive = !session.revoked_at && new Date(session.expires_at) > new Date();
  const expiresLabel = session.revoked_at
    ? `Revoked ${new Date(session.revoked_at).toLocaleDateString()}`
    : new Date(session.expires_at) < new Date()
    ? 'Expired'
    : `Expires ${new Date(session.expires_at).toLocaleDateString()}`;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${isActive ? 'bg-slate-800 border-slate-700' : 'bg-slate-800/40 border-slate-700/40'}`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-emerald-500/20' : 'bg-slate-700'}`}>
        <Monitor className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-300 truncate">{session.device_label || 'Browser'}</span>
          {session.remember_device && (
            <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
              Remembered
            </span>
          )}
          {!isActive && (
            <span className="text-[10px] bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
              {session.revoked_at ? 'Revoked' : 'Expired'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-slate-500">{expiresLabel}</span>
          {session.last_accessed_at && (
            <span className="text-[11px] text-slate-600">
              &middot; Last seen {new Date(session.last_accessed_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      {isActive && (
        <button
          onClick={() => onRevoke(session.id)}
          disabled={revoking}
          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
          title="Revoke session"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function AuthEventRow({ event }: { event: PortalEvent }) {
  const icons: Record<string, string> = {
    auth_code_sent: 'text-blue-400',
    auth_code_verified: 'text-emerald-400',
    auth_code_failed: 'text-red-400',
    session_created: 'text-cyan-400',
    session_revoked: 'text-amber-400',
    login_success: 'text-emerald-400',
    login_failed: 'text-red-400',
    logout: 'text-slate-400',
    portal_token_validated: 'text-slate-400',
  };
  const labels: Record<string, string> = {
    auth_code_sent: 'Code sent',
    auth_code_resent: 'Code resent',
    auth_code_verified: 'Code verified',
    auth_code_failed: 'Code failed',
    session_created: 'Session created',
    session_revoked: 'Session revoked',
    login_success: 'Login success',
    login_failed: 'Login failed',
    logout: 'Logged out',
    portal_token_validated: 'Token validated',
  };

  const authEvents = new Set([
    'auth_code_sent', 'auth_code_resent', 'auth_code_verified', 'auth_code_failed',
    'session_created', 'session_revoked', 'login_success', 'login_failed', 'logout',
    'portal_token_validated',
  ]);
  if (!authEvents.has(event.event_type)) return null;

  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${icons[event.event_type] || 'text-slate-500'} bg-current`} />
      <span className={`text-xs ${icons[event.event_type] || 'text-slate-500'}`}>
        {labels[event.event_type] || event.event_type}
      </span>
      <span className="text-[11px] text-slate-600 ml-auto">
        {new Date(event.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}

export function ClientPortalManagementPanel({ projectId, orgId, contactId, currentUserId, canManage }: Props) {
  const [portals, setPortals] = useState<ClientPortalWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingPortal, setGeneratingPortal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingRawTokens, setPendingRawTokens] = useState<Record<string, string>>({});
  const [showExtendModal, setShowExtendModal] = useState<string | null>(null);
  const [extendDate, setExtendDate] = useState('');
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);

  const [expandedSecurityPortal, setExpandedSecurityPortal] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Record<string, PortalSession[]>>({});
  const [events, setEvents] = useState<Record<string, PortalEvent[]>>({});
  const [sessionsLoading, setSessionsLoading] = useState<Record<string, boolean>>({});
  const [revokingSession, setRevokingSession] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState<string | null>(null);
  const [revokeAllConfirm, setRevokeAllConfirm] = useState<string | null>(null);

  async function load() {
    try {
      const data = await getPortalsByProject(projectId);
      setPortals(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [projectId]);

  async function loadSecurity(portalId: string) {
    setSessionsLoading(prev => ({ ...prev, [portalId]: true }));
    try {
      const [sess, evts] = await Promise.all([
        listSessions(portalId),
        getPortalEvents(portalId),
      ]);
      setSessions(prev => ({ ...prev, [portalId]: sess }));
      setEvents(prev => ({ ...prev, [portalId]: evts.slice(0, 15) }));
    } catch (err) {
      console.error(err);
    } finally {
      setSessionsLoading(prev => ({ ...prev, [portalId]: false }));
    }
  }

  function toggleSecurity(portalId: string) {
    if (expandedSecurityPortal === portalId) {
      setExpandedSecurityPortal(null);
    } else {
      setExpandedSecurityPortal(portalId);
      loadSecurity(portalId);
    }
  }

  async function handleRevokeSession(sessionId: string, portalId: string) {
    setRevokingSession(sessionId);
    try {
      await revokeSession(sessionId, portalId);
      await loadSecurity(portalId);
    } catch (err) {
      console.error(err);
    } finally {
      setRevokingSession(null);
    }
  }

  async function handleRevokeAll(portalId: string) {
    setRevokingAll(portalId);
    setRevokeAllConfirm(null);
    try {
      await revokeAllSessions(portalId);
      await loadSecurity(portalId);
    } catch (err) {
      console.error(err);
    } finally {
      setRevokingAll(null);
    }
  }

  async function handleGenerate() {
    if (!canManage) return;
    setGeneratingPortal(true);
    try {
      const { portal, rawToken } = await createPortal({
        projectId,
        orgId,
        contactId: contactId ?? undefined,
        createdByUserId: currentUserId,
      });
      setPendingRawTokens((prev) => ({ ...prev, [portal.id]: rawToken }));
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingPortal(false);
    }
  }

  async function handleRevoke(portalId: string) {
    try {
      await revokePortal(portalId);
      setPendingRawTokens((prev) => { const n = { ...prev }; delete n[portalId]; return n; });
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setRevokeConfirmId(null);
    }
  }

  async function handleExtend() {
    if (!showExtendModal || !extendDate) return;
    try {
      await extendPortalExpiration(showExtendModal, new Date(extendDate).toISOString());
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setShowExtendModal(null);
      setExtendDate('');
    }
  }

  async function handleRegenerate(portalId: string) {
    try {
      const { rawToken } = await regeneratePortalToken(portalId);
      setPendingRawTokens((prev) => ({ ...prev, [portalId]: rawToken }));
      await load();
    } catch (err) {
      console.error(err);
    }
  }

  function copyLink(portalId: string, rawToken: string) {
    const url = buildPortalUrl(rawToken);
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(portalId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  const activePortals = portals.filter((p) => p.status === 'active');
  const inactivePortals = portals.filter((p) => p.status !== 'active');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white">Client Portal Access</span>
        </div>
        {canManage && (
          <button
            onClick={handleGenerate}
            disabled={generatingPortal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            <Plus className="w-3 h-3" />
            {generatingPortal ? 'Generating...' : 'Generate Portal Link'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-3">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Loading...
        </div>
      ) : portals.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 text-center">
          <Link2 className="w-7 h-7 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No client portal links yet</p>
          {canManage && (
            <p className="text-xs text-slate-500 mt-1">Generate a secure link to share with the client.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {activePortals.map((portal) => {
            const rawToken = portal.portal_token || pendingRawTokens[portal.id];
            const hasToken = !!rawToken;
            const securityExpanded = expandedSecurityPortal === portal.id;
            const portalSessions = sessions[portal.id] || [];
            const portalEvents = events[portal.id] || [];
            const activeSessions = portalSessions.filter(s => !s.revoked_at && new Date(s.expires_at) > new Date());

            return (
              <div key={portal.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <PortalStatusBadge status={portal.status} />
                    {portal.expires_at && (
                      <span className="text-xs text-slate-500">
                        Expires {new Date(portal.expires_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {portal.last_accessed_at
                      ? `Last accessed ${new Date(portal.last_accessed_at).toLocaleDateString()}`
                      : 'Never accessed'}
                  </div>
                </div>

                {hasToken ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono truncate">
                      {buildPortalUrl(rawToken)}
                    </div>
                    <button
                      onClick={() => copyLink(portal.id, rawToken)}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors flex-none"
                    >
                      {copiedId === portal.id ? (
                        <><CheckCircle2 className="w-3 h-3" /> Copied</>
                      ) : (
                        <><Copy className="w-3 h-3" /> Copy</>
                      )}
                    </button>
                    <a
                      href={buildPortalUrl(rawToken)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                    <EyeOff className="w-3.5 h-3.5" />
                    Legacy link -- regenerate to create a permanent link.
                  </div>
                )}

                {canManage && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => handleRegenerate(portal.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Regenerate Link
                    </button>
                    <button
                      onClick={() => { setShowExtendModal(portal.id); setExtendDate(''); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <Calendar className="w-3 h-3" />
                      Set Expiry
                    </button>
                    {revokeConfirmId === portal.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-red-400">Confirm revoke?</span>
                        <button
                          onClick={() => handleRevoke(portal.id)}
                          className="px-2 py-1 text-xs text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setRevokeConfirmId(null)}
                          className="px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRevokeConfirmId(portal.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <XCircle className="w-3 h-3" />
                        Revoke Portal
                      </button>
                    )}
                  </div>
                )}

                {/* Security Section */}
                <div className="border-t border-slate-700/60 pt-3">
                  <button
                    onClick={() => toggleSecurity(portal.id)}
                    className="flex items-center justify-between w-full text-left group"
                  >
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-xs font-medium text-slate-400 group-hover:text-slate-300 transition-colors">
                        Portal Access Security
                      </span>
                      {activeSessions.length > 0 && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-medium">
                          {activeSessions.length} active session{activeSessions.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {securityExpanded
                      ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                      : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                  </button>

                  {securityExpanded && (
                    <div className="mt-3 space-y-4">
                      {sessionsLoading[portal.id] ? (
                        <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Loading security data...
                        </div>
                      ) : (
                        <>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-medium text-slate-400">Active Sessions</p>
                              {activeSessions.length > 0 && canManage && (
                                <div>
                                  {revokeAllConfirm === portal.id ? (
                                    <div className="flex items-center gap-1">
                                      <span className="text-[11px] text-red-400">Revoke all?</span>
                                      <button
                                        onClick={() => handleRevokeAll(portal.id)}
                                        disabled={!!revokingAll}
                                        className="px-2 py-0.5 text-[11px] text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
                                      >
                                        Yes
                                      </button>
                                      <button
                                        onClick={() => setRevokeAllConfirm(null)}
                                        className="px-2 py-0.5 text-[11px] text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                                      >
                                        No
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setRevokeAllConfirm(portal.id)}
                                      className="flex items-center gap-1 px-2 py-1 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                      <XCircle className="w-3 h-3" />
                                      Revoke All
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {portalSessions.length === 0 ? (
                              <p className="text-[11px] text-slate-600 py-1">No sessions created yet.</p>
                            ) : (
                              <div className="space-y-1.5">
                                {portalSessions.map(s => (
                                  <SessionCard
                                    key={s.id}
                                    session={s}
                                    onRevoke={(id) => handleRevokeSession(id, portal.id)}
                                    revoking={revokingSession === s.id}
                                  />
                                ))}
                              </div>
                            )}
                          </div>

                          {portalEvents.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <History className="w-3 h-3 text-slate-500" />
                                <p className="text-xs font-medium text-slate-400">Recent Auth Activity</p>
                              </div>
                              <div className="bg-slate-900 rounded-xl border border-slate-700/50 px-3 py-1 divide-y divide-slate-700/40">
                                {portalEvents.map(evt => (
                                  <AuthEventRow key={evt.id} event={evt} />
                                ))}
                              </div>
                            </div>
                          )}

                          <button
                            onClick={() => loadSecurity(portal.id)}
                            className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Refresh
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {portal.created_by_user && (
                  <div className="text-xs text-slate-600">
                    Created by {portal.created_by_user.name} on {new Date(portal.created_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            );
          })}

          {inactivePortals.length > 0 && (
            <div className="pt-1">
              <p className="text-xs text-slate-500 mb-2">Past Links</p>
              {inactivePortals.map((portal) => (
                <div key={portal.id} className="flex items-center gap-3 py-2 px-3 bg-slate-800/50 border border-slate-700/50 rounded-lg mb-1.5">
                  <PortalStatusBadge status={portal.status} />
                  <span className="text-xs text-slate-500 flex-1">
                    {portal.last_accessed_at
                      ? `Last accessed ${new Date(portal.last_accessed_at).toLocaleDateString()}`
                      : 'Never accessed'}
                  </span>
                  <span className="text-xs text-slate-600">
                    {new Date(portal.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showExtendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowExtendModal(null)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Set Portal Expiration</h3>
            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-1">Expire on</label>
              <input
                type="date"
                value={extendDate}
                onChange={(e) => setExtendDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowExtendModal(null)}
                className="flex-1 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExtend}
                disabled={!extendDate}
                className="flex-1 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
