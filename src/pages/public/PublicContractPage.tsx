import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getContractByPublicToken } from '../../services/contracts';
import { getBrandKits } from '../../services/brandboard';
import { sanitizeHtml } from '../../utils/sanitizeHtml';
import type { Contract, BrandKitWithVersion } from '../../types';
import {
  Scale,
  Calendar,
  AlertCircle,
  Loader2,
  DollarSign,
  MapPin,
  Shield,
} from 'lucide-react';

const FALLBACK_LOGO = '/assets/logo/Autom8ion-White.png';

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

  const primaryColor = brandKit?.latest_version?.colors?.primary?.hex || '#06b6d4';
  const logoUrl = brandKit?.latest_version?.logos?.[0]?.url || null;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-600 animate-spin" />
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Contract Not Found</h1>
          <p className="text-slate-600">
            {error || 'The contract you are looking for does not exist or has been removed.'}
          </p>
        </div>
      </div>
    );
  }

  const sections = [...(contract.sections || [])].sort((a, b) => a.sort_order - b.sort_order);
  const typeLabel = CONTRACT_TYPE_LABELS[contract.contract_type] || contract.contract_type;
  const formatCurrency = (val: number, curr: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: curr || 'USD', minimumFractionDigits: 0 }).format(val);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-6 py-12">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 bg-slate-900">
            <img src={logoUrl || FALLBACK_LOGO} alt="Logo" className="h-10 object-contain" />
          </div>

          <div className="p-8">
            <div className="mb-2">
              <div className="flex items-center gap-2 mb-2">
                <Scale className="w-5 h-5" style={{ color: primaryColor }} />
                <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">Contract</span>
              </div>
              <h1 className="text-3xl font-bold text-slate-900 mb-1">{contract.title}</h1>
              <p className="text-sm text-slate-500">{typeLabel}</p>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 mb-6 mt-4">
              <Shield className="w-4 h-4 inline mr-1 -mt-0.5" />
              This contract is a template for informational purposes only. It must be reviewed by a qualified attorney before signing.
            </div>

            <div className="flex items-center gap-6 mb-8 text-sm text-slate-600">
              {contract.effective_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>Effective {new Date(contract.effective_date).toLocaleDateString()}</span>
                </div>
              )}
              {contract.governing_law_state && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>{contract.governing_law_state}</span>
                </div>
              )}
              {contract.total_value > 0 && (
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(contract.total_value, contract.currency)}
                  </span>
                </div>
              )}
            </div>

            {(contract.party_a_name || contract.party_b_name) && (
              <div className="grid grid-cols-2 gap-6 mb-8 p-5 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: primaryColor }}>Party A (Service Provider)</h3>
                  <p className="text-sm font-medium text-slate-900">{contract.party_a_name || 'Not specified'}</p>
                  {contract.party_a_email && <p className="text-xs text-slate-500 mt-1">{contract.party_a_email}</p>}
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: primaryColor }}>Party B (Client)</h3>
                  <p className="text-sm font-medium text-slate-900">
                    {contract.party_b_name || (contract.contact ? `${contract.contact.first_name} ${contract.contact.last_name}` : 'Not specified')}
                  </p>
                  {(contract.party_b_email || contract.contact?.email) && (
                    <p className="text-xs text-slate-500 mt-1">{contract.party_b_email || contract.contact?.email}</p>
                  )}
                </div>
              </div>
            )}

            {sections.length > 0 && (
              <div className="space-y-8 mb-8">
                {sections.map((section, idx) => (
                  <div key={section.id || idx}>
                    <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                      <span
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-white text-xs font-bold"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {idx + 1}
                      </span>
                      {section.title}
                    </h2>
                    {section.annotation && (
                      <div className="ml-9 mb-3 px-3 py-2 bg-slate-50 border-l-3 rounded-r-md text-sm text-slate-500 italic" style={{ borderLeftWidth: 3, borderLeftColor: primaryColor }}>
                        {section.annotation}
                      </div>
                    )}
                    <div className="ml-9">
                      <div
                        className="prose prose-slate max-w-none text-sm"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.content) }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-8 py-4 bg-slate-50 border-t border-slate-200 text-center">
            <p className="text-xs text-slate-400">
              Generated by Autom8ion Lab. This document requires professional legal review before execution.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
