import type { Proposal, ProposalSection, ProposalLineItem, BrandKitWithVersion } from '../types';

const COMPANY = {
  name: 'Autom8ion Lab',
  email: 'info@autom8ionlab.com',
  phone: '(855) 508-6062',
  website: 'autom8ionlab.com',
};

const SECTION_ICONS: Record<string, string> = {
  intro: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  scope: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
  deliverables: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  timeline: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  pricing: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  terms: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  custom: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
};

const CHECK_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatProposalDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatProposalCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function generateProposalNumber(proposal: Proposal): string {
  const date = new Date(proposal.created_at);
  const year = date.getFullYear();
  const numericPart = parseInt(proposal.id.replace(/[^0-9]/g, '').slice(-4) || '1', 10) % 1000;
  return `PROP-${year}-${String(numericPart).padStart(3, '0')}`;
}

function getStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getStatusBadgeStyle(status: string): string {
  const map: Record<string, string> = {
    draft: 'background: rgba(100,116,139,0.3); color: #cbd5e1;',
    sent: 'background: rgba(34,211,238,0.2); color: #67e8f9;',
    viewed: 'background: rgba(251,191,36,0.2); color: #fcd34d;',
    accepted: 'background: rgba(16,185,129,0.2); color: #6ee7b7;',
    rejected: 'background: rgba(239,68,68,0.2); color: #fca5a5;',
    expired: 'background: rgba(100,116,139,0.15); color: #94a3b8;',
  };
  return map[status] || map.draft;
}

function buildSectionContent(section: ProposalSection): string {
  let html = section.content || '';
  html = html.replace(/<li>/g, `<li><span class="check-icon">${CHECK_SVG}</span><span class="check-text">`);
  html = html.replace(/<\/li>/g, '</span></li>');
  return html;
}

function buildCoverPage(proposal: Proposal, accentColor: string, logoUrl: string | null): string {
  const contactName = proposal.contact
    ? `${proposal.contact.first_name || ''} ${proposal.contact.last_name || ''}`.trim()
    : 'Client';
  const contactCompany = proposal.contact?.company || '';
  const contactEmail = proposal.contact?.email || '';
  const contactPhone = proposal.contact?.phone || '';

  return `
    <div class="page cover-page">
      <div class="cover-header">
        ${logoUrl
          ? `<img src="${logoUrl}" alt="${COMPANY.name}" class="company-logo" />`
          : `<div class="company-logo-text">${escapeHtml(COMPANY.name)}</div>`
        }
        <span class="company-name">${escapeHtml(COMPANY.name)}</span>
      </div>
      <div class="cover-divider"></div>

      <div class="status-badge" style="${getStatusBadgeStyle(proposal.status)}">
        ${getStatusLabel(proposal.status).toUpperCase()}
      </div>

      <h1 class="cover-title">
        ${escapeHtml(proposal.title)}
      </h1>
      <p class="cover-subtitle">Project Proposal and Scope of Work</p>

      <div class="meta-grid">
        <div class="meta-card">
          <div class="meta-label"># PROPOSAL NUMBER</div>
          <div class="meta-value">${generateProposalNumber(proposal)}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">DATE PREPARED</div>
          <div class="meta-value">${formatProposalDate(proposal.created_at)}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">VALID UNTIL</div>
          <div class="meta-value">${proposal.valid_until ? formatProposalDate(proposal.valid_until) : 'No expiration'}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">PREPARED BY</div>
          <div class="meta-value">${escapeHtml(COMPANY.name)}</div>
        </div>
      </div>

      <div class="contact-card">
        <div class="contact-label" style="color: ${accentColor};">PREPARED FOR</div>
        <div class="contact-name">${escapeHtml(contactName)}</div>
        ${contactCompany ? `<div class="contact-detail">${escapeHtml(contactCompany)}</div>` : ''}
        ${contactEmail ? `<div class="contact-detail">${escapeHtml(contactEmail)}</div>` : ''}
        ${contactPhone ? `<div class="contact-detail">${escapeHtml(contactPhone)}</div>` : ''}
      </div>

      <div class="contact-card">
        <div class="contact-label" style="color: ${accentColor};">PREPARED BY</div>
        <div class="contact-name">${escapeHtml(COMPANY.name)}</div>
        <div class="contact-detail">${escapeHtml(COMPANY.email)}</div>
        <div class="contact-detail">${escapeHtml(COMPANY.phone)}</div>
        <div class="contact-detail">${escapeHtml(COMPANY.website)}</div>
      </div>
    </div>
  `;
}

