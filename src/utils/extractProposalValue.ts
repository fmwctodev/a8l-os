import type { ProposalSection } from '../types';

const CURRENCY_SYMBOL_MAP: [string, string][] = [
  ['AU$', 'AUD'],
  ['NZ$', 'NZD'],
  ['CA$', 'CAD'],
  ['HK$', 'HKD'],
  ['S$', 'SGD'],
  ['€', 'EUR'],
  ['£', 'GBP'],
  ['¥', 'JPY'],
  ['₹', 'INR'],
  ['$', 'USD'],
];

const TOTAL_LABEL_PATTERNS = [
  /total\s+platform\s+investment/i,
  /total\s+project\s+investment/i,
  /total\s+project\s+cost/i,
  /total\s+engagement/i,
  /total\s+investment/i,
  /total\s+annual/i,
  /grand\s+total/i,
  /total\s+cost/i,
  /total\s+value/i,
  /total\s+fee/i,
  /\btotal\b/i,
];

const ANNUAL_LABEL_PATTERNS = [
  /annual\s*\(recommended\)/i,
  /annual\s*[-–]\s*recommended/i,
  /\bannual\b/i,
  /\byearly\b/i,
  /per\s+year/i,
  /\/\s*year/i,
  /p\.?a\.?/i,
];

const ANNUAL_COLUMN_HEADER_PATTERNS = [
  /annual\s+total/i,
  /total\s+annual/i,
  /annual\s+cost/i,
  /annual\s+value/i,
  /annual\s+amount/i,
  /\bannual\b/i,
];

const INLINE_TOTAL_PATTERNS = [
  /total\s*:\s*(?:AUD|USD|NZD|CAD|GBP|EUR|JPY|SGD|HKD|INR)?\s*(?:AU\$|NZ\$|CA\$|HK\$|S\$|[$€£¥₹])?\s*([\d,]+(?:\.\d+)?)/i,
  /(?:AUD|USD|NZD|CAD|GBP|EUR|JPY|SGD|HKD|INR)\s*\$?\s*([\d,]+(?:\.\d+)?)\s*\(excl\. gst\)/i,
  /(?:AU\$|NZ\$|CA\$|HK\$|S\$|[$€£¥₹])([\d,]+(?:\.\d+)?)\s*\(excl\. gst\)/i,
];

function detectCurrency(text: string): string {
  const isoMatch = text.match(/\b(USD|AUD|NZD|CAD|GBP|EUR|JPY|SGD|HKD|INR)\b/);
  if (isoMatch) return isoMatch[1];
  for (const [symbol, code] of CURRENCY_SYMBOL_MAP) {
    if (text.includes(symbol)) return code;
  }
  return 'USD';
}

function parseMonetaryValue(text: string): number | null {
  const cleaned = text
    .replace(/\b(AU|NZ|CA|HK|S)\$/g, '')
    .replace(/\b(USD|AUD|NZD|CAD|GBP|EUR|JPY|SGD|HKD|INR)\b/g, '')
    .replace(/[$€£¥₹]/g, '')
    .replace(/,/g, '')
    .trim();

  const match = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = parseFloat(match[1]);
  return isNaN(value) || value <= 0 ? null : value;
}

function hasMonetaryValue(text: string): boolean {
  return /(?:AU\$|NZ\$|CA\$|\$|€|£|¥|₹|AUD|USD|GBP|EUR)[\s]?\d/.test(text) ||
    /\d[\d,]*(?:\.\d+)?(?:\s*\/\s*(?:year|yr|month|mo))?/.test(text);
}

function matchesAnyPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function extractFromDom(doc: Document, detectedCurrency: string): { value: number; currency: string } | null {
  const rows = Array.from(doc.querySelectorAll('tr'));

  if (rows.length === 0) return null;

  const headerRow = rows[0];
  const headerCells = Array.from(headerRow.querySelectorAll('td, th'));
  const annualColIndex = headerCells.findIndex((c) =>
    matchesAnyPattern(c.textContent?.trim() || '', ANNUAL_COLUMN_HEADER_PATTERNS)
  );

  if (annualColIndex >= 0) {
    let bestValue: number | null = null;
    let bestCurrency = detectedCurrency;

    for (let r = 1; r < rows.length; r++) {
      const cells = Array.from(rows[r].querySelectorAll('td, th'));
      if (annualColIndex < cells.length) {
        const cellText = cells[annualColIndex].textContent?.trim() || '';
        const v = parseMonetaryValue(cellText);
        if (v !== null && (bestValue === null || v > bestValue)) {
          bestValue = v;
          bestCurrency = detectCurrency(cellText) || detectedCurrency;
        }
      }
    }

    if (bestValue !== null && bestValue > 0) {
      return { value: bestValue, currency: bestCurrency };
    }
  }

  for (const row of rows) {
    const cells = Array.from(row.querySelectorAll('td, th'));
    if (cells.length < 2) continue;

    const firstCellText = cells[0].textContent?.trim() || '';
    const allCellsText = cells.map((c) => c.textContent?.trim() || '').join(' ');

    if (matchesAnyPattern(firstCellText, TOTAL_LABEL_PATTERNS) ||
        matchesAnyPattern(allCellsText, TOTAL_LABEL_PATTERNS)) {
      for (let i = cells.length - 1; i >= 1; i--) {
        const cellText = cells[i].textContent?.trim() || '';
        const value = parseMonetaryValue(cellText);
        if (value !== null) {
          return { value, currency: detectCurrency(cellText) || detectedCurrency };
        }
      }
    }
  }

  for (const row of rows) {
    const cells = Array.from(row.querySelectorAll('td, th'));
    if (cells.length < 2) continue;

    const firstCellText = cells[0].textContent?.trim() || '';

    if (matchesAnyPattern(firstCellText, ANNUAL_LABEL_PATTERNS)) {
      let bestValue: number | null = null;
      let bestCurrency = detectedCurrency;
      for (let i = 1; i < cells.length; i++) {
        const cellText = cells[i].textContent?.trim() || '';
        if (hasMonetaryValue(cellText)) {
          const value = parseMonetaryValue(cellText);
          if (value !== null && (bestValue === null || value > bestValue)) {
            bestValue = value;
            bestCurrency = detectCurrency(cellText) || detectedCurrency;
          }
        }
      }
      if (bestValue !== null) {
        return { value: bestValue, currency: bestCurrency };
      }
    }
  }

  return null;
}

