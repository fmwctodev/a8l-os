import type { ProposalSectionType } from '../../types';

export const COMPANY = {
  name: 'Autom8ion Lab',
  email: 'info@autom8ionlab.com',
  phone: '(855) 508-6062',
  website: 'autom8ionlab.com',
};

export const FALLBACK_LOGO = '/assets/logo/Autom8ion-White.png';
export const DEFAULT_ACCENT = '#22d3ee';

export const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'rgba(100,116,139,0.3)', text: '#cbd5e1' },
  sent: { bg: 'rgba(34,211,238,0.2)', text: '#67e8f9' },
  viewed: { bg: 'rgba(251,191,36,0.2)', text: '#fcd34d' },
  accepted: { bg: 'rgba(16,185,129,0.2)', text: '#6ee7b7' },
  signed: { bg: 'rgba(16,185,129,0.2)', text: '#6ee7b7' },
  rejected: { bg: 'rgba(239,68,68,0.2)', text: '#fca5a5' },
  declined: { bg: 'rgba(239,68,68,0.2)', text: '#fca5a5' },
  expired: { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8' },
  voided: { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8' },
};

export const SECTION_ICON_MAP: Record<string, string> = {
  intro: 'FileText',
  scope: 'List',
  deliverables: 'Package',
  timeline: 'CalendarDays',
  pricing: 'DollarSign',
  terms: 'Shield',
  custom: 'FileText',
  payment_terms: 'DollarSign',
  intellectual_property: 'Shield',
  confidentiality: 'Lock',
  termination: 'XCircle',
  liability: 'AlertTriangle',
  dispute_resolution: 'Scale',
  governing_law: 'Landmark',
  general_provisions: 'FileText',
  signatures: 'PenTool',
};

export function generateProposalNumber(id: string, createdAt: string): string {
  const date = new Date(createdAt);
  const year = date.getFullYear();
  const numericPart = parseInt(id.replace(/[^0-9]/g, '').slice(-4) || '1', 10) % 1000;
  return `PROP-${year}-${String(numericPart).padStart(3, '0')}`;
}

export function generateContractNumber(id: string, createdAt: string): string {
  const date = new Date(createdAt);
  const year = date.getFullYear();
  const numericPart = parseInt(id.replace(/[^0-9]/g, '').slice(-4) || '1', 10) % 1000;
  return `CNTR-${year}-${String(numericPart).padStart(3, '0')}`;
}

export function formatDocDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDocCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'DRAFT',
    sent: 'SENT',
    viewed: 'VIEWED',
    accepted: 'ACCEPTED',
    signed: 'SIGNED',
    rejected: 'DECLINED',
    declined: 'DECLINED',
    expired: 'EXPIRED',
    voided: 'VOIDED',
  };
  return labels[status] || status.toUpperCase();
}

export function getSectionTypeIcon(sectionType: string): string {
  return SECTION_ICON_MAP[sectionType] || 'FileText';
}

export function injectCheckIcons(html: string): string {
  return html
    .replace(/<li>/g, '<li class="doc-check-item">')
    .replace(/<ul>/g, '<ul class="doc-check-list">')
    .replace(/<ol>/g, '<ol class="doc-check-list">');
}