function buildSectionPage(section: ProposalSection, index: number, accentColor: string): string {
  const num = String(index + 1).padStart(2, '0');
  const icon = SECTION_ICONS[section.section_type] || SECTION_ICONS.custom;

  return `
    <div class="page section-page">
      <div class="section-header">
        <div class="section-number" style="background: ${accentColor};">${num}</div>
        <div class="section-icon" style="color: ${accentColor};">${icon}</div>
        <h2 class="section-title">${escapeHtml(section.title)}</h2>
      </div>
      <div class="section-body">
        ${buildSectionContent(section)}
      </div>
    </div>
  `;
}

function buildPricingPage(
  proposal: Proposal,
  lineItems: ProposalLineItem[],
  sectionIndex: number,
  accentColor: string
): string {
  const num = String(sectionIndex + 1).padStart(2, '0');
  const sorted = [...lineItems].sort((a, b) => a.sort_order - b.sort_order);

  const rows = sorted.map((item) => {
    const subtotal = item.quantity * item.unit_price;
    const discount = subtotal * (item.discount_percent / 100);
    const total = subtotal - discount;
    return `
      <div class="pricing-row">
        <div class="pricing-item-info">
          <div class="pricing-item-name">${escapeHtml(item.name)}</div>
          ${item.description ? `<div class="pricing-item-desc">${escapeHtml(item.description)}</div>` : ''}
        </div>
        <div class="pricing-item-amount">${formatProposalCurrency(total, proposal.currency)}</div>
      </div>
    `;
  }).join('');

  const pricingSection = proposal.sections?.find(s => s.section_type === 'pricing');
  const paymentTermsContent = pricingSection?.content || '';

  return `
    <div class="page section-page">
      <div class="section-header">
        <div class="section-number" style="background: ${accentColor};">${num}</div>
        <div class="section-icon" style="color: ${accentColor};">${SECTION_ICONS.pricing}</div>
        <h2 class="section-title">Pricing</h2>
      </div>
      <div class="pricing-table">
        ${rows}
        <div class="pricing-subtotal">
          <span>Subtotal</span>
          <span>${formatProposalCurrency(proposal.total_value, proposal.currency)}</span>
        </div>
        <div class="pricing-total">
          <span>Total Investment</span>
          <span class="pricing-total-amount" style="color: ${accentColor};">${formatProposalCurrency(proposal.total_value, proposal.currency)}</span>
        </div>
      </div>
      ${paymentTermsContent ? `
        <div class="payment-terms-card">
          <h3 class="payment-terms-title">Payment Terms</h3>
          <div class="payment-terms-body">${paymentTermsContent}</div>
        </div>
      ` : ''}
    </div>
  `;
}

function buildAcceptancePage(proposal: Proposal, accentColor: string): string {
  const contactName = proposal.contact
    ? `${proposal.contact.first_name || ''} ${proposal.contact.last_name || ''}`.trim()
    : '';

  return `
    <div class="page acceptance-page">
      <h2 class="acceptance-title">Acceptance</h2>
      <p class="acceptance-intro">
        By signing below, both parties agree to the terms, scope, deliverables, timeline, and pricing outlined in
        this proposal. This document shall serve as the binding agreement between both parties upon signature.
      </p>

      <div class="signature-block">
        <div class="signature-label" style="color: ${accentColor};">CLIENT</div>
        <div class="signature-line"></div>
        <div class="signature-fields">
          <div class="signature-field">
            <div class="signature-field-label">PRINTED NAME</div>
            <div class="signature-field-value">${escapeHtml(contactName)}</div>
          </div>
          <div class="signature-field">
            <div class="signature-field-label">TITLE</div>
            <div class="signature-field-value"></div>
          </div>
        </div>
        <div class="signature-field" style="margin-top: 12px;">
          <div class="signature-field-label">DATE</div>
          <div class="signature-field-underline"></div>
        </div>
      </div>

      <div class="signature-block">
        <div class="signature-label" style="color: ${accentColor};">AUTOM8TION LAB</div>
        <div class="signature-line"></div>
        <div class="signature-fields">
          <div class="signature-field">
            <div class="signature-field-label">PRINTED NAME</div>
            <div class="signature-field-value"></div>
          </div>
          <div class="signature-field">
            <div class="signature-field-label">TITLE</div>
            <div class="signature-field-value"></div>
          </div>
        </div>
        <div class="signature-field" style="margin-top: 12px;">
          <div class="signature-field-label">DATE</div>
          <div class="signature-field-underline"></div>
        </div>
      </div>

      <div class="acceptance-footer">
        <p>Questions about this proposal? We are happy to help.</p>
        <p class="acceptance-contact">${escapeHtml(COMPANY.email)} &nbsp;&nbsp; ${escapeHtml(COMPANY.phone)}</p>
      </div>
    </div>
  `;
}

