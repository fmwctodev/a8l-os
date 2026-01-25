import { supabase } from '../lib/supabase';

export interface TokenContext {
  contact?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    company?: string;
    job_title?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    source?: string;
    status?: string;
    owner_name?: string;
    custom_fields?: Record<string, unknown>;
    [key: string]: unknown;
  };
  opportunity?: {
    id?: string;
    name?: string;
    value?: number;
    stage_name?: string;
    pipeline_name?: string;
    close_date?: string;
    owner_name?: string;
    custom_fields?: Record<string, unknown>;
    [key: string]: unknown;
  };
  appointment?: {
    id?: string;
    type_name?: string;
    start_at?: string;
    end_at?: string;
    location?: string;
    assigned_user?: string;
    [key: string]: unknown;
  };
  user?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    [key: string]: unknown;
  };
  organization?: {
    id?: string;
    name?: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface ResolveOptions {
  preserveUnresolved?: boolean;
  dateFormat?: string;
  currencyCode?: string;
  locale?: string;
}

interface TokenInfo {
  token: string;
  category: string;
  key: string;
  description?: string;
  example?: string;
}

interface UnresolvedToken {
  token: string;
  reason: 'missing_context' | 'missing_value' | 'invalid_path';
}

const TOKEN_PATTERN = /\{\{([^}|]+)(?:\|([^}]*))?\}\}/g;

export async function resolveTokensInText(
  text: string,
  orgId: string,
  context: TokenContext,
  options: ResolveOptions = {}
): Promise<string> {
  const { preserveUnresolved = false, dateFormat, currencyCode = 'USD', locale = 'en-US' } = options;

  const { data: customValues } = await supabase
    .from('custom_values')
    .select('key, value')
    .eq('org_id', orgId);

  const customValueMap: Record<string, string> = {};
  customValues?.forEach(v => {
    customValueMap[v.key.toLowerCase()] = v.value;
  });

  return text.replace(TOKEN_PATTERN, (match, tokenPath, fallback) => {
    const resolved = resolveTokenPath(tokenPath.trim(), context, customValueMap, {
      dateFormat,
      currencyCode,
      locale,
    });

    if (resolved !== null && resolved !== undefined && resolved !== '') {
      return String(resolved);
    }

    if (fallback !== undefined) {
      return fallback;
    }

    return preserveUnresolved ? match : '';
  });
}

function resolveTokenPath(
  path: string,
  context: TokenContext,
  customValues: Record<string, string>,
  options: { dateFormat?: string; currencyCode?: string; locale?: string }
): unknown {
  if (path.startsWith('custom.')) {
    const key = path.substring(7).toLowerCase();
    return customValues[key];
  }

  if (path === 'today') {
    return formatDate(new Date(), options.dateFormat);
  }
  if (path === 'now') {
    return formatDateTime(new Date(), options.locale);
  }
  if (path === 'year') {
    return new Date().getFullYear();
  }
  if (path === 'month') {
    return new Date().toLocaleString(options.locale, { month: 'long' });
  }
  if (path === 'day') {
    return new Date().getDate();
  }

  if (path.includes('|format:')) {
    const [basePath, formatSpec] = path.split('|format:');
    const value = resolveNestedPath(basePath.trim(), context);
    return applyFormat(value, formatSpec, options);
  }

  return resolveNestedPath(path, context);
}

