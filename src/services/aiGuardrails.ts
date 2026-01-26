import { supabase } from '../lib/supabase';
import type {
  AIActionGuardrail,
  AIActionGuardrailConfig,
  AIWorkflowActionType,
  GuardrailType,
} from '../types';

export interface GuardrailCheckResult {
  passed: boolean;
  blocked: boolean;
  blockedReason?: string;
  appliedGuardrails: string[];
  warnings: string[];
  modifiedContent?: string;
}

export async function getActiveGuardrails(
  orgId: string,
  channel?: string,
  actionType?: AIWorkflowActionType
): Promise<AIActionGuardrail[]> {
  let query = supabase
    .from('ai_action_guardrails')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('priority', { ascending: true });

  const { data, error } = await query;

  if (error) throw error;

  let guardrails = data as AIActionGuardrail[];

  if (channel) {
    guardrails = guardrails.filter(g =>
      g.applies_to_channels.length === 0 || g.applies_to_channels.includes(channel)
    );
  }

  if (actionType) {
    guardrails = guardrails.filter(g =>
      g.applies_to_action_types.length === 0 || g.applies_to_action_types.includes(actionType)
    );
  }

  return guardrails;
}

export async function createGuardrail(input: {
  org_id: string;
  name: string;
  description?: string;
  guardrail_type: GuardrailType;
  config: Record<string, unknown>;
  applies_to_channels?: string[];
  applies_to_action_types?: AIWorkflowActionType[];
  priority?: number;
  created_by_user_id?: string;
}): Promise<AIActionGuardrail> {
  const { data, error } = await supabase
    .from('ai_action_guardrails')
    .insert({
      org_id: input.org_id,
      name: input.name,
      description: input.description,
      guardrail_type: input.guardrail_type,
      config: input.config,
      applies_to_channels: input.applies_to_channels || [],
      applies_to_action_types: input.applies_to_action_types || [],
      priority: input.priority || 100,
      is_active: true,
      created_by_user_id: input.created_by_user_id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as AIActionGuardrail;
}

export async function updateGuardrail(
  id: string,
  updates: Partial<{
    name: string;
    description: string;
    config: Record<string, unknown>;
    applies_to_channels: string[];
    applies_to_action_types: AIWorkflowActionType[];
    is_active: boolean;
    priority: number;
  }>
): Promise<AIActionGuardrail> {
  const { data, error } = await supabase
    .from('ai_action_guardrails')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as AIActionGuardrail;
}

export async function deleteGuardrail(id: string): Promise<void> {
  const { error } = await supabase
    .from('ai_action_guardrails')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export function applyGuardrails(
  content: string,
  config: AIActionGuardrailConfig,
  context: {
    channel: string;
    timezone?: string;
  }
): GuardrailCheckResult {
  const result: GuardrailCheckResult = {
    passed: true,
    blocked: false,
    appliedGuardrails: [],
    warnings: [],
    modifiedContent: content,
  };

  if (config.blockSensitiveClaims && config.blockedClaimsList?.length) {
    const claimsCheck = checkBlockedClaims(content, config.blockedClaimsList);
    if (claimsCheck.found) {
      result.blocked = true;
      result.blockedReason = `Content contains blocked claim: "${claimsCheck.match}"`;
      result.passed = false;
      return result;
    }
    result.appliedGuardrails.push('blocked_claims');
  }

  if (config.profanityFilter) {
    const profanityCheck = filterProfanity(content);
    if (profanityCheck.hasProfanity) {
      result.blocked = true;
      result.blockedReason = 'Content contains profanity';
      result.passed = false;
      return result;
    }
    result.appliedGuardrails.push('profanity_filter');
  }

  if (config.quietHoursEnabled && config.quietHoursStart && config.quietHoursEnd) {
    const quietCheck = checkQuietHours(
      context.timezone || 'UTC',
      config.quietHoursStart,
      config.quietHoursEnd
    );
    if (quietCheck.inQuietHours) {
      result.blocked = true;
      result.blockedReason = `Currently in quiet hours (${config.quietHoursStart} - ${config.quietHoursEnd})`;
      result.passed = false;
      return result;
    }
    result.appliedGuardrails.push('quiet_hours');
  }

  if (config.disallowedDomains?.length) {
    const linksCheck = validateLinks(content, config.disallowedDomains);
    if (linksCheck.hasBlockedDomain) {
      result.blocked = true;
      result.blockedReason = `Content contains link to blocked domain: ${linksCheck.blockedDomain}`;
      result.passed = false;
      return result;
    }
    result.appliedGuardrails.push('domain_blocklist');
  }

  if (config.maxMessageLength && context.channel) {
    const lengthCheck = enforceMaxLength(content, config.maxMessageLength, context.channel);
    if (lengthCheck.truncated) {
      result.modifiedContent = lengthCheck.content;
      result.warnings.push(`Content truncated from ${content.length} to ${config.maxMessageLength} characters`);
    }
    result.appliedGuardrails.push('max_length');
  }

  return result;
}

export function checkBlockedClaims(
  text: string,
  claimsList: string[]
): { found: boolean; match?: string } {
  const lowerText = text.toLowerCase();

  for (const claim of claimsList) {
    const lowerClaim = claim.toLowerCase();
    if (lowerText.includes(lowerClaim)) {
      return { found: true, match: claim };
    }
  }

  return { found: false };
}

const PROFANITY_PATTERNS = [
  /\bf+u+c+k+/gi,
  /\bs+h+i+t+/gi,
  /\ba+s+s+h+o+l+e+/gi,
  /\bb+i+t+c+h+/gi,
  /\bd+a+m+n+/gi,
];

export function filterProfanity(text: string): { hasProfanity: boolean; cleaned?: string } {
  let hasProfanity = false;

  for (const pattern of PROFANITY_PATTERNS) {
    if (pattern.test(text)) {
      hasProfanity = true;
      break;
    }
  }

  return { hasProfanity };
}

const PII_PATTERNS = {
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
};

export function redactPIIForLogs(text: string): string {
  let redacted = text;

  redacted = redacted.replace(PII_PATTERNS.ssn, '[SSN REDACTED]');
  redacted = redacted.replace(PII_PATTERNS.creditCard, '[CARD REDACTED]');
  redacted = redacted.replace(PII_PATTERNS.email, '[EMAIL REDACTED]');

  return redacted;
}

export function checkQuietHours(
  timezone: string,
  startTime: string,
  endTime: string
): { inQuietHours: boolean; nextAvailableTime?: string } {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const currentTime = formatter.format(now);
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const currentMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = startTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;

    const [endHour, endMinute] = endTime.split(':').map(Number);
    const endMinutes = endHour * 60 + endMinute;

    let inQuietHours: boolean;
    if (startMinutes <= endMinutes) {
      inQuietHours = currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      inQuietHours = currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    return { inQuietHours };
  } catch (e) {
    console.error('Error checking quiet hours:', e);
    return { inQuietHours: false };
  }
}

export function validateLinks(
  text: string,
  blockedDomains: string[]
): { hasBlockedDomain: boolean; blockedDomain?: string } {
  const urlPattern = /https?:\/\/([^\s/]+)/gi;
  let match;

  while ((match = urlPattern.exec(text)) !== null) {
    const domain = match[1].toLowerCase();
    for (const blocked of blockedDomains) {
      if (domain === blocked.toLowerCase() || domain.endsWith('.' + blocked.toLowerCase())) {
        return { hasBlockedDomain: true, blockedDomain: domain };
      }
    }
  }

  return { hasBlockedDomain: false };
}

export function enforceMaxLength(
  text: string,
  maxLength: number,
  channel: string
): { content: string; truncated: boolean } {
  const effectiveMax = channel === 'sms' ? Math.min(maxLength, 160) : maxLength;

  if (text.length <= effectiveMax) {
    return { content: text, truncated: false };
  }

  const truncated = text.slice(0, effectiveMax - 3) + '...';
  return { content: truncated, truncated: true };
}

export async function applyOrgGuardrails(
  orgId: string,
  content: string,
  channel: string,
  actionType: AIWorkflowActionType,
  timezone?: string
): Promise<GuardrailCheckResult> {
  const guardrails = await getActiveGuardrails(orgId, channel, actionType);

  const result: GuardrailCheckResult = {
    passed: true,
    blocked: false,
    appliedGuardrails: [],
    warnings: [],
    modifiedContent: content,
  };

  for (const guardrail of guardrails) {
    const config = guardrail.config as Record<string, unknown>;

    switch (guardrail.guardrail_type) {
      case 'blocked_claims': {
        const claims = config.claims as string[] || [];
        const check = checkBlockedClaims(result.modifiedContent || content, claims);
        if (check.found) {
          result.blocked = true;
          result.blockedReason = `Content contains blocked claim: "${check.match}"`;
          result.passed = false;
          return result;
        }
        result.appliedGuardrails.push(guardrail.name);
        break;
      }

      case 'profanity_filter': {
        const check = filterProfanity(result.modifiedContent || content);
        if (check.hasProfanity) {
          result.blocked = true;
          result.blockedReason = 'Content contains profanity';
          result.passed = false;
          return result;
        }
        result.appliedGuardrails.push(guardrail.name);
        break;
      }

      case 'quiet_hours': {
        const startTime = config.start_time as string;
        const endTime = config.end_time as string;
        const tz = config.timezone as string || timezone || 'UTC';
        if (startTime && endTime) {
          const check = checkQuietHours(tz, startTime, endTime);
          if (check.inQuietHours) {
            result.blocked = true;
            result.blockedReason = `Currently in quiet hours (${startTime} - ${endTime})`;
            result.passed = false;
            return result;
          }
        }
        result.appliedGuardrails.push(guardrail.name);
        break;
      }

      case 'domain_blocklist': {
        const domains = config.domains as string[] || [];
        const check = validateLinks(result.modifiedContent || content, domains);
        if (check.hasBlockedDomain) {
          result.blocked = true;
          result.blockedReason = `Content contains link to blocked domain: ${check.blockedDomain}`;
          result.passed = false;
          return result;
        }
        result.appliedGuardrails.push(guardrail.name);
        break;
      }

      case 'max_length': {
        const maxLength = config.max_length as number;
        if (maxLength) {
          const check = enforceMaxLength(result.modifiedContent || content, maxLength, channel);
          if (check.truncated) {
            result.modifiedContent = check.content;
            result.warnings.push(`Content truncated to ${maxLength} characters`);
          }
        }
        result.appliedGuardrails.push(guardrail.name);
        break;
      }

      case 'custom_regex': {
        const pattern = config.pattern as string;
        const blockOnMatch = config.block_on_match !== false;
        if (pattern) {
          try {
            const regex = new RegExp(pattern, 'gi');
            const matches = regex.test(result.modifiedContent || content);
            if (matches && blockOnMatch) {
              result.blocked = true;
              result.blockedReason = `Content matches blocked pattern: ${guardrail.name}`;
              result.passed = false;
              return result;
            }
          } catch (e) {
            console.error('Invalid regex pattern in guardrail:', guardrail.name);
          }
        }
        result.appliedGuardrails.push(guardrail.name);
        break;
      }
    }
  }

  return result;
}

export const DEFAULT_BLOCKED_CLAIMS = [
  'guaranteed results',
  'risk-free',
  'act now',
  'limited time only',
  'you have won',
  'congratulations, you',
  'wire transfer',
  'send money',
  'social security number',
  'bank account details',
  'password',
  'login credentials',
];

export const DEFAULT_BLOCKED_DOMAINS = [
  'bit.ly',
  't.co',
  'tinyurl.com',
  'goo.gl',
];
