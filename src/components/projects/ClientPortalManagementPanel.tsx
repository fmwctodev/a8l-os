import { useState, useEffect } from 'react';
import {
  Link2,
  Copy,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  Plus,
  Calendar,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  createPortal,
  getPortalsByProject,
  revokePortal,
  extendPortalExpiration,
  regeneratePortalToken,
  buildPortalUrl,
} from '../../services/projectClientPortals';
import type { ClientPortalWithProject } from '../../services/projectClientPortals';

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

export function ClientPortalManagementPanel({ projectId, orgId, contactId, currentUserId, canManage }: Props) {
  const [portals, setPortals] = useState<ClientPortalWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingPortal, setGeneratingPortal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingRawTokens, setPendingRawTokens] = useState<Record<string, string>>({});
  const [showExtendModal, setShowExtendModal] = useState<string | null>(null);
  const [extendDate, setExtendDate] = useState('');
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);

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
            const rawToken = pendingRawTokens[portal.id];
            const hasToken = !!rawToken;

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
                    Token hidden for security. Regenerate to get a new link.
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
                        Revoke Access
                      </button>
                    )}
                  </div>
                )}

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
