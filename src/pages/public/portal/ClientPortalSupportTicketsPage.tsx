import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronRight,
  Plus,
  Search,
  LifeBuoy,
  Loader2,
} from 'lucide-react';
import { useClientPortalProject } from '../../../contexts/ClientPortalContextV2';
import { getPortalSupportTickets } from '../../../services/projectClientPortals';
import { SupportTicketStatusBadge } from '../../../components/portal/SupportTicketStatusBadge';
import { SubmitSupportTicketModal } from '../../../components/portal/SubmitSupportTicketModal';
import type { ProjectSupportTicket } from '../../../types';

const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-slate-400',
  medium: 'bg-amber-400',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

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

const FILTER_TABS = [
  { key: '', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'waiting_on_client', label: 'Waiting on You' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

const OPEN_STATUSES = ['new', 'in_review', 'in_progress'];

export function ClientPortalSupportTicketsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { project } = useClientPortalProject(projectId!);
  const navigate = useNavigate();

  const [tickets, setTickets] = useState<ProjectSupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  useEffect(() => {
    if (!project) return;
    setLoading(true);
    getPortalSupportTickets(projectId!).then(setTickets).catch(console.error).finally(() => setLoading(false));
  }, [project]);

  if (!project) return <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>;

  const contact = project.contact;
  const contactName = contact
    ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Client'
    : 'Client';

  const filtered = tickets.filter((t) => {
    const matchesFilter =
      !activeFilter ||
      (activeFilter === 'open' && OPEN_STATUSES.includes(t.status)) ||
      t.status === activeFilter;
    const matchesSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const waitingCount = tickets.filter((t) => t.status === 'waiting_on_client').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Support Tickets</h2>
          <p className="text-sm text-gray-500 mt-0.5">{tickets.length} total ticket{tickets.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowSubmitModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Ticket</span>
        </button>
      </div>

      {waitingCount > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          <p className="text-sm text-orange-700 font-medium">
            {waitingCount} ticket{waitingCount > 1 ? 's' : ''} waiting on your response
          </p>
          <button
            onClick={() => setActiveFilter('waiting_on_client')}
            className="ml-auto text-xs font-semibold text-orange-700 hover:text-orange-800"
          >
            View
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search support tickets..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 text-gray-900 placeholder-gray-400"
            />
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  activeFilter === tab.key
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <LifeBuoy className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              {search || activeFilter ? 'No tickets match your filters' : 'No support tickets yet'}
            </p>
            {!search && !activeFilter && (
              <button
                onClick={() => setShowSubmitModal(true)}
                className="mt-3 text-sm text-teal-600 hover:text-teal-700 font-medium"
              >
                Submit your first ticket
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => navigate(`/client-portal/projects/${projectId}/support-tickets/${ticket.id}`)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left group"
              >
                <div className={`w-2.5 h-2.5 rounded-full flex-none mt-0.5 ${PRIORITY_DOT[ticket.priority] ?? 'bg-gray-400'}`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">{ticket.title}</span>
                    <span className="text-xs text-gray-400">{CATEGORY_LABELS[ticket.service_category] ?? ticket.service_category}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>{ticket.ticket_number}</span>
                    <span>{new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    {ticket.severity_score >= 7 && (
                      <span className="text-red-500 font-medium">Severity {ticket.severity_score}/10</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-none">
                  <SupportTicketStatusBadge status={ticket.status} />
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showSubmitModal && (
        <SubmitSupportTicketModal
          projectId={projectId!}
          orgId={project.org_id}
          contactName={contactName}
          contactEmail={contact?.email ?? undefined}
          onSuccess={() => {
            setShowSubmitModal(false);
            getPortalSupportTickets(projectId!).then(setTickets);
          }}
          onClose={() => setShowSubmitModal(false)}
        />
      )}
    </div>
  );
}
