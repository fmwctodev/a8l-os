// Safe formula evaluator for math_calculation fields.
//
// Formula syntax:
//   {fieldId} + {otherFieldId} * 1.5
//   ({a} + {b}) / 2
//   {sqft} * 12 + 250
//
// - {fieldId} placeholders are substituted with the numeric value from `values`.
//   Missing/non-numeric values become 0.
// - After substitution, only digits, +, -, multiplication, division, parens, dot,
//   and whitespace remain. Anything else is stripped before evaluation.
// - Evaluation uses `new Function()` on the sanitized math-only string. Because we
//   strip everything except those characters, the input cannot contain JS keywords,
//   identifiers, or function calls, so it can only return the result of the
//   arithmetic expression.
// - Returns null if the formula is empty, contains a syntax error, divides by zero,
//   or produces a non-finite number.

const MATH_ALLOWED = /[^0-9+\-*/().\s]/g;

export function evalMath(expression: string): number | null {
  const safe = expression.replace(MATH_ALLOWED, '').trim();
  if (!safe) return null;
  try {
    const result = new Function(`"use strict"; return (${safe})`)();
    if (typeof result === 'number' && Number.isFinite(result)) {
      return result;
    }
    return null;
  } catch {
    return null;
  }
}

export function evalFormula(
  formula: string | undefined,
  values: Record<string, unknown>
): number | null {
  if (!formula) return null;

  const substituted = formula.replace(/\{([^}]+)\}/g, (_, id) => {
    const raw = values[id.trim()];
    if (raw === undefined || raw === null || raw === '') return '0';
    if (typeof raw === 'number') return Number.isFinite(raw) ? String(raw) : '0';
    if (typeof raw === 'string') {
      // Parse numeric strings, allow leading $ or other symbols
      const cleaned = raw.replace(/[^0-9.\-]/g, '');
      const num = Number(cleaned);
      return Number.isFinite(num) ? String(num) : '0';
    }
    return '0';
  });

  return evalMath(substituted);
}

export function formatComputed(
  value: number | null,
  options: { currency?: string; decimals?: number } = {}
): string {
  if (value === null) return '';
  const { currency, decimals } = options;
  const fixed = decimals !== undefined ? value.toFixed(decimals) : String(value);
  if (currency) {
    return `${currency}${fixed}`;
  }
  return fixed;
}
