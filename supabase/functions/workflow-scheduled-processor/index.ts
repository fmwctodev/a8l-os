import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface FilterConfig {
  logic?: "and" | "or";
  rules?: FilterRule[];
}

interface FilterRule {
  field: string;
  operator: string;
  value: unknown;
}

interface WorkflowDefinition {
  nodes: Array<{ id: string; type: string; data: Record<string, unknown> }>;
  edges: Array<{ id: string; source: string; target: string; sourceHandle?: string }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const results = {
      triggersProcessed: 0,
      contactsMatched: 0,
      enrollmentsCreated: 0,
      contactsSkipped: 0,
      errors: [] as string[],
    };

    const now = new Date().toISOString();
    const { data: dueTriggers } = await supabase
      .from("workflow_scheduled_triggers")
      .select(`
        *,
        workflow:workflows(id, org_id, status, published_definition)
      `)
      .eq("is_active", true)
      .lte("next_run_at", now)
      .order("next_run_at", { ascending: true })
      .limit(10);

    for (const trigger of dueTriggers || []) {
      const runId = crypto.randomUUID();
      const runStartTime = new Date();

      try {
        if (trigger.workflow?.status !== "published") {
          continue;
        }

        const { data: run } = await supabase
          .from("workflow_scheduled_trigger_runs")
          .insert({
            org_id: trigger.org_id,
            trigger_id: trigger.id,
            started_at: runStartTime.toISOString(),
            status: "running",
          })
          .select()
          .single();

        const contacts = await getMatchingContacts(supabase, trigger.org_id, trigger.filter_config);
        const runStats = {
          contactsMatched: contacts.length,
          contactsEnrolled: 0,
          contactsSkipped: 0,
          errors: [] as string[],
        };

        results.contactsMatched += contacts.length;

        const { data: latestVersion } = await supabase
          .from("workflow_versions")
          .select("id")
          .eq("workflow_id", trigger.workflow_id)
          .order("version_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!latestVersion) {
          runStats.errors.push("No published version found");
          await finalizeRun(supabase, run.id, runStats, "failed");
          continue;
        }

        const definition = trigger.workflow.published_definition as WorkflowDefinition;
        const triggerNode = definition.nodes.find((n) => n.type === "trigger");
        const firstEdge = triggerNode
          ? definition.edges.find((e) => e.source === triggerNode.id)
          : null;
        const firstNodeId = firstEdge?.target || null;

        for (const contact of contacts) {
          try {
            const shouldEnroll = await checkReEnrollmentPolicy(
              supabase,
              trigger.workflow_id,
              contact.id,
              trigger.re_enrollment_policy
            );

            if (!shouldEnroll) {
              runStats.contactsSkipped++;
              results.contactsSkipped++;
              continue;
            }

            const { data: enrollment } = await supabase
              .from("workflow_enrollments")
              .insert({
                org_id: trigger.org_id,
                workflow_id: trigger.workflow_id,
                version_id: latestVersion.id,
                contact_id: contact.id,
                status: "active",
                current_node_id: firstNodeId,
                context_data: {
                  trigger_source: "scheduled",
                  trigger_id: trigger.id,
                  trigger_name: trigger.name,
                  scheduled_run_id: run.id,
                  enrolled_at: new Date().toISOString(),
                },
              })
              .select()
              .single();

            if (enrollment && firstNodeId) {
              await supabase.from("workflow_jobs").insert({
                org_id: trigger.org_id,
                enrollment_id: enrollment.id,
                node_id: firstNodeId,
                run_at: new Date().toISOString(),
                status: "pending",
                execution_key: `${enrollment.id}-${firstNodeId}-${Date.now()}`,
              });

              await supabase.from("workflow_execution_logs").insert({
                org_id: trigger.org_id,
                enrollment_id: enrollment.id,
                node_id: "trigger",
                event_type: "trigger_fired",
                payload: {
                  source: "scheduled",
                  trigger_id: trigger.id,
                  trigger_name: trigger.name,
                  cadence: trigger.cadence,
                },
              });
            }

            runStats.contactsEnrolled++;
            results.enrollmentsCreated++;
          } catch (err) {
            runStats.errors.push(`Contact ${contact.id}: ${err.message}`);
          }
        }

        await finalizeRun(supabase, run.id, runStats,
          runStats.errors.length > 0 ? "partial_failure" : "success");

        const nextRunAt = calculateNextRunAt(trigger);
        await supabase
          .from("workflow_scheduled_triggers")
          .update({
            last_run_at: runStartTime.toISOString(),
            next_run_at: nextRunAt.toISOString(),
          })
          .eq("id", trigger.id);

        results.triggersProcessed++;
      } catch (err) {
        results.errors.push(`Trigger ${trigger.id}: ${err.message}`);

        await supabase
          .from("workflow_scheduled_trigger_runs")
          .update({
            completed_at: new Date().toISOString(),
            status: "failed",
            error_details: { error: err.message },
          })
          .eq("trigger_id", trigger.id)
          .eq("status", "running");
      }
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Scheduled processor error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function getMatchingContacts(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  filterConfig: FilterConfig
): Promise<Array<{ id: string; [key: string]: unknown }>> {
  let query = supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, status, owner_id, department_id, created_at, last_activity_at, lead_score, tags:contact_tags(tag_id)")
    .eq("org_id", orgId);

  if (!filterConfig?.rules || filterConfig.rules.length === 0) {
    const { data } = await query.limit(1000);
    return data || [];
  }

  for (const rule of filterConfig.rules) {
    query = applyFilterRule(query, rule);
  }

  const { data } = await query.limit(1000);

  if (filterConfig.logic === "or" && filterConfig.rules.length > 1) {
    return filterContactsWithOrLogic(data || [], filterConfig);
  }

  return data || [];
}

function applyFilterRule(
  query: ReturnType<ReturnType<typeof createClient>["from"]>,
  rule: FilterRule
) {
  const { field, operator, value } = rule;

  if (field === "tags") {
    return query;
  }

  switch (operator) {
    case "equals":
      return query.eq(field, value);
    case "not_equals":
      return query.neq(field, value);
    case "contains":
      return query.ilike(field, `%${value}%`);
    case "starts_with":
      return query.ilike(field, `${value}%`);
    case "ends_with":
      return query.ilike(field, `%${value}`);
    case "is_empty":
      return query.is(field, null);
    case "is_not_empty":
      return query.not(field, "is", null);
    case "greater_than":
      return query.gt(field, value);
    case "less_than":
      return query.lt(field, value);
    case "greater_than_or_equal":
      return query.gte(field, value);
    case "less_than_or_equal":
      return query.lte(field, value);
    case "in_last_days": {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - Number(value));
      return query.gte(field, daysAgo.toISOString());
    }
    case "not_in_last_days": {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - Number(value));
      return query.lt(field, daysAgo.toISOString());
    }
    default:
      return query;
  }
}