function buildClosingPage(proposal: Proposal): string {
  const clientCompany = proposal.contact?.company || 'the Client';
  return `
    <div class="page closing-page">
      <div class="closing-content">
        <p class="closing-confidential">Confidential &mdash; Prepared exclusively for ${escapeHtml(clientCompany)}</p>
        <p class="closing-website">${escapeHtml(COMPANY.website)}</p>
      </div>
    </div>
  `;
}

function buildStyles(accentColor: string): string {
  return `
    @page {
      size: A4;
      margin: 0;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 210mm;
      background: #0b1120;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 13px;
      line-height: 1.6;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: 210mm;
      padding: 40px 50px 60px;
      background: #0b1120;
      page-break-before: always;
      position: relative;
    }
    .page:first-child {
      page-break-before: auto;
    }

    /* Cover */
    .cover-page { padding-top: 50px; }
    .cover-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
    }
    .company-logo {
      height: 36px;
      width: auto;
      object-fit: contain;
    }
    .company-logo-text {
      font-size: 20px;
      font-weight: 700;
      color: #f1f5f9;
    }
    .company-name {
      font-size: 18px;
      font-weight: 600;
      color: #f1f5f9;
    }
    .cover-divider {
      height: 1px;
      background: #334155;
      margin-bottom: 30px;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 14px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      margin-bottom: 18px;
    }
    .cover-title {
      font-size: 36px;
      font-weight: 800;
      line-height: 1.15;
      color: #f1f5f9;
      margin-bottom: 8px;
    }
    .cover-subtitle {
      font-size: 16px;
      color: #94a3b8;
      margin-bottom: 32px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 32px;
    }
    .meta-card {
      background: #1e293b;
      border-radius: 10px;
      padding: 16px 20px;
    }
    .meta-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 1px;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .meta-value {
      font-size: 15px;
      font-weight: 600;
      color: #e2e8f0;
    }
    .contact-card {
      background: #1e293b;
      border-radius: 10px;
      padding: 20px 24px;
      margin-bottom: 16px;
    }
    .contact-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .contact-name {
      font-size: 18px;
      font-weight: 700;
      color: #f1f5f9;
      margin-bottom: 4px;
    }
    .contact-detail {
      font-size: 13px;
      color: #94a3b8;
      margin-top: 2px;
    }

    /* Section pages */
    .section-page { padding-top: 50px; }
    .section-header {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 28px;
    }
    .section-number {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      font-weight: 800;
      color: #0b1120;
      flex-shrink: 0;
    }
    .section-icon {
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }
    .section-title {
      font-size: 28px;
      font-weight: 800;
      color: #f1f5f9;
    }
    .section-body {
      background: #1e293b;
      border-radius: 12px;
      padding: 24px 28px;
      color: #cbd5e1;
      font-size: 14px;
      line-height: 1.65;
      break-inside: avoid-page;
    }
    .section-body h2,
    .section-body h3 {
      color: #f1f5f9;
      font-weight: 700;
      margin-top: 18px;
      margin-bottom: 8px;
    }
    .section-body h2 { font-size: 18px; }
    .section-body h3 { font-size: 16px; }
    .section-body h2:first-child,
    .section-body h3:first-child { margin-top: 0; }
    .section-body p {
      margin-bottom: 10px;
    }
    .section-body ul,
    .section-body ol {
      list-style: none;
      padding: 0;
      margin: 8px 0 12px 0;
    }
    .section-body li {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 6px 0;
      border-bottom: 1px solid rgba(51,65,85,0.4);
      font-size: 14px;
      color: #cbd5e1;
      break-inside: avoid;
    }
    .section-body li:last-child {
      border-bottom: none;
    }
    .check-icon {
      flex-shrink: 0;
      margin-top: 1px;
    }
    .check-text {
      flex: 1;
    }
    .section-body strong {
      color: #f1f5f9;
      font-weight: 600;
    }
    .section-body a {
      color: ${accentColor};
    }

    /* Pricing */
    .pricing-table {
      background: #1e293b;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 20px;
    }
    .pricing-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 28px;
      border-bottom: 1px solid #334155;
    }
    .pricing-row:last-child {
      border-bottom: none;
    }
    .pricing-item-info { flex: 1; }
    .pricing-item-name {
      font-size: 15px;
      font-weight: 600;
      color: #f1f5f9;
    }
    .pricing-item-desc {
      font-size: 12px;
      color: #64748b;
      margin-top: 2px;
    }
    .pricing-item-amount {
      font-size: 15px;
      font-weight: 600;
      color: #e2e8f0;
      font-variant-numeric: tabular-nums;
    }
    .pricing-subtotal {
      display: flex;
      justify-content: space-between;
      padding: 16px 28px;
      border-top: 2px solid #334155;
      font-size: 14px;
      color: #94a3b8;
    }
    .pricing-total {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 28px;
      background: #162032;
      border-top: 1px solid #334155;
    }
    .pricing-total span:first-child {
      font-size: 16px;
      font-weight: 700;
      color: #f1f5f9;
    }
    .pricing-total-amount {
      font-size: 28px;
      font-weight: 800;
      font-style: italic;
    }
    .payment-terms-card {
      background: #1e293b;
      border-radius: 12px;
      padding: 24px 28px;
    }
    .payment-terms-title {
      font-size: 16px;
      font-weight: 700;
      color: #f1f5f9;
      margin-bottom: 10px;
    }
    .payment-terms-body {
      font-size: 13px;
      color: #94a3b8;
      line-height: 1.7;
    }
    .payment-terms-body p { margin-bottom: 8px; }

    /* Acceptance */
    .acceptance-page {
      padding-top: 60px;
    }
    .acceptance-title {
      font-size: 28px;
      font-weight: 800;
      color: #f1f5f9;
      text-align: center;
      margin-bottom: 16px;
    }
    .acceptance-intro {
      text-align: center;
      color: #94a3b8;
      font-size: 13px;
      line-height: 1.6;
      max-width: 520px;
      margin: 0 auto 36px auto;
    }
    .signature-block {
      background: #1e293b;
      border-radius: 12px;
      padding: 24px 28px;
      margin-bottom: 20px;
    }
    .signature-label {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 1.2px;
      margin-bottom: 28px;
    }
    .signature-line {
      border-bottom: 2px dashed #475569;
      margin-bottom: 12px;
    }
    .signature-fields {
      display: flex;
      gap: 24px;
    }
    .signature-field {
      flex: 1;
    }
    .signature-field-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.8px;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .signature-field-value {
      font-size: 14px;
      color: #e2e8f0;
      min-height: 20px;
    }
    .signature-field-underline {
      border-bottom: 1px solid #475569;
      min-height: 24px;
    }
    .acceptance-footer {
      text-align: center;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #1e293b;
      color: #64748b;
      font-size: 13px;
    }
    .acceptance-contact {
      margin-top: 6px;
      color: #94a3b8;
    }

    /* Closing page */
    .closing-page {
      display: flex;
      align-items: flex-start;
      justify-content: center;
    }
    .closing-content {
      background: linear-gradient(180deg, #162032 0%, #0b1120 100%);
      border-radius: 12px;
      padding: 36px 50px;
      text-align: center;
      width: 100%;
    }
    .closing-confidential {
      font-size: 14px;
      color: #94a3b8;
      margin-bottom: 6px;
    }
    .closing-website {
      font-size: 13px;
      color: #64748b;
    }

    @media print {
      html, body {
        width: 210mm;
        background: #0b1120;
      }
      .page {
        page-break-before: always;
        margin: 0;
      }
      .page:first-child {
        page-break-before: auto;
      }
    }
  `;
}

