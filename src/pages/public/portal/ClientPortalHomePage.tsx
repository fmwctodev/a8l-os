import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Calendar,
  Clock,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Plus,
  Mail,
  Phone,
  FileText,
  TrendingUp,
  Headphones,
  LifeBuoy,
} from 'lucide-react';
import { useClientPortal } from '../../../contexts/ClientPortalContext';
import { getPortalChangeRequests, getPortalStats, getPortalSupportTickets, getPortalTicketStats } from '../../../services/projectClientPortals';
import { PortalStatusBadge } from '../../../components/portal/PortalStatusBadge';
import { SupportTicketStatusBadge } from '../../../components/portal/SupportTicketStatusBadge';
import { SubmitChangeRequestModal } from '../../../components/portal/SubmitChangeRequestModal';
import { SubmitSupportTicketModal } from '../../../components/portal/SubmitSupportTicketModal';
import type { ProjectChangeRequest, ProjectSupportTicket } from '../../../types';

const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-slate-400',
  medium: 'bg-amber-400',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-700',
    orange: 'bg-orange-50 text-orange-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

export function ClientPortalHomePage() {
  const { portalToken } = useParams<{ portalToken: string }>();
  const { portal, logEvent } = useClientPortal();
  const navigate = useNavigate();

  const [requests, setRequests] = useState<ProjectChangeRequest[]>([]);
  const [tickets, setTickets] = useState<ProjectSupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);

  useEffect(() => {
    if (!portal) return;
    logEvent('project_portal.viewed');
    Promise.all([
      getPortalChangeRequests(portal.project_id),
      getPortalSupportTickets(portal.project_id),
    ]).then(([reqs, tix]) => {
      setRequests(reqs);
      setTickets(tix);
    }).catch(console.error).finally(() => setLoading(false));
  }, [portal]);

  if (!portal) return null;

  const project = portal.project;
  const org = portal.organization;
  const contact = portal.contact;

  const contactName = contact
    ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Client'
    : 'Client';

  const stats = getPortalStats(requests);
  const ticketStats = getPortalTicketStats(tickets);
  const recentRequests = requests.slice(0, 5);
  const recentTickets = tickets.slice(0, 5);

  const base = `/portal/project/${portalToken}`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{project?.name}</h2>
              <p className="text-sm text-gray-500 mt-0.5 capitalize">
                {project?.status?.replace(/_/g, ' ') ?? '—'}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              {project?.status && (
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                  project.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                  project.status === 'completed' ? 'bg-gray-100 text-gray-600' :
                  project.status === 'on_hold' ? 'bg-amber-100 text-amber-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {project.status.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          </div>

          {project?.description && (
            <p className="text-sm text-gray-600 leading-relaxed mb-5">{project.description}</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            {project?.start_date && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="text-xs text-gray-400">Start Date</div>
                  <div className="text-gray-700 font-medium">
                    {new Date(project.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              </div>
            )}
            {project?.target_end_date && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="text-xs text-gray-400">Est. Completion</div>
                  <div className="text-gray-700 font-medium">
                    {new Date(project.target_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              </div>
            )}
            {project?.updated_at && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="text-xs text-gray-400">Last Updated</div>
                  <div className="text-gray-700 font-medium">
                    {new Date(project.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Project Support</h3>
            <p className="text-sm text-gray-500 mb-4">Have a question or need assistance with your project?</p>
            <div className="space-y-2">
              {org?.email && (
                <a href={`mailto:${org.email}`} className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-blue-600 transition-colors">
                  <Mail className="w-4 h-4 text-gray-400" />
                  {org.email}
                </a>
              )}
              {org?.phone && (
                <a href={`tel:${org.phone}`} className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-blue-600 transition-colors">
                  <Phone className="w-4 h-4 text-gray-400" />
                  {org.phone}
                </a>
              )}
            </div>
          </div>
          <div className="mt-5 space-y-2">
            <button
              onClick={() => setShowSubmitModal(true)}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Submit Change Request
            </button>
            <button
              onClick={() => setShowTicketModal(true)}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Headphones className="w-4 h-4" />
              Support Ticket
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Open Requests" value={loading ? '—' : stats.open} color="blue" />
        <StatCard icon={AlertCircle} label="Awaiting Approval" value={loading ? '—' : stats.awaitingApproval} color="orange" />
        <StatCard icon={CheckCircle2} label="Completed" value={loading ? '—' : stats.completed} color="emerald" />
        <StatCard
          icon={TrendingUp}
          label="Approved Value"
          value={loading ? '—' : `$${stats.totalApprovedValue.toLocaleString()}`}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard icon={LifeBuoy} label="Open Tickets" value={loading ? '—' : ticketStats.open} color="blue" />
        <StatCard icon={Clock} label="Waiting on You" value={loading ? '—' : ticketStats.waitingOnClient} color="orange" />
        <StatCard icon={CheckCircle2} label="Resolved Tickets" value={loading ? '—' : ticketStats.resolved} color="emerald" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Recent Change Requests</h3>
          <button
            onClick={() => navigate(`${base}/change-requests`)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            View all
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : recentRequests.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No change requests yet</p>
            <button
              onClick={() => setShowSubmitModal(true)}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Submit your first request
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentRequests.map((req) => (
              <button
                key={req.id}
                onClick={() => navigate(`${base}/change-requests/${req.id}`)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors text-left group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-none ${PRIORITY_DOT[req.priority] ?? 'bg-gray-400'}`} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{req.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-none ml-4">
                  <PortalStatusBadge status={req.status} size="sm" />
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Recent Support Tickets</h3>
          <button
            onClick={() => navigate(`${base}/support-tickets`)}
            className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
          >
            View all
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
          </div>
        ) : recentTickets.length === 0 ? (
          <div className="text-center py-12">
            <LifeBuoy className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No support tickets yet</p>
            <button
              onClick={() => setShowTicketModal(true)}
              className="mt-3 text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              Submit your first ticket
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentTickets.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => navigate(`${base}/support-tickets/${ticket.id}`)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors text-left group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-none ${PRIORITY_DOT[ticket.priority] ?? 'bg-gray-400'}`} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{ticket.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {ticket.ticket_number} &middot; {new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-none ml-4">
                  <SupportTicketStatusBadge status={ticket.status} size="sm" />
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showSubmitModal && portal && (
        <SubmitChangeRequestModal
          projectId={portal.project_id}
          orgId={portal.org_id}
          contactName={contactName}
          contactEmail={contact?.email ?? undefined}
          onSuccess={() => {
            setShowSubmitModal(false);
            getPortalChangeRequests(portal.project_id).then(setRequests);
          }}
          onClose={() => setShowSubmitModal(false)}
        />
      )}

      {showTicketModal && portal && (
        <SubmitSupportTicketModal
          projectId={portal.project_id}
          orgId={portal.org_id}
          contactName={contactName}
          contactEmail={contact?.email ?? undefined}
          contactPhone={contact?.phone ?? undefined}
          onSuccess={() => {
            setShowTicketModal(false);
            getPortalSupportTickets(portal.project_id).then(setTickets);
          }}
          onClose={() => setShowTicketModal(false)}
        />
      )}
    </div>
  );
}
