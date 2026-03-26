import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  LifeBuoy,
  AlertTriangle,
} from 'lucide-react';
import type { ProjectSupportTicket, ProjectSupportTicketStats, User } from '../../types';
import { getSupportTickets, getSupportTicketStats } from '../../services/projectSupportTickets';
import { SupportTicketAdminStatusBadge } from './SupportTicketStatusBadge';
import { SupportTicketDrawer } from './SupportTicketDrawer';

const CATEGORY_LABELS: Record<string, string> = {
  ai_automation: 'AI Automation',
  crm_pipeline: 'CRM / Pipeline',
  content_automation: 'Content Engine',
  integration_api: 'Integration / API',
  workflow_automation: 'Workflows',
  custom_software: 'Custom Software',
  data_analytics: 'Data / Analytics',
  other: 'Other',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-slate-400',
  medium: 'text-amber-400',
  high: 'text-orange-400',
  critical: 'text-red-400',
};

const FILTER_TABS = [
  { key: '', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'waiting_on_client', label: 'Waiting on Client' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

const OPEN_STATUSES = ['new', 'in_review', 'in_progress'];

interface Props {
  projectId: string;
  orgId: string;
  users: User[];
  canManage: boolean;
  currentUserId: string;
  currentUserName: string;
}

export function ProjectSupportTicketsTab({
  projectId,
  orgId,
  users,
  canManage,
  currentUserId,
  currentUserName,
}: Props) {
  const [tickets, setTickets] = useState<ProjectSupportTicket[]>([]);
  const [stats, setStats] = useState<ProjectSupportTicketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<ProjectSupportTicket | null>(null);

  const load = useCallback(async () => {
    try {
      const statusFilter = activeFilter === 'open'
        ? OPEN_STATUSES
        : activeFilter
          ? [activeFilter]
          : undefined;
      const [tix, st] = await Promise.all([
        getSupportTickets(projectId, { status: statusFilter, search: search || undefined }),
        getSupportTicketStats(projectId),
      ]);
      setTickets(tix);
      setStats(st);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId, activeFilter, search]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
      </div>
    );
  }

  const waitingCount = stats?.waiting_on_client ?? 0;

  return (
    <div className="p-6 space-y-5">
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={LifeBuoy} label="Open" value={stats.open} color="cyan" />
          <StatCard icon={Clock} label="Waiting on Client" value={stats.waiting_on_client} color="orange" />
          <StatCard icon={CheckCircle2} label="Resolved" value={stats.resolved} color="emerald" />
          <StatCard icon={AlertTriangle} label="Critical" value={stats.critical} color="red" />
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search support tickets..."
            className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>
        <button onClick={load} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeFilter === tab.key
                ? 'bg-teal-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {tab.label}
            {tab.key === 'waiting_on_client' && waitingCount > 0 && (
              <span className="ml-1.5 bg-orange-500 text-white rounded-full px-1.5 py-0.5 text-xs">
                {waitingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <LifeBuoy className="w-10 h-10 text-slate-600 mb-3" />
          <p className="text-slate-400 font-medium">No support tickets yet</p>
          <p className="text-slate-500 text-sm mt-1">
            Tickets submitted by clients through the portal will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Ticket</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden sm:table-cell">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">Priority</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Severity</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Assigned</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Date</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => {
                const assignedUser = users.find((u) => u.id === ticket.assigned_user_id);
                return (
                  <tr
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className="border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-white truncate max-w-xs">{ticket.title}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span className="font-mono">{ticket.ticket_number}</span>
                        <span>&middot;</span>
                        <span>{ticket.client_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <SupportTicketAdminStatusBadge status={ticket.status} size="sm" />
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-slate-300 text-xs">{CATEGORY_LABELS[ticket.service_category] ?? ticket.service_category}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`capitalize font-medium text-xs ${PRIORITY_COLORS[ticket.priority]}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {ticket.severity_score >= 7 ? (
                        <span className="text-red-400 text-xs font-medium">{ticket.severity_score}/10</span>
                      ) : (
                        <span className="text-slate-500 text-xs">{ticket.severity_score}/10</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {assignedUser ? (
                        <span className="text-slate-300 text-xs">{assignedUser.name || assignedUser.email}</span>
                      ) : (
                        <span className="text-slate-600 text-xs">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedTicket && (
        <SupportTicketDrawer
          ticket={selectedTicket}
          users={users}
          canManage={canManage}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onClose={() => setSelectedTicket(null)}
          onUpdate={async () => {
            await load();
            const updated = tickets.find((t) => t.id === selectedTicket.id);
            if (updated) setSelectedTicket(updated);
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
  color: 'cyan' | 'emerald' | 'red' | 'orange';
}) {
  const colorMap = {
    cyan: 'text-cyan-400 bg-cyan-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    red: 'text-red-400 bg-red-500/10',
    orange: 'text-orange-400 bg-orange-500/10',
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
