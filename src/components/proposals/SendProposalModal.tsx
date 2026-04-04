import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { sendEmail } from '../../services/emailSend';
import { getEmailDefaults } from '../../services/emailDefaults';
import { sendProposal } from '../../services/proposals';
import { createProposalActivity } from '../../services/proposals';
import type { Proposal } from '../../types';
import { APP_BASE_URL } from '../../constants';
import { X, Send, Loader2, Mail, AlertCircle } from 'lucide-react';

interface SendProposalModalProps {
  proposal: Proposal;
  onClose: () => void;
  onSent: () => void;
}

export function SendProposalModal({ proposal, onClose, onSent }: SendProposalModalProps) {
  const { user } = useAuth();
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [fromAddressId, setFromAddressId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDefaults();
  }, []);

  const loadDefaults = async () => {
    if (!user?.organization_id) return;

    try {
      setIsLoading(true);

      const contactEmail = proposal.contact?.email || '';
      const contactName = proposal.contact
        ? `${proposal.contact.first_name} ${proposal.contact.last_name}`.trim()
        : '';

      setToEmail(contactEmail);

      const companyName = user.organization?.name || 'our company';
      setSubject(`Proposal: ${proposal.title}`);

      const publicUrl = `${APP_BASE_URL}/p/${proposal.public_token}`;

      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <p style="font-size: 16px; color: #333;">Hi ${contactName || 'there'},</p>

          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            We're pleased to share a proposal for your review. Please take a moment to review the details and let us know if you have any questions.
          </p>

          <div style="margin: 30px 0;">
            <h2 style="color: #0f172a; font-size: 20px; margin-bottom: 10px;">${proposal.title}</h2>
            ${proposal.summary ? `<p style="color: #64748b; font-size: 14px;">${proposal.summary}</p>` : ''}
          </div>

          <div style="text-align: center; margin: 40px 0;">
            <a href="${publicUrl}" style="display: inline-block; padding: 14px 32px; background-color: #06b6d4; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
              View Proposal
            </a>
          </div>

          ${proposal.valid_until ? `<p style="color: #64748b; font-size: 14px;">This proposal is valid until ${new Date(proposal.valid_until).toLocaleDateString()}.</p>` : ''}

          <p style="font-size: 16px; color: #333; margin-top: 30px;">
            If you have any questions or need clarification, please don't hesitate to reach out.
          </p>

          <p style="font-size: 16px; color: #333; margin-top: 20px;">
            Best regards,<br/>
            ${companyName}
          </p>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;"/>

          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            You're receiving this email because a proposal was created for you.
          </p>
        </div>
      `;

      setBody(emailBody);

      const defaults = await getEmailDefaults(user.organization_id);
      if (defaults?.default_from_address?.id) {
        setFromAddressId(defaults.default_from_address.id);
      }
    } catch (err) {
      console.error('Failed to load defaults:', err);
      setError('Failed to load email settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!toEmail || !subject || !body || !user) {
      return;
    }

    if (!fromAddressId) {
      setError('No default email address configured. Please set up email services first.');
      return;
    }

    try {
      setIsSending(true);
      setError(null);

      const result = await sendEmail({
        toEmail,
        toName: proposal.contact
          ? `${proposal.contact.first_name} ${proposal.contact.last_name}`.trim()
          : undefined,
        fromAddressId,
        subject,
        htmlBody: body,
        trackOpens: true,
        trackClicks: false,
      });

      if (!result.success) {
        setError(result.error || 'Failed to send email');
        return;
      }

      await sendProposal(proposal.id, user.id);

      await createProposalActivity(
        proposal.id,
        proposal.org_id,
        'sent',
        `Proposal sent to ${toEmail}`,
        { email: toEmail, message_id: result.messageId },
        user.id
      );

      onSent();
    } catch (err) {
      console.error('Failed to send proposal:', err);
      setError('Failed to send proposal. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-cyan-400" />
              Send Proposal
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Email this proposal to your client
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            </div>
          ) : (
            <div className="space-y-5">
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-400">Error</p>
                    <p className="text-sm text-red-300 mt-1">{error}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  To <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Subject <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Proposal for review"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Message <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={12}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 font-mono text-sm"
                  required
                />
                <p className="text-xs text-slate-400 mt-2">
                  HTML content is supported. The proposal link is already included in the message.
                </p>
              </div>

              <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <h4 className="text-sm font-medium text-cyan-400 mb-2">Email Features</h4>
                <ul className="text-sm text-slate-300 space-y-1">
                  <li>• Open and click tracking enabled</li>
                  <li>• Public proposal link included</li>
                  <li>• Proposal status will be updated to "sent"</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSending}
            className="px-4 py-2 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!toEmail || !subject || !body || isSending || isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send Proposal
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
