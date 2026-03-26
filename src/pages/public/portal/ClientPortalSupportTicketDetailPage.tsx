import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  User,
  MessageSquare,
  Download,
  FileText,
  AlertTriangle,
  Clock,
  Paperclip,
} from 'lucide-react';
import { useClientPortal } from '../../../contexts/ClientPortalContext';
import {
  getPortalSupportTicketById,
  getPortalTicketComments,
  clientAddTicketComment,
} from '../../../services/projectClientPortals';
import { SupportTicketStatusBadge } from '../../../components/portal/SupportTicketStatusBadge';
import type { ProjectSupportTicket, ProjectSupportTicketComment } from '../../../types';

const CATEGORY_LABELS: Record<string, string> = {
  ai_automation: 'AI Automation System',
  crm_pipeline: 'CRM / Pipeline System',
  content_automation: 'Content Automation Engine',
  integration_api: 'Integration / API System',
  workflow_automation: 'Workflow Automation',
  custom_software: 'Custom Software Development',
  data_analytics: 'Data / Analytics System',
  other: 'Other',
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  bug_report: 'Bug Report',
  feature_request: 'Feature Request',
  performance_issue: 'Performance Issue',
  configuration_change: 'Configuration Change',
  access_permissions: 'Access / Permissions',
  training_docs: 'Training / Documentation',
  general_inquiry: 'General Inquiry',
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: 'text-gray-500' },
  medium: { label: 'Medium', color: 'text-amber-600' },
  high: { label: 'High', color: 'text-orange-600' },
  critical: { label: 'Critical', color: 'text-red-600' },
};

