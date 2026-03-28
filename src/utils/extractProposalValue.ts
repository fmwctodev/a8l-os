import type { ProposalSection } from '../types';

const CURRENCY_SYMBOL_MAP: Record<string, string> = {
  'AU$': 'AUD',
  'NZ$': 'NZD',
  'CA$': 'CAD',
  'HK$': 'HKD',
  'S$': 'SGD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
  '₹': 'INR',
  '$': 'USD',
};

const TOTAL_ROW_PATTERNS = [
  /total\s+platform\s+investment/i,
  /total\s+project\s+investment/i,
  /total\s+investment/i,
  /total\s+engagement/i,
  /total\s+annual/i,
  /total\s+project\s+cost/i,
  /grand\s+total/i,
  /total\s+cost/i,
  /total\s+value/i,
  /total\s+fee/i,
  /\btotal\b/i,
];

function detectCurrency(text: string): string {
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOL_MAP)) {
    if (text.includes(symbol)) return code;
  }
  const isoMatch = text.match(/\b(USD|AUD|NZD|CAD|GBP|EUR|JPY|SGD|HKD|INR)\b/);
  if (isoMatch) return isoMatch[1];
  return 'USD';
}

function parseMonetaryValue(text: string): number | null {
  const cleaned = text
    .replace(/AU\$|NZ\$|CA\$|HK\$|S\$|USD|AUD|NZD|CAD|GBP|EUR|JPY|SGD|HKD|INR/g, '')
    .replace(/[$€£¥₹]/g, '')
    .replace(/,/g, '')
    .trim();

  const match = cleaned.match(/[\d]+(?:\.\d+)?/);
  if (!match) return null;
  const value = parseFloat(match[0]);
  return isNaN(value) || value <= 0 ? null : value;
}

function isTotalRow(cellText: string): boolean {
  return TOTAL_ROW_PATTERNS.some((p) => p.test(cellText));
}

function extractFromHtml(html: string): { value: number; currency: string } | null {
  if (!html || typeof html !== 'string') return null;

  const detectedCurrency = detectCurrency(html);

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const rows = Array.from(doc.querySelectorAll('tr'));
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll('td, th'));
      if (cells.length < 2) continue;

      const firstCellText = cells[0].textContent?.trim() || '';
      const allCellsText = cells.map((c) => c.textContent?.trim() || '').join(' ');

      if (isTotalRow(firstCellText) || isTotalRow(allCellsText)) {
        for (let i = cells.length - 1; i >= 1; i--) {
          const cellText = cells[i].textContent?.trim() || '';
          const value = parseMonetaryValue(cellText);
          if (value !== null) {
            return { value, currency: detectCurrency(cellText) || detectedCurrency };
          }
        }
      }
    }
  } catch {
    // DOMParser not available (SSR/edge) — fall through to regex
  }

  return extractFromHtmlRegex(html, detectedCurrency);
}

function extractFromHtmlRegex(html: string, defaultCurrency: string): { value: number; currency: string } | null {
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match: RegExpExecArray | null;

  while ((match = rowPattern.exec(html)) !== null) {
    const rowHtml = match[1];
    const cellPattern = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellPattern.exec(rowHtml)) !== null) {
      const text = cellMatch[1].replace(/<[^>]+>/g, '').trim();
      cells.push(text);
    }

    if (cells.length < 2) continue;

    const firstCell = cells[0];
    const allCells = cells.join(' ');

    if (isTotalRow(firstCell) || isTotalRow(allCells)) {
      for (let i = cells.length - 1; i >= 1; i--) {
        const value = parseMonetaryValue(cells[i]);
        if (value !== null) {
          return { value, currency: detectCurrency(cells[i]) || defaultCurrency };
        }
      }
    }
  }

  return null;
}

export function extractValueFromSections(
  sections: ProposalSection[] | undefined | null,
  fallbackCurrency = 'USD'
): { value: number; currency: string } | null {
  if (!sections || sections.length === 0) return null;

  const priority: Array<ProposalSection['section_type']> = ['pricing', 'terms', 'custom'];

  for (const type of priority) {
    const section = sections.find((s) => s.section_type === type);
    if (!section?.content) continue;
    const result = extractFromHtml(section.content);
    if (result && result.value > 0) return result;
  }

  const introSection = sections.find((s) => s.section_type === 'intro');
  if (introSection?.content) {
    const result = extractFromHtml(introSection.content);
    if (result && result.value > 0) return result;
  }

  return null;
}

export function extractValueFromHtmlRegexOnly(
  html: string,
  defaultCurrency = 'USD'
): { value: number; currency: string } | null {
  if (!html) return null;
  const currency = detectCurrency(html) || defaultCurrency;
  return extractFromHtmlRegex(html, currency);
}
