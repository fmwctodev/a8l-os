import { useState, useEffect, useCallback } from 'react';
import {
  X,
  User,
  MessageSquare,
  Clock,
  DollarSign,
  Calendar,
  ChevronDown,
  Send,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Copy,
  ExternalLink,
  Plus,
  RotateCcw,
} from 'lucide-react';
import type {
  ProjectChangeRequest,
  ProjectChangeRequestComment,
  ProjectChangeRequestAuditEvent,
  ProjectChangeOrder,
  User as UserType,
} from '../../types';
import {
  updateChangeRequest,
  assignReviewer,
  getAuditEvents,
  generateClientPortalToken,
} from '../../services/projectChangeRequests';
import { getComments, addComment } from '../../services/projectChangeRequestComments';
import { createChangeOrder } from '../../services/projectChangeOrders';
import { ChangeRequestStatusBadge } from './ChangeRequestStatusBadge';
import { SendChangeOrderModal } from './SendChangeOrderModal';

const TYPE_LABELS: Record<string, string> = {
  scope: 'Scope',
  timeline: 'Timeline',
  design: 'Design',
  feature: 'Feature',
  bugfix: 'Bug Fix',
  support: 'Support',
  other: 'Other',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-slate-400',
  medium: 'text-amber-400',
  high: 'text-orange-400',
  critical: 'text-red-400',
};

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  submitted: ['under_review', 'needs_more_info', 'rejected', 'cancelled'],
  under_review: ['needs_more_info', 'quoted_awaiting_approval', 'rejected', 'cancelled'],
  needs_more_info: ['under_review', 'rejected', 'cancelled'],
  quoted_awaiting_approval: ['approved', 'rejected', 'cancelled'],
  approved: ['scheduled', 'in_progress', 'cancelled'],
  scheduled: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  rejected: [],
  completed: [],
  cancelled: ['submitted'],
};

const STATUS_ACTION_LABELS: Record<string, string> = {
  under_review: 'Start Review',
  needs_more_info: 'Request More Info',
  quoted_awaiting_approval: 'Send for Approval',
  approved: 'Approve',
  rejected: 'Reject',
  scheduled: 'Mark Scheduled',
  in_progress: 'Start Work',
  completed: 'Mark Complete',
  cancelled: 'Cancel',
  submitted: 'Reopen',
};

interface Props {
  changeRequest: ProjectChangeRequest;
  users: UserType[];
  canManage: boolean;
  canApprove: boolean;
  currentUserId: string;
  currentUserName: string;
  onClose: () => void;
  onUpdate: () => Promise<void>;
}

