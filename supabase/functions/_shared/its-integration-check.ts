import { SupabaseClient } from "npm:@supabase/supabase-js@2";

interface ITSAction {
  action_id: string;
  type: string;
  module: string;
  payload: Record<string, unknown>;
  depends_on: string | null;
}

interface IntegrationCheckResult {
  valid: ITSAction[];
  invalid: { action_id: string; action_type: string; reason: string }[];
}

const EMAIL_ACTIONS = new Set(['send_email', 'draft_email']);
const CALENDAR_ACTIONS = new Set(['create_event', 'update_event', 'cancel_event']);
const SMS_ACTIONS = new Set(['send_sms']);

export async function validateIntegrationState(
  actions: ITSAction[],
  context: { userId: string; orgId: string; supabase: SupabaseClient }
): Promise<IntegrationCheckResult> {
  const valid: ITSAction[] = [];
  const invalid: { action_id: string; action_type: string; reason: string }[] = [];

  const needsGmail = actions.some((a) => EMAIL_ACTIONS.has(a.type));
  const needsCalendar = actions.some((a) => CALENDAR_ACTIONS.has(a.type));
  const needsSms = actions.some((a) => SMS_ACTIONS.has(a.type));

  let gmailConnected = false;
  let calendarConnected = false;
  let smsConfigured = false;

  if (needsGmail) {
    const { data } = await context.supabase
      .from('google_oauth_master')
      .select('id, granted_scopes')
      .eq('user_id', context.userId)
      .maybeSingle();

    if (data) {
      const scopes = data.granted_scopes || [];
      gmailConnected = scopes.some((s: string) =>
        s.includes('gmail.send') || s.includes('gmail.modify')
      );
    }
  }

  if (needsCalendar) {
    const { data } = await context.supabase
      .from('google_calendar_connections')
      .select('id, sync_enabled')
      .eq('user_id', context.userId)
      .maybeSingle();

    calendarConnected = !!data && data.sync_enabled !== false;
  }

  if (needsSms) {
    const { data } = await context.supabase
      .from('phone_numbers')
      .select('id')
      .eq('org_id', context.orgId)
      .eq('status', 'active')
      .limit(1);

    smsConfigured = !!data && data.length > 0;
  }

  for (const action of actions) {
    if (EMAIL_ACTIONS.has(action.type) && !gmailConnected) {
      invalid.push({
        action_id: action.action_id,
        action_type: action.type,
        reason: 'Gmail is not connected. Please connect Gmail in Settings > Integrations.',
      });
      continue;
    }

    if (CALENDAR_ACTIONS.has(action.type) && !calendarConnected) {
      invalid.push({
        action_id: action.action_id,
        action_type: action.type,
        reason: 'Google Calendar is not connected. Please connect in Settings > Calendars.',
      });
      continue;
    }

    if (SMS_ACTIONS.has(action.type) && !smsConfigured) {
      invalid.push({
        action_id: action.action_id,
        action_type: action.type,
        reason: 'No active phone number configured. Please set up phone in Settings.',
      });
      continue;
    }

    valid.push(action);
  }

  return { valid, invalid };
}