export function generateProposalHTML(
  proposal: Proposal,
  brandKit?: BrandKitWithVersion | null
): string {
  const accentColor = brandKit?.latest_version?.colors?.primary?.hex || '#22d3ee';
  const logoUrl = brandKit?.latest_version?.logos?.find(l => l.url)?.url || null;

  const sections = [...(proposal.sections || [])].sort((a, b) => a.sort_order - b.sort_order);
  const lineItems = proposal.line_items || [];
  const nonPricingSections = sections.filter(s => s.section_type !== 'pricing');
  const hasPricing = lineItems.length > 0;

  let pagesHtml = '';

  pagesHtml += buildCoverPage(proposal, accentColor, logoUrl);

  nonPricingSections.forEach((section, i) => {
    pagesHtml += buildSectionPage(section, i, accentColor);
  });

  if (hasPricing) {
    const pricingIndex = nonPricingSections.length;
    pagesHtml += buildPricingPage(proposal, lineItems, pricingIndex, accentColor);
  }

  pagesHtml += buildAcceptancePage(proposal, accentColor);
  pagesHtml += buildClosingPage(proposal);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(proposal.title)} &mdash; Proposal | ${COMPANY.name}</title>
  <style>${buildStyles(accentColor)}</style>
</head>
<body>
  ${pagesHtml}
</body>
</html>
  `.trim();
}

export async function exportProposalToPDF(
  proposal: Proposal,
  brandKit?: BrandKitWithVersion | null
): Promise<void> {
  const html = generateProposalHTML(proposal, brandKit);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Unable to open print window. Please allow popups for this site.');
  }

  printWindow.document.write(html);
  printWindow.document.close();

  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };
}
