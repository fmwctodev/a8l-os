import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Filter,
  RefreshCw,
  ChevronRight,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  TrendingUp,
} from 'lucide-react';
import type { ProjectChangeRequest, ProjectChangeRequestStats, User } from '../../types';
import { getChangeRequests, getChangeRequestStats, createChangeRequest } from '../../services/projectChangeRequests';
import { ChangeRequestStatusBadge } from './ChangeRequestStatusBadge';
import { ChangeRequestDrawer } from './ChangeRequestDrawer';
import { ClientPortalManagementPanel } from './ClientPortalManagementPanel';

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-slate-400',
  medium: 'text-amber-400',
  high: 'text-orange-400',
  critical: 'text-red-400',
};

const TYPE_LABELS: Record<string, string> = {
  scope: 'Scope',
  timeline: 'Timeline',
  design: 'Design',
  feature: 'Feature',
  bugfix: 'Bug Fix',
  support: 'Support',
  other: 'Other',
};

interface Props {
  projectId: string;
  orgId: string;
  contactId?: string | null;
  users: User[];
  canManage: boolean;
  canApprove: boolean;
  currentUserId: string;
  currentUserName: string;
}

export function ProjectChangeRequestsTab({
  projectId,
  orgId,
  contactId,
  users,
  canManage,
  canApprove,
  currentUserId,
  currentUserName,
}: Props) {
  const [requests, setRequests] = useState<ProjectChangeRequest[]>([]);
  const [stats, setStats] = useState<ProjectChangeRequestStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ProjectChangeRequest | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState({
    title: '',
    client_name: '',
    client_email: '',
    request_type: 'scope' as const,
    priority: 'medium' as const,
    description: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [reqs, st] = await Promise.all([
        getChangeRequests(projectId, { status: statusFilter.length ? statusFilter : undefined, search: search || undefined }),
        getChangeRequestStats(projectId),
      ]);
      setRequests(reqs);
      setStats(st);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId, statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!newForm.title.trim() || !newForm.client_name.trim() || !newForm.description.trim()) return;
    setSaving(true);
    try {
      const { request } = await createChangeRequest({
        project_id: projectId,
        org_id: orgId,
        client_name: newForm.client_name,
        client_email: newForm.client_email || undefined,
        title: newForm.title,
        request_type: newForm.request_type,
        priority: newForm.priority,
        description: newForm.description,
        source: 'internal',
      }, currentUserId);

      try {
        const notifyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/change-request-notify`;
        const notifyRes = await fetch(notifyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ request_id: request.id, org_id: orgId }),
        });
        const notifyBody = await notifyRes.json().catch(() => null);
        console.log('change-request-notify response:', notifyRes.status, notifyBody);
      } catch (notifyErr) {
        console.error('change-request-notify error:', notifyErr);
      }

      setShowNewForm(false);
      setNewForm({ title: '', client_name: '', client_email: '', request_type: 'scope', priority: 'medium', description: '' });
      await load();
      setSelectedRequest(request);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Clock} label="Open" value={stats.open} color="cyan" />
          <StatCard icon={CheckCircle2} label="Approved" value={stats.approved} color="emerald" />
          <StatCard icon={XCircle} label="Rejected" value={stats.rejected} color="red" />
          <StatCard icon={TrendingUp} label="Cost Impact" value={`$${stats.total_approved_value.toLocaleString()}`} color="amber" />
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search change requests..."
            className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
        <button onClick={load} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
        {canManage && (
          <button
            onClick={() => setShowNewForm(true)}
            className="flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Request
          </button>
        )}
      </div>

      {showNewForm && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">New Internal Change Request</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Title *</label>
              <input
                value={newForm.title}
                onChange={(e) => setNewForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                placeholder="Brief title"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Submitted By *</label>
              <input
                value={newForm.client_name}
                onChange={(e) => setNewForm((f) => ({ ...f, client_name: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                placeholder="Client or requestor name"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Type</label>
              <select
                value={newForm.request_type}
                onChange={(e) => setNewForm((f) => ({ ...f, request_type: e.target.value as typeof f.request_type }))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Priority</label>
              <select
                value={newForm.priority}
                onChange={(e) => setNewForm((f) => ({ ...f, priority: e.target.value as typeof f.priority }))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Description *</label>
            <textarea
              value={newForm.description}
              onChange={(e) => setNewForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 resize-none"
              placeholder="Describe the requested change..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNewForm(false)} className="px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !newForm.title || !newForm.client_name || !newForm.description}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
            >
              {saving ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="w-10 h-10 text-slate-600 mb-3" />
          <p className="text-slate-400 font-medium">No change requests yet</p>
          <p className="text-slate-500 text-sm mt-1">
            {canManage
              ? 'Create an internal request or share the client link to receive submissions.'
              : 'Change requests from clients or the team will appear here.'}
          </p>
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Request</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden sm:table-cell">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">Priority</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Cost Impact</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Reviewer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Date</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr
                  key={req.id}
                  onClick={() => setSelectedRequest(req)}
                  className="border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-white truncate max-w-xs">{req.title}</p>
                    <p className="text-xs text-slate-500">{req.client_name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <ChangeRequestStatusBadge status={req.status} size="sm" />
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-slate-300">{TYPE_LABELS[req.request_type] ?? req.request_type}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`capitalize font-medium ${PRIORITY_COLORS[req.priority]}`}>
                      {req.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {req.cost_impact > 0 ? (
                      <span className="text-emerald-400">+${Number(req.cost_impact).toLocaleString()}</span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {req.reviewer?.name ? (
                      <span className="text-slate-300 text-xs">{req.reviewer.name}</span>
                    ) : (
                      <span className="text-slate-600 text-xs">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(req.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage && (
        <ClientPortalManagementPanel
          projectId={projectId}
          orgId={orgId}
          contactId={contactId ?? null}
          currentUserId={currentUserId}
          canManage={canManage}
        />
      )}

      {selectedRequest && (
        <ChangeRequestDrawer
          changeRequest={selectedRequest}
          users={users}
          canManage={canManage}
          canApprove={canApprove}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onClose={() => setSelectedRequest(null)}
          onUpdate={async () => {
            await load();
            const updated = requests.find((r) => r.id === selectedRequest.id);
            if (updated) setSelectedRequest(updated);
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: 'cyan' | 'emerald' | 'red' | 'amber';
}) {
  const colorMap = {
    cyan: 'text-cyan-400 bg-cyan-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    red: 'text-red-400 bg-red-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${colorMap[color]}`}>
        <Icon className={`w-4 h-4 ${colorMap[color].split(' ')[0]}`} />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-bold text-white">{value}</p>
      </div>
    </div>
  );
}
