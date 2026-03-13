import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { freezeProposal, createSignatureRequest } from '../../services/proposalSigning';
import { sendEmail } from '../../services/emailSend';
import { getEmailDefaults } from '../../services/emailDefaults';
import { buildSignatureRequestEmail } from '../../services/proposalSigningEmails';
import { createProposalActivity } from '../../services/proposals';
import type { Proposal } from '../../types';
import { X, PenTool, Loader2, AlertCircle, Calendar, Mail, User } from 'lucide-react';

interface SendForSignatureModalProps {
  proposal: Proposal;
  onClose: () => void;
  onSent: () => void;
}

export function SendForSignatureModal({ proposal, onClose, onSent }: SendForSignatureModalProps) {
  const { user } = useAuth();
  const contactName = proposal.contact
    ? `${proposal.contact.first_name || ''} ${proposal.contact.last_name || ''}`.trim()
    : '';

  const [signerName, setSignerName] = useState(contactName);
  const [signerEmail, setSignerEmail] = useState(proposal.contact?.email || '');
  const [expirationDays, setExpirationDays] = useState(14);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'sending' | 'freezing'>('form');

  const formatCurrency = (amount: number, currency = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  const canSend =
    signerName.trim() &&
    signerEmail.trim() &&
    expirationDays > 0 &&
    proposal.title &&
    (proposal.sections?.length || 0) > 0;

  const handleSend = async () => {
    if (!user || !canSend) return;

    try {
      setIsSending(true);
      setError(null);
      setStep('freezing');

      await freezeProposal(proposal.id);

      setStep('sending');

      const { rawToken, signingUrl } = await createSignatureRequest(
        proposal.id,
        proposal.contact_id,
        signerName.trim(),
        signerEmail.trim(),
        expirationDays,
        user.id,
        proposal.org_id
      );

      const companyName = user.organization?.name || 'Our Company';
      const htmlBody = buildSignatureRequestEmail({
        signerName: signerName.trim(),
        proposalTitle: proposal.title,
        totalValue: proposal.total_value > 0
          ? formatCurrency(proposal.total_value, proposal.currency)
          : undefined,
        signingUrl,
        expiresAt: new Date(Date.now() + expirationDays * 86400000).toISOString(),
        companyName,
      });

      let fromAddressId: string | undefined;
      try {
        const defaults = await getEmailDefaults(user.organization_id);
        fromAddressId = defaults?.default_from_address?.id;
      } catch {
        // continue without default
      }

      if (fromAddressId) {
        await sendEmail({
          toEmail: signerEmail.trim(),
          toName: signerName.trim(),
          fromAddressId,
          subject: `Please review and sign: ${proposal.title}`,
          htmlBody,
          trackOpens: true,
          trackClicks: true,
        });
      }

      await createProposalActivity(
        proposal.id,
        proposal.org_id,
        'signature_sent',
        `Signature request sent to ${signerEmail.trim()}`,
        { signer_name: signerName.trim(), signer_email: signerEmail.trim() },
        user.id
      );

      onSent();
    } catch (err) {
      console.error('Failed to send for signature:', err);
      setError(err instanceof Error ? err.message : 'Failed to send signature request');
      setStep('form');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <PenTool className="w-5 h-5 text-cyan-400" />
              Send for Signature
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Request an electronic signature on this proposal
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSending}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {error && (
            <div className="mb-5 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {step === 'freezing' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              <p className="text-slate-300">Freezing proposal content...</p>
              <p className="text-sm text-slate-500">Creating an immutable snapshot for signing</p>
            </div>
          )}

          {step === 'sending' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              <p className="text-slate-300">Sending signature request...</p>
            </div>
          )}

          {step === 'form' && (
            <div className="space-y-5">
              <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-lg">
                <p className="text-sm font-medium text-slate-300 mb-1">{proposal.title}</p>
                {proposal.total_value > 0 && (
                  <p className="text-lg font-semibold text-cyan-400">
                    {formatCurrency(proposal.total_value, proposal.currency)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <User className="w-4 h-4 inline mr-1" />
                  Signer Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Full name"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Signer Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  placeholder="signer@example.com"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Expires in (days)
                </label>
                <select
                  value={expirationDays}
                  onChange={(e) => setExpirationDays(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                >
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                </select>
              </div>

              <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <h4 className="text-sm font-medium text-cyan-400 mb-2">What happens next</h4>
                <ul className="text-sm text-slate-300 space-y-1">
                  <li>1. The proposal content will be frozen (no further edits)</li>
                  <li>2. A secure signing link will be emailed to the signer</li>
                  <li>3. You'll be notified when they view, sign, or decline</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {step === 'form' && (
          <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={!canSend || isSending}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <PenTool className="w-4 h-4" />
              Send for Signature
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