function resolveNestedPath(path: string, context: TokenContext): unknown {
  const parts = path.split('.');
  let current: unknown = context;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

function formatDate(date: Date, format?: string): string {
  if (format) {
    return format
      .replace('YYYY', String(date.getFullYear()))
      .replace('MM', String(date.getMonth() + 1).padStart(2, '0'))
      .replace('DD', String(date.getDate()).padStart(2, '0'))
      .replace('M', String(date.getMonth() + 1))
      .replace('D', String(date.getDate()));
  }
  return date.toLocaleDateString();
}

function formatDateTime(date: Date, locale?: string): string {
  return date.toLocaleString(locale);
}

function applyFormat(
  value: unknown,
  formatSpec: string,
  options: { currencyCode?: string; locale?: string }
): string {
  if (value === null || value === undefined) {
    return '';
  }

  const spec = formatSpec.trim().toLowerCase();

  if (spec.startsWith('date:') || spec === 'date') {
    const dateFormat = spec === 'date' ? undefined : spec.substring(5);
    const date = new Date(value as string);
    if (!isNaN(date.getTime())) {
      return formatDate(date, dateFormat);
    }
    return String(value);
  }

  if (spec === 'currency') {
    const num = Number(value);
    if (!isNaN(num)) {
      return new Intl.NumberFormat(options.locale, {
        style: 'currency',
        currency: options.currencyCode,
      }).format(num);
    }
    return String(value);
  }

  if (spec === 'number') {
    const num = Number(value);
    if (!isNaN(num)) {
      return new Intl.NumberFormat(options.locale).format(num);
    }
    return String(value);
  }

  if (spec === 'uppercase') {
    return String(value).toUpperCase();
  }

  if (spec === 'lowercase') {
    return String(value).toLowerCase();
  }

  if (spec === 'titlecase') {
    return String(value)
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  if (spec === 'phone') {
    const digits = String(value).replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return String(value);
  }

  return String(value);
}

export function getUnresolvedTokens(
  text: string,
  context: TokenContext,
  customValueKeys: string[]
): UnresolvedToken[] {
  const unresolved: UnresolvedToken[] = [];
  const matches = text.matchAll(TOKEN_PATTERN);

  for (const match of matches) {
    const tokenPath = match[1].trim();
    const fallback = match[2];

    if (fallback !== undefined) {
      continue;
    }

    if (tokenPath.startsWith('custom.')) {
      const key = tokenPath.substring(7).toLowerCase();
      if (!customValueKeys.includes(key)) {
        unresolved.push({
          token: match[0],
          reason: 'missing_value',
        });
      }
      continue;
    }

    if (['today', 'now', 'year', 'month', 'day'].includes(tokenPath)) {
      continue;
    }

    const basePath = tokenPath.includes('|format:')
      ? tokenPath.split('|format:')[0].trim()
      : tokenPath;

    const value = resolveNestedPath(basePath, context);
    if (value === undefined) {
      const parts = basePath.split('.');
      const rootKey = parts[0];

      if (!(rootKey in context)) {
        unresolved.push({
          token: match[0],
          reason: 'missing_context',
        });
      } else {
        unresolved.push({
          token: match[0],
          reason: 'invalid_path',
        });
      }
    } else if (value === null || value === '') {
      unresolved.push({
        token: match[0],
        reason: 'missing_value',
      });
    }
  }

  return unresolved;
}

export function extractTokensFromText(text: string): string[] {
  const tokens: string[] = [];
  const matches = text.matchAll(TOKEN_PATTERN);

  for (const match of matches) {
    tokens.push(match[0]);
  }

  return [...new Set(tokens)];
}

export async function getAvailableTokens(
  orgId: string,
  includeContextTokens: ('contact' | 'opportunity' | 'appointment' | 'user' | 'organization')[]
): Promise<TokenInfo[]> {
  const tokens: TokenInfo[] = [];

  if (includeContextTokens.includes('contact')) {
    tokens.push(
      { token: '{{contact.first_name}}', category: 'contact', key: 'first_name', description: 'Contact first name' },
      { token: '{{contact.last_name}}', category: 'contact', key: 'last_name', description: 'Contact last name' },
      { token: '{{contact.email}}', category: 'contact', key: 'email', description: 'Contact email address' },
      { token: '{{contact.phone}}', category: 'contact', key: 'phone', description: 'Contact phone number' },
      { token: '{{contact.company}}', category: 'contact', key: 'company', description: 'Contact company name' },
      { token: '{{contact.job_title}}', category: 'contact', key: 'job_title', description: 'Contact job title' },
      { token: '{{contact.city}}', category: 'contact', key: 'city', description: 'Contact city' },
      { token: '{{contact.state}}', category: 'contact', key: 'state', description: 'Contact state' },
      { token: '{{contact.owner_name}}', category: 'contact', key: 'owner_name', description: 'Assigned owner name' },
    );
  }

  if (includeContextTokens.includes('opportunity')) {
    tokens.push(
      { token: '{{opportunity.name}}', category: 'opportunity', key: 'name', description: 'Opportunity name' },
      { token: '{{opportunity.value}}', category: 'opportunity', key: 'value', description: 'Opportunity value' },
      { token: '{{opportunity.stage_name}}', category: 'opportunity', key: 'stage_name', description: 'Current stage' },
      { token: '{{opportunity.pipeline_name}}', category: 'opportunity', key: 'pipeline_name', description: 'Pipeline name' },
      { token: '{{opportunity.close_date}}', category: 'opportunity', key: 'close_date', description: 'Expected close date' },
    );
  }

  if (includeContextTokens.includes('appointment')) {
    tokens.push(
      { token: '{{appointment.type_name}}', category: 'appointment', key: 'type_name', description: 'Appointment type' },
      { token: '{{appointment.start_at}}', category: 'appointment', key: 'start_at', description: 'Appointment start time' },
      { token: '{{appointment.end_at}}', category: 'appointment', key: 'end_at', description: 'Appointment end time' },
      { token: '{{appointment.location}}', category: 'appointment', key: 'location', description: 'Appointment location' },
    );
  }

  if (includeContextTokens.includes('user')) {
    tokens.push(
      { token: '{{user.first_name}}', category: 'user', key: 'first_name', description: 'Current user first name' },
      { token: '{{user.last_name}}', category: 'user', key: 'last_name', description: 'Current user last name' },
      { token: '{{user.email}}', category: 'user', key: 'email', description: 'Current user email' },
    );
  }

  if (includeContextTokens.includes('organization')) {
    tokens.push(
      { token: '{{organization.name}}', category: 'organization', key: 'name', description: 'Organization name' },
      { token: '{{organization.phone}}', category: 'organization', key: 'phone', description: 'Organization phone' },
      { token: '{{organization.email}}', category: 'organization', key: 'email', description: 'Organization email' },
      { token: '{{organization.website}}', category: 'organization', key: 'website', description: 'Organization website' },
    );
  }

  tokens.push(
    { token: '{{today}}', category: 'date', key: 'today', description: 'Current date' },
    { token: '{{now}}', category: 'date', key: 'now', description: 'Current date and time' },
    { token: '{{year}}', category: 'date', key: 'year', description: 'Current year' },
    { token: '{{month}}', category: 'date', key: 'month', description: 'Current month name' },
  );

  const { data: customValues } = await supabase
    .from('custom_values')
    .select('key, name')
    .eq('org_id', orgId);

  customValues?.forEach(cv => {
    tokens.push({
      token: `{{custom.${cv.key}}}`,
      category: 'custom',
      key: cv.key,
      description: cv.name,
    });
  });

  return tokens;
}

export function validateTemplate(
  template: string,
  availableTokens: string[]
): { valid: boolean; invalidTokens: string[] } {
  const usedTokens = extractTokensFromText(template);
  const invalidTokens: string[] = [];

  for (const token of usedTokens) {
    const tokenMatch = /\{\{([^}|]+)/.exec(token);
    if (!tokenMatch) continue;

    const tokenPath = tokenMatch[1].trim();

    if (['today', 'now', 'year', 'month', 'day'].includes(tokenPath)) {
      continue;
    }

    if (tokenPath.includes('|format:')) {
      const basePath = tokenPath.split('|format:')[0].trim();
      const baseToken = `{{${basePath}}}`;
      if (!availableTokens.includes(baseToken) && !availableTokens.some(t => t.startsWith(`{{${basePath.split('.')[0]}.`))) {
        invalidTokens.push(token);
      }
      continue;
    }

    if (!availableTokens.includes(token)) {
      const parts = tokenPath.split('.');
      const categoryToken = `{{${parts[0]}.`;
      if (!availableTokens.some(t => t.startsWith(categoryToken))) {
        invalidTokens.push(token);
      }
    }
  }

  return {
    valid: invalidTokens.length === 0,
    invalidTokens,
  };
}

export function buildComputedTokens(context: TokenContext): Record<string, string> {
  const computed: Record<string, string> = {};

  if (context.contact) {
    const { first_name, last_name } = context.contact;
    if (first_name || last_name) {
      computed['contact.full_name'] = [first_name, last_name].filter(Boolean).join(' ');
    }

    const { address_line1, address_line2, city, state, postal_code, country } = context.contact;
    const addressParts = [address_line1, address_line2, city, state, postal_code, country].filter(Boolean);
    if (addressParts.length > 0) {
      computed['contact.full_address'] = addressParts.join(', ');
    }
  }

  if (context.user) {
    const { first_name, last_name } = context.user;
    if (first_name || last_name) {
      computed['user.full_name'] = [first_name, last_name].filter(Boolean).join(' ');
    }
  }

  return computed;
}