function filterContactsWithOrLogic(
  contacts: Array<{ id: string; [key: string]: unknown }>,
  filterConfig: FilterConfig
): Array<{ id: string; [key: string]: unknown }> {
  return contacts.filter((contact) => {
    return filterConfig.rules!.some((rule) => evaluateRule(contact, rule));
  });
}

function evaluateRule(contact: Record<string, unknown>, rule: FilterRule): boolean {
  const { field, operator, value } = rule;

  if (field === "tags") {
    const contactTags = (contact.tags as Array<{ tag_id: string }>) || [];
    const tagIds = contactTags.map((t) => t.tag_id);

    switch (operator) {
      case "includes":
        return Array.isArray(value)
          ? (value as string[]).some((v) => tagIds.includes(v))
          : tagIds.includes(value as string);
      case "excludes":
        return Array.isArray(value)
          ? !(value as string[]).some((v) => tagIds.includes(v))
          : !tagIds.includes(value as string);
      case "includes_all":
        return Array.isArray(value)
          ? (value as string[]).every((v) => tagIds.includes(v))
          : tagIds.includes(value as string);
      default:
        return true;
    }
  }

  const contactValue = contact[field];

  switch (operator) {
    case "equals":
      return contactValue === value;
    case "not_equals":
      return contactValue !== value;
    case "contains":
      return String(contactValue || "").toLowerCase().includes(String(value).toLowerCase());
    case "is_empty":
      return contactValue === null || contactValue === undefined || contactValue === "";
    case "is_not_empty":
      return contactValue !== null && contactValue !== undefined && contactValue !== "";
    case "greater_than":
      return Number(contactValue) > Number(value);
    case "less_than":
      return Number(contactValue) < Number(value);
    default:
      return true;
  }
}

