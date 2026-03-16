import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  MessageSquare,
  FileText,
  DollarSign,
  Calendar,
  Send,
  XCircle,
  PenTool,
} from 'lucide-react';
import type { ProjectChangeRequest, ProjectChangeOrder } from '../../types';
import { verifyClientPortalToken } from '../../services/projectChangeRequests';
import { getChangeOrderForSigning, signChangeOrder, declineChangeOrder, uploadChangeOrderSignatureImage } from '../../services/projectChangeOrders';
import { getComments, addComment } from '../../services/projectChangeRequestComments';
import { SignatureCapture } from '../../components/proposals/SignatureCapture';
import type { ProjectChangeRequestComment } from '../../types';
import { ChangeRequestStatusBadge } from '../../components/projects/ChangeRequestStatusBadge';

type PageState = 'loading' | 'invalid' | 'ready' | 'signing' | 'signed' | 'declined' | 'error';

interface SignatureData {
  type: 'typed' | 'drawn';
  text?: string;
  imageDataUrl: string;
}

export function PublicChangeRequestStatusPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const [searchParams] = useSearchParams();
  const rawToken = searchParams.get('token');

  const [pageState, setPageState] = useState<PageState>('loading');
  const [changeRequest, setChangeRequest] = useState<ProjectChangeRequest | null>(null);
  const [changeOrder, setChangeOrder] = useState<ProjectChangeOrder | null>(null);
  const [comments, setComments] = useState<ProjectChangeRequestComment[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [signatureData, setSignatureData] = useState<SignatureData | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function load() {
      if (!requestId || !rawToken) {
        setPageState('invalid');
        return;
      }
      const request = await verifyClientPortalToken(requestId, rawToken);
      if (!request) {
        setPageState('invalid');
        return;
      }
      setChangeRequest(request);

      const orders = request.change_orders ?? [];
      const active = orders.find((o) => ['sent', 'viewed'].includes(o.status));
      if (active) {
        setChangeOrder(active);
      }

      const msgs = await getComments(requestId, false);
      setComments(msgs);
      setPageState('ready');
    }
    load();
  }, [requestId, rawToken]);

  async function handleSendMessage() {
    if (!newMessage.trim() || !changeRequest) return;
    setSendingMessage(true);
    try {
      const c = await addComment({
        changeRequestId: changeRequest.id,
        orgId: changeRequest.org_id,
        body: newMessage,
        isInternal: false,
        authorType: 'client',
        authorName: changeRequest.client_name,
      });
      setComments((prev) => [...prev, c]);
      setNewMessage('');
    } catch (err) {
      console.error(err);
    } finally {
      setSendingMessage(false);
    }
  }

  async function handleSign() {
    if (!signatureData || !consentChecked || !changeOrder || !changeRequest || !rawToken) return;
    setProcessing(true);
    setErrorMsg('');
    try {
      let signatureImageUrl: string | undefined;
      if (signatureData.imageDataUrl) {
        signatureImageUrl = await uploadChangeOrderSignatureImage(
          changeRequest.org_id,
          changeOrder.id,
          signatureData.imageDataUrl
        ) ?? undefined;
      }

      const ipRes = await fetch('https://api.ipify.org?format=json').catch(() => null);
      const ipData = ipRes ? await ipRes.json().catch(() => null) : null;

      await signChangeOrder({
        changeOrderId: changeOrder.id,
        changeRequest,
        rawToken: searchParams.get('orderToken') ?? rawToken,
        signatureType: signatureData.type,
        signatureText: signatureData.text,
        signatureImageUrl,
        signerName: changeRequest.client_name,
        signerEmail: changeRequest.client_email ?? '',
        consentText: 'I agree to the terms outlined in this change order and authorize the described changes.',
        ipAddress: ipData?.ip,
        userAgent: navigator.userAgent,
      });

      setChangeRequest((r) => r ? { ...r, status: 'approved', client_decision: 'approved' } : r);
      setChangeOrder((o) => o ? { ...o, status: 'signed' } : o);
      setPageState('signed');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Signing failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleDecline() {
    if (!changeOrder || !changeRequest || !rawToken) return;
    setProcessing(true);
    setErrorMsg('');
    try {
      await declineChangeOrder({
        changeOrderId: changeOrder.id,
        changeRequest,
        rawToken: searchParams.get('orderToken') ?? rawToken,
        reason: declineReason || undefined,
        ipAddress: undefined,
      });
      setChangeRequest((r) => r ? { ...r, client_decision: 'declined' } : r);
      setChangeOrder((o) => o ? { ...o, status: 'declined' } : o);
      setPageState('declined');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to decline. Please try again.');
    } finally {
      setProcessing(false);
      setShowDeclineForm(false);
    }
  }

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  if (pageState === 'invalid') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Invalid or Expired Link</h1>
          <p className="text-slate-400 text-sm">This status link is invalid or has expired. Please contact the project team for a new link.</p>
        </div>
      </div>
    );
  }

  if (pageState === 'signed') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Change Order Signed</h1>
            <p className="text-slate-400 text-sm">
              Thank you! Your approval has been recorded. The project team has been notified and work will proceed according to the agreed terms.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (pageState === 'declined') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
            <div className="w-16 h-16 bg-slate-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <XCircle className="w-8 h-8 text-slate-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Change Order Declined</h1>
            <p className="text-slate-400 text-sm">
              You have declined this change order. The project team has been notified and will be in touch to discuss alternatives.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!changeRequest) return null;

  const hasSignableOrder = changeOrder && ['sent', 'viewed'].includes(changeOrder.status);

  return (
    <div className="min-h-screen bg-slate-950 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="text-center mb-6">
          <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
            <FileText className="w-5 h-5 text-cyan-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Change Request Status</h1>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">{changeRequest.title}</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Submitted {new Date(changeRequest.created_at).toLocaleDateString()}
              </p>
            </div>
            <ChangeRequestStatusBadge status={changeRequest.status} />
          </div>

          <StatusTimeline status={changeRequest.status} />

          <div className="mt-5 pt-5 border-t border-slate-800">
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{changeRequest.description}</p>
          </div>

          {(changeRequest.timeline_impact_days > 0 || changeRequest.cost_impact > 0) && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {changeRequest.timeline_impact_days > 0 && (
                <div className="bg-slate-800 rounded-xl p-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Timeline Impact</p>
                    <p className="text-sm font-semibold text-white">+{changeRequest.timeline_impact_days} days</p>
                  </div>
                </div>
              )}
              {changeRequest.cost_impact > 0 && (
                <div className="bg-slate-800 rounded-xl p-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Cost Impact</p>
                    <p className="text-sm font-semibold text-white">+${Number(changeRequest.cost_impact).toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {hasSignableOrder && changeOrder && (
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <h3 className="text-sm font-semibold text-white">Change Order Awaiting Your Approval</h3>
            </div>

            {changeOrder.frozen_html_snapshot ? (
              <div className="bg-white rounded-xl overflow-hidden border border-slate-700 mb-5">
                <iframe
                  srcDoc={changeOrder.frozen_html_snapshot}
                  className="w-full h-96"
                  title="Change Order Document"
                  sandbox="allow-same-origin"
                />
              </div>
            ) : (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-5 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Additional Cost</span>
                  <span className="text-white font-semibold">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: changeOrder.currency }).format(changeOrder.cost_amount)}
                  </span>
                </div>
                {changeOrder.timeline_extension_days > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Timeline Extension</span>
                    <span className="text-white font-semibold">+{changeOrder.timeline_extension_days} days</span>
                  </div>
                )}
              </div>
            )}

            {!showDeclineForm && pageState === 'ready' && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-300 mb-2">Your Signature</p>
                  <SignatureCapture
                    signerName={changeRequest.client_name}
                    onSignatureChange={setSignatureData}
                  />
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-cyan-500"
                  />
                  <span className="text-xs text-slate-400 leading-relaxed">
                    I agree to the terms outlined in this change order and authorize the described changes, including any additional costs and timeline extensions.
                  </span>
                </label>

                {errorMsg && (
                  <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <AlertCircle className="w-4 h-4 flex-none" />
                    {errorMsg}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleSign}
                    disabled={processing || !signatureData || !consentChecked}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {processing ? 'Processing...' : 'Approve & Sign'}
                  </button>
                  <button
                    onClick={() => setShowDeclineForm(true)}
                    className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-sm rounded-xl transition-colors"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}

            {showDeclineForm && (
              <div className="space-y-3">
                <p className="text-sm text-slate-300">Please let us know why you are declining this change order:</p>
                <textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  rows={3}
                  placeholder="Reason (optional)"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-red-500 resize-none"
                />
                {errorMsg && (
                  <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <AlertCircle className="w-4 h-4 flex-none" />
                    {errorMsg}
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setShowDeclineForm(false)} className="flex-1 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-colors">
                    Back
                  </button>
                  <button
                    onClick={handleDecline}
                    disabled={processing}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm rounded-xl transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    {processing ? 'Processing...' : 'Confirm Decline'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-white">Messages</h3>
          </div>

          {comments.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No messages yet.</p>
          ) : (
            <div className="space-y-3 mb-4">
              {comments.map((c) => (
                <div key={c.id} className={`flex gap-3 ${c.author_type === 'client' ? 'flex-row-reverse' : ''}`}>
                  <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-slate-300 flex-none">
                    {(c.author_name ?? 'T').charAt(0).toUpperCase()}
                  </div>
                  <div className={`flex-1 rounded-xl px-3 py-2.5 ${c.author_type === 'client' ? 'bg-cyan-600/20 border border-cyan-500/30' : 'bg-slate-800 border border-slate-700'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-white">{c.author_name ?? 'Team'}</span>
                      <span className="text-xs text-slate-500">{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{c.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={2}
              placeholder="Send a message to the project team..."
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
            />
            <button
              onClick={handleSendMessage}
              disabled={sendingMessage || !newMessage.trim()}
              className="px-3 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg self-end transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusTimeline({ status }: { status: string }) {
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
      <div className="flex items-center gap-2 py-2">
        <XCircle className="w-4 h-4 text-red-400" />
        <span className="text-xs text-red-400 capitalize font-medium">{status}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 mt-4">
      {steps.map((step, i) => {
        const done = currentIndex > i;
        const active = currentIndex === i;
        return (
          <div key={step.key} className="flex items-center gap-1 flex-1">
            <div className="flex flex-col items-center gap-1 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                done ? 'bg-emerald-500 text-white' : active ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-500'
              }`}>
                {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-xs text-center leading-tight ${active ? 'text-cyan-400 font-medium' : done ? 'text-emerald-400' : 'text-slate-500'}`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-px flex-1 mt-0 mb-4 ${done ? 'bg-emerald-500' : 'bg-slate-700'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