export function ClientPortalSupportTicketDetailPage() {
  const { portalToken, ticketId } = useParams<{ portalToken: string; ticketId: string }>();
  const { portal } = useClientPortal();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState<ProjectSupportTicket | null>(null);
  const [comments, setComments] = useState<ProjectSupportTicketComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    if (!ticketId || !portal) return;
    Promise.all([
      getPortalSupportTicketById(ticketId),
      getPortalTicketComments(ticketId),
    ]).then(([t, msgs]) => {
      setTicket(t);
      setComments(msgs);
    }).catch(console.error).finally(() => setLoading(false));
  }, [ticketId, portal]);

  if (!portal) return null;

  const contact = portal.contact;
  const contactName = contact
    ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Client'
    : 'Client';

  const base = `/portal/project/${portalToken}`;

  async function handleSendMessage() {
    if (!newMessage.trim() || !ticket || !portal) return;
    setSendingMessage(true);
    try {
      await clientAddTicketComment({
        supportTicketId: ticket.id,
        orgId: portal.org_id,
        body: newMessage,
        authorName: contactName,
        portalId: portal.id,
        projectId: portal.project_id,
        contactId: portal.contact_id,
      });
      const updated = await getPortalTicketComments(ticket.id);
      setComments(updated);
      setNewMessage('');
    } catch (err) {
      console.error(err);
    } finally {
      setSendingMessage(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Support ticket not found.</p>
      </div>
    );
  }

  const priorityConfig = PRIORITY_CONFIG[ticket.priority] ?? PRIORITY_CONFIG.medium;

  return (
    <div className="space-y-5 max-w-3xl">
      <button
        onClick={() => navigate(`${base}/support-tickets`)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Support Tickets
      </button>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 mb-1">{ticket.title}</h1>
            <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500">
              <span className="font-medium text-gray-600">{ticket.ticket_number}</span>
              <span>&middot;</span>
              <span>{CATEGORY_LABELS[ticket.service_category] ?? ticket.service_category}</span>
              <span>&middot;</span>
              <span>{REQUEST_TYPE_LABELS[ticket.request_type] ?? ticket.request_type}</span>
              <span>&middot;</span>
              <span className={priorityConfig.color}>{priorityConfig.label} priority</span>
            </div>
          </div>
          <SupportTicketStatusBadge status={ticket.status} size="lg" />
        </div>

        <TicketStatusProgress status={ticket.status} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Issue Details</h2>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{ticket.description}</p>

        {ticket.steps_to_reproduce && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Steps to Reproduce</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.steps_to_reproduce}</p>
          </div>
        )}

        {ticket.error_messages && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Error Messages</h3>
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <pre className="text-xs text-red-700 whitespace-pre-wrap font-mono">{ticket.error_messages}</pre>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mt-4">
          {ticket.affected_area && (
            <div className="text-sm">
              <span className="text-xs text-gray-400 block">Affected Area</span>
              <span className="text-gray-700 font-medium">{ticket.affected_area}</span>
            </div>
          )}
          {ticket.affected_feature && (
            <div className="text-sm">
              <span className="text-xs text-gray-400 block">Affected Feature</span>
              <span className="text-gray-700 font-medium">{ticket.affected_feature}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-gray-400" />
            <div>
              <div className="text-xs text-gray-400">Submitted by</div>
              <div className="text-gray-700 font-medium">{ticket.client_name}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-gray-400" />
            <div>
              <div className="text-xs text-gray-400">Submitted</div>
              <div className="text-gray-700 font-medium">
                {new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>
        </div>

        {ticket.severity_score >= 7 && (
          <div className="mt-4 flex items-center gap-2 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 flex-none" />
            High severity issue (score: {ticket.severity_score}/10)
          </div>
        )}
      </div>

      {ticket.resolution_summary && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-emerald-800 mb-2">Resolution</h2>
          <p className="text-sm text-emerald-700 leading-relaxed whitespace-pre-wrap">{ticket.resolution_summary}</p>
          {ticket.resolved_at && (
            <p className="text-xs text-emerald-600 mt-2">
              Resolved on {new Date(ticket.resolved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>
      )}

      {ticket.attachments?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-3">
            <Paperclip className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Attachments</h2>
          </div>
          <div className="space-y-2">
            {ticket.attachments.map((att, i) => (
              <a
                key={i}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <div>
                    <span className="text-sm font-medium text-gray-900">{att.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{(att.size / 1024).toFixed(0)} KB</span>
                  </div>
                </div>
                <Download className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
              </a>
            ))}
          </div>
        </div>
      )}

      {ticket.status === 'waiting_on_client' && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            <h2 className="text-sm font-semibold text-gray-900">Response Needed</h2>
          </div>
          <p className="text-sm text-gray-600">
            Our team is waiting for additional information from you. Please reply below to help us resolve your issue.
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">Messages & Updates</h2>
        </div>

        {comments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No messages yet.</p>
        ) : (
          <div className="space-y-4 mb-5">
            {comments.map((c) => {
              const isClient = c.author_type === 'client';
              return (
                <div key={c.id} className={`flex gap-3 ${isClient ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-none ${
                    isClient ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-700'
                  }`}>
                    {(c.author_name ?? 'T').charAt(0).toUpperCase()}
                  </div>
                  <div className={`flex-1 max-w-[85%] rounded-2xl px-4 py-3 ${
                    isClient ? 'bg-teal-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-900 rounded-tl-sm'
                  }`}>
                    <div className={`flex items-center gap-2 mb-1 ${isClient ? 'flex-row-reverse' : ''}`}>
                      <span className={`text-xs font-medium ${isClient ? 'text-teal-100' : 'text-gray-600'}`}>
                        {isClient ? 'You' : (c.author_name ?? 'Support Team')}
                      </span>
                      <span className={`text-xs ${isClient ? 'text-teal-200' : 'text-gray-400'}`}>
                        {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' '}
                        {new Date(c.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{c.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!['resolved', 'closed'].includes(ticket.status) && (
          <div className="flex gap-3">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              rows={2}
              placeholder="Send a message to the support team..."
              className="flex-1 px-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 resize-none text-gray-900 placeholder-gray-400"
            />
            <button
              onClick={handleSendMessage}
              disabled={sendingMessage || !newMessage.trim()}
              className="px-3 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl self-end transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}

        {['resolved', 'closed'].includes(ticket.status) && (
          <p className="text-center text-sm text-gray-400 py-2">
            This ticket has been {ticket.status}. If you need further help, please submit a new ticket.
          </p>
        )}
      </div>
    </div>
  );
}

function TicketStatusProgress({ status }: { status: string }) {
  const steps = [
    { key: 'new', label: 'New' },
    { key: 'in_review', label: 'In Review' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'resolved', label: 'Resolved' },
  ];

  const stepKeys = steps.map((s) => s.key);
  let currentIndex = stepKeys.indexOf(status);

  if (status === 'waiting_on_client') currentIndex = 2;
  if (status === 'closed') currentIndex = 4;

  return (
    <div className="flex items-center gap-1 mt-5">
      {steps.map((step, i) => {
        const done = currentIndex > i;
        const active = currentIndex === i;
        return (
          <div key={step.key} className="flex items-center gap-1 flex-1">
            <div className="flex flex-col items-center gap-1 flex-none">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                done ? 'bg-emerald-500 text-white' :
                active ? 'bg-teal-600 text-white' :
                'bg-gray-200 text-gray-400'
              }`}>
                {done ? '\u2713' : i + 1}
              </div>
              <span className={`text-xs text-center leading-tight w-16 ${
                active ? 'text-teal-600 font-semibold' :
                done ? 'text-emerald-600' :
                'text-gray-400'
              }`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 flex-1 mb-4 ${done ? 'bg-emerald-400' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
