import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ConditionGroup {
  logic: 'and' | 'or';
  conditions: Condition[];
  groups?: ConditionGroup[];
}

interface Condition {
  field: string;
  operator: string;
  value: unknown;
  field_type?: string;
}

interface WaitConfig {
  condition_groups: ConditionGroup[];
  timeout_action?: 'skip' | 'stop' | 'continue';
  timeout_days?: number;
  check_interval_minutes?: number;
}

interface EnrollmentContext {
  contact_id: string;
  org_id: string;
  opportunity_id?: string;
  variables: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { enrollment_id, action } = await req.json();

    if (action === 'check_single') {
      const result = await checkSingleEnrollment(supabase, enrollment_id);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === 'check_all_waiting') {
      const results = await checkAllWaitingEnrollments(supabase);
      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error('Condition checker error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function checkSingleEnrollment(supabase: ReturnType<typeof createClient>, enrollmentId: string) {
  const { data: wait, error: waitError } = await supabase
    .from('workflow_condition_waits')
    .select(`
      *,
      enrollment:workflow_enrollments(
        *,
        contact:contacts(*),
        workflow:workflows(*)
      )
    `)
    .eq('enrollment_id', enrollmentId)
    .eq('status', 'waiting')
    .maybeSingle();

  if (waitError || !wait) {
    return { checked: false, reason: 'No active wait found' };
  }

  return await evaluateWaitCondition(supabase, wait);
}

async function checkAllWaitingEnrollments(supabase: ReturnType<typeof createClient>) {
  const { data: waits, error } = await supabase
    .from('workflow_condition_waits')
    .select(`
      *,
      enrollment:workflow_enrollments(
        *,
        contact:contacts(*),
        workflow:workflows(*)
      )
    `)
    .eq('status', 'waiting')
    .lte('next_check_at', new Date().toISOString());

  if (error) {
    throw error;
  }

  const results = [];
  for (const wait of waits || []) {
    const result = await evaluateWaitCondition(supabase, wait);
    results.push({ wait_id: wait.id, ...result });
  }

  return { checked: results.length, results };
}

async function evaluateWaitCondition(supabase: ReturnType<typeof createClient>, wait: any) {
  const enrollment = wait.enrollment;
  const config = wait.condition_config as WaitConfig;

  if (wait.timeout_at && new Date(wait.timeout_at) < new Date()) {
    await handleTimeout(supabase, wait, config.timeout_action || 'skip');
    return { checked: true, result: 'timeout', action: config.timeout_action };
  }

  const context: EnrollmentContext = {
    contact_id: enrollment.contact_id,
    org_id: enrollment.org_id,
    opportunity_id: enrollment.variables?.opportunity_id,
    variables: enrollment.variables || {},
  };

  const conditionMet = await evaluateConditionGroups(supabase, config.condition_groups, context);

  if (conditionMet) {
    await supabase
      .from('workflow_condition_waits')
      .update({ status: 'satisfied', satisfied_at: new Date().toISOString() })
      .eq('id', wait.id);

    await supabase
      .from('workflow_enrollments')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', enrollment.id);

    await supabase.functions.invoke('workflow-processor', {
      body: { enrollment_id: enrollment.id }
    });

    return { checked: true, result: 'satisfied', resumed: true };
  }

  const checkInterval = config.check_interval_minutes || 60;
  const nextCheck = new Date(Date.now() + checkInterval * 60 * 1000);

  await supabase
    .from('workflow_condition_waits')
    .update({
      check_count: wait.check_count + 1,
      last_check_at: new Date().toISOString(),
      next_check_at: nextCheck.toISOString(),
    })
    .eq('id', wait.id);

  return { checked: true, result: 'waiting', next_check: nextCheck.toISOString() };
}

async function handleTimeout(supabase: ReturnType<typeof createClient>, wait: any, action: string) {
  await supabase
    .from('workflow_condition_waits')
    .update({ status: 'timed_out', satisfied_at: new Date().toISOString() })
    .eq('id', wait.id);

  const enrollment = wait.enrollment;

  if (action === 'stop') {
    await supabase
      .from('workflow_enrollments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_reason: 'condition_timeout',
      })
      .eq('id', enrollment.id);
  } else if (action === 'continue' || action === 'skip') {
    await supabase
      .from('workflow_enrollments')
      .update({
        status: 'active',
        current_step_index: enrollment.current_step_index + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', enrollment.id);

    await supabase.functions.invoke('workflow-processor', {
      body: { enrollment_id: enrollment.id }
    });
  }
}

async function evaluateConditionGroups(
  supabase: ReturnType<typeof createClient>,
  groups: ConditionGroup[],
  context: EnrollmentContext
): Promise<boolean> {
  if (!groups || groups.length === 0) return true;

  for (const group of groups) {
    const groupResult = await evaluateSingleGroup(supabase, group, context);
    if (!groupResult) return false;
  }

  return true;
}

async function evaluateSingleGroup(
  supabase: ReturnType<typeof createClient>,
  group: ConditionGroup,
  context: EnrollmentContext
): Promise<boolean> {
  const conditionResults: boolean[] = [];

  for (const condition of group.conditions || []) {
    const result = await evaluateCondition(supabase, condition, context);
    conditionResults.push(result);
  }

  if (group.groups) {
    for (const subGroup of group.groups) {
      const result = await evaluateSingleGroup(supabase, subGroup, context);
      conditionResults.push(result);
    }
  }

  if (conditionResults.length === 0) return true;

  if (group.logic === 'and') {
    return conditionResults.every(r => r);
  } else {
    return conditionResults.some(r => r);
  }
}

async function evaluateCondition(
  supabase: ReturnType<typeof createClient>,
  condition: Condition,
  context: EnrollmentContext
): Promise<boolean> {
  const fieldValue = await getFieldValue(supabase, condition.field, context);
  return compareValues(fieldValue, condition.operator, condition.value, condition.field_type);
}

async function getFieldValue(
  supabase: ReturnType<typeof createClient>,
  field: string,
  context: EnrollmentContext
): Promise<unknown> {
  const parts = field.split('.');
  const entity = parts[0];
  const fieldPath = parts.slice(1).join('.');

  if (entity === 'contact') {
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', context.contact_id)
      .maybeSingle();
    return getNestedValue(data, fieldPath);
  }

  if (entity === 'opportunity' && context.opportunity_id) {
    const { data } = await supabase
      .from('opportunities')
      .select('*')
      .eq('id', context.opportunity_id)
      .maybeSingle();
    return getNestedValue(data, fieldPath);
  }

  if (entity === 'last_email') {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', context.contact_id)
      .eq('channel', 'email')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return getNestedValue(data, fieldPath);
  }

  if (entity === 'last_sms') {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', context.contact_id)
      .eq('channel', 'sms')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return getNestedValue(data, fieldPath);
  }

  if (entity === 'last_activity') {
    const { data } = await supabase
      .from('contact_timeline')
      .select('*')
      .eq('contact_id', context.contact_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return getNestedValue(data, fieldPath);
  }

  if (entity === 'appointment') {
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('contact_id', context.contact_id)
      .eq('org_id', context.org_id)
      .order('start_time', { ascending: false })
      .limit(1)
      .maybeSingle();
    return getNestedValue(data, fieldPath);
  }

  if (entity === 'invoice') {
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .eq('contact_id', context.contact_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return getNestedValue(data, fieldPath);
  }

  if (entity === 'task') {
    const { data } = await supabase
      .from('contact_tasks')
      .select('*')
      .eq('contact_id', context.contact_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return getNestedValue(data, fieldPath);
  }

  if (entity === 'variable') {
    return getNestedValue(context.variables, fieldPath);
  }

  if (entity === 'custom_field') {
    const { data } = await supabase
      .from('contact_custom_field_values')
      .select('value, custom_field:custom_fields(field_key)')
      .eq('contact_id', context.contact_id)
      .maybeSingle();

    if (data && typeof data === 'object' && 'custom_field' in data) {
      const customField = data.custom_field as { field_key: string } | null;
      if (customField?.field_key === fieldPath) {
        return data.value;
      }
    }
    return null;
  }

  return null;
}

function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || !path) return obj;

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return null;
    if (typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }

  return current;
}

function compareValues(
  fieldValue: unknown,
  operator: string,
  conditionValue: unknown,
  fieldType?: string
): boolean {
  if (fieldValue === null || fieldValue === undefined) {
    if (operator === 'is_empty' || operator === 'is_null') return true;
    if (operator === 'is_not_empty' || operator === 'is_not_null') return false;
    return false;
  }

  switch (operator) {
    case 'equals':
    case 'eq':
      return String(fieldValue).toLowerCase() === String(conditionValue).toLowerCase();

    case 'not_equals':
    case 'neq':
      return String(fieldValue).toLowerCase() !== String(conditionValue).toLowerCase();

    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());

    case 'not_contains':
      return !String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());

    case 'starts_with':
      return String(fieldValue).toLowerCase().startsWith(String(conditionValue).toLowerCase());

    case 'ends_with':
      return String(fieldValue).toLowerCase().endsWith(String(conditionValue).toLowerCase());

    case 'greater_than':
    case 'gt':
      return Number(fieldValue) > Number(conditionValue);

    case 'less_than':
    case 'lt':
      return Number(fieldValue) < Number(conditionValue);

    case 'greater_than_or_equal':
    case 'gte':
      return Number(fieldValue) >= Number(conditionValue);

    case 'less_than_or_equal':
    case 'lte':
      return Number(fieldValue) <= Number(conditionValue);

    case 'is_empty':
      return fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0);

    case 'is_not_empty':
      return fieldValue !== '' && !(Array.isArray(fieldValue) && fieldValue.length === 0);

    case 'is_true':
      return fieldValue === true || fieldValue === 'true' || fieldValue === 1;

    case 'is_false':
      return fieldValue === false || fieldValue === 'false' || fieldValue === 0;

    case 'in_list':
      if (Array.isArray(conditionValue)) {
        return conditionValue.some(v =>
          String(v).toLowerCase() === String(fieldValue).toLowerCase()
        );
      }
      return false;

    case 'not_in_list':
      if (Array.isArray(conditionValue)) {
        return !conditionValue.some(v =>
          String(v).toLowerCase() === String(fieldValue).toLowerCase()
        );
      }
      return true;

    case 'before':
      if (fieldType === 'date' || fieldType === 'datetime') {
        return new Date(String(fieldValue)) < new Date(String(conditionValue));
      }
      return false;

    case 'after':
      if (fieldType === 'date' || fieldType === 'datetime') {
        return new Date(String(fieldValue)) > new Date(String(conditionValue));
      }
      return false;

    case 'within_days':
      if (fieldType === 'date' || fieldType === 'datetime') {
        const fieldDate = new Date(String(fieldValue));
        const now = new Date();
        const daysDiff = Math.abs((fieldDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff <= Number(conditionValue);
      }
      return false;

    case 'matches_regex':
      try {
        const regex = new RegExp(String(conditionValue), 'i');
        return regex.test(String(fieldValue));
      } catch {
        return false;
      }

    case 'has_tag':
      if (Array.isArray(fieldValue)) {
        return fieldValue.some(tag =>
          String(tag).toLowerCase() === String(conditionValue).toLowerCase()
        );
      }
      return false;

    case 'missing_tag':
      if (Array.isArray(fieldValue)) {
        return !fieldValue.some(tag =>
          String(tag).toLowerCase() === String(conditionValue).toLowerCase()
        );
      }
      return true;

    default:
      console.warn(`Unknown operator: ${operator}`);
      return false;
  }
}
