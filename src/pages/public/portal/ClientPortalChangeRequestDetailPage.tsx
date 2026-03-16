import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  DollarSign,
  Calendar,
  Send,
  User,
  FileText,
  CheckCircle2,
  XCircle,
  MessageSquare,
  AlertTriangle,
  PenTool,
  Download,
  ExternalLink,
} from 'lucide-react';
import { useClientPortal } from '../../../contexts/ClientPortalContext';
import {
  getPortalChangeRequestById,
  getPortalComments,
  clientApproveChangeRequest,
  clientRejectChangeRequest,
  clientAddComment,
} from '../../../services/projectClientPortals';
import { PortalStatusBadge } from '../../../components/portal/PortalStatusBadge';
import { ApproveChangeModal } from '../../../components/portal/ApproveChangeModal';
import { RejectChangeModal } from '../../../components/portal/RejectChangeModal';
import { ClarificationModal } from '../../../components/portal/ClarificationModal';
import { SignatureCapture } from '../../../components/proposals/SignatureCapture';
import { signChangeOrder, declineChangeOrder, uploadChangeOrderSignatureImage } from '../../../services/projectChangeOrders';
import type { ProjectChangeRequest, ProjectChangeRequestComment, ProjectChangeOrder } from '../../../types';

const TYPE_LABELS: Record<string, string> = {
  scope: 'Scope Change',
  timeline: 'Timeline Adjustment',
  design: 'Design Change',
  feature: 'New Feature',
  bugfix: 'Bug Fix',
  support: 'Support Request',
  other: 'Other',
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: 'text-gray-500' },
  medium: { label: 'Medium', color: 'text-amber-600' },
  high: { label: 'High', color: 'text-orange-600' },
  critical: { label: 'Critical', color: 'text-red-600' },
};

interface SignatureData {
  type: 'typed' | 'drawn';
  text?: string;
  imageDataUrl: string;
}

type ActionState = 'idle' | 'approving' | 'rejecting' | 'clarifying';
type SigningState = 'idle' | 'signing' | 'signed' | 'declined';

