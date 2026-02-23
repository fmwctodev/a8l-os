import { SupabaseClient } from "npm:@supabase/supabase-js@2";

interface ITSAction {
  action_id: string;
  type: string;
  module: string;
  payload: Record<string, unknown>;
  depends_on: string | null;
}

interface ITSRequest {
  intent: string;
  confidence: number;
  requires_confirmation: boolean;
  confirmation_reason: string | null;
  actions: ITSAction[];
  response_to_user: string;
}

interface ConfirmationContext {
  userId: string;
  orgId: string;
  supabase: SupabaseClient;
  confirmAllWrites: boolean;
}

const ALWAYS_CONFIRM: Set<string> = new Set([
  'send_email',
  'cancel_event',
]);

const FINANCIAL_ACTIONS: Set<string> = new Set([
  'create_invoice_draft',
  'create_proposal_draft',
]);

const DESTRUCTIVE_WRITES: Set<string> = new Set([
  'update_contact',
  'move_opportunity',
  'update_event',
  'send_sms',
]);

export async function applyConfirmationOverrides(
  request: ITSRequest,
  context: ConfirmationContext
): Promise<ITSRequest> {
  const reasons: string[] = [];

  for (const action of request.actions) {
    if (ALWAYS_CONFIRM.has(action.type)) {
      reasons.push(`${action.type} always requires confirmation`);
    }

    if (FINANCIAL_ACTIONS.has(action.type)) {
      reasons.push(`${action.type} is a financial action requiring confirmation`);
    }

    if (context.confirmAllWrites && DESTRUCTIVE_WRITES.has(action.type)) {
      reasons.push(`${action.type} is a write action and confirm_all_writes is enabled`);
    }

    if (action.type === 'send_sms') {
      const isFirstTime = await isFirstTimeSmsRecipient(
        context.supabase,
        context.userId,
        action.payload.contact_id as string
      );
      if (isFirstTime) {
        reasons.push('First SMS to this contact requires confirmation');
      }
    }
  }

  if (reasons.length > 0) {
    return {
      ...request,
      requires_confirmation: true,
      confirmation_reason: reasons.join('; '),
    };
  }

  return request;
}

async function isFirstTimeSmsRecipient(
  supabase: SupabaseClient,
  userId: string,
  contactId: string
): Promise<boolean> {
  if (!contactId) return true;

  const { data, error } = await supabase
    .from('assistant_action_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('action_type', 'send_sms')
    .eq('execution_status', 'success')
    .limit(1);

  if (error || !data || data.length === 0) {
    return true;
  }

  return false;
}

export function shouldForceConfirmation(actionType: string): boolean {
  return ALWAYS_CONFIRM.has(actionType) || FINANCIAL_ACTIONS.has(actionType);
}
