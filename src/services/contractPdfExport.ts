import type { Contract, ContractSection, BrandKitWithVersion } from '../types';

const FALLBACK_LOGO = '/assets/logo/Autom8ion-White.png';

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  freelance_service: 'Freelance Service Agreement',
  retainer: 'Retainer Agreement',
  partnership: 'Partnership Agreement',
  nda: 'Non-Disclosure Agreement',
};

const SECTION_TYPE_LABELS: Record<string, string> = {
  scope: 'Scope of Work',
  deliverables: 'Deliverables',
  payment_terms: 'Payment Terms',
  timeline: 'Timeline and Milestones',
  intellectual_property: 'Intellectual Property',
  confidentiality: 'Confidentiality',
  termination: 'Termination',
  liability: 'Limitation of Liability',
  dispute_resolution: 'Dispute Resolution',
  governing_law: 'Governing Law',
  general_provisions: 'General Provisions',
  signatures: 'Signatures',
  custom: 'Additional Terms',
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: currency || 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value);
}

function generateContractNumber(contract: Contract): string {
  const date = new Date(contract.created_at);
  const year = date.getFullYear();
  const numericPart = parseInt(contract.id.replace(/[^0-9]/g, '').slice(-4) || '1', 10) % 1000;
  return `CNTR-${year}-${String(numericPart).padStart(3, '0')}`;
}