export function ClientPortalChangeRequestDetailPage() {
  const { portalToken, requestId } = useParams<{ portalToken: string; requestId: string }>();
  const { portal } = useClientPortal();
  const navigate = useNavigate();

  const [request, setRequest] = useState<ProjectChangeRequest | null>(null);
  const [comments, setComments] = useState<ProjectChangeRequestComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionState, setActionState] = useState<ActionState>('idle');
  const [signingState, setSigningState] = useState<SigningState>('idle');
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [signatureData, setSignatureData] = useState<SignatureData | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [signingError, setSigningError] = useState('');
  const [processingSign, setProcessingSign] = useState(false);

  useEffect(() => {
    if (!requestId || !portal) return;
    Promise.all([
      getPortalChangeRequestById(requestId),
      getPortalComments(requestId),
    ]).then(([req, msgs]) => {
      setRequest(req);
      setComments(msgs);
    }).catch(console.error).finally(() => setLoading(false));
  }, [requestId, portal]);

  if (!portal) return null;

  const contact = portal.contact;
  const contactName = contact
    ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Client'
    : 'Client';

  const base = `/portal/project/${portalToken}`;

  async function handleApprove() {
    if (!request || !portal) return;
    await clientApproveChangeRequest({
      requestId: request.id,
      portalId: portal.id,
      projectId: portal.project_id,
      contactId: portal.contact_id,
    });
    setRequest((r) => r ? { ...r, status: 'approved', client_decision: 'approved' } : r);
    setActionState('idle');
  }

  async function handleReject(reason: string) {
    if (!request || !portal) return;
    await clientRejectChangeRequest({
      requestId: request.id,
      portalId: portal.id,
      projectId: portal.project_id,
      contactId: portal.contact_id,
      reason,
    });
    setRequest((r) => r ? { ...r, status: 'rejected', client_decision: 'declined' } : r);
    setActionState('idle');
  }

  async function handleClarification(message: string) {
    if (!request || !portal) return;
    await clientAddComment({
      changeRequestId: request.id,
      orgId: portal.org_id,
      body: message,
      authorName: contactName,
      portalId: portal.id,
      projectId: portal.project_id,
      contactId: portal.contact_id,
    });
    const updated = await getPortalComments(request.id);
    setComments(updated);
    setActionState('idle');
  }

  async function handleSendMessage() {
    if (!newMessage.trim() || !request || !portal) return;
    setSendingMessage(true);
    try {
      await clientAddComment({
        changeRequestId: request.id,
        orgId: portal.org_id,
        body: newMessage,
        authorName: contactName,
        portalId: portal.id,
        projectId: portal.project_id,
        contactId: portal.contact_id,
      });
      const updated = await getPortalComments(request.id);
      setComments(updated);
      setNewMessage('');
    } catch (err) {
      console.error(err);
    } finally {
      setSendingMessage(false);
    }
  }

  const activeChangeOrder = request?.change_orders?.find(
    (o): o is ProjectChangeOrder => ['sent', 'viewed'].includes(o.status)
  ) ?? null;

  async function handleSignChangeOrder() {
    if (!signatureData || !consentChecked || !activeChangeOrder || !request) return;
    setProcessingSign(true);
    setSigningError('');
    try {
      let signatureImageUrl: string | undefined;
      if (signatureData.imageDataUrl) {
        signatureImageUrl = await uploadChangeOrderSignatureImage(
          request.org_id,
          activeChangeOrder.id,
          signatureData.imageDataUrl
        ) ?? undefined;
      }
      await signChangeOrder({
        changeOrderId: activeChangeOrder.id,
        changeRequest: request,
        rawToken: activeChangeOrder.access_token_hash ?? '',
        signatureType: signatureData.type,
        signatureText: signatureData.text,
        signatureImageUrl,
        signerName: contactName,
        signerEmail: contact?.email ?? '',
        consentText: 'I agree to the terms outlined in this change order and authorize the described changes.',
        userAgent: navigator.userAgent,
      });
      setRequest((r) => r ? { ...r, status: 'approved', client_decision: 'approved' } : r);
      setSigningState('signed');
    } catch (err) {
      setSigningError(err instanceof Error ? err.message : 'Signing failed. Please try again.');
    } finally {
      setProcessingSign(false);
    }
  }

  async function handleDeclineChangeOrder() {
    if (!activeChangeOrder || !request) return;
    setProcessingSign(true);
    setSigningError('');
    try {
      await declineChangeOrder({
        changeOrderId: activeChangeOrder.id,
        changeRequest: request,
        rawToken: activeChangeOrder.access_token_hash ?? '',
        userAgent: navigator.userAgent,
      });
      setRequest((r) => r ? { ...r, client_decision: 'declined' } : r);
      setSigningState('declined');
    } catch (err) {
      setSigningError(err instanceof Error ? err.message : 'Failed to decline. Please try again.');
    } finally {
      setProcessingSign(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Change request not found.</p>
      </div>
    );
  }

  const isAwaitingApproval = request.status === 'quoted_awaiting_approval';
  const priorityConfig = PRIORITY_CONFIG[request.priority] ?? PRIORITY_CONFIG.medium;

  return (
    <div className="space-y-5 max-w-3xl">
      <button
        onClick={() => navigate(`${base}/change-requests`)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Change Requests
      </button>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 mb-1">{request.title}</h1>
            <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500">
              <span className="capitalize">{TYPE_LABELS[request.request_type] ?? request.request_type}</span>
              <span>&middot;</span>
              <span className={priorityConfig.color}>{priorityConfig.label} priority</span>
              <span>&middot;</span>
              <span>Submitted {new Date(request.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
          </div>
          <PortalStatusBadge status={request.status} size="lg" />
        </div>

        <StatusProgressBar status={request.status} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Request Details</h2>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{request.description}</p>

        <div className="grid grid-cols-2 gap-4 mt-4">
          {request.requested_due_date && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-gray-400" />
              <div>
                <div className="text-xs text-gray-400">Requested by</div>
                <div className="text-gray-700 font-medium">
                  {new Date(request.requested_due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-gray-400" />
            <div>
              <div className="text-xs text-gray-400">Submitted by</div>
              <div className="text-gray-700 font-medium">{request.client_name}</div>
            </div>
          </div>
        </div>
      </div>

      {(request.client_summary || (request.cost_impact_visible_to_client && request.cost_impact > 0) || (request.timeline_impact_visible_to_client && request.timeline_impact_days > 0)) && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Team Assessment</h2>

          {request.client_summary && (
            <p className="text-sm text-gray-700 leading-relaxed mb-4">{request.client_summary}</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            {request.cost_impact_visible_to_client && request.cost_impact > 0 && (
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-500">Cost Impact</div>
                  <div className="text-base font-bold text-gray-900">+${Number(request.cost_impact).toLocaleString()}</div>
                </div>
              </div>
            )}
            {request.timeline_impact_visible_to_client && request.timeline_impact_days > 0 && (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-500">Timeline Impact</div>
                  <div className="text-base font-bold text-gray-900">+{request.timeline_impact_days} days</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeChangeOrder && signingState === 'idle' && (
        <div className="bg-white rounded-2xl border border-orange-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            <h2 className="text-sm font-semibold text-gray-900">Change Order Awaiting Your Signature</h2>
          </div>

          {activeChangeOrder.frozen_html_snapshot ? (
            <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-200 mb-5">
              <iframe
                srcDoc={activeChangeOrder.frozen_html_snapshot}
                className="w-full h-80"
                title="Change Order Document"
                sandbox="allow-same-origin"
              />
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Additional Cost</span>
                <span className="font-semibold text-gray-900">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: activeChangeOrder.currency }).format(activeChangeOrder.cost_amount)}
                </span>
              </div>
              {activeChangeOrder.timeline_extension_days > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Timeline Extension</span>
                  <span className="font-semibold text-gray-900">+{activeChangeOrder.timeline_extension_days} days</span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">Your Signature</p>
              <SignatureCapture signerName={contactName} onSignatureChange={setSignatureData} />
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-blue-600"
              />
              <span className="text-xs text-gray-500 leading-relaxed">
                I agree to the terms outlined in this change order and authorize the described changes, including any additional costs and timeline extensions.
              </span>
            </label>

            {signingError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 flex-none" />
                {signingError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleSignChangeOrder}
                disabled={processingSign || !signatureData || !consentChecked}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors"
              >
                <PenTool className="w-4 h-4" />
                {processingSign ? 'Processing...' : 'Approve & Sign'}
              </button>
              <button
                onClick={handleDeclineChangeOrder}
                disabled={processingSign}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {signingState === 'signed' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900 mb-1">Change Order Signed</h3>
          <p className="text-sm text-gray-500">Thank you. The project team has been notified and will proceed with the changes.</p>
        </div>
      )}

      {signingState === 'declined' && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center">
          <XCircle className="w-8 h-8 text-gray-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900 mb-1">Change Order Declined</h3>
          <p className="text-sm text-gray-500">You have declined this change order. The project team will be in touch to discuss alternatives.</p>
        </div>
      )}

      {isAwaitingApproval && signingState === 'idle' && !activeChangeOrder && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            <h2 className="text-sm font-semibold text-gray-900">Action Required</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            This change request has been reviewed and is ready for your approval. Please review the details above and make your decision.
          </p>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => setActionState('approving')}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Approve Change
            </button>
            <button
              onClick={() => setActionState('rejecting')}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Reject Change
            </button>
            <button
              onClick={() => setActionState('clarifying')}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              Request Clarification
            </button>
          </div>
        </div>
      )}

      {(request.attachments?.length > 0 || request.change_orders?.some(o => o.status === 'signed')) && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Documents</h2>
          <div className="space-y-2">
            {request.change_orders?.filter(o => ['signed', 'sent', 'viewed'].includes(o.status)).map((order) => (
              <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{order.title}</div>
                    <div className={`text-xs capitalize ${
                      order.status === 'signed' ? 'text-emerald-600' :
                      order.status === 'sent' || order.status === 'viewed' ? 'text-amber-600' :
                      'text-gray-500'
                    }`}>
                      Change Order &middot; {order.status}
                    </div>
                  </div>
                </div>
                {order.frozen_html_snapshot && (
                  <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            {request.attachments?.map((att, i) => (
              <a
                key={i}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900">{att.name}</span>
                </div>
                <Download className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
              </a>
            ))}
          </div>
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
                    isClient ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                  }`}>
                    {(c.author_name ?? 'T').charAt(0).toUpperCase()}
                  </div>
                  <div className={`flex-1 max-w-[85%] rounded-2xl px-4 py-3 ${
                    isClient ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-900 rounded-tl-sm'
                  }`}>
                    <div className={`flex items-center gap-2 mb-1 ${isClient ? 'flex-row-reverse' : ''}`}>
                      <span className={`text-xs font-medium ${isClient ? 'text-blue-100' : 'text-gray-600'}`}>
                        {isClient ? 'You' : (c.author_name ?? 'Project Team')}
                      </span>
                      <span className={`text-xs ${isClient ? 'text-blue-200' : 'text-gray-400'}`}>
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
            placeholder="Send a message to the project team..."
            className="flex-1 px-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none text-gray-900 placeholder-gray-400"
          />
          <button
            onClick={handleSendMessage}
            disabled={sendingMessage || !newMessage.trim()}
            className="px-3 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl self-end transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {actionState === 'approving' && (
        <ApproveChangeModal
          request={request}
          onConfirm={handleApprove}
          onClose={() => setActionState('idle')}
        />
      )}

      {actionState === 'rejecting' && (
        <RejectChangeModal
          request={request}
          onConfirm={handleReject}
          onClose={() => setActionState('idle')}
        />
      )}

      {actionState === 'clarifying' && (
        <ClarificationModal
          authorName={contactName}
          onSend={handleClarification}
          onClose={() => setActionState('idle')}
        />
      )}
    </div>
  );
}

function StatusProgressBar({ status }: { status: string }) {
  const steps = [
    { key: 'submitted', label: 'Submitted' },
    { key: 'under_review', label: 'Under Review' },
    { key: 'quoted_awaiting_approval', label: 'Awaiting Approval' },
    { key: 'approved', label: 'Approved' },
    { key: 'completed', label: 'Completed' },
  ];

  const terminalStatuses = ['rejected', 'cancelled'];
  const stepKeys = steps.map((s) => s.key);
  const currentIndex = stepKeys.indexOf(status);

  if (terminalStatuses.includes(status)) {
    return (
      <div className="flex items-center gap-2 mt-4 py-2">
        <XCircle className="w-4 h-4 text-red-500" />
        <span className="text-sm text-red-600 font-medium capitalize">{status}</span>
      </div>
    );
  }

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
                active ? 'bg-blue-600 text-white' :
                'bg-gray-200 text-gray-400'
              }`}>
                {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs text-center leading-tight w-16 ${
                active ? 'text-blue-600 font-semibold' :
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
