import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };

interface Condition { id: string; field: string; operator: string; value: unknown; secondaryValue?: unknown; caseSensitive?: boolean; }
interface ConditionGroup { id: string; logicalOperator: 'and' | 'or'; conditions: Array<Condition | ConditionGroup>; }
interface EvaluationContext { entityType: string; entityId: string; entityData: Record<string, unknown>; previousEntityData?: Record<string, unknown>; relatedEntities?: Record<string, Record<string, unknown>>; tags?: string[]; timestamp: string; }
interface EvaluatedCondition { conditionId: string; field: string; operator: string; expectedValue: unknown; actualValue: unknown; result: boolean; error?: string; }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: userData } = await supabase.from("users").select("org_id").eq("id", user.id).maybeSingle();
    if (!userData?.org_id) return new Response(JSON.stringify({ error: "User organization not found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const body = await req.json();
    const { conditions, context, logEvaluation = false } = body as { conditions: ConditionGroup; context: EvaluationContext; logEvaluation?: boolean };
    if (!conditions || !context) return new Response(JSON.stringify({ error: "Missing conditions or context" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const startTime = performance.now();
    const evaluatedConditions: EvaluatedCondition[] = [];
    const errors: string[] = [];
    const result = evaluateGroup(conditions, context, evaluatedConditions, errors);
    const durationMs = performance.now() - startTime;
    if (logEvaluation) await supabase.from("condition_evaluation_logs").insert({ org_id: userData.org_id, context_type: context.entityType, condition_tree: conditions, runtime_context_snapshot: context, evaluation_trace: evaluatedConditions, result, evaluation_time_ms: Math.round(durationMs) });
    return new Response(JSON.stringify({ success: true, result, evaluatedConditions, duration_ms: durationMs, errors: errors.length > 0 ? errors : undefined }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) { console.error("Evaluation error:", error); return new Response(JSON.stringify({ success: false, result: false, error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
});

function evaluateGroup(group: ConditionGroup, context: EvaluationContext, evaluatedConditions: EvaluatedCondition[], errors: string[]): boolean {
  if (!group.conditions || group.conditions.length === 0) return true;
  const results: boolean[] = [];
  for (const item of group.conditions) { if ("logicalOperator" in item) results.push(evaluateGroup(item, context, evaluatedConditions, errors)); else { const evalResult = evaluateSingleCondition(item, context); evaluatedConditions.push(evalResult); if (evalResult.error) errors.push(evalResult.error); results.push(evalResult.result); } }
  return group.logicalOperator === "and" ? results.every(r => r) : results.some(r => r);
}

function evaluateSingleCondition(condition: Condition, context: EvaluationContext): EvaluatedCondition {
  try {
    const actualValue = resolveFieldValue(condition.field, context);
    const result = evaluateOperator(condition.operator, actualValue, condition.value, condition.secondaryValue, condition.caseSensitive ?? false, condition.field, context);
    return { conditionId: condition.id, field: condition.field, operator: condition.operator, expectedValue: condition.value, actualValue, result };
  } catch (error) { return { conditionId: condition.id, field: condition.field, operator: condition.operator, expectedValue: condition.value, actualValue: null, result: false, error: error instanceof Error ? error.message : "Evaluation error" }; }
}

function resolveFieldValue(fieldPath: string, context: EvaluationContext): unknown {
  const parts = fieldPath.split("."); let current: unknown = context.entityData;
  if (parts[0] && parts[0] !== context.entityType && context.relatedEntities) { current = context.relatedEntities[parts[0]]; parts.shift(); }
  for (const part of parts) { if (current === null || current === undefined) return null; current = (current as Record<string, unknown>)[part]; }
  return current;
}

function getPreviousValue(fieldPath: string, context: EvaluationContext): unknown {
  if (!context.previousEntityData) return undefined;
  const parts = fieldPath.split("."); let current: unknown = context.previousEntityData;
  for (const part of parts) { if (current === null || current === undefined) return undefined; current = (current as Record<string, unknown>)[part]; }
  return current;
}

function evaluateOperator(operator: string, actual: unknown, expected: unknown, secondary: unknown, caseSensitive: boolean, fieldPath: string, context: EvaluationContext): boolean {
  switch (operator) {
    case "equals": return compareValues(actual, expected, caseSensitive);
    case "not_equals": return !compareValues(actual, expected, caseSensitive);
    case "contains": return stringContains(actual, expected, caseSensitive);
    case "not_contains": return !stringContains(actual, expected, caseSensitive);
    case "starts_with": return stringStartsWith(actual, expected, caseSensitive);
    case "ends_with": return stringEndsWith(actual, expected, caseSensitive);
    case "is_empty": return isEmpty(actual);
    case "is_not_empty": return !isEmpty(actual);
    case "greater_than": return compareNumbers(actual, expected) > 0;
    case "less_than": return compareNumbers(actual, expected) < 0;
    case "greater_than_or_equal": return compareNumbers(actual, expected) >= 0;
    case "less_than_or_equal": return compareNumbers(actual, expected) <= 0;
    case "between": return isNumberBetween(actual, expected, secondary);
    case "date_before": return compareDates(actual, expected) < 0;
    case "date_after": return compareDates(actual, expected) > 0;
    case "date_within_last": return isDateWithinLast(actual, expected as number);
    case "date_within_next": return isDateWithinNext(actual, expected as number);
    case "date_is_today": return isToday(actual);
    case "has_tag": return hasTag(actual, expected);
    case "not_has_tag": return !hasTag(actual, expected);
    case "changed": { const previous = getPreviousValue(fieldPath, context); return previous !== undefined && !compareValues(actual, previous, caseSensitive); }
    case "changed_to": { const previous = getPreviousValue(fieldPath, context); return previous !== undefined && !compareValues(previous, expected, caseSensitive) && compareValues(actual, expected, caseSensitive); }
    default: return false;
  }
}

function compareValues(a: unknown, b: unknown, caseSensitive: boolean): boolean { if (a === b) return true; if (a == null || b == null) return a === b; if (typeof a === "string" && typeof b === "string") return caseSensitive ? a === b : a.toLowerCase() === b.toLowerCase(); return String(a) === String(b); }
function stringContains(actual: unknown, expected: unknown, caseSensitive: boolean): boolean { if (actual == null) return false; const str = String(actual), search = String(expected); return caseSensitive ? str.includes(search) : str.toLowerCase().includes(search.toLowerCase()); }
function stringStartsWith(actual: unknown, expected: unknown, caseSensitive: boolean): boolean { if (actual == null) return false; const str = String(actual), search = String(expected); return caseSensitive ? str.startsWith(search) : str.toLowerCase().startsWith(search.toLowerCase()); }
function stringEndsWith(actual: unknown, expected: unknown, caseSensitive: boolean): boolean { if (actual == null) return false; const str = String(actual), search = String(expected); return caseSensitive ? str.endsWith(search) : str.toLowerCase().endsWith(search.toLowerCase()); }
function isEmpty(value: unknown): boolean { if (value == null) return true; if (typeof value === "string") return value.trim() === ""; if (Array.isArray(value)) return value.length === 0; return false; }
function compareNumbers(a: unknown, b: unknown): number { return (Number(a) || 0) - (Number(b) || 0); }
function isNumberBetween(value: unknown, min: unknown, max: unknown): boolean { const num = Number(value), minNum = Number(min), maxNum = Number(max); if (isNaN(num) || isNaN(minNum) || isNaN(maxNum)) return false; return num >= minNum && num <= maxNum; }
function compareDates(a: unknown, b: unknown): number { return (a ? new Date(String(a)).getTime() : 0) - (b ? new Date(String(b)).getTime() : 0); }
function isDateWithinLast(value: unknown, days: number): boolean { if (!value) return false; const date = new Date(String(value)), now = new Date(), threshold = new Date(now.getTime() - days * 86400000); return date >= threshold && date <= now; }
function isDateWithinNext(value: unknown, days: number): boolean { if (!value) return false; const date = new Date(String(value)), now = new Date(), threshold = new Date(now.getTime() + days * 86400000); return date >= now && date <= threshold; }
function isToday(value: unknown): boolean { if (!value) return false; const date = new Date(String(value)), today = new Date(); return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate(); }
function hasTag(actual: unknown, tag: unknown): boolean { const tags = Array.isArray(actual) ? actual : []; const searchTag = String(tag).toLowerCase(); return tags.some(t => String(t).toLowerCase() === searchTag); }
