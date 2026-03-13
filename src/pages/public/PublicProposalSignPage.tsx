import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { SignatureCapture } from '../../components/proposals/SignatureCapture';
import type { Proposal, ProposalSignatureRequest } from '../../types';
import {
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  PenTool,
  ChevronDown,
  ChevronUp,
  DollarSign,
} from 'lucide-react';

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashContent(content: string): Promise<string> {
  return hashToken(content);
}

type PageState = 'loading' | 'invalid' | 'expired' | 'already_signed' | 'declined' | 'voided' | 'ready' | 'signing' | 'signed' | 'decline_form';

export function PublicProposalSignPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [pageState, setPageState] = useState<PageState>('loading');
  const [request, setRequest] = useState<ProposalSignatureRequest | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const [signatureData, setSignatureData] = useState<{
    type: 'typed' | 'drawn';
    text?: string;
    imageDataUrl?: string;
  } | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    verifyAndLoad();
  }, [requestId, token]);

  const verifyAndLoad = async () => {
    if (!requestId || !token) {
      setPageState('invalid');
      return;
    }

    try {
      const tokenHash = await hashToken(token);

      const { data: req, error: reqError } = await supabase
        .from('proposal_signature_requests')
        .select('*')
        .eq('id', requestId)
        .eq('access_token_hash', tokenHash)
        .maybeSingle();

      if (reqError || !req) {
        setPageState('invalid');
        return;
      }

      setRequest(req);

      if (req.status === 'signed') {
        setPageState('already_signed');
        return;
      }
      if (req.status === 'declined') {
        setPageState('declined');
        return;
      }
      if (req.status === 'voided') {
        setPageState('voided');
        return;
      }
      if (new Date(req.expires_at) < new Date()) {
        setPageState('expired');
        return;
      }

      const { data: proposalData, error: proposalError } = await supabase
        .from('proposals')
        .select(`
          *,
          contact:contacts(first_name, last_name, email, company, phone),
          line_items:proposal_line_items(name, description, quantity, unit_price, discount_percent, sort_order),
          sections:proposal_sections(id, title, content, section_type, sort_order)
        `)
        .eq('id', req.proposal_id)
        .maybeSingle();

      if (proposalError || !proposalData) {
        setPageState('invalid');
        return;
      }

      setProposal(proposalData);

      if (!req.viewed_at) {
        await supabase
          .from('proposal_signature_requests')
          .update({ viewed_at: new Date().toISOString(), status: 'viewed' })
          .eq('id', requestId);

        await supabase
          .from('proposals')
          .update({ signature_status: 'viewed' })
          .eq('id', req.proposal_id)
          .in('signature_status', ['pending_signature']);

        await supabase.from('proposal_audit_events').insert({
          org_id: proposalData.org_id,
          proposal_id: req.proposal_id,
          event_type: 'viewed',
          actor_type: 'signer',
          metadata: { request_id: requestId },
        });
      }

      setPageState('ready');
    } catch (err) {
      console.error('Verification failed:', err);
      setPageState('invalid');
    }
  };

  const handleSign = async () => {
    if (!request || !proposal || !signatureData || !consentChecked) return;

    try {
      setIsSubmitting(true);
      setError(null);
      setPageState('signing');

      let signatureImageUrl: string | null = null;
      if (signatureData.imageDataUrl) {
        const base64Data = signatureData.imageDataUrl.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' });

        const path = `${proposal.org_id}/${request.id}/signature.png`;
        await supabase.storage
          .from('proposal-signatures')
          .upload(path, blob, { contentType: 'image/png', upsert: true });

        const { data: urlData } = supabase.storage
          .from('proposal-signatures')
          .getPublicUrl(path);

        signatureImageUrl = urlData.publicUrl;
      }

      const documentHash = proposal.frozen_html_snapshot
        ? await hashContent(proposal.frozen_html_snapshot)
        : 'no-snapshot';

      const consentText = `I, ${request.signer_name}, agree to electronically sign this proposal. I understand this constitutes a legally binding signature.`;

      const { error: sigError } = await supabase
        .from('proposal_signatures')
        .insert({
          org_id: proposal.org_id,
          proposal_id: proposal.id,
          signature_request_id: request.id,
          signature_type: signatureData.type,
          signature_text: signatureData.text || null,
          signature_image_url: signatureImageUrl,
          signer_name: request.signer_name,
          signer_email: request.signer_email,
          ip_address: null,
          user_agent: navigator.userAgent,
          consent_text: consentText,
          document_hash: documentHash,
        });

      if (sigError) throw sigError;

      const now = new Date().toISOString();

      await supabase
        .from('proposal_signature_requests')
        .update({ status: 'signed', signed_at: now })
        .eq('id', request.id);

      await supabase
        .from('proposals')
        .update({
          signature_status: 'signed',
          signed_at: now,
          signer_name: request.signer_name,
          signer_email: request.signer_email,
        })
        .eq('id', proposal.id);

      await supabase.from('proposal_audit_events').insert({
        org_id: proposal.org_id,
        proposal_id: proposal.id,
        event_type: 'signed',
        actor_type: 'signer',
        metadata: {
          request_id: request.id,
          signer_name: request.signer_name,
          signer_email: request.signer_email,
          user_agent: navigator.userAgent,
          document_hash: documentHash,
        },
      });

      setPageState('signed');
      topRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      console.error('Signing failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit signature');
      setPageState('ready');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!request || !proposal) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const now = new Date().toISOString();

      await supabase
        .from('proposal_signature_requests')
        .update({
          status: 'declined',
          declined_at: now,
          decline_reason: declineReason || null,
        })
        .eq('id', request.id);

      await supabase
        .from('proposals')
        .update({
          signature_status: 'declined',
          declined_at: now,
        })
        .eq('id', proposal.id);

      await supabase.from('proposal_audit_events').insert({
        org_id: proposal.org_id,
        proposal_id: proposal.id,
        event_type: 'declined',
        actor_type: 'signer',
        metadata: {
          request_id: request.id,
          reason: declineReason || null,
          user_agent: navigator.userAgent,
        },
      });

      setPageState('declined');
      topRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      console.error('Decline failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to decline');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatCurrency = (amount: number, currency = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  const formatDate = (d: string | null) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-300">Verifying your signing link...</p>
        </div>
      </div>
    );
  }

  if (pageState === 'invalid') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Invalid Signing Link</h1>
          <p className="text-slate-400">
            This signing link is invalid or has been revoked. Please contact the sender for a new link.
          </p>
        </div>
      </div>
    );
  }

  if (pageState === 'expired') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center">
          <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Signing Link Expired</h1>
          <p className="text-slate-400">
            This signing request has expired. Please contact the sender to request a new link.
          </p>
        </div>
      </div>
    );
  }

  if (pageState === 'already_signed') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Already Signed</h1>
          <p className="text-slate-400">This proposal has already been signed. No further action is needed.</p>
        </div>
      </div>
    );
  }

  if (pageState === 'voided') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center">
          <div className="w-16 h-16 bg-slate-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-slate-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Signing Request Voided</h1>
          <p className="text-slate-400">This signing request has been voided by the sender.</p>
        </div>
      </div>
    );
  }

  if (pageState === 'signed') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" ref={topRef}>
        <div className="max-w-md w-full bg-slate-900 rounded-2xl border border-emerald-500/30 p-8 text-center">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Proposal Signed</h1>
          <p className="text-slate-400 mb-6">
            Your signature has been recorded. The sender has been notified.
          </p>
          <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700">
            <p className="text-sm text-slate-300">
              A signed copy of this proposal will be available from the sender.
              You can safely close this page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (pageState === 'declined') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" ref={topRef}>
        <div className="max-w-md w-full bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Proposal Declined</h1>
          <p className="text-slate-400">The sender has been notified of your decision.</p>
        </div>
      </div>
    );
  }

  const sections = [...(proposal?.sections || [])].sort((a, b) => a.sort_order - b.sort_order);
  const lineItems = [...(proposal?.line_items || [])].sort((a, b) => a.sort_order - b.sort_order);
  const nonPricingSections = sections.filter((s) => s.section_type !== 'pricing');

  return (
    <div className="min-h-screen bg-slate-950" ref={topRef}>
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Proposal for your review</p>
            <h1 className="text-xl font-bold text-white">{proposal?.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4 mb-8">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-sm font-medium">
            <PenTool className="w-3.5 h-3.5" />
            Signature Requested
          </span>
          {request?.expires_at && (
            <span className="text-sm text-slate-400">
              Expires {formatDate(request.expires_at)}
            </span>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {proposal?.total_value > 0 && (
          <div className="mb-6 p-5 bg-slate-900 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Total Value</span>
              <span className="text-2xl font-bold text-cyan-400 flex items-center gap-1">
                <DollarSign className="w-5 h-5" />
                {formatCurrency(proposal.total_value, proposal.currency).replace('$', '')}
              </span>
            </div>
          </div>
        )}

        {nonPricingSections.length > 0 && (
          <div className="space-y-3 mb-6">
            {nonPricingSections.map((section) => (
              <div
                key={section.id}
                className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden"
              >
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-800/50 transition-colors"
                >
                  <h3 className="font-medium text-white">{section.title}</h3>
                  {expandedSections.has(section.id) ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </button>
                {expandedSections.has(section.id) && (
                  <div className="px-5 pb-5">
                    <div
                      className="prose prose-invert prose-sm max-w-none text-slate-300"
                      dangerouslySetInnerHTML={{ __html: section.content }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {lineItems.length > 0 && (
          <div className="mb-6 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800">
              <h3 className="font-medium text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-cyan-400" />
                Pricing
              </h3>
            </div>
            <div className="divide-y divide-slate-800">
              {lineItems.map((item, idx) => {
                const lineTotal = item.quantity * item.unit_price;
                const discount = lineTotal * (item.discount_percent / 100);
                const total = lineTotal - discount;
                return (
                  <div key={idx} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-white text-sm">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-slate-400">{item.description}</p>
                      )}
                    </div>
                    <p className="text-white font-medium text-sm">
                      {formatCurrency(total, proposal?.currency)}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-4 border-t border-slate-700 flex items-center justify-between bg-slate-800/40">
              <span className="font-semibold text-white">Total</span>
              <span className="text-lg font-bold text-cyan-400">
                {formatCurrency(proposal?.total_value || 0, proposal?.currency)}
              </span>
            </div>
          </div>
        )}

        {pageState === 'decline_form' ? (
          <div className="bg-slate-900 rounded-xl border border-red-500/30 p-6 mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">Decline This Proposal</h3>
            <p className="text-sm text-slate-400 mb-4">
              Please let the sender know why you are declining. This is optional.
            </p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Reason for declining (optional)"
              rows={3}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-red-500/50 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setPageState('ready')}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2.5 text-slate-300 hover:text-white border border-slate-700 rounded-lg transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleDecline}
                disabled={isSubmitting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 text-white rounded-lg transition-colors"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                Confirm Decline
              </button>
            </div>
          </div>
        ) : pageState === 'signing' ? (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-8 text-center mb-6">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
            <p className="text-slate-300">Recording your signature...</p>
          </div>
        ) : (
          <div className="bg-slate-900 rounded-xl border border-cyan-500/30 p-6 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                <PenTool className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Sign This Proposal</h3>
                <p className="text-sm text-slate-400">
                  By signing, you agree to the terms outlined above
                </p>
              </div>
            </div>

            <div className="mb-6">
              <SignatureCapture
                signerName={request?.signer_name || ''}
                onSignatureChange={setSignatureData}
              />
            </div>

            <label className="flex items-start gap-3 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500/50"
              />
              <span className="text-sm text-slate-300">
                I agree to electronically sign this proposal. I understand this constitutes a
                legally binding signature and that the document content has been presented to
                me in full.
              </span>
            </label>

            <div className="flex gap-3">
              <button
                onClick={() => setPageState('decline_form')}
                disabled={isSubmitting}
                className="px-5 py-2.5 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/50 rounded-lg transition-colors"
              >
                Decline
              </button>
              <button
                onClick={handleSign}
                disabled={!signatureData || !consentChecked || isSubmitting}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <PenTool className="w-4 h-4" />
                )}
                Sign Proposal
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 text-slate-500 text-xs mt-8">
          <Shield className="w-3.5 h-3.5" />
          <span>Secured by Autom8ion Lab. Your signature is encrypted and tamper-evident.</span>
        </div>
      </div>
    </div>
  );
}