async function checkReEnrollmentPolicy(
  supabase: ReturnType<typeof createClient>,
  workflowId: string,
  contactId: string,
  policy: string
): Promise<boolean> {
  if (policy === "always") {
    const { data: activeEnrollment } = await supabase
      .from("workflow_enrollments")
      .select("id")
      .eq("workflow_id", workflowId)
      .eq("contact_id", contactId)
      .eq("status", "active")
      .maybeSingle();

    return !activeEnrollment;
  }

  if (policy === "after_completion") {
    const { data: existingEnrollment } = await supabase
      .from("workflow_enrollments")
      .select("id, status")
      .eq("workflow_id", workflowId)
      .eq("contact_id", contactId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!existingEnrollment) return true;
    return existingEnrollment.status === "completed";
  }

  const { data: existingEnrollment } = await supabase
    .from("workflow_enrollments")
    .select("id")
    .eq("workflow_id", workflowId)
    .eq("contact_id", contactId)
    .maybeSingle();

  return !existingEnrollment;
}

async function finalizeRun(
  supabase: ReturnType<typeof createClient>,
  runId: string,
  stats: {
    contactsMatched: number;
    contactsEnrolled: number;
    contactsSkipped: number;
    errors: string[];
  },
  status: string
): Promise<void> {
  await supabase
    .from("workflow_scheduled_trigger_runs")
    .update({
      completed_at: new Date().toISOString(),
      contacts_matched: stats.contactsMatched,
      contacts_enrolled: stats.contactsEnrolled,
      contacts_skipped: stats.contactsSkipped,
      status,
      error_details: stats.errors.length > 0 ? { errors: stats.errors } : null,
    })
    .eq("id", runId);
}

function calculateNextRunAt(trigger: {
  cadence: string;
  time_of_day: string;
  timezone: string;
  day_of_week?: number | null;
  day_of_month?: number | null;
  cron_expression?: string | null;
}): Date {
  const now = new Date();
  const [hours, minutes] = trigger.time_of_day.split(":").map(Number);

  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);

  switch (trigger.cadence) {
    case "daily": {
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      break;
    }

    case "weekly": {
      const targetDay = trigger.day_of_week ?? 1;
      const currentDay = now.getDay();
      let daysToAdd = targetDay - currentDay;

      if (daysToAdd < 0 || (daysToAdd === 0 && next <= now)) {
        daysToAdd += 7;
      }

      next.setDate(now.getDate() + daysToAdd);
      break;
    }

    case "monthly": {
      const targetDayOfMonth = trigger.day_of_month ?? 1;
      next.setDate(targetDayOfMonth);

      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }

      const lastDayOfMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      if (targetDayOfMonth > lastDayOfMonth) {
        next.setDate(lastDayOfMonth);
      }
      break;
    }

    case "custom_cron": {
      next.setDate(next.getDate() + 1);
      break;
    }

    default:
      next.setDate(next.getDate() + 1);
  }

  return next;
}
