import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getContractByPublicToken } from '../../services/contracts';
import { getBrandKits } from '../../services/brandboard';
import { sanitizeHtml } from '../../utils/sanitizeHtml';
import { SectionIcon } from '../../components/public-document/SectionIcon';
import { DocumentContentStyles } from '../../components/public-document/DocumentContentStyles';
import {
  COMPANY,
  FALLBACK_LOGO,
  DEFAULT_ACCENT,
  generateContractNumber,
  formatDocDate,
  formatDocCurrency,
} from '../../components/public-document/documentTheme';
import type { Contract, BrandKitWithVersion } from '../../types';
import {
  AlertCircle,
  Loader2,
} from 'lucide-react';

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  freelance_service: 'Freelance Service Agreement',
  retainer: 'Retainer Agreement',
  partnership: 'Partnership Agreement',
  nda: 'Non-Disclosure Agreement',
};

export default function PublicContractPage() {
  const { token } = useParams<{ token: string }>();
  const [contract, setContract] = useState<Contract | null>(null);
  const [brandKit, setBrandKit] = useState<BrandKitWithVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadContract();
  }, [token]);

  const loadContract = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await getContractByPublicToken(token);
      if (!data) {
        setError('Contract not found');
        return;
      }
      setContract(data);

      try {
        const kits = await getBrandKits(data.org_id, { active: true });
        if (kits.length > 0) setBrandKit(kits[0]);
      } catch { /* continue */ }
    } catch (err) {
      console.error('Failed to load contract:', err);
      setError('Failed to load contract');
    } finally {
      setLoading(false);
    }
  };

  const accentColor = brandKit?.latest_version?.colors?.primary?.hex || DEFAULT_ACCENT;
  const logoUrl = brandKit?.latest_version?.logos?.find((l: { url?: string }) => l.url)?.url || FALLBACK_LOGO;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor }} />
          <p className="text-sm text-slate-500">Loading contract...</p>
        </div>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mb-3">Contract Not Found</h1>
          <p className="text-slate-400 leading-relaxed">
            {error || 'The contract you are looking for does not exist or has been removed.'}
          </p>
        </div>
      </div>
    );
  }

  const sections = [...(contract.sections || [])].sort((a, b) => a.sort_order - b.sort_order);
  const typeLabel = CONTRACT_TYPE_LABELS[contract.contract_type] || contract.contract_type;
  const contractNumber = generateContractNumber(contract.id, contract.created_at);

  const partyBName = contract.party_b_name
    || (contract.contact ? `${contract.contact.first_name} ${contract.contact.last_name}` : 'Not specified');
  const partyBEmail = contract.party_b_email || contract.contact?.email || '';

  return (
    <div className="min-h-screen bg-[#0f172a]">
      <DocumentContentStyles accentColor={accentColor} />

      <div className="max-w-[900px] mx-auto px-6 py-12 md:py-16">

        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-6 mb-12 pb-8" style={{ borderBottom: `2px solid ${accentColor}` }}>
          <div>
            {logoUrl && (
              <img src={logoUrl} alt={COMPANY.name} className="h-10 object-contain mb-3" />
            )}
            <h1 className="text-2xl font-bold text-slate-50 mb-1">{contract.title}</h1>
            <p className="text-sm text-slate-500">{typeLabel}</p>
          </div>
          <div className="sm:text-right space-y-3 flex-shrink-0">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-600 font-semibold mb-0.5">Contract No.</div>
              <div className="text-sm font-medium text-slate-200">{contractNumber}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-600 font-semibold mb-0.5">Effective Date</div>
              <div className="text-sm font-medium text-slate-200">{formatDocDate(contract.effective_date)}</div>
            </div>
            {contract.total_value > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wider text-slate-600 font-semibold mb-0.5">Contract Value</div>
                <div className="text-sm font-medium text-slate-200">{formatDocCurrency(contract.total_value, contract.currency)}</div>
              </div>
            )}
          </div>
        </header>

        {/* Parties */}
        {(contract.party_a_name || contract.party_b_name || contract.contact) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10 p-6 bg-[#1e293b] rounded-xl border border-[#334155]">
            <div>
              <h3
                className="text-xs font-bold uppercase tracking-[0.08em] mb-2"
                style={{ color: accentColor }}
              >
                Party A (Service Provider)
              </h3>
              <p className="text-[15px] font-semibold text-slate-100">{contract.party_a_name || 'Not specified'}</p>
              {contract.party_a_email && (
                <p className="text-sm text-slate-400 mt-1">{contract.party_a_email}</p>
              )}
            </div>
            <div>
              <h3
                className="text-xs font-bold uppercase tracking-[0.08em] mb-2"
                style={{ color: accentColor }}
              >
                Party B (Client)
              </h3>
              <p className="text-[15px] font-semibold text-slate-100">{partyBName}</p>
              {partyBEmail && (
                <p className="text-sm text-slate-400 mt-1">{partyBEmail}</p>
              )}
              {contract.contact?.company && (
                <p className="text-sm text-slate-400 mt-0.5">{contract.contact.company}</p>
              )}
            </div>
          </div>
        )}

        {/* Meta Bar */}
        <div className="flex flex-wrap gap-8 mb-10 px-6 py-5 bg-[#1e293b] rounded-xl border border-[#334155]">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-600 font-semibold mb-0.5">Contract Type</div>
            <div className="text-base font-semibold" style={{ color: accentColor }}>{typeLabel}</div>
          </div>
          {contract.governing_law_state && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-600 font-semibold mb-0.5">Governing Law</div>
              <div className="text-base font-semibold" style={{ color: accentColor }}>{contract.governing_law_state}</div>
            </div>
          )}
          {contract.total_value > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-600 font-semibold mb-0.5">Total Value</div>
              <div className="text-base font-semibold" style={{ color: accentColor }}>
                {formatDocCurrency(contract.total_value, contract.currency)}
              </div>
            </div>
          )}
        </div>

        {/* Sections */}
        {sections.length > 0 && (
          <div className="space-y-9 mb-12">
            {sections.map((section, idx) => (
              <div key={section.id || idx}>
                <div className="flex items-center gap-2.5 mb-4 pb-2 border-b border-[#334155]">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: accentColor }}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-shrink-0" style={{ color: accentColor }}>
                    <SectionIcon sectionType={section.section_type} className="w-4 h-4" />
                  </div>
                  <h2 className="text-[17px] font-semibold text-slate-100">{section.title}</h2>
                </div>

                {section.annotation && (
                  <div
                    className="mb-3.5 px-3.5 py-2.5 bg-[#1e293b] rounded-r-md text-[13px] text-slate-500 italic"
                    style={{ borderLeft: `3px solid ${accentColor}` }}
                  >
                    {section.annotation}
                  </div>
                )}

                <div
                  className="doc-section-body"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.content) }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-[#334155] text-center">
          <p className="text-xs text-slate-600">
            Generated by {COMPANY.name}. This document requires professional legal review before execution.
          </p>
        </footer>
      </div>
    </div>
  );
}
