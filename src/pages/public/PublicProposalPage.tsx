import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getProposalByToken, updateProposalStatus, acceptPublicProposal } from '../../services/proposals';
import { getBrandKits } from '../../services/brandboard';
import { SignatureCanvas } from '../../components/proposals/SignatureCanvas';
import { sanitizeProposalContent } from '../../utils/proposalContentSanitizer';
import { sanitizeHtml } from '../../utils/sanitizeHtml';
import { SectionIcon } from '../../components/public-document/SectionIcon';
import { DocumentContentStyles } from '../../components/public-document/DocumentContentStyles';
import {
  COMPANY,
  FALLBACK_LOGO,
  DEFAULT_ACCENT,
  STATUS_STYLES,
  generateProposalNumber,
  formatDocDate,
  formatDocCurrency,
  getStatusLabel,
} from '../../components/public-document/documentTheme';
import type { Proposal, BrandKitWithVersion } from '../../types';
import {
  FileText,
  AlertCircle,
  CheckCircle,
  Loader2,
  Clock,
  Download,
} from 'lucide-react';
import { exportProposalToPDF } from '../../services/proposalPdfExport';

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

      await acceptPublicProposal(
        proposal.id,
        acceptanceData,
        clientName,
        clientEmail
      );

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

  const handleDownloadPDF = async () => {
    if (!proposal) return;
    try {
      await exportProposalToPDF(proposal, brandKit);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('Failed to generate PDF. Please allow popups for this site.');
    }
  };

  const isExpired = proposal?.valid_until && new Date(proposal.valid_until) < new Date();
  const canRespond = proposal?.status === 'sent' || proposal?.status === 'viewed';
  const isSigned = proposal?.status === 'accepted' || proposal?.status === 'signed';

  const accentColor = brandKit?.latest_version?.colors?.primary?.hex || DEFAULT_ACCENT;
  const logoUrl = brandKit?.latest_version?.logos?.find((l: { url?: string }) => l.url)?.url || FALLBACK_LOGO;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1120] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor }} />
          <p className="text-sm text-slate-500">Loading proposal...</p>
        </div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen bg-[#0b1120] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mb-3">Proposal Not Found</h1>
          <p className="text-slate-400 leading-relaxed">
            {error || 'The proposal you are looking for does not exist or has been removed.'}
          </p>
        </div>
      </div>
    );
  }

  if (acceptanceComplete) {
    return (
      <div className="min-h-screen bg-[#0b1120] flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-[#1e293b] rounded-2xl border border-[#334155] p-10 text-center">
          <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-100 mb-3">Proposal Accepted</h1>
          <p className="text-lg text-slate-400 mb-8 leading-relaxed">
            Thank you for accepting this proposal. We will be in touch soon to get started.
          </p>
          <div className="bg-[#162032] rounded-xl p-4">
            <p className="text-sm text-slate-500">A confirmation has been sent to {clientEmail}</p>
          </div>
        </div>
      </div>
    );
  }

  const contactName = proposal.contact
    ? `${proposal.contact.first_name || ''} ${proposal.contact.last_name || ''}`.trim()
    : 'Client';
  const contactCompany = proposal.contact?.company || '';
  const contactEmail = proposal.contact?.email || '';
  const contactPhone = proposal.contact?.phone || '';

  const sections = [...(proposal.sections || [])].sort((a, b) => a.sort_order - b.sort_order);
  const nonPricingSections = sections.filter(s => s.section_type !== 'pricing');
  const lineItems = [...(proposal.line_items || [])].sort((a, b) => a.sort_order - b.sort_order);
  const hasPricing = lineItems.length > 0;

  const statusStyle = STATUS_STYLES[proposal.status] || STATUS_STYLES.draft;
  const proposalNumber = generateProposalNumber(proposal.id, proposal.created_at);

  return (
    <div className="min-h-screen bg-[#0b1120]">
      <DocumentContentStyles accentColor={accentColor} />

      <div className="max-w-[860px] mx-auto px-6 py-12 md:py-16">

        {/* Cover Section */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            {logoUrl && (
              <img src={logoUrl} alt={COMPANY.name} className="h-9 object-contain" />
            )}
            <span className="text-lg font-semibold text-slate-100">{COMPANY.name}</span>
          </div>

          <div className="h-px bg-[#334155] mb-8" />

          <div
            className="inline-flex items-center px-3.5 py-1 rounded-md text-[11px] font-bold tracking-wider mb-5"
            style={{ background: statusStyle.bg, color: statusStyle.text }}
          >
            {getStatusLabel(proposal.status)}
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-100 leading-tight mb-2">
            {proposal.title}
          </h1>
          <p className="text-base text-slate-500 mb-8">Project Proposal and Scope of Work</p>

          {proposal.summary && (
            <p className="text-base text-slate-400 leading-relaxed mb-8">{proposal.summary}</p>
          )}

          {isExpired && (
            <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-300">This proposal has expired</p>
                <p className="text-sm text-amber-400/70 mt-1">
                  Please contact us to request an updated proposal.
                </p>
              </div>
            </div>
          )}

          {/* Meta Grid */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            <MetaCard label="# Proposal Number" value={proposalNumber} />
            <MetaCard label="Date Prepared" value={formatDocDate(proposal.created_at)} />
            <MetaCard label="Valid Until" value={proposal.valid_until ? formatDocDate(proposal.valid_until) : 'No expiration'} />
            <MetaCard label="Prepared By" value={COMPANY.name} />
          </div>

          {/* Contact Cards */}
          <div className="space-y-4">
            <ContactCard
              label="Prepared For"
              name={contactName}
              details={[contactCompany, contactEmail, contactPhone].filter(Boolean)}
              accentColor={accentColor}
            />
            <ContactCard
              label="Prepared By"
              name={COMPANY.name}
              details={[COMPANY.email, COMPANY.phone, COMPANY.website]}
              accentColor={accentColor}
            />
          </div>
        </section>

        {/* Sections */}
        {nonPricingSections.length > 0 && (
          <section className="space-y-10 mb-12">
            {nonPricingSections.map((section, idx) => (
              <div key={section.id}>
                <div className="flex items-center gap-3.5 mb-5">
                  <div
                    className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center text-[15px] font-extrabold text-[#0b1120] flex-shrink-0"
                    style={{ background: accentColor }}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                  <div className="flex-shrink-0" style={{ color: accentColor }}>
                    <SectionIcon sectionType={section.section_type} className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl md:text-[28px] font-extrabold text-slate-100 leading-tight">
                    {section.title}
                  </h2>
                </div>
                <div
                  className="doc-section-body"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(sanitizeProposalContent(section.content)) }}
                />
              </div>
            ))}
          </section>
        )}

        {/* Pricing Section */}
        {hasPricing && (
          <section className="mb-12">
            <div className="flex items-center gap-3.5 mb-5">
              <div
                className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center text-[15px] font-extrabold text-[#0b1120] flex-shrink-0"
                style={{ background: accentColor }}
              >
                {String(nonPricingSections.length + 1).padStart(2, '0')}
              </div>
              <div className="flex-shrink-0" style={{ color: accentColor }}>
                <SectionIcon sectionType="pricing" className="w-5 h-5" />
              </div>
              <h2 className="text-2xl md:text-[28px] font-extrabold text-slate-100 leading-tight">
                Pricing
              </h2>
            </div>

            <div className="bg-[#1e293b] rounded-xl overflow-hidden mb-5">
              {lineItems.map((item, i) => {
                const subtotal = item.quantity * item.unit_price;
                const discount = subtotal * (item.discount_percent / 100);
                const total = subtotal - discount;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between px-7 py-[18px] ${i < lineItems.length - 1 ? 'border-b border-[#334155]' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-semibold text-slate-100">{item.name}</div>
                      {item.description && (
                        <div className="text-xs text-slate-500 mt-0.5">{item.description}</div>
                      )}
                    </div>
                    <div className="text-[15px] font-semibold text-slate-200 tabular-nums flex-shrink-0 ml-4">
                      {formatDocCurrency(total, proposal.currency)}
                      {item.discount_percent > 0 && (
                        <span className="text-xs text-emerald-400 ml-2">-{item.discount_percent}%</span>
                      )}
                    </div>
                  </div>
                );
              })}

              <div className="flex justify-between items-center px-7 py-4 border-t-2 border-[#334155] text-sm text-slate-500">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatDocCurrency(proposal.total_value, proposal.currency)}</span>
              </div>

              <div className="flex justify-between items-center px-7 py-5 bg-[#162032] border-t border-[#334155]">
                <span className="text-base font-bold text-slate-100">Total Investment</span>
                <span
                  className="text-2xl md:text-[28px] font-extrabold italic tabular-nums"
                  style={{ color: accentColor }}
                >
                  {formatDocCurrency(proposal.total_value, proposal.currency)}
                </span>
              </div>
            </div>

            {sections.find(s => s.section_type === 'pricing')?.content && (
              <div className="bg-[#1e293b] rounded-xl p-6">
                <h3 className="text-base font-bold text-slate-100 mb-2.5">Payment Terms</h3>
                <div
                  className="text-[13px] text-slate-500 leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(sanitizeProposalContent(
                      sections.find(s => s.section_type === 'pricing')!.content
                    ))
                  }}
                />
              </div>
            )}
          </section>
        )}

        {/* Acceptance Section */}
        {canRespond && !isExpired && (
          <section className="mb-12">
            <div className="border-t border-[#1e293b] pt-10">
              {!showAcceptForm ? (
                <div className="text-center">
                  <h2 className="text-2xl font-extrabold text-slate-100 mb-4">Ready to proceed?</h2>
                  <p className="text-sm text-slate-500 mb-8 max-w-lg mx-auto leading-relaxed">
                    By accepting this proposal, you agree to the terms, scope, deliverables, timeline, and pricing outlined above.
                  </p>
                  <div className="flex gap-4 max-w-md mx-auto">
                    <button
                      onClick={() => setShowAcceptForm(true)}
                      className="flex-1 py-3.5 rounded-xl font-bold text-[#0b1120] text-sm transition-all duration-200 hover:opacity-90 hover:shadow-lg"
                      style={{ backgroundColor: accentColor, boxShadow: `0 0 24px ${accentColor}33` }}
                    >
                      Accept Proposal
                    </button>
                    <button
                      onClick={handleDecline}
                      className="flex-1 py-3.5 rounded-xl font-bold text-sm text-slate-400 border border-[#334155] bg-[#1e293b] hover:bg-[#162032] transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-[#1e293b] rounded-2xl border border-[#334155] p-8">
                  <h3 className="text-xl font-extrabold text-slate-100 mb-6">Accept Proposal</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        Your Name
                      </label>
                      <input
                        type="text"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[#162032] border border-[#334155] rounded-lg text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:border-transparent"
                        style={{ '--tw-ring-color': `${accentColor}50` } as React.CSSProperties}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[#162032] border border-[#334155] rounded-lg text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:border-transparent"
                        style={{ '--tw-ring-color': `${accentColor}50` } as React.CSSProperties}
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Signature
                    </label>
                    <SignatureCanvas
                      value={signature}
                      onSave={(data) => setSignature(data)}
                      onClear={() => setSignature('')}
                      darkMode
                    />
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={handleAccept}
                      disabled={!clientName || !clientEmail || !signature || isSubmitting}
                      className="flex-1 py-3.5 rounded-xl font-bold text-sm text-[#0b1120] disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                      style={{
                        backgroundColor: accentColor,
                        boxShadow: clientName && clientEmail && signature && !isSubmitting
                          ? `0 0 24px ${accentColor}33`
                          : undefined,
                      }}
                    >
                      {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                      {isSubmitting ? 'Processing...' : 'Sign and Accept'}
                    </button>
                    <button
                      onClick={() => setShowAcceptForm(false)}
                      disabled={isSubmitting}
                      className="px-6 py-3.5 rounded-xl font-bold text-sm text-slate-400 border border-[#334155] bg-[#162032] hover:bg-[#1e293b] disabled:opacity-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Declined State */}
        {proposal.status === 'rejected' && (
          <section className="mb-12">
            <div className="p-5 bg-[#1e293b] border border-[#334155] rounded-xl text-center">
              <p className="text-slate-400">This proposal has been declined.</p>
            </div>
          </section>
        )}

        {/* Accepted State with PDF Download */}
        {isSigned && (
          <section className="mb-12">
            <div className="p-6 rounded-xl text-center" style={{ background: `${accentColor}10`, border: `1px solid ${accentColor}20` }}>
              <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: accentColor }} />
              <p className="text-lg font-bold mb-1" style={{ color: accentColor }}>
                This proposal has been accepted
              </p>
              <p className="text-sm text-slate-500 mb-4">You can download a copy for your records.</p>
              <button
                onClick={handleDownloadPDF}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-[#0b1120] transition-opacity hover:opacity-90"
                style={{ backgroundColor: accentColor }}
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="mt-8">
          <div className="bg-gradient-to-b from-[#162032] to-[#0b1120] rounded-xl py-7 px-10 text-center">
            <p className="text-sm text-slate-500 mb-1">
              Confidential &mdash; Prepared exclusively for {contactCompany || contactName}
            </p>
            <p className="text-xs text-slate-600">{COMPANY.website}</p>
          </div>

          <div className="text-center mt-6 mb-4">
            <p className="text-[11px] text-slate-700 flex items-center justify-center gap-1.5">
              <FileText className="w-3 h-3" />
              Questions? Contact us at {COMPANY.email} or {COMPANY.phone}
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#1e293b] rounded-[10px] px-5 py-4">
      <div className="text-[10px] font-semibold tracking-[1px] text-slate-600 uppercase mb-1">{label}</div>
      <div className="text-[15px] font-semibold text-slate-200">{value}</div>
    </div>
  );
}

function ContactCard({
  label,
  name,
  details,
  accentColor,
}: {
  label: string;
  name: string;
  details: string[];
  accentColor: string;
}) {
  return (
    <div className="bg-[#1e293b] rounded-[10px] px-6 py-5">
      <div
        className="text-[11px] font-bold tracking-[1.2px] uppercase mb-2.5"
        style={{ color: accentColor }}
      >
        {label}
      </div>
      <div className="text-lg font-bold text-slate-100 mb-1">{name}</div>
      {details.map((d, i) => (
        <div key={i} className="text-[13px] text-slate-500 mt-0.5">{d}</div>
      ))}
    </div>
  );
}