function extractInlineTotals(doc: Document, detectedCurrency: string): { value: number; currency: string } | null {
  const allText = doc.body?.textContent || '';

  for (const pattern of INLINE_TOTAL_PATTERNS) {
    const m = allText.match(pattern);
    if (m) {
      const raw = m[1].replace(/,/g, '');
      const value = parseFloat(raw);
      if (!isNaN(value) && value > 0) {
        return { value, currency: detectCurrency(m[0]) || detectedCurrency };
      }
    }
  }

  const boldElements = Array.from(doc.querySelectorAll('strong, b, h1, h2, h3, h4, p'));
  for (const el of boldElements) {
    const text = el.textContent?.trim() || '';
    if (matchesAnyPattern(text, TOTAL_LABEL_PATTERNS) && hasMonetaryValue(text)) {
      const value = parseMonetaryValue(text);
      if (value !== null) {
        return { value, currency: detectCurrency(text) || detectedCurrency };
      }
    }
  }

  return null;
}

function extractFromHtml(html: string): { value: number; currency: string } | null {
  if (!html || typeof html !== 'string') return null;

  const detectedCurrency = detectCurrency(html);

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const tableResult = extractFromDom(doc, detectedCurrency);
    if (tableResult) return tableResult;

    const inlineResult = extractInlineTotals(doc, detectedCurrency);
    if (inlineResult) return inlineResult;
  } catch {
    // DOMParser not available
  }

  return extractFromHtmlRegex(html, detectedCurrency);
}

function extractFromHtmlRegex(html: string, defaultCurrency: string): { value: number; currency: string } | null {
  const rows: string[][] = [];
  const tablePattern = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tablePattern.exec(html)) !== null) {
    const tableHtml = tableMatch[1];
    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;
    const tableRows: string[][] = [];

    while ((rowMatch = rowPattern.exec(tableHtml)) !== null) {
      const rowHtml = rowMatch[1];
      const cellPattern = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      const cells: string[] = [];
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellPattern.exec(rowHtml)) !== null) {
        cells.push(cellMatch[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim());
      }
      if (cells.length > 0) tableRows.push(cells);
    }

    if (tableRows.length === 0) continue;

    const headerRow = tableRows[0];
    const annualColIndex = headerRow.findIndex((h) =>
      matchesAnyPattern(h, ANNUAL_COLUMN_HEADER_PATTERNS)
    );

    if (annualColIndex >= 0 && tableRows.length > 1) {
      let bestValue: number | null = null;
      let bestCurrency = defaultCurrency;
      for (let r = 1; r < tableRows.length; r++) {
        if (annualColIndex < tableRows[r].length) {
          const v = parseMonetaryValue(tableRows[r][annualColIndex]);
          if (v !== null && (bestValue === null || v > bestValue)) {
            bestValue = v;
            bestCurrency = detectCurrency(tableRows[r][annualColIndex]) || defaultCurrency;
          }
        }
      }
      if (bestValue !== null && bestValue > 0) return { value: bestValue, currency: bestCurrency };
    }

    for (const cells of tableRows) {
      if (cells.length < 2) continue;
      const allCells = cells.join(' ');
      if (matchesAnyPattern(cells[0], TOTAL_LABEL_PATTERNS) || matchesAnyPattern(allCells, TOTAL_LABEL_PATTERNS)) {
        for (let i = cells.length - 1; i >= 1; i--) {
          const v = parseMonetaryValue(cells[i]);
          if (v !== null) return { value: v, currency: detectCurrency(cells[i]) || defaultCurrency };
        }
      }
    }

    for (const cells of tableRows) {
      if (cells.length < 2) continue;
      if (matchesAnyPattern(cells[0], ANNUAL_LABEL_PATTERNS)) {
        let bestValue: number | null = null;
        let bestCurrency = defaultCurrency;
        for (let i = 1; i < cells.length; i++) {
          if (hasMonetaryValue(cells[i])) {
            const v = parseMonetaryValue(cells[i]);
            if (v !== null && (bestValue === null || v > bestValue)) {
              bestValue = v;
              bestCurrency = detectCurrency(cells[i]) || defaultCurrency;
            }
          }
        }
        if (bestValue !== null) return { value: bestValue, currency: bestCurrency };
      }
    }

    rows.push(...tableRows);
  }

  const stripped = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  for (const pattern of INLINE_TOTAL_PATTERNS) {
    const m = stripped.match(pattern);
    if (m) {
      const value = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(value) && value > 0) {
        return { value, currency: detectCurrency(m[0]) || defaultCurrency };
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

  const priority: Array<ProposalSection['section_type']> = ['pricing', 'terms', 'custom', 'scope', 'deliverables', 'timeline', 'intro'];

  for (const type of priority) {
    const matchingSections = sections.filter((s) => s.section_type === type);
    for (const section of matchingSections) {
      if (!section?.content) continue;
      const result = extractFromHtml(section.content);
      if (result && result.value > 0) return result;
    }
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