export function generateContractHTML(contract: Contract, brandKit: BrandKitWithVersion | null): string {
  const version = brandKit?.versions?.[0] || null;
  const colors = (version?.colors as Record<string, { hex: string }>) || {};
  const primaryColor = colors.primary?.hex || '#0ea5e9';
  const accentColor = colors.accent?.hex || '#06b6d4';
  const logoUrl = version?.logo_url || FALLBACK_LOGO;

  const sections = [...(contract.sections || [])].sort((a, b) => a.sort_order - b.sort_order);
  const contractNumber = generateContractNumber(contract);
  const typeLabel = CONTRACT_TYPE_LABELS[contract.contract_type] || contract.contract_type;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(contract.title)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.7; }
  .page { max-width: 900px; margin: 0 auto; padding: 60px 48px; }
  .disclaimer { background: #451a03; border: 1px solid #92400e; border-radius: 8px; padding: 16px 20px; margin-bottom: 40px; font-size: 11px; color: #fbbf24; line-height: 1.6; text-transform: uppercase; letter-spacing: 0.03em; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px; padding-bottom: 32px; border-bottom: 2px solid ${primaryColor}; }
  .header-left img { height: 40px; margin-bottom: 12px; }
  .header-left h1 { font-size: 24px; font-weight: 700; color: #f8fafc; margin-bottom: 4px; }
  .header-left .subtitle { font-size: 14px; color: #94a3b8; }
  .header-right { text-align: right; font-size: 13px; color: #94a3b8; }
  .header-right .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 2px; }
  .header-right .value { font-size: 14px; color: #e2e8f0; font-weight: 500; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 40px; padding: 24px; background: #1e293b; border-radius: 12px; border: 1px solid #334155; }
  .party h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: ${accentColor}; margin-bottom: 8px; }
  .party p { font-size: 14px; color: #cbd5e1; line-height: 1.6; }
  .party .name { font-weight: 600; color: #f1f5f9; font-size: 15px; }
  .section { margin-bottom: 36px; }
  .section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #334155; }
  .section-number { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: ${primaryColor}; color: white; font-size: 13px; font-weight: 700; border-radius: 6px; }
  .section-title { font-size: 17px; font-weight: 600; color: #f1f5f9; }
  .section-annotation { background: #1e293b; border-left: 3px solid ${accentColor}; padding: 10px 14px; margin-bottom: 14px; font-size: 13px; color: #94a3b8; font-style: italic; border-radius: 0 6px 6px 0; }
  .section-content { font-size: 14px; color: #cbd5e1; line-height: 1.8; }
  .section-content p { margin-bottom: 12px; }
  .section-content h3, .section-content h4 { color: #e2e8f0; margin: 16px 0 8px; }
  .section-content ul, .section-content ol { margin: 8px 0 12px 24px; }
  .section-content li { margin-bottom: 4px; }
  .section-content table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  .section-content th { background: #1e293b; color: #94a3b8; padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #334155; }
  .section-content td { padding: 8px 12px; border-bottom: 1px solid #1e293b; font-size: 13px; }
  .section-content strong { color: #e2e8f0; }
  .meta-bar { display: flex; gap: 32px; margin-bottom: 40px; padding: 20px 24px; background: #1e293b; border-radius: 12px; border: 1px solid #334155; }
  .meta-item .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
  .meta-item .value { font-size: 16px; font-weight: 600; color: ${accentColor}; }
  .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #334155; text-align: center; font-size: 12px; color: #475569; }
</style>
</head>
<body>
<div class="page">
  <div class="disclaimer">
    THIS CONTRACT IS A TEMPLATE FOR INFORMATIONAL PURPOSES ONLY. IT DOES NOT CONSTITUTE LEGAL ADVICE.
    ALL CONTRACTS MUST BE REVIEWED BY A QUALIFIED ATTORNEY BEFORE SIGNING OR ENFORCEMENT.
  </div>

  <div class="header">
    <div class="header-left">
      <img src="${logoUrl}" alt="Logo" />
      <h1>${escapeHtml(contract.title)}</h1>
      <div class="subtitle">${escapeHtml(typeLabel)}</div>
    </div>
    <div class="header-right">
      <div class="label">Contract No.</div>
      <div class="value">${contractNumber}</div>
      <div class="label" style="margin-top:12px">Effective Date</div>
      <div class="value">${formatDate(contract.effective_date)}</div>
      <div class="label" style="margin-top:12px">Contract Value</div>
      <div class="value">${formatCurrency(contract.total_value || 0, contract.currency)}</div>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h3>Party A (Service Provider)</h3>
      <p class="name">${escapeHtml(contract.party_a_name || 'N/A')}</p>
      <p>${escapeHtml(contract.party_a_email || '')}</p>
    </div>
    <div class="party">
      <h3>Party B (Client)</h3>
      <p class="name">${escapeHtml(contract.party_b_name || contract.contact?.first_name ? `${contract.contact?.first_name} ${contract.contact?.last_name}` : 'N/A')}</p>
      <p>${escapeHtml(contract.party_b_email || contract.contact?.email || '')}</p>
      ${contract.contact?.company ? `<p>${escapeHtml(contract.contact.company)}</p>` : ''}
    </div>
  </div>

  <div class="meta-bar">
    <div class="meta-item">
      <div class="label">Contract Type</div>
      <div class="value">${escapeHtml(typeLabel)}</div>
    </div>
    <div class="meta-item">
      <div class="label">Governing Law</div>
      <div class="value">${escapeHtml(contract.governing_law_state || 'To Be Determined')}</div>
    </div>
    <div class="meta-item">
      <div class="label">Total Value</div>
      <div class="value">${formatCurrency(contract.total_value || 0, contract.currency)}</div>
    </div>
  </div>

  ${sections.map((section: ContractSection, index: number) => `
  <div class="section">
    <div class="section-header">
      <span class="section-number">${index + 1}</span>
      <span class="section-title">${escapeHtml(section.title || SECTION_TYPE_LABELS[section.section_type] || 'Section')}</span>
    </div>
    ${section.annotation ? `<div class="section-annotation">${escapeHtml(section.annotation)}</div>` : ''}
    <div class="section-content">${section.content}</div>
  </div>
  `).join('')}

  <div class="footer">
    <p>Generated by Autom8ion Lab &mdash; This document requires professional legal review before execution.</p>
  </div>
</div>
</body>
</html>`;
}

export async function exportContractToPDF(contract: Contract, brandKit: BrandKitWithVersion | null): Promise<void> {
  const html = generateContractHTML(contract, brandKit);
  const printWindow = window.open('', '_blank');
  if (!printWindow) throw new Error('Pop-up blocked. Please allow pop-ups for this site.');
  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
  }, 500);
}
