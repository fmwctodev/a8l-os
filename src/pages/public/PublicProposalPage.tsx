import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getProposalByToken, updateProposalStatus, updateProposal } from '../../services/proposals';
import { getBrandKits } from '../../services/brandboard';
import { SignatureCanvas } from '../../components/proposals/SignatureCanvas';
import type { Proposal, BrandKitWithVersion } from '../../types';
import {
  FileText,
  Calendar,
  AlertCircle,
  CheckCircle,
  Loader2,
  Clock,
  DollarSign,
} from 'lucide-react';

export default function PublicProposalPage() {
  const { token } = useParams<{ token: string }>();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [brandKit, setBrandKit] = useState<BrandKitWithVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAcceptForm, setShowAcceptForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [signature, setSignature] = useState('');
  const [acceptanceComplete, setAcceptanceComplete] = useState(false);

  useEffect(() => {
    loadProposal();
  }, [token]);

  const loadProposal = async () => {
    if (!token) return;

    try {
      setLoading(true);
      const proposalData = await getProposalByToken(token);

      if (!proposalData) {
        setError('Proposal not found');
        return;
      }

      setProposal(proposalData);

      if (proposalData.contact) {
        setClientName(`${proposalData.contact.first_name || ''} ${proposalData.contact.last_name || ''}`.trim());
        setClientEmail(proposalData.contact.email || '');
      }

      if (proposalData.status === 'sent' && !proposalData.viewed_at) {
        await updateProposalStatus(proposalData.id, 'viewed', proposalData.created_by);
        setProposal(prev => prev ? { ...prev, status: 'viewed', viewed_at: new Date().toISOString() } : null);
      }

      const brandKits = await getBrandKits(proposalData.org_id, { active: true });
      if (brandKits.length > 0) {
        setBrandKit(brandKits[0]);
      }
    } catch (err) {
      console.error('Failed to load proposal:', err);
      setError('Failed to load proposal');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!proposal || !clientName || !clientEmail || !signature) return;

    try {
      setIsSubmitting(true);

      const acceptanceData = {
        client_name: clientName,
        client_email: clientEmail,
        signature_data: signature,
        accepted_at: new Date().toISOString(),
      };

      await updateProposal(
        proposal.id,
        {
          ai_context: {
            ...(proposal.ai_context || {}),
            acceptance: acceptanceData,
          },
        },
        proposal.created_by
      );

      await updateProposalStatus(proposal.id, 'accepted', proposal.created_by);

      setAcceptanceComplete(true);
    } catch (err) {
      console.error('Failed to accept proposal:', err);
      alert('Failed to accept proposal. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!proposal) return;

    const confirmed = window.confirm('Are you sure you want to decline this proposal?');
    if (!confirmed) return;

    try {
      await updateProposalStatus(proposal.id, 'rejected', proposal.created_by);
      setProposal(prev => prev ? { ...prev, status: 'rejected' } : null);
    } catch (err) {
      console.error('Failed to decline proposal:', err);
      alert('Failed to decline proposal. Please try again.');
    }
  };

  const isExpired = proposal?.valid_until && new Date(proposal.valid_until) < new Date();
  const canRespond = proposal?.status === 'sent' || proposal?.status === 'viewed';

  const primaryColor = brandKit?.latest_version?.colors?.primary?.hex || '#06b6d4';
  const logoUrl = brandKit?.latest_version?.logos?.[0]?.url || null;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-600 animate-spin" />
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Proposal Not Found</h1>
          <p className="text-slate-600">
            {error || 'The proposal you are looking for does not exist or has been removed.'}
          </p>
        </div>
      </div>
    );
  }

  if (acceptanceComplete) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Proposal Accepted!</h1>
          <p className="text-lg text-slate-600 mb-6">
            Thank you for accepting this proposal. We'll be in touch soon to get started.
          </p>
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-sm text-slate-500">A confirmation has been sent to {clientEmail}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-6 py-12">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {logoUrl && (
            <div className="p-6 border-b border-slate-200 bg-white">
              <img src={logoUrl} alt="Company Logo" className="h-12 object-contain" />
            </div>
          )}

          <div className="p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5" style={{ color: primaryColor }} />
                  <span className="text-sm font-medium text-slate-500">PROPOSAL</span>
                </div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">{proposal.title}</h1>
                {proposal.summary && (
                  <p className="text-lg text-slate-600">{proposal.summary}</p>
                )}
              </div>
              <div className="text-right">
                <div
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-2"
                  style={{
                    backgroundColor: `${primaryColor}15`,
                    color: primaryColor
                  }}
                >
                  {proposal.status === 'sent' && 'Sent'}
                  {proposal.status === 'viewed' && 'Viewed'}
                  {proposal.status === 'accepted' && 'Accepted'}
                  {proposal.status === 'rejected' && 'Declined'}
                  {proposal.status === 'expired' && 'Expired'}
                </div>
              </div>
            </div>

            {isExpired && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-900">This proposal has expired</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Please contact us to request an updated proposal.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-6 mb-8 text-sm text-slate-600">
              {proposal.valid_until && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>Valid until {new Date(proposal.valid_until).toLocaleDateString()}</span>
                </div>
              )}
              {proposal.total_value > 0 && (
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  <span className="font-semibold text-slate-900">
                    {proposal.currency} {proposal.total_value.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {proposal.sections && proposal.sections.length > 0 && (
              <div className="space-y-8 mb-8">
                {proposal.sections
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((section) => (
                    <div key={section.id}>
                      <h2 className="text-2xl font-bold text-slate-900 mb-3">
                        {section.title}
                      </h2>
                      <div
                        className="prose prose-slate max-w-none"
                        dangerouslySetInnerHTML={{ __html: section.content }}
                      />
                    </div>
                  ))}
              </div>
            )}

            {proposal.line_items && proposal.line_items.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Pricing</h2>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-semibold text-slate-900">Item</th>
                        <th className="text-right px-4 py-3 text-sm font-semibold text-slate-900">Quantity</th>
                        <th className="text-right px-4 py-3 text-sm font-semibold text-slate-900">Unit Price</th>
                        <th className="text-right px-4 py-3 text-sm font-semibold text-slate-900">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {proposal.line_items
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((item) => {
                          const subtotal = item.quantity * item.unit_price;
                          const discount = subtotal * (item.discount_percent / 100);
                          const total = subtotal - discount;

                          return (
                            <tr key={item.id}>
                              <td className="px-4 py-3">
                                <div className="font-medium text-slate-900">{item.name}</div>
                                {item.description && (
                                  <div className="text-sm text-slate-500 mt-1">{item.description}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right text-slate-900">{item.quantity}</td>
                              <td className="px-4 py-3 text-right text-slate-900">
                                {proposal.currency} {item.unit_price.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-slate-900">
                                {proposal.currency} {total.toLocaleString()}
                                {item.discount_percent > 0 && (
                                  <div className="text-xs text-green-600">
                                    -{item.discount_percent}%
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-right font-bold text-slate-900">
                          Total
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900 text-lg">
                          {proposal.currency} {proposal.total_value.toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {canRespond && !isExpired && (
              <div className="border-t border-slate-200 pt-8">
                {!showAcceptForm ? (
                  <div className="flex gap-4">
                    <button
                      onClick={() => setShowAcceptForm(true)}
                      className="flex-1 py-3 rounded-lg font-semibold text-white transition-colors"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Accept Proposal
                    </button>
                    <button
                      onClick={handleDecline}
                      className="flex-1 py-3 bg-white border-2 border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <h3 className="text-xl font-bold text-slate-900">Accept Proposal</h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Your Name
                        </label>
                        <input
                          type="text"
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={clientEmail}
                          onChange={(e) => setClientEmail(e.target.value)}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Signature
                      </label>
                      <SignatureCanvas
                        value={signature}
                        onSave={(data) => setSignature(data)}
                        onClear={() => setSignature('')}
                      />
                    </div>

                    <div className="flex gap-4">
                      <button
                        onClick={handleAccept}
                        disabled={!clientName || !clientEmail || !signature || isSubmitting}
                        className="flex-1 py-3 rounded-lg font-semibold text-white disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        style={{ backgroundColor: signature && clientName && clientEmail && !isSubmitting ? primaryColor : undefined }}
                      >
                        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isSubmitting ? 'Processing...' : 'Sign and Accept'}
                      </button>
                      <button
                        onClick={() => setShowAcceptForm(false)}
                        disabled={isSubmitting}
                        className="px-6 py-3 bg-white border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {proposal.status === 'rejected' && (
              <div className="border-t border-slate-200 pt-8">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center">
                  <p className="text-slate-600">This proposal has been declined.</p>
                </div>
              </div>
            )}

            {proposal.status === 'accepted' && (
              <div className="border-t border-slate-200 pt-8">
                <div className="p-4 rounded-lg text-center" style={{ backgroundColor: `${primaryColor}10` }}>
                  <CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: primaryColor }} />
                  <p className="font-semibold" style={{ color: primaryColor }}>
                    This proposal has been accepted
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