export function ChangeRequestDrawer({
  changeRequest: initialRequest,
  users,
  canManage,
  canApprove,
  currentUserId,
  currentUserName,
  onClose,
  onUpdate,
}: Props) {
  const [request, setRequest] = useState(initialRequest);
  const [comments, setComments] = useState<ProjectChangeRequestComment[]>([]);
  const [auditEvents, setAuditEvents] = useState<ProjectChangeRequestAuditEvent[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'audit'>('details');
  const [commentTab, setCommentTab] = useState<'internal' | 'client'>('internal');
  const [newComment, setNewComment] = useState('');
  const [addingComment, setSavingComment] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);
  const [assessment, setAssessment] = useState({
    scope_impact: request.scope_impact ?? '',
    timeline_impact_days: request.timeline_impact_days ?? 0,
    cost_impact: request.cost_impact ?? 0,
    internal_summary: request.internal_summary ?? '',
  });
  const [savingAssessment, setSavingAssessment] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [copiedPortalLink, setCopiedPortalLink] = useState(false);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [newOrder, setNewOrder] = useState({
    title: '',
    description: '',
    scope_changes: '',
    timeline_extension_days: 0,
    cost_amount: 0,
    currency: 'USD',
    terms_and_conditions: '',
  });
  const [savingOrder, setSavingOrder] = useState(false);
  const [sendOrderTarget, setSendOrderTarget] = useState<ProjectChangeOrder | null>(null);

  const loadData = useCallback(async () => {
    const [c, a] = await Promise.all([
      getComments(request.id, true),
      getAuditEvents(request.id),
    ]);
    setComments(c);
    setAuditEvents(a);
  }, [request.id]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleTransition(newStatus: string, reason?: string) {
    setTransitioning(true);
    try {
      const updated = await updateChangeRequest(
        request.id,
        { status: newStatus as any },
        currentUserId,
        currentUserName
      );
      if (reason) {
        await addComment({
          changeRequestId: request.id,
          orgId: request.org_id,
          body: reason,
          isInternal: true,
          authorType: 'user',
          authorUserId: currentUserId,
          authorName: currentUserName,
        });
      }
      setRequest(updated);
      await onUpdate();
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setTransitioning(false);
      setShowRejectDialog(false);
      setRejectReason('');
    }
  }

  async function handleSaveAssessment() {
    setSavingAssessment(true);
    try {
      const updated = await updateChangeRequest(
        request.id,
        {
          scope_impact: assessment.scope_impact || undefined,
          timeline_impact_days: assessment.timeline_impact_days,
          cost_impact: assessment.cost_impact,
          internal_summary: assessment.internal_summary || undefined,
        },
        currentUserId,
        currentUserName
      );
      setRequest(updated);
      setShowAssessment(false);
      await onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingAssessment(false);
    }
  }

  async function handleAssignReviewer(userId: string) {
    try {
      await assignReviewer(request.id, userId, currentUserId);
      const updated = { ...request, reviewer_user_id: userId, reviewer: users.find((u) => u.id === userId) ?? null };
      setRequest(updated);
      await onUpdate();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleAddComment() {
    if (!newComment.trim()) return;
    setSavingComment(true);
    try {
      const comment = await addComment({
        changeRequestId: request.id,
        orgId: request.org_id,
        body: newComment,
        isInternal: commentTab === 'internal',
        authorType: 'user',
        authorUserId: currentUserId,
        authorName: currentUserName,
      });
      setComments((c) => [...c, comment]);
      setNewComment('');
    } catch (err) {
      console.error(err);
    } finally {
      setSavingComment(false);
    }
  }

  async function handleCopyPortalLink() {
    try {
      const { clientPortalUrl } = await generateClientPortalToken(request.id);
      await navigator.clipboard.writeText(clientPortalUrl);
      setCopiedPortalLink(true);
      setTimeout(() => setCopiedPortalLink(false), 2500);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCreateOrder() {
    if (!newOrder.title.trim()) return;
    setSavingOrder(true);
    try {
      await createChangeOrder({
        org_id: request.org_id,
        project_id: request.project_id,
        change_request_id: request.id,
        ...newOrder,
      }, currentUserId);
      setShowCreateOrder(false);
      setNewOrder({ title: '', description: '', scope_changes: '', timeline_extension_days: 0, cost_amount: 0, currency: 'USD', terms_and_conditions: '' });
      await onUpdate();
      const refreshed = { ...request };
      setRequest(refreshed);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingOrder(false);
    }
  }

  const existingOrders = request.change_orders ?? [];
  const activeOrder = existingOrders.find((o) => !['voided', 'declined'].includes(o.status));
  const allowedTransitions = ALLOWED_TRANSITIONS[request.status] ?? [];
  const filteredComments = comments.filter((c) => commentTab === 'internal' ? true : !c.is_internal);

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative w-full max-w-2xl bg-slate-900 border-l border-slate-700 flex flex-col h-full overflow-hidden shadow-2xl">
          <div className="flex-none border-b border-slate-700 px-6 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <ChangeRequestStatusBadge status={request.status} />
                  <span className={`text-xs font-medium capitalize ${PRIORITY_COLORS[request.priority]}`}>
                    {request.priority} priority
                  </span>
                  <span className="text-xs text-slate-500">{TYPE_LABELS[request.request_type]}</span>
                </div>
                <h2 className="text-base font-semibold text-white mt-1.5 leading-snug">{request.title}</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Submitted by {request.client_name} · {new Date(request.created_at).toLocaleDateString()}
                </p>
              </div>
              <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg flex-none">
                <X className="w-4 h-4" />
              </button>
            </div>

            {canManage && allowedTransitions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {allowedTransitions.map((status) => {
                  const isReject = status === 'rejected';
                  return (
                    <button
                      key={status}
                      onClick={() => isReject ? setShowRejectDialog(true) : handleTransition(status)}
                      disabled={transitioning}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                        isReject
                          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                          : status === 'approved'
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : status === 'completed'
                          ? 'bg-emerald-600/80 text-white hover:bg-emerald-600'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                      }`}
                    >
                      {STATUS_ACTION_LABELS[status] ?? status.replace(/_/g, ' ')}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex-none border-b border-slate-700 px-6">
            <nav className="flex gap-1">
              {(['details', 'comments', 'audit'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-2.5 text-xs font-medium capitalize transition-colors border-b-2 ${
                    activeTab === tab
                      ? 'border-cyan-500 text-cyan-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  {tab}
                  {tab === 'comments' && comments.length > 0 && (
                    <span className="ml-1.5 text-xs bg-slate-700 text-slate-300 rounded-full px-1.5">
                      {comments.length}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === 'details' && (
              <div className="p-6 space-y-5">
                <Section title="Client Info">
                  <InfoRow label="Name" value={request.client_name} />
                  {request.client_email && <InfoRow label="Email" value={request.client_email} />}
                  {request.client_phone && <InfoRow label="Phone" value={request.client_phone} />}
                  {request.requested_due_date && (
                    <InfoRow label="Requested By" value={new Date(request.requested_due_date).toLocaleDateString()} />
                  )}
                  <InfoRow label="Source" value={request.source.replace('_', ' ')} />
                </Section>

                <Section title="Description">
                  <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{request.description}</p>
                </Section>

                <Section title="Reviewer">
                  {canManage ? (
                    <select
                      value={request.reviewer_user_id ?? ''}
                      onChange={(e) => e.target.value && handleAssignReviewer(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="">Unassigned</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  ) : (
                    <InfoRow label="" value={request.reviewer?.name ?? 'Unassigned'} />
                  )}
                </Section>

                <Section
                  title="Internal Assessment"
                  action={canManage ? (
                    <button
                      onClick={() => setShowAssessment(!showAssessment)}
                      className="text-xs text-cyan-400 hover:text-cyan-300"
                    >
                      {showAssessment ? 'Cancel' : 'Edit'}
                    </button>
                  ) : undefined}
                >
                  {showAssessment ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Scope Impact</label>
                        <textarea
                          value={assessment.scope_impact}
                          onChange={(e) => setAssessment((a) => ({ ...a, scope_impact: e.target.value }))}
                          rows={2}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Timeline Impact (days)</label>
                          <input
                            type="number"
                            value={assessment.timeline_impact_days}
                            onChange={(e) => setAssessment((a) => ({ ...a, timeline_impact_days: Number(e.target.value) }))}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Cost Impact ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={assessment.cost_impact}
                            onChange={(e) => setAssessment((a) => ({ ...a, cost_impact: Number(e.target.value) }))}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Internal Summary</label>
                        <textarea
                          value={assessment.internal_summary}
                          onChange={(e) => setAssessment((a) => ({ ...a, internal_summary: e.target.value }))}
                          rows={2}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 resize-none"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setShowAssessment(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">Cancel</button>
                        <button onClick={handleSaveAssessment} disabled={savingAssessment} className="px-3 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg disabled:opacity-50">
                          {savingAssessment ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {request.scope_impact ? (
                        <InfoRow label="Scope" value={request.scope_impact} />
                      ) : null}
                      <div className="flex gap-4">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-400">+{request.timeline_impact_days ?? 0} days</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-400">+${Number(request.cost_impact ?? 0).toLocaleString()}</span>
                        </div>
                      </div>
                      {request.internal_summary && (
                        <p className="text-xs text-slate-400 leading-relaxed">{request.internal_summary}</p>
                      )}
                    </div>
                  )}
                </Section>

                <Section
                  title="Change Order"
                  action={canManage && !activeOrder ? (
                    <button
                      onClick={() => setShowCreateOrder(!showCreateOrder)}
                      className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                    >
                      <Plus className="w-3 h-3" /> Create
                    </button>
                  ) : undefined}
                >
                  {activeOrder ? (
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-white">{activeOrder.title}</p>
                        <OrderStatusBadge status={activeOrder.status} />
                      </div>
                      <div className="flex gap-4 text-xs text-slate-400">
                        <span>+${Number(activeOrder.cost_amount).toLocaleString()}</span>
                        {activeOrder.timeline_extension_days > 0 && (
                          <span>+{activeOrder.timeline_extension_days}d</span>
                        )}
                      </div>
                      {canManage && activeOrder.status === 'draft' && (
                        <button
                          onClick={() => setSendOrderTarget(activeOrder)}
                          className="w-full mt-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Send className="w-3.5 h-3.5" /> Send for Signature
                        </button>
                      )}
                      {(activeOrder.status === 'sent' || activeOrder.status === 'viewed') && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-400">
                          <Clock className="w-3.5 h-3.5" /> Awaiting client signature
                        </div>
                      )}
                      {activeOrder.status === 'signed' && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Signed by {activeOrder.signer_name}
                        </div>
                      )}
                    </div>
                  ) : showCreateOrder ? (
                    <div className="space-y-3">
                      <input
                        value={newOrder.title}
                        onChange={(e) => setNewOrder((o) => ({ ...o, title: e.target.value }))}
                        placeholder="Change order title"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                      />
                      <textarea
                        value={newOrder.description}
                        onChange={(e) => setNewOrder((o) => ({ ...o, description: e.target.value }))}
                        rows={2}
                        placeholder="Description of changes"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 resize-none"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Cost Amount ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={newOrder.cost_amount}
                            onChange={(e) => setNewOrder((o) => ({ ...o, cost_amount: Number(e.target.value) }))}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Timeline Extension (days)</label>
                          <input
                            type="number"
                            value={newOrder.timeline_extension_days}
                            onChange={(e) => setNewOrder((o) => ({ ...o, timeline_extension_days: Number(e.target.value) }))}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      </div>
                      <textarea
                        value={newOrder.terms_and_conditions}
                        onChange={(e) => setNewOrder((o) => ({ ...o, terms_and_conditions: e.target.value }))}
                        rows={2}
                        placeholder="Terms & conditions (optional)"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 resize-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setShowCreateOrder(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">Cancel</button>
                        <button onClick={handleCreateOrder} disabled={savingOrder || !newOrder.title} className="px-3 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg">
                          {savingOrder ? 'Creating...' : 'Create Order'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No change order created yet.</p>
                  )}
                </Section>

                <Section title="Client Portal">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyPortalLink}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-xs rounded-lg transition-colors"
                    >
                      {copiedPortalLink ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedPortalLink ? 'Copied!' : 'Copy Client Status Link'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Share this link with {request.client_name} to let them view the request status and sign any pending change orders.
                  </p>
                </Section>
              </div>
            )}

            {activeTab === 'comments' && (
              <div className="p-6 flex flex-col gap-4">
                <div className="flex gap-2 bg-slate-800 rounded-lg p-1 w-fit">
                  {(['internal', 'client'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setCommentTab(t)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                        commentTab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {t === 'internal' ? 'Internal Notes' : 'Client-Visible'}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  {filteredComments.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">
                      No {commentTab === 'internal' ? 'internal notes' : 'client-visible comments'} yet.
                    </p>
                  ) : (
                    filteredComments.map((c) => (
                      <div key={c.id} className="flex gap-3">
                        <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center flex-none text-xs font-semibold text-slate-300">
                          {(c.author_name ?? c.author_user?.name ?? 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-white">
                              {c.author_name ?? c.author_user?.name ?? 'Unknown'}
                            </span>
                            {!c.is_internal && (
                              <span className="text-xs bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full border border-cyan-500/30">
                                Client Visible
                              </span>
                            )}
                            <span className="text-xs text-slate-500 ml-auto">
                              {new Date(c.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{c.body}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {canManage && (
                  <div className="flex gap-2 mt-2">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      rows={2}
                      placeholder={`Add ${commentTab === 'internal' ? 'internal note' : 'client-visible comment'}...`}
                      className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                    />
                    <button
                      onClick={handleAddComment}
                      disabled={addingComment || !newComment.trim()}
                      className="px-3 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg self-end transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'audit' && (
              <div className="p-6">
                {auditEvents.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">No audit events recorded yet.</p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-3.5 top-0 bottom-0 w-px bg-slate-700" />
                    <div className="space-y-4">
                      {auditEvents.map((ev) => (
                        <div key={ev.id} className="flex gap-3 relative">
                          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center flex-none z-10">
                            <div className="w-2 h-2 rounded-full bg-cyan-500" />
                          </div>
                          <div className="flex-1 pb-1">
                            <p className="text-xs font-medium text-white capitalize">
                              {ev.event_type.replace(/_/g, ' ')}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {ev.actor_name && (
                                <span className="text-xs text-slate-400">{ev.actor_name}</span>
                              )}
                              <span className="text-xs text-slate-600">
                                {new Date(ev.created_at).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showRejectDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowRejectDialog(false)} />
          <div className="relative bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Reject Change Request</h3>
                <p className="text-xs text-slate-400">Provide a reason for the client</p>
              </div>
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Reason for rejection..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-red-500 resize-none mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowRejectDialog(false)} className="px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">Cancel</button>
              <button
                onClick={() => handleTransition('rejected', rejectReason)}
                disabled={transitioning}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm rounded-lg"
              >
                {transitioning ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {sendOrderTarget && (
        <SendChangeOrderModal
          changeOrder={sendOrderTarget}
          changeRequest={request}
          onClose={() => setSendOrderTarget(null)}
          onSent={async () => {
            setSendOrderTarget(null);
            await onUpdate();
          }}
          currentUserId={currentUserId}
        />
      )}
    </>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{title}</h4>
        {action}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-1">
      {label && <span className="text-xs text-slate-500 w-20 flex-none">{label}</span>}
      <span className="text-sm text-slate-300">{value}</span>
    </div>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'bg-slate-500/20 text-slate-400',
    sent: 'bg-amber-500/20 text-amber-400',
    viewed: 'bg-blue-500/20 text-blue-400',
    signed: 'bg-emerald-500/20 text-emerald-400',
    declined: 'bg-red-500/20 text-red-400',
    voided: 'bg-slate-500/20 text-slate-500',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${map[status] ?? ''}`}>
      {status}
    </span>
  );
}
