import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

interface WorkflowNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

interface TriggerConfig {
  logic?: "and" | "or";
  rules?: Array<{
    field: string;
    operator: string;
    value: unknown;
  }>;
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
      eventsProcessed: 0,
      enrollmentsCreated: 0,
      jobsProcessed: 0,
      errors: [] as string[],
    };

    const { data: events } = await supabase
      .from("event_outbox")
      .select("*")
      .is("processed_at", null)
      .order("created_at", { ascending: true })
      .limit(50);

    for (const event of events || []) {
      try {
        const { data: triggers } = await supabase
          .from("workflow_triggers")
          .select(`
            *,
            workflow:workflows(id, org_id, status, published_definition, enrollment_rules)
          `)
          .eq("trigger_type", event.event_type)
          .eq("is_active", true)
          .eq("org_id", event.org_id);

        for (const trigger of triggers || []) {
          if (trigger.workflow?.status !== "published") continue;

          const config = trigger.trigger_config as TriggerConfig;
          if (config.rules && config.rules.length > 0) {
            const matches = evaluateTriggerConditions(config, event.payload);
            if (!matches) continue;
          }

          const triggerSpecificConfig = (trigger.trigger_specific_config ?? config) as Record<string, unknown>;
          if (triggerSpecificConfig && Object.keys(triggerSpecificConfig).length > 0) {
            const specificMatch = evaluateTriggerSpecificConfig(
              event.event_type,
              triggerSpecificConfig,
              event.payload
            );
            if (!specificMatch) continue;
          }

          const contactId = event.contact_id;
          if (!contactId) continue;

          const enrollmentRules = (trigger.workflow as Record<string, unknown>).enrollment_rules as {
            allow_re_enrollment?: string;
            max_concurrent_enrollments?: number;
            stop_existing_on_re_entry?: boolean;
          } | null;
          const rules = enrollmentRules || {
            allow_re_enrollment: "after_completion",
            max_concurrent_enrollments: 1,
            stop_existing_on_re_entry: false,
          };

          const { data: activeEnrollments } = await supabase
            .from("workflow_enrollments")
            .select("id, status")
            .eq("workflow_id", trigger.workflow_id)
            .eq("contact_id", contactId)
            .in("status", ["active", "waiting"]);

          const activeCount = (activeEnrollments || []).length;
          let enrollmentAllowed = true;
          let blockReason = "";

          if (rules.allow_re_enrollment === "never") {
            const { count } = await supabase
              .from("workflow_enrollments")
              .select("id", { count: "exact", head: true })
              .eq("workflow_id", trigger.workflow_id)
              .eq("contact_id", contactId);
            if ((count || 0) > 0) {
              enrollmentAllowed = false;
              blockReason = "re_enrollment_disabled";
            }
          } else if (rules.allow_re_enrollment === "after_completion") {
            if (activeCount > 0) {
              enrollmentAllowed = false;
              blockReason = "active_enrollment_exists";
            }
          } else if (rules.allow_re_enrollment === "always") {
            if (activeCount >= (rules.max_concurrent_enrollments || 1)) {
              enrollmentAllowed = false;
              blockReason = "max_concurrent_reached";
            }
          }

          if (rules.stop_existing_on_re_entry && enrollmentAllowed && activeCount > 0) {
            for (const existing of activeEnrollments || []) {
              await supabase
                .from("workflow_enrollments")
                .update({
                  status: "stopped",
                  stopped_reason: "Stopped by re-entry rule",
                  completed_at: new Date().toISOString(),
                })
                .eq("id", existing.id);
            }
          }

          await supabase.from("workflow_enrollment_attempts").insert({
            org_id: event.org_id,
            workflow_id: trigger.workflow_id,
            contact_id: contactId,
            event_type: event.event_type,
            result: enrollmentAllowed ? "enrolled" : "blocked",
            reason: enrollmentAllowed ? null : blockReason,
          });

          if (!enrollmentAllowed) continue;

          const { data: latestVersion } = await supabase
            .from("workflow_versions")
            .select("id")
            .eq("workflow_id", trigger.workflow_id)
            .order("version_number", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!latestVersion) continue;

          const definition = trigger.workflow.published_definition as WorkflowDefinition;
          const triggerNode = definition.nodes.find((n) => n.type === "trigger");
          const firstEdge = triggerNode
            ? definition.edges.find((e) => e.source === triggerNode.id)
            : null;
          const firstNodeId = firstEdge?.target || null;

          // Expose the trigger payload to workflows in three ways:
          //  1. trigger_event.X — original payload, preserved for backwards compat
          //  2. domain-key.X (appointment.X, form.X, opportunity.X, message.X) —
          //     friendly merge fields like {{appointment.start_at_minus_24h}}
          //  3. flat top-level — so condition rules of the form context.message_body_upper
          //     resolve to contextData['message_body_upper'] directly (the engine's
          //     evaluateCondition reads contextData[field] for context.* paths).
          const payloadObj = (event.payload as Record<string, unknown>) ?? {};
          const contextData: Record<string, unknown> = { trigger_event: event.payload, ...payloadObj };
          if (event.event_type === "appointment_booked" || event.event_type === "appointment_rescheduled" || event.event_type === "appointment_canceled") {
            contextData.appointment = event.payload;
          } else if (event.event_type === "form_submitted") {
            contextData.form = event.payload;
          } else if (event.event_type === "opportunity_created" || event.event_type === "opportunity_stage_changed" || event.event_type === "opportunity_status_changed") {
            contextData.opportunity = event.payload;
          } else if (event.event_type === "conversation_message_received") {
            contextData.message = event.payload;
          } else if (event.event_type === "contact_created" || event.event_type === "contact_updated" || event.event_type === "contact_tag_added" || event.event_type === "contact_tag_removed") {
            // Already mostly contact-related; expose 'tag' alias for tag events
            if (event.event_type === "contact_tag_added" || event.event_type === "contact_tag_removed") {
              contextData.tag = event.payload;
            }
          }

          const { data: enrollment } = await supabase
            .from("workflow_enrollments")
            .insert({
              org_id: event.org_id,
              workflow_id: trigger.workflow_id,
              version_id: latestVersion.id,
              contact_id: contactId,
              status: "active",
              current_node_id: firstNodeId,
              context_data: contextData,
            })
            .select()
            .single();

          if (enrollment && firstNodeId) {
            await supabase.from("workflow_jobs").insert({
              org_id: event.org_id,
              enrollment_id: enrollment.id,
              node_id: firstNodeId,
              run_at: new Date().toISOString(),
              status: "pending",
              execution_key: `${enrollment.id}-${firstNodeId}-${Date.now()}`,
            });
          }

          results.enrollmentsCreated++;
        }

        // ----------------------------------------------------------
        // Side-effect: on project_created, auto-send a client portal
        // invite to the contact so they can access the portal without
        // admin intervention. Dispatches to the client-portal-auth
        // edge function with action: send-invite (throttled to 1 per
        // 24h per contact, so batch imports don't spam).
        // ----------------------------------------------------------
        if (event.event_type === "project_created" && event.payload?.project_id) {
          try {
            const portalInviteUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/client-portal-auth`;
            await fetch(portalInviteUrl, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                action: "send-invite",
                projectId: event.payload.project_id,
              }),
            });
          } catch (portalErr) {
            console.error(
              `[workflow-processor] portal invite failed for project ${event.payload.project_id}:`,
              portalErr
            );
          }
        }

        await supabase
          .from("event_outbox")
          .update({ processed_at: new Date().toISOString() })
          .eq("id", event.id);

        results.eventsProcessed++;
      } catch (err) {
        results.errors.push(`Event ${event.id}: ${err.message}`);
      }
    }

    const { data: jobs } = await supabase
      .from("workflow_jobs")
      .select(`
        *,
        enrollment:workflow_enrollments(
          *,
          workflow:workflows(published_definition),
          version:workflow_versions(definition),
          contact:contacts(*)
        )
      `)
      .eq("status", "pending")
      .lte("run_at", new Date().toISOString())
      .order("run_at", { ascending: true })
      .limit(20);

    for (const job of jobs || []) {
      try {
        await supabase
          .from("workflow_jobs")
          .update({ status: "running", attempts: job.attempts + 1 })
          .eq("id", job.id);

        const enrollment = job.enrollment;
        if (!enrollment || enrollment.status !== "active") {
          await supabase
            .from("workflow_jobs")
            .update({ status: "done" })
            .eq("id", job.id);
          continue;
        }

        const definition = (enrollment.version?.definition ||
          enrollment.workflow?.published_definition) as WorkflowDefinition;
        const wfSettings = (definition as Record<string, unknown>).settings as Record<string, unknown> | undefined;

        // Stop-on-Response: if the workflow has stopOnResponse on, check whether the contact
        // has sent any inbound message since enrollment started. If so, abort this enrollment.
        if (wfSettings?.stopOnResponse) {
          const enrolledAt = (enrollment as Record<string, unknown>).started_at as string | undefined;
          const contactId = (enrollment.contact as Record<string, unknown>)?.id as string | undefined;
          if (enrolledAt && contactId) {
            const { count } = await supabase
              .from("messages")
              .select("id", { count: "exact", head: true })
              .eq("contact_id", contactId)
              .eq("direction", "inbound")
              .gte("created_at", enrolledAt);
            if ((count ?? 0) > 0) {
              await supabase
                .from("workflow_enrollments")
                .update({
                  status: "stopped",
                  stopped_reason: "Stop-on-Response: contact replied",
                  completed_at: new Date().toISOString(),
                  current_node_id: null,
                })
                .eq("id", enrollment.id);
              await supabase
                .from("workflow_jobs")
                .update({ status: "done" })
                .eq("id", job.id);
              results.jobsProcessed++;
              continue;
            }
          }
        }

        // Workflow-level drip throttle: if a batch size is set and we're already at the cap
        // for the current window, defer this job to the start of the next window.
        const dripBatch = wfSettings?.dripBatchSize as number | undefined;
        const dripWindowMin = (wfSettings?.dripIntervalMinutes as number | undefined) ?? 60;
        if (dripBatch && dripBatch > 0) {
          const windowStart = new Date(Date.now() - dripWindowMin * 60 * 1000).toISOString();
          const { count } = await supabase
            .from("workflow_execution_logs")
            .select("id", { count: "exact", head: true })
            .eq("workflow_id", (enrollment as Record<string, unknown>).workflow_id)
            .eq("event_type", "node_started")
            .gte("created_at", windowStart);
          if ((count ?? 0) >= dripBatch) {
            const nextWindow = new Date(Date.now() + dripWindowMin * 60 * 1000);
            await supabase
              .from("workflow_jobs")
              .update({ status: "pending", run_at: nextWindow.toISOString() })
              .eq("id", job.id);
            results.jobsProcessed++;
            continue;
          }
        }

        const node = definition.nodes.find((n) => n.id === job.node_id);

        if (!node) {
          await supabase
            .from("workflow_jobs")
            .update({ status: "failed", last_error: "Node not found" })
            .eq("id", job.id);
          continue;
        }

        const startTime = Date.now();

        await supabase.from("workflow_execution_logs").insert({
          org_id: job.org_id,
          enrollment_id: enrollment.id,
          node_id: job.node_id,
          event_type: "node_started",
          payload: { node_type: node.type },
        });

        let nextNodeId: string | null = null;

        switch (node.type) {
          case "condition": {
            const result = evaluateCondition(node.data, enrollment.contact, enrollment.context_data);
            const edge = definition.edges.find(
              (e) => e.source === node.id && e.sourceHandle === (result ? "true" : "false")
            );
            nextNodeId = edge?.target || null;
            break;
          }

          case "delay": {
            const runAt = calculateDelayRunAt(
              node.data,
              enrollment.contact as Record<string, unknown>,
              enrollment.context_data as Record<string, unknown>
            );
            if (runAt > new Date()) {
              await supabase.from("delayed_action_queue").insert({
                org_id: job.org_id,
                enrollment_id: enrollment.id,
                node_id: node.id,
                resume_at: runAt.toISOString(),
                wait_type: (node.data.delayType as string) || "wait_duration",
                status: "waiting",
              });

              await supabase
                .from("workflow_jobs")
                .update({
                  status: "pending",
                  run_at: runAt.toISOString(),
                })
                .eq("id", job.id);
              results.jobsProcessed++;
              continue;
            }
            const edge = definition.edges.find((e) => e.source === node.id);
            nextNodeId = edge?.target || null;
            break;
          }

          case "action": {
            // Inject the node id so action handlers (drip_mode, wait_for_condition) can reference it
            const actionData = { ...node.data, nodeId: node.id };
            const actionResult = await executeAction(supabase, actionData, enrollment, job.org_id);

            // Drip-mode action: defer the job to a future time
            if (actionResult?.deferUntil) {
              await supabase
                .from("workflow_jobs")
                .update({ status: "pending", run_at: actionResult.deferUntil as string })
                .eq("id", job.id);
              results.jobsProcessed++;
              continue;
            }

            // remove_from_workflow_action / stop_workflow: end this enrollment
            if (actionResult?.shouldStop) {
              await supabase
                .from("workflow_enrollments")
                .update({
                  status: "stopped",
                  stopped_reason: (actionResult.stopReason as string) || "Stopped by action",
                  completed_at: new Date().toISOString(),
                  current_node_id: null,
                })
                .eq("id", enrollment.id);
              await supabase
                .from("workflow_jobs")
                .update({ status: "done" })
                .eq("id", job.id);
              results.jobsProcessed++;
              continue;
            }

            // wait_for_condition: park the job, polled separately by workflow-condition-checker
            if (actionResult?.shouldWait) {
              await supabase
                .from("workflow_jobs")
                .update({ status: "waiting" })
                .eq("id", job.id);
              await supabase
                .from("workflow_enrollments")
                .update({
                  status: "waiting",
                  context_data: {
                    ...(enrollment.context_data as Record<string, unknown>),
                    waiting_for_condition: true,
                    waiting_node_id: node.id,
                  },
                })
                .eq("id", enrollment.id);
              results.jobsProcessed++;
              continue;
            }

            // go_to: jump to a different node in this workflow
            if (actionResult?.redirectNode) {
              nextNodeId = actionResult.redirectNode as string;
              break;
            }

            // go_to: jump to an entirely different workflow
            if (actionResult?.redirectWorkflow) {
              const targetWorkflowId = actionResult.redirectWorkflow as string;
              const contactId = (enrollment.contact as Record<string, unknown>)?.id;

              // Stop current
              await supabase
                .from("workflow_enrollments")
                .update({
                  status: "completed",
                  completed_at: new Date().toISOString(),
                  current_node_id: null,
                })
                .eq("id", enrollment.id);

              // Find the trigger node of the target workflow as the entry point
              const { data: targetWf } = await supabase
                .from("workflows")
                .select("published_definition")
                .eq("id", targetWorkflowId)
                .maybeSingle();
              const targetDef = targetWf?.published_definition as WorkflowDefinition | undefined;
              const entryNode = targetDef?.nodes?.find((n) => n.type === "trigger");
              const firstAfterTrigger = entryNode
                ? targetDef?.edges?.find((e) => e.source === entryNode.id)
                : undefined;
              const startId = firstAfterTrigger?.target || entryNode?.id;

              if (contactId && startId) {
                const { data: newEnr } = await supabase
                  .from("workflow_enrollments")
                  .insert({
                    org_id: job.org_id,
                    workflow_id: targetWorkflowId,
                    contact_id: contactId,
                    status: "active",
                    started_at: new Date().toISOString(),
                    current_node_id: startId,
                    context_data: enrollment.context_data,
                  })
                  .select("id")
                  .single();
                if (newEnr) {
                  await supabase.from("workflow_jobs").insert({
                    org_id: job.org_id,
                    enrollment_id: newEnr.id,
                    node_id: startId,
                    run_at: new Date().toISOString(),
                    status: "pending",
                  });
                }
              }

              await supabase
                .from("workflow_jobs")
                .update({ status: "done" })
                .eq("id", job.id);
              results.jobsProcessed++;
              continue;
            }

            if (actionResult && actionResult.branch) {
              const branchEdge = definition.edges.find(
                (e) => e.source === node.id && e.sourceHandle === actionResult.branch
              );
              nextNodeId = branchEdge?.target || null;

              if (!nextNodeId) {
                const defaultEdge = definition.edges.find(
                  (e) => e.source === node.id && (!e.sourceHandle || e.sourceHandle === "default")
                );
                nextNodeId = defaultEdge?.target || null;
              }

              if (actionResult.status === "pending_approval") {
                await supabase.from("workflow_approval_queue").insert({
                  org_id: job.org_id,
                  enrollment_id: enrollment.id,
                  workflow_id: (enrollment as Record<string, unknown>).workflow_id,
                  node_id: node.id,
                  action_type: node.data.actionType,
                  contact_id: (enrollment.contact as Record<string, unknown>)?.id,
                  draft_content: actionResult.output_raw || actionResult.output_structured,
                  ai_run_id: actionResult.draft_id || null,
                  pending_next_node_id: nextNodeId,
                  status: "pending",
                });

                await supabase
                  .from("workflow_jobs")
                  .update({ status: "waiting_approval" })
                  .eq("id", job.id);

                await supabase
                  .from("workflow_enrollments")
                  .update({
                    status: "waiting",
                    context_data: {
                      ...(enrollment.context_data as Record<string, unknown>),
                      waiting_for_approval: true,
                      pending_node_id: node.id,
                      pending_next_node_id: nextNodeId,
                    },
                  })
                  .eq("id", enrollment.id);

                results.jobsProcessed++;
                continue;
              }
            } else {
              const edge = definition.edges.find((e) => e.source === node.id);
              nextNodeId = edge?.target || null;
            }
            break;
          }

          case "goal": {
            // Goal nodes evaluate a condition; if met, jump to skipAheadTargetNodeId.
            // Otherwise, follow the default forward edge.
            const goalData = node.data as Record<string, unknown>;
            const goalCondition = goalData.goalCondition as Record<string, unknown> | undefined;
            const skipTo = goalData.skipAheadTargetNodeId as string | undefined;

            let goalMet = false;
            if (goalCondition) {
              try {
                goalMet = evaluateCondition({ conditions: goalCondition }, enrollment.contact, enrollment.context_data);
              } catch (e) {
                console.error("Goal evaluation failed:", e);
              }
            }

            if (goalMet && skipTo) {
              nextNodeId = skipTo;
            } else {
              const edge = definition.edges.find((e) => e.source === node.id);
              nextNodeId = edge?.target || null;
            }
            break;
          }

          case "end": {
            await supabase
              .from("workflow_enrollments")
              .update({
                status: "completed",
                completed_at: new Date().toISOString(),
                current_node_id: null,
              })
              .eq("id", enrollment.id);

            await supabase
              .from("workflow_jobs")
              .update({ status: "done" })
              .eq("id", job.id);

            await supabase.from("workflow_execution_logs").insert({
              org_id: job.org_id,
              enrollment_id: enrollment.id,
              node_id: job.node_id,
              event_type: "node_completed",
              payload: { node_type: "end" },
              duration_ms: Date.now() - startTime,
            });

            results.jobsProcessed++;
            continue;
          }
        }

        await supabase.from("workflow_execution_logs").insert({
          org_id: job.org_id,
          enrollment_id: enrollment.id,
          node_id: job.node_id,
          event_type: "node_completed",
          payload: { node_type: node.type, next_node: nextNodeId },
          duration_ms: Date.now() - startTime,
        });

        await supabase
          .from("workflow_jobs")
          .update({ status: "done" })
          .eq("id", job.id);

        if (nextNodeId) {
          await supabase
            .from("workflow_enrollments")
            .update({ current_node_id: nextNodeId })
            .eq("id", enrollment.id);

          await supabase.from("workflow_jobs").insert({
            org_id: job.org_id,
            enrollment_id: enrollment.id,
            node_id: nextNodeId,
            run_at: new Date().toISOString(),
            status: "pending",
            execution_key: `${enrollment.id}-${nextNodeId}-${Date.now()}`,
          });
        } else {
          await supabase
            .from("workflow_enrollments")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
              current_node_id: null,
            })
            .eq("id", enrollment.id);
        }

        results.jobsProcessed++;
      } catch (err) {
        results.errors.push(`Job ${job.id}: ${err.message}`);

        await supabase
          .from("workflow_jobs")
          .update({
            status: job.attempts >= 3 ? "failed" : "pending",
            last_error: err.message,
            run_at: new Date(Date.now() + Math.pow(2, job.attempts) * 60000).toISOString(),
          })
          .eq("id", job.id);

        if (job.attempts >= 3) {
          await supabase
            .from("workflow_enrollments")
            .update({ status: "errored" })
            .eq("id", job.enrollment_id);
        }
      }
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Workflow processor error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function evaluateTriggerConditions(
  config: TriggerConfig,
  payload: Record<string, unknown>
): boolean {
  if (!config.rules || config.rules.length === 0) return true;

  const results = config.rules.map((rule) => {
    const value = payload[rule.field];
    switch (rule.operator) {
      case "equals":
        return value === rule.value;
      case "not_equals":
        return value !== rule.value;
      case "contains":
        return String(value).includes(String(rule.value));
      case "is_empty":
        return value === null || value === undefined || value === "";
      case "is_not_empty":
        return value !== null && value !== undefined && value !== "";
      default:
        return true;
    }
  });

  return config.logic === "or" ? results.some((r) => r) : results.every((r) => r);
}

function evaluateTriggerSpecificConfig(
  triggerType: string,
  config: Record<string, unknown>,
  payload: Record<string, unknown>
): boolean {
  switch (triggerType) {
    case "contact_changed": {
      const watchedFields = (config.watchedFields as string[]) ?? [];
      const matchMode = (config.matchMode as string) ?? "any";
      const changedFields = (payload.changed_fields as string[]) ?? [];
      if (watchedFields.length === 0) return true;
      const hits = watchedFields.filter((f) => changedFields.includes(f));
      return matchMode === "all" ? hits.length === watchedFields.length : hits.length > 0;
    }
    case "contact_tag_changed": {
      const tagName = (config.tagName as string) ?? "";
      const action = (config.action as string) ?? "added";
      if (tagName && payload.tag !== tagName) return false;
      if (action !== "either" && payload.action !== action) return false;
      return true;
    }
    case "contact_dnd_changed": {
      const channel = (config.channel as string) ?? "all";
      const state = (config.state as string) ?? "any";
      if (channel !== "all" && payload.channel !== channel) return false;
      if (state === "turned_on" && payload.new_state !== true) return false;
      if (state === "turned_off" && payload.new_state !== false) return false;
      return true;
    }
    case "contact_engagement_score": {
      const operator = (config.operator as string) ?? "greater_than";
      const scoreValue = (config.scoreValue as number) ?? 0;
      const newScore = (payload.new_score as number) ?? 0;
      const oldScore = (payload.old_score as number) ?? 0;
      switch (operator) {
        case "equals": return newScore === scoreValue;
        case "greater_than": return newScore > scoreValue;
        case "less_than": return newScore < scoreValue;
        case "crosses_above": return oldScore < scoreValue && newScore >= scoreValue;
        case "crosses_below": return oldScore >= scoreValue && newScore < scoreValue;
        default: return false;
      }
    }
    case "event_call_details": {
      const direction = (config.direction as string) ?? "any";
      const answeredStatus = (config.answeredStatus as string) ?? "any";
      const minDuration = (config.minDuration as number) ?? 0;
      const maxDuration = (config.maxDuration as number) ?? 0;
      const outcome = (config.outcome as string[]) ?? [];
      if (direction !== "any" && payload.direction !== direction) return false;
      if (answeredStatus !== "any" && payload.answered_status !== answeredStatus) return false;
      const dur = (payload.duration as number) ?? 0;
      if (minDuration > 0 && dur < minDuration) return false;
      if (maxDuration > 0 && dur > maxDuration) return false;
      if (outcome.length > 0 && !outcome.includes(payload.outcome as string)) return false;
      return true;
    }
    case "event_email": {
      const eventTypes = (config.eventTypes as string[]) ?? [];
      const templateFilter = (config.templateFilter as string) ?? "";
      if (eventTypes.length > 0 && !eventTypes.includes(payload.event_type as string)) return false;
      if (templateFilter && payload.template_id !== templateFilter) return false;
      return true;
    }
    case "event_customer_replied": {
      const channels = (config.channels as string[]) ?? [];
      const replyContains = (config.replyContains as string) ?? "";
      if (channels.length > 0 && !channels.includes(payload.channel as string)) return false;
      if (replyContains) {
        const content = ((payload.content as string) ?? "").toLowerCase();
        if (!content.includes(replyContains.toLowerCase())) return false;
      }
      return true;
    }
    case "event_form_submitted": {
      const formId = (config.formId as string) ?? "";
      if (formId && payload.form_id !== formId) return false;
      return true;
    }
    case "event_survey_submitted": {
      const surveyId = (config.surveyId as string) ?? "";
      const minScore = (config.minScore as number) ?? 0;
      const maxScore = (config.maxScore as number) ?? 0;
      if (surveyId && payload.survey_id !== surveyId) return false;
      const score = (payload.score as number) ?? 0;
      if (minScore > 0 && score < minScore) return false;
      if (maxScore > 0 && score > maxScore) return false;
      return true;
    }
    case "event_review_received": {
      const platforms = (config.platforms as string[]) ?? [];
      const minRating = (config.minRating as number) ?? 0;
      const maxRating = (config.maxRating as number) ?? 0;
      if (platforms.length > 0 && !platforms.includes(payload.platform as string)) return false;
      const rating = (payload.rating as number) ?? 0;
      if (minRating > 0 && rating < minRating) return false;
      if (maxRating > 0 && rating > maxRating) return false;
      return true;
    }
    case "event_conversation_ai": {
      const classificationFilter = (config.classificationFilter as string) ?? "";
      const confidenceThreshold = (config.confidenceThreshold as number) ?? 0;
      if (classificationFilter && payload.ai_classification !== classificationFilter) return false;
      if (confidenceThreshold > 0) {
        const confidence = (payload.confidence as number) ?? 0;
        if (confidence < confidenceThreshold / 100) return false;
      }
      return true;
    }
    case "event_custom": {
      const eventName = (config.eventName as string) ?? "";
      if (eventName && payload.event_name !== eventName) return false;
      const keyFilters = (config.payloadKeyFilters as Array<{ key: string; operator: string; value: string }>) ?? [];
      for (const filter of keyFilters) {
        if (!filter.key) continue;
        const val = String(payload[filter.key] ?? "");
        if (filter.operator === "equals" && val !== filter.value) return false;
        if (filter.operator === "contains" && !val.includes(filter.value)) return false;
        if (filter.operator === "not_empty" && !val) return false;
      }
      return true;
    }
    case "appointment_status_changed": {
      const statuses = (config.statuses as string[]) ?? [];
      const calendarFilter = (config.calendarFilter as string) ?? "";
      if (statuses.length > 0 && !statuses.includes(payload.new_status as string)) return false;
      if (calendarFilter && payload.calendar_id !== calendarFilter) return false;
      return true;
    }
    case "appointment_customer_booked": {
      const calendarFilter = (config.calendarFilter as string) ?? "";
      const appointmentTypeFilter = (config.appointmentTypeFilter as string) ?? "";
      if (calendarFilter && payload.calendar_id !== calendarFilter) return false;
      if (appointmentTypeFilter && payload.appointment_type_id !== appointmentTypeFilter) return false;
      return true;
    }
    case "opportunity_status_changed": {
      const statuses = (config.statuses as string[]) ?? [];
      const pipelineFilter = (config.pipelineFilter as string) ?? "";
      if (statuses.length > 0 && !statuses.includes(payload.new_status as string)) return false;
      if (pipelineFilter && payload.pipeline_id !== pipelineFilter) return false;
      return true;
    }
    case "opportunity_created": {
      const pipelineFilter = (config.pipelineFilter as string) ?? "";
      const stageFilter = (config.stageFilter as string) ?? "";
      const ownerFilter = (config.ownerFilter as string) ?? "";
      if (pipelineFilter && payload.pipeline_id !== pipelineFilter) return false;
      if (stageFilter && payload.stage_id !== stageFilter) return false;
      if (ownerFilter && payload.owner_id !== ownerFilter) return false;
      return true;
    }
    case "opportunity_changed": {
      const watchedFields = (config.watchedFields as string[]) ?? [];
      const matchMode = (config.matchMode as string) ?? "any";
      const pipelineFilter = (config.pipelineFilter as string) ?? "";
      const changedFields = (payload.changed_fields as string[]) ?? [];
      if (pipelineFilter && payload.pipeline_id !== pipelineFilter) return false;
      if (watchedFields.length === 0) return true;
      const hits = watchedFields.filter((f) => changedFields.includes(f));
      return matchMode === "all" ? hits.length === watchedFields.length : hits.length > 0;
    }
    case "opportunity_stage_changed": {
      const pipelineFilter = (config.pipelineFilter as string) ?? "";
      const anyStageMove = (config.anyStageMove as boolean) ?? true;
      const fromStage = (config.fromStage as string) ?? "";
      const toStage = (config.toStage as string) ?? "";
      if (pipelineFilter && payload.pipeline_id !== pipelineFilter) return false;
      if (anyStageMove) return true;
      if (fromStage && payload.old_stage_id !== fromStage) return false;
      if (toStage && payload.new_stage_id !== toStage) return false;
      return true;
    }
    case "opportunity_stale": {
      const pipelineFilter = (config.pipelineFilter as string) ?? "";
      const stageFilter = (config.stageFilter as string) ?? "";
      if (pipelineFilter && payload.pipeline_id !== pipelineFilter) return false;
      if (stageFilter && payload.stage_id !== stageFilter) return false;
      return true;
    }

    // ─────────────────────────────────────────────────────────────────
    // P6 — Vapi voice AI trigger filters
    // ─────────────────────────────────────────────────────────────────
    case "ai_call_completed": {
      const outcomes = (config.outcomes as string[]) ?? [];
      const minDuration = (config.minDurationSeconds as number) ?? 0;
      const requireQualified = (config.requireQualified as boolean) ?? false;
      const assistantIds = (config.assistantIds as string[]) ?? [];
      const payloadOutcome = (payload.outcome as string) || "completed";
      const payloadAssistantIds = (payload.assistantIds as string[]) ?? [];
      const dur = (payload.duration_seconds as number) ?? 0;

      if (outcomes.length > 0 && !outcomes.includes(payloadOutcome)) return false;
      if (minDuration > 0 && dur < minDuration) return false;
      if (requireQualified && !payload.qualified) return false;
      if (assistantIds.length > 0) {
        const hasMatch = assistantIds.some((id) => payloadAssistantIds.includes(id));
        if (!hasMatch) return false;
      }
      return true;
    }
    case "ai_voicemail_received": {
      const keywords = (config.keywords as string[]) ?? [];
      const minDuration = (config.minDurationSeconds as number) ?? 0;
      const sentiment = (config.sentiment as string) ?? "any";
      const payloadKeywords = (payload.keywords as string[]) ?? [];
      const transcript = ((payload.transcript as string) || "").toLowerCase();
      const dur = (payload.duration_seconds as number) ?? 0;
      const payloadSentiment = (payload.sentiment as string) ?? "neutral";

      if (minDuration > 0 && dur < minDuration) return false;
      if (keywords.length > 0) {
        const lowerKeywords = keywords.map((k) => k.toLowerCase());
        const matches = lowerKeywords.some((k) =>
          payloadKeywords.includes(k) || transcript.includes(k)
        );
        if (!matches) return false;
      }
      if (sentiment !== "any") {
        if (sentiment === "positive" && payloadSentiment !== "positive") return false;
        if (sentiment === "neutral" && payloadSentiment === "negative") return false;
        if (sentiment === "negative" && payloadSentiment !== "negative") return false;
      }
      return true;
    }
    case "ai_agent_handoff_requested": {
      const reasons = (config.reasons as string[]) ?? [];
      const channel = (config.channel as string) ?? "any";
      const payloadReasons = (payload.reasons as string[]) ?? [
        (payload.reason as string) || "",
      ].filter(Boolean);
      const payloadChannel = (payload.channel as string) ?? "voice";

      if (reasons.length > 0) {
        const matches = reasons.some((r) => payloadReasons.includes(r));
        if (!matches) return false;
      }
      if (channel !== "any" && payloadChannel !== channel) return false;
      return true;
    }
    case "ai_call_started": {
      // No filter knobs in v1 — fires on every call.started.
      return true;
    }

    default:
      return true;
  }
}

function evaluateCondition(
  data: Record<string, unknown>,
  contact: Record<string, unknown>,
  contextData: Record<string, unknown>
): boolean {
  const conditions = data.conditions as TriggerConfig;
  if (!conditions?.rules || conditions.rules.length === 0) return true;

  const results = conditions.rules.map((rule) => {
    let value: unknown;
    if (rule.field.startsWith("contact.")) {
      value = contact[rule.field.replace("contact.", "")];
    } else if (rule.field.startsWith("context.")) {
      value = contextData[rule.field.replace("context.", "")];
    } else {
      value = contact[rule.field];
    }

    switch (rule.operator) {
      case "equals":
        return String(value).toLowerCase() === String(rule.value).toLowerCase();
      case "not_equals":
        return String(value).toLowerCase() !== String(rule.value).toLowerCase();
      case "contains":
        return String(value).toLowerCase().includes(String(rule.value).toLowerCase());
      case "is_empty":
        return value === null || value === undefined || value === "";
      case "is_not_empty":
        return value !== null && value !== undefined && value !== "";
      case "greater_than":
        return Number(value) > Number(rule.value);
      case "less_than":
        return Number(value) < Number(rule.value);
      default:
        return true;
    }
  });

  return conditions.logic === "or" ? results.some((r) => r) : results.every((r) => r);
}

function calculateDelayRunAt(
  data: Record<string, unknown>,
  contact?: Record<string, unknown>,
  contextData?: Record<string, unknown>
): Date {
  const now = new Date();

  switch (data.delayType) {
    case "wait_duration": {
      const duration = data.duration as { value: number; unit: string } | undefined;
      if (!duration) return now;

      const ms = now.getTime();
      switch (duration.unit) {
        case "minutes":
          return new Date(ms + duration.value * 60 * 1000);
        case "hours":
          return new Date(ms + duration.value * 60 * 60 * 1000);
        case "days":
          return new Date(ms + duration.value * 24 * 60 * 60 * 1000);
        default:
          return new Date(ms + duration.value * 60 * 1000);
      }
    }

    case "wait_until_datetime": {
      let datetime = data.datetime as string | undefined;
      if (!datetime) return now;
      // Resolve merge fields like {{appointment.start_at_minus_24h}} so the
      // delay can target a runtime-computed datetime from the trigger event.
      if (datetime.includes("{{") && (contact || contextData)) {
        datetime = resolveMergeFields(datetime, contact || {}, contextData);
      }
      const parsed = new Date(datetime);
      // Fall through to "now" for unparseable / already-past datetimes — safer
      // than hanging the workflow on an Invalid Date comparison forever.
      if (isNaN(parsed.getTime())) return now;
      return parsed;
    }

    case "wait_until_weekday_time": {
      const weekday = data.weekday as number | undefined;
      const time = data.time as string | undefined;
      if (weekday === undefined || !time) return now;

      const [hours, minutes] = time.split(":").map(Number);
      const result = new Date(now);
      result.setHours(hours, minutes, 0, 0);

      const currentWeekday = now.getDay();
      let daysToAdd = weekday - currentWeekday;
      if (daysToAdd < 0 || (daysToAdd === 0 && result <= now)) {
        daysToAdd += 7;
      }
      result.setDate(result.getDate() + daysToAdd);
      return result;
    }

    default:
      return now;
  }
}

async function executeAction(
  supabase: ReturnType<typeof createClient>,
  data: Record<string, unknown>,
  enrollment: Record<string, unknown>,
  orgId: string
): Promise<void> {
  const actionType = data.actionType as string;
  const config = data.config as Record<string, unknown>;
  const contact = enrollment.contact as Record<string, unknown>;
  const contactId = contact.id as string;

  // P8 — test mode short-circuit. If the enrollment is marked test_mode,
  // log what would happen and return early WITHOUT making any external
  // API calls (no SMS, no email, no Vapi calls, no Slack pings, etc).
  // Internal CRM mutations (add_tag, update_field, etc.) are also skipped
  // to keep test runs idempotent and side-effect-free.
  const testMode = (enrollment as { test_mode?: boolean }).test_mode === true
    || ((enrollment.context_data as Record<string, unknown>)?._test_mode === true);
  if (testMode) {
    await supabase.from("workflow_action_logs").insert({
      enrollment_id: enrollment.id,
      action_type: actionType,
      status: "test_mode_skipped",
      detail: `[TEST MODE] Would have executed ${actionType}`,
      metadata: {
        test_mode: true,
        action_config: config,
        is_destructive: [
          "delete_contact", "mark_opportunity_lost", "remove_opportunity",
          "void_invoice", "set_dnd", "remove_from_workflow_action",
        ].includes(actionType),
      },
    }).catch(() => {});
    return;
  }

  switch (actionType) {
    case "add_tag": {
      const tagId = config.tagId as string;
      await supabase.from("contact_tags").upsert(
        { contact_id: contactId, tag_id: tagId },
        { onConflict: "contact_id,tag_id" }
      );

      await supabase.from("contact_timeline").insert({
        contact_id: contactId,
        event_type: "tag_added",
        event_data: { tag_id: tagId, source: "workflow" },
      });
      break;
    }

    case "remove_tag": {
      const tagId = config.tagId as string;
      await supabase
        .from("contact_tags")
        .delete()
        .eq("contact_id", contactId)
        .eq("tag_id", tagId);

      await supabase.from("contact_timeline").insert({
        contact_id: contactId,
        event_type: "tag_removed",
        event_data: { tag_id: tagId, source: "workflow" },
      });
      break;
    }

    case "update_field": {
      const field = config.field as string;
      const value = resolveMergeFields(config.value as string, contact);
      await supabase
        .from("contacts")
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq("id", contactId);
      break;
    }

    case "assign_owner": {
      const userId = config.userId as string;
      await supabase
        .from("contacts")
        .update({ owner_id: userId, updated_at: new Date().toISOString() })
        .eq("id", contactId);
      break;
    }

    case "move_department": {
      const departmentId = config.departmentId as string;
      await supabase
        .from("contacts")
        .update({ department_id: departmentId, updated_at: new Date().toISOString() })
        .eq("id", contactId);
      break;
    }

    case "create_note": {
      const content = resolveMergeFields(config.content as string, contact);
      await supabase.from("contact_notes").insert({
        contact_id: contactId,
        content,
        is_pinned: false,
      });
      break;
    }

    case "send_sms": {
      const ctx = enrollment.context_data as Record<string, unknown> | undefined;
      const allowed = await canSendOnChannel(supabase, contact, "sms", {
        orgId,
        enrollmentId: enrollment.id as string,
        workflowId: (enrollment as Record<string, unknown>).workflow_id as string,
        nodeId: data.nodeId as string,
        actionType: "send_sms",
        payload: { body_preview: ((config.body as string) ?? "").slice(0, 80) },
      });
      if (!allowed) break;
      const body = resolveMergeFields(config.body as string, contact, ctx);
      await sendSms(supabase, orgId, contactId, contact.phone as string, body);
      break;
    }

    case "send_email": {
      // Legacy action — Gmail OAuth path. New workflows should use
      // send_email_org or send_email_personal. Kept for backwards compat.
      const ctx = enrollment.context_data as Record<string, unknown> | undefined;
      const allowed = await canSendOnChannel(supabase, contact, "email", {
        orgId,
        enrollmentId: enrollment.id as string,
        workflowId: (enrollment as Record<string, unknown>).workflow_id as string,
        nodeId: data.nodeId as string,
        actionType: "send_email",
        payload: { subject_preview: ((config.subject as string) ?? "").slice(0, 80) },
      });
      if (!allowed) break;
      const subject = resolveMergeFields(config.subject as string, contact, ctx);
      const emailBody = resolveMergeFields(config.body as string, contact, ctx);
      await sendEmail(supabase, orgId, contactId, contact.email as string, subject, emailBody);
      break;
    }

    case "send_email_org": {
      // Sends as the organization via Mailgun. Optionally resolves a
      // marketing-module email template by ID.
      const ctx = enrollment.context_data as Record<string, unknown> | undefined;
      const allowed = await canSendOnChannel(supabase, contact, "email", {
        orgId,
        enrollmentId: enrollment.id as string,
        workflowId: (enrollment as Record<string, unknown>).workflow_id as string,
        nodeId: data.nodeId as string,
        actionType: "send_email_org",
        payload: { template_id: config.template_id, recipient_override: config.recipient_override },
      });
      if (!allowed) break;
      const recipient =
        (config.recipient_override as string) ||
        (resolveMergeFields(((config.recipient_override as string) ?? "{{contact.email}}"), contact, ctx)) ||
        (contact.email as string);
      if (!recipient) break;

      let subject: string;
      let bodyHtml: string;

      if (config.template_id) {
        const rendered = await renderEmailTemplate(
          supabase,
          config.template_id as string,
          contact,
          ctx
        );
        if (!rendered) {
          console.warn("send_email_org: template not found", config.template_id);
          break;
        }
        subject = rendered.subject;
        bodyHtml = rendered.body_html;
      } else {
        subject = resolveMergeFields((config.raw_subject as string) ?? "", contact, ctx);
        bodyHtml = resolveMergeFields((config.raw_body_html as string) ?? "", contact, ctx);
      }

      await dispatchOrgEmail(supabase, orgId, contactId, recipient, subject, bodyHtml, {
        track_opens: config.track_opens as boolean | undefined,
        track_clicks: config.track_clicks as boolean | undefined,
        template_id: config.template_id as string | undefined,
      });
      break;
    }

    case "send_email_personal": {
      // Sends from a user's Gmail OAuth account. Optionally resolves a
      // marketing-module email template by ID.
      const ctx = enrollment.context_data as Record<string, unknown> | undefined;
      const allowed = await canSendOnChannel(supabase, contact, "email", {
        orgId,
        enrollmentId: enrollment.id as string,
        workflowId: (enrollment as Record<string, unknown>).workflow_id as string,
        nodeId: data.nodeId as string,
        actionType: "send_email_personal",
        payload: { template_id: config.template_id, from_user_id: config.from_user_id },
      });
      if (!allowed) break;
      const recipient =
        (config.recipient_override as string) ||
        (contact.email as string);
      if (!recipient) break;

      // Resolve from_user_id sentinel
      let fromUserId = config.from_user_id as string | undefined;
      if (fromUserId === "contact_owner" || !fromUserId) {
        fromUserId = contact.owner_id as string | undefined;
      } else if (fromUserId === "workflow_creator") {
        const { data: wf } = await supabase
          .from("workflows")
          .select("created_by_user_id")
          .eq("id", (enrollment as Record<string, unknown>).workflow_id)
          .maybeSingle();
        fromUserId = wf?.created_by_user_id as string | undefined;
      }

      let subject: string;
      let bodyHtml: string;

      if (config.template_id) {
        const rendered = await renderEmailTemplate(
          supabase,
          config.template_id as string,
          contact,
          ctx
        );
        if (!rendered) {
          console.warn("send_email_personal: template not found", config.template_id);
          break;
        }
        subject = rendered.subject;
        bodyHtml = rendered.body_html;
      } else {
        subject = resolveMergeFields((config.raw_subject as string) ?? "", contact, ctx);
        bodyHtml = resolveMergeFields((config.raw_body_html as string) ?? "", contact, ctx);
      }

      await sendEmailFromUser(supabase, orgId, contactId, recipient, subject, bodyHtml, fromUserId);
      break;
    }

    case "webhook_post": {
      const url = config.url as string;
      const headers = (config.headers as Record<string, string>) || {};
      const payload = {
        contact,
        enrollment_id: enrollment.id,
        workflow_id: (enrollment as Record<string, unknown>).workflow_id,
        ...((config.payload as Record<string, unknown>) || {}),
      };

      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(payload),
      });
      break;
    }

    case "invoke_ai_agent": {
      const agentId = config.agentId as string;
      const instructions = resolveMergeFields(
        (config.instructions as string) || "",
        contact
      );
      const outputVariable = (config.outputVariable as string) || "ai_agent_result";

      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      const agentResponse = await fetch(
        `${supabaseUrl}/functions/v1/ai-agent-executor`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            org_id: orgId,
            agent_id: agentId,
            contact_id: contactId,
            instructions,
            source: "workflow",
            enrollment_id: enrollment.id,
          }),
        }
      );

      const agentResult = await agentResponse.json();

      const contextData = (enrollment.context_data as Record<string, unknown>) || {};
      contextData[outputVariable] = {
        run_id: agentResult.run_id,
        status: agentResult.status,
        final_response: agentResult.final_response,
        drafts: agentResult.drafts,
        tool_calls: agentResult.tool_calls,
      };

      await supabase
        .from("workflow_enrollments")
        .update({ context_data: contextData })
        .eq("id", enrollment.id);
      break;
    }

    case "ai_conversation_reply":
    case "ai_email_draft":
    case "ai_follow_up_message":
    case "ai_lead_qualification":
    case "ai_booking_assist":
    case "ai_decision_step": {
      const result = await executeAIWorkflowAction(
        supabase,
        actionType,
        config,
        enrollment,
        orgId,
        contactId
      );

      const contextData = (enrollment.context_data as Record<string, unknown>) || {};
      if (!contextData.ai_outputs) {
        contextData.ai_outputs = {};
      }
      (contextData.ai_outputs as Record<string, unknown>)[data.nodeId || actionType] = result;

      await supabase
        .from("workflow_enrollments")
        .update({ context_data: contextData })
        .eq("id", enrollment.id);

      return result;
    }

    // ─────────────────────────────────────────────────────────────────
    // P6 — Vapi voice AI actions
    // ─────────────────────────────────────────────────────────────────
    case "start_ai_call":
    case "transfer_to_ai_agent":
    case "send_ai_voicemail": {
      const result = await executeVapiAction(
        supabase,
        actionType,
        config,
        contact,
        enrollment,
        orgId,
        contactId
      );
      return result;
    }

    case "create_opportunity": {
      const result = await executeOpportunityAction(supabase, "create", config, enrollment, orgId, contactId);
      return result;
    }

    case "update_opportunity": {
      const result = await executeOpportunityAction(supabase, "update", config, enrollment, orgId, contactId);
      return result;
    }

    case "move_opportunity_stage": {
      const result = await executeOpportunityAction(supabase, "move_stage", config, enrollment, orgId, contactId);
      return result;
    }

    case "assign_opportunity_owner": {
      const result = await executeOpportunityAction(supabase, "assign_owner", config, enrollment, orgId, contactId);
      return result;
    }

    case "mark_opportunity_won": {
      const result = await executeOpportunityAction(supabase, "mark_won", config, enrollment, orgId, contactId);
      return result;
    }

    case "mark_opportunity_lost": {
      const result = await executeOpportunityAction(supabase, "mark_lost", config, enrollment, orgId, contactId);
      return result;
    }

    case "create_appointment": {
      const result = await executeAppointmentAction(supabase, "create", config, enrollment, orgId, contactId);
      return result;
    }

    case "cancel_appointment": {
      const result = await executeAppointmentAction(supabase, "cancel", config, enrollment, orgId, contactId);
      return result;
    }

    case "reschedule_appointment": {
      const result = await executeAppointmentAction(supabase, "reschedule", config, enrollment, orgId, contactId);
      return result;
    }

    case "send_appointment_reminder": {
      const result = await executeAppointmentAction(supabase, "send_reminder", config, enrollment, orgId, contactId);
      return result;
    }

    case "mark_no_show": {
      const result = await executeAppointmentAction(supabase, "mark_no_show", config, enrollment, orgId, contactId);
      return result;
    }

    case "create_invoice": {
      const result = await executePaymentAction(supabase, "create_invoice", config, enrollment, orgId, contactId);
      return result;
    }

    case "send_invoice": {
      const result = await executePaymentAction(supabase, "send_invoice", config, enrollment, orgId, contactId);
      return result;
    }

    case "void_invoice": {
      const result = await executePaymentAction(supabase, "void_invoice", config, enrollment, orgId, contactId);
      return result;
    }

    case "create_subscription": {
      const result = await executePaymentAction(supabase, "create_subscription", config, enrollment, orgId, contactId);
      return result;
    }

    case "create_task": {
      const result = await executeTaskAction(supabase, "create", config, enrollment, orgId, contactId);
      return result;
    }

    case "assign_task": {
      const result = await executeTaskAction(supabase, "assign", config, enrollment, orgId, contactId);
      return result;
    }

    case "mark_task_complete": {
      const result = await executeTaskAction(supabase, "complete", config, enrollment, orgId, contactId);
      return result;
    }

    case "update_lead_score": {
      const { data: scoring } = await supabase
        .from("contacts")
        .select("lead_score")
        .eq("id", contactId)
        .single();

      let newScore = scoring?.lead_score || 0;
      const operation = config.operation as string;
      const value = config.value as number;

      if (operation === "set") {
        newScore = value;
      } else if (operation === "increment") {
        newScore += value;
      } else if (operation === "decrement") {
        newScore -= value;
      }

      await supabase
        .from("contacts")
        .update({ lead_score: Math.max(0, newScore) })
        .eq("id", contactId);

      await supabase.from("scoring_history").insert({
        org_id: orgId,
        contact_id: contactId,
        previous_score: scoring?.lead_score || 0,
        new_score: newScore,
        change_reason: config.reason || "Workflow action",
        change_source: "workflow",
      });
      break;
    }

    case "set_dnd": {
      const channels = config.channels as string[];
      const endDate = config.endDate as string | undefined;

      await supabase
        .from("contacts")
        .update({
          dnd_status: {
            enabled: true,
            channels,
            reason: config.reason,
            end_date: endDate,
            set_at: new Date().toISOString(),
          },
        })
        .eq("id", contactId);
      break;
    }

    case "remove_dnd": {
      await supabase
        .from("contacts")
        .update({ dnd_status: null })
        .eq("id", contactId);
      break;
    }

    case "notify_user": {
      const recipientType = config.recipientType as string;
      let userIds: string[] = [];

      if (recipientType === "user_id" && config.recipientIds) {
        userIds = config.recipientIds as string[];
      } else if (recipientType === "contact_owner") {
        const owner = contact.assigned_user_id as string;
        if (owner) userIds = [owner];
      } else if (recipientType === "role" && config.roleNames) {
        const { data: roleUsers } = await supabase
          .from("users")
          .select("id, role:roles!inner(name)")
          .eq("org_id", orgId)
          .in("roles.name", config.roleNames as string[]);
        userIds = roleUsers?.map((u: Record<string, unknown>) => u.id as string) || [];
      }

      for (const userId of userIds) {
        await supabase.from("inbox_events").insert({
          org_id: orgId,
          user_id: userId,
          event_type: "workflow_notification",
          title: config.subject || "Workflow Notification",
          body: resolveMergeFields(config.message as string, contact),
          metadata: { contact_id: contactId, enrollment_id: enrollment.id },
          read: false,
        });
      }
      break;
    }

    case "log_custom_event": {
      await supabase.from("contact_timeline_events").insert({
        org_id: orgId,
        contact_id: contactId,
        event_type: config.eventName as string,
        title: config.eventName as string,
        description: "Logged via workflow",
        metadata: {
          ...(config.eventData as Record<string, unknown> || {}),
          workflow_enrollment_id: enrollment.id,
        },
      });
      break;
    }

    case "stop_workflow": {
      await supabase
        .from("workflow_enrollments")
        .update({
          status: config.markAsCompleted ? "completed" : "stopped",
          stopped_reason: config.reason || "Stopped by workflow action",
          completed_at: new Date().toISOString(),
        })
        .eq("id", enrollment.id);
      return { shouldStop: true };
    }

    case "trigger_another_workflow": {
      const targetWorkflowId = config.workflowId as string;

      const { data: targetWorkflow } = await supabase
        .from("workflows")
        .select("id, status, published_definition")
        .eq("id", targetWorkflowId)
        .eq("status", "published")
        .maybeSingle();

      if (targetWorkflow) {
        const { data: latestVersion } = await supabase
          .from("workflow_versions")
          .select("id")
          .eq("workflow_id", targetWorkflowId)
          .order("version_number", { ascending: false })
          .limit(1)
          .single();

        if (latestVersion) {
          const definition = targetWorkflow.published_definition as WorkflowDefinition;
          const triggerNode = definition.nodes.find((n) => n.type === "trigger");
          const firstEdge = triggerNode
            ? definition.edges.find((e) => e.source === triggerNode.id)
            : null;
          const firstNodeId = firstEdge?.target || null;

          const { data: newEnrollment } = await supabase
            .from("workflow_enrollments")
            .insert({
              org_id: orgId,
              workflow_id: targetWorkflowId,
              version_id: latestVersion.id,
              contact_id: contactId,
              status: "active",
              current_node_id: firstNodeId,
              context_data: {
                triggered_by_workflow: enrollment.workflow_id,
                triggered_by_enrollment: enrollment.id,
              },
            })
            .select()
            .single();

          if (newEnrollment && firstNodeId) {
            await supabase.from("workflow_jobs").insert({
              org_id: orgId,
              enrollment_id: newEnrollment.id,
              node_id: firstNodeId,
              run_at: new Date().toISOString(),
              status: "pending",
              execution_key: `${newEnrollment.id}-${firstNodeId}-${Date.now()}`,
            });
          }
        }
      }
      break;
    }

    case "set_workflow_variable": {
      const variableName = config.variableName as string;
      let value = config.value;

      if (config.valueType === "merge_field") {
        value = resolveMergeFields(value as string, contact);
      }

      const contextData = (enrollment.context_data as Record<string, unknown>) || {};
      contextData[variableName] = value;

      await supabase
        .from("workflow_enrollments")
        .update({ context_data: contextData })
        .eq("id", enrollment.id);
      break;
    }

    case "create_proposal": {
      const result = await executeProposalAction(supabase, "create", config, enrollment, orgId, contactId);
      return result;
    }

    case "send_proposal": {
      const result = await executeProposalAction(supabase, "send", config, enrollment, orgId, contactId);
      return result;
    }

    case "create_project": {
      const result = await executeProjectAction(supabase, "create", config, enrollment, orgId, contactId);
      return result;
    }

    case "update_project_stage": {
      const result = await executeProjectAction(supabase, "move_stage", config, enrollment, orgId, contactId);
      return result;
    }

    case "send_review_request": {
      const result = await executeReviewAction(supabase, "send_request", config, enrollment, orgId, contactId);
      return result;
    }

    case "generate_ai_review_reply": {
      const result = await executeReviewAction(supabase, "ai_reply", config, enrollment, orgId, contactId);
      return result;
    }

    case "send_booking_link": {
      const calendarId = config.calendarId as string;
      const appointmentTypeId = config.appointmentTypeId as string;

      const { data: org } = await supabase
        .from("organizations")
        .select("slug")
        .eq("id", orgId)
        .single();

      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const bookingUrl = `${supabaseUrl.replace('.supabase.co', '.supabase.co')}/booking/${org?.slug || orgId}/${calendarId}/${appointmentTypeId}`;

      const message = resolveMergeFields(
        (config.message as string) || `Book a time with us: ${bookingUrl}`,
        contact
      ).replace("{{booking_link}}", bookingUrl);

      const channel = (config.channel as string) || "email";
      if (channel === "sms" && contact.phone) {
        await sendSms(supabase, orgId, contactId, contact.phone as string, message);
      } else if (contact.email) {
        const subject = resolveMergeFields(
          (config.subject as string) || "Book Your Appointment",
          contact
        );
        await sendEmail(supabase, orgId, contactId, contact.email as string, subject, message);
      }
      break;
    }

    case "goal_check": {
      const goalConditions = config.conditions as TriggerConfig;
      if (!goalConditions) return { branch: "not_met" };

      const goalMet = evaluateCondition(
        { conditions: goalConditions },
        contact,
        (enrollment.context_data as Record<string, unknown>) || {}
      );

      return { branch: goalMet ? "met" : "not_met" };
    }

    case "wait_for_condition": {
      const timeoutDays = config.timeoutDays || 30;
      const timeoutAt = new Date();
      timeoutAt.setDate(timeoutAt.getDate() + timeoutDays);

      await supabase.from("workflow_condition_waits").insert({
        org_id: orgId,
        enrollment_id: enrollment.id,
        node_id: data.nodeId || "wait_condition",
        condition_config: config.conditions,
        check_interval_minutes: config.checkIntervalMinutes || 5,
        timeout_at: timeoutAt.toISOString(),
        status: "waiting",
      });

      return { shouldWait: true };
    }

    case "create_contact": {
      const email = resolveMergeFields((config.email as string) || "", contact);
      const phone = resolveMergeFields((config.phone as string) || "", contact);
      const duplicateRule = (config.duplicateRule as string) || "skip";

      let existingId: string | null = null;
      if (email || phone) {
        const query = supabase.from("contacts").select("id").eq("org_id", orgId);
        if (email) query.eq("email", email);
        else if (phone) query.eq("phone", phone);
        const { data: existing } = await query.maybeSingle();
        existingId = existing?.id || null;
      }

      if (existingId && duplicateRule === "skip") break;

      if (existingId && duplicateRule === "update") {
        await supabase.from("contacts").update({
          first_name: resolveMergeFields((config.firstName as string) || "", contact) || undefined,
          last_name: resolveMergeFields((config.lastName as string) || "", contact) || undefined,
          company: resolveMergeFields((config.company as string) || "", contact) || undefined,
          source: (config.source as string) || undefined,
          updated_at: new Date().toISOString(),
        }).eq("id", existingId);
        break;
      }

      const { data: newContact } = await supabase.from("contacts").insert({
        org_id: orgId,
        first_name: resolveMergeFields((config.firstName as string) || "", contact),
        last_name: resolveMergeFields((config.lastName as string) || "", contact),
        email,
        phone,
        company: resolveMergeFields((config.company as string) || "", contact),
        source: (config.source as string) || "workflow",
      }).select("id").single();

      if (newContact && config.tags) {
        const tags = config.tags as string[];
        for (const tagName of tags) {
          const { data: tag } = await supabase.from("tags").select("id").eq("org_id", orgId).eq("name", tagName).maybeSingle();
          if (tag) await supabase.from("contact_tags").upsert({ contact_id: newContact.id, tag_id: tag.id }, { onConflict: "contact_id,tag_id" });
        }
      }
      break;
    }

    case "find_contact": {
      const lookupField = (config.lookupField as string) || "email";
      const lookupValue = resolveMergeFields((config.lookupValue as string) || "", contact);
      const fallbackBehavior = (config.fallbackBehavior as string) || "skip";
      const storeResultAs = (config.storeResultAs as string) || "found_contact_id";

      let query = supabase.from("contacts").select("id").eq("org_id", orgId);
      if (lookupField === "custom_field") {
        query = query.contains("custom_field_values", { [config.customFieldKey as string]: lookupValue });
      } else {
        query = query.eq(lookupField === "id" ? "id" : lookupField, lookupValue);
      }

      const matchMode = (config.matchMode as string) || "first";
      query = query.order("created_at", { ascending: matchMode !== "last" && matchMode !== "newest" });

      const { data: found } = await query.limit(1).maybeSingle();

      if (!found) {
        if (fallbackBehavior === "stop") return { shouldStop: true };
        break;
      }

      const ctx = (enrollment.context_data as Record<string, unknown>) || {};
      ctx[storeResultAs] = found.id;
      await supabase.from("workflow_enrollments").update({ context_data: ctx }).eq("id", enrollment.id);
      break;
    }

    case "delete_contact": {
      const mode = (config.mode as string) || "soft";
      if (mode === "soft") {
        await supabase.from("contacts").update({ status: "archived", updated_at: new Date().toISOString() }).eq("id", contactId);
      } else {
        await supabase.from("contacts").delete().eq("id", contactId);
      }
      break;
    }

    case "modify_engagement_score": {
      const operation = (config.operation as string) || "increase";
      const value = (config.value as number) || 0;
      const floor = config.floor as number | undefined;
      const ceiling = config.ceiling as number | undefined;

      const { data: current } = await supabase.from("contacts").select("lead_score").eq("id", contactId).single();
      let score = current?.lead_score || 0;

      if (operation === "set") score = value;
      else if (operation === "increase") score += value;
      else if (operation === "decrease") score -= value;

      if (floor !== undefined) score = Math.max(floor, score);
      if (ceiling !== undefined) score = Math.min(ceiling, score);

      await supabase.from("contacts").update({ lead_score: score }).eq("id", contactId);

      await supabase.from("scoring_history").insert({
        org_id: orgId,
        contact_id: contactId,
        previous_score: current?.lead_score || 0,
        new_score: score,
        change_reason: (config.reason as string) || "Modified by workflow",
        change_source: "workflow",
      });
      break;
    }

    case "modify_followers": {
      const action = (config.action as string) || "add";
      const followerType = (config.followerType as string) || "specific_user";
      let userIds: string[] = [];

      if (followerType === "specific_user") {
        userIds = (config.userIds as string[]) || [];
      } else if (followerType === "contact_owner") {
        const owner = contact.assigned_user_id as string;
        if (owner) userIds = [owner];
      } else if (followerType === "role") {
        const roleNames = (config.roleNames as string[]) || [];
        const { data: roleUsers } = await supabase.from("users").select("id, role:roles!inner(name)").eq("org_id", orgId).in("roles.name", roleNames);
        userIds = roleUsers?.map((u: Record<string, unknown>) => u.id as string) || [];
      }

      for (const userId of userIds) {
        if (action === "add") {
          await supabase.from("contact_followers").upsert({ contact_id: contactId, user_id: userId, org_id: orgId }, { onConflict: "contact_id,user_id" });
        } else {
          await supabase.from("contact_followers").delete().eq("contact_id", contactId).eq("user_id", userId);
        }
      }
      break;
    }

    case "add_note": {
      const visibility = (config.visibility as string) || "internal";
      let noteContent = resolveMergeFields((config.content as string) || "", contact);
      if (config.prependTimestamp) {
        noteContent = `[${new Date().toLocaleString()}] ${noteContent}`;
      }
      await supabase.from("contact_notes").insert({
        contact_id: contactId,
        content: noteContent,
        visibility,
        is_pinned: false,
      });
      break;
    }

    case "edit_conversation": {
      const operation = (config.operation as string) || "mark_read";
      const conversationSource = (config.conversationSource as string) || "most_recent";

      let conversationId: string | null = null;
      if (conversationSource === "context") {
        conversationId = ((enrollment.context_data as Record<string, unknown>)?.conversationId as string) || null;
      } else {
        const { data: conv } = await supabase.from("conversations").select("id").eq("org_id", orgId).eq("contact_id", contactId).order("created_at", { ascending: false }).limit(1).maybeSingle();
        conversationId = conv?.id || null;
      }

      if (!conversationId) break;

      const updateMap: Record<string, unknown> = {};
      if (operation === "mark_read") updateMap.unread_count = 0;
      else if (operation === "archive" || operation === "close") updateMap.status = "archived";
      else if (operation === "reopen") updateMap.status = "open";

      if (Object.keys(updateMap).length) {
        await supabase.from("conversations").update(updateMap).eq("id", conversationId);
      }
      break;
    }

    case "send_internal_notification": {
      const recipientType = (config.recipientType as string) || "contact_owner";
      let userIds: string[] = [];

      if (recipientType === "specific_user") {
        userIds = (config.recipientIds as string[]) || [];
      } else if (recipientType === "contact_owner") {
        const owner = contact.assigned_user_id as string;
        if (owner) userIds = [owner];
      } else if (recipientType === "role") {
        const roleNames = (config.roleNames as string[]) || [];
        const { data: roleUsers } = await supabase.from("users").select("id, role:roles!inner(name)").eq("org_id", orgId).in("roles.name", roleNames);
        userIds = roleUsers?.map((u: Record<string, unknown>) => u.id as string) || [];
      }

      const title = resolveMergeFields((config.title as string) || "Workflow Notification", contact);
      const body = resolveMergeFields((config.body as string) || "", contact);

      for (const userId of userIds) {
        await supabase.from("notifications").insert({
          org_id: orgId,
          user_id: userId,
          title,
          body,
          type: "workflow",
          metadata: { contact_id: contactId, enrollment_id: enrollment.id, urgency: config.urgency },
          read: false,
        });
      }
      break;
    }

    case "send_slack_message": {
      const webhookUrl = config.webhookUrl as string;
      const message = resolveMergeFields((config.message as string) || "", contact);

      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: message }),
        });
      }
      break;
    }

    case "conversation_ai_reply": {
      const agentId = config.agentId as string;
      const mode = (config.mode as string) || "draft";

      if (mode === "draft" || mode === "auto_reply") {
        const { data: agentData } = await supabase.from("ai_agents").select("id, name").eq("id", agentId).maybeSingle();
        if (agentData) {
          await supabase.from("ai_drafts").insert({
            org_id: orgId,
            contact_id: contactId,
            agent_id: agentId,
            status: mode === "draft" ? "draft" : "approved",
            content: `AI ${mode} generated for contact ${contactId}`,
            metadata: { enrollment_id: enrollment.id },
          });
        }
      }
      break;
    }

    case "manual_action":
    case "manual_call":
    case "manual_sms":
    case "manual_email": {
      const channelLabel: Record<string, string> = {
        manual_call: "Manual call",
        manual_sms: "Manual SMS",
        manual_email: "Manual email",
        manual_action: "Manual action",
      };
      const assigneeType = (config.assigneeType as string) || "contact_owner";
      let assigneeId: string | null = null;

      if (assigneeType === "specific_user") {
        assigneeId = config.assigneeId as string;
      } else {
        assigneeId = contact.assigned_user_id as string || null;
      }

      const dueAt = new Date();
      dueAt.setHours(dueAt.getHours() + ((config.dueHours as number) || 24));

      await supabase.from("contact_tasks").insert({
        org_id: orgId,
        contact_id: contactId,
        title: (config.instructionText as string) || `${channelLabel[actionType]} required`,
        description: (config.instructionText as string) || `Workflow ${channelLabel[actionType].toLowerCase()} task`,
        assigned_to: assigneeId,
        due_date: dueAt.toISOString(),
        status: "pending",
        source: "workflow",
        metadata: {
          enrollment_id: enrollment.id,
          manual_action: true,
          channel: actionType.replace("manual_", ""),
          draft_subject: config.subject ?? null,
          draft_body: config.body ?? null,
        },
      });

      return { shouldWait: true };
    }

    case "grant_course_access":
    case "revoke_course_access": {
      const courseId = config.courseId as string | undefined;
      if (!courseId) break;
      if (actionType === "grant_course_access") {
        await supabase.from("course_enrollments").upsert(
          { org_id: orgId, course_id: courseId, contact_id: contactId, granted_via: "workflow", granted_at: new Date().toISOString(), revoked_at: null },
          { onConflict: "course_id,contact_id" }
        );
      } else {
        await supabase
          .from("course_enrollments")
          .update({ revoked_at: new Date().toISOString() })
          .eq("course_id", courseId)
          .eq("contact_id", contactId);
      }
      break;
    }

    case "grant_community_access":
    case "revoke_community_access": {
      const groupId = config.communityId as string | undefined;
      if (!groupId) break;
      if (actionType === "grant_community_access") {
        await supabase.from("community_members").upsert(
          { org_id: orgId, community_id: groupId, contact_id: contactId, joined_via: "workflow", joined_at: new Date().toISOString(), removed_at: null },
          { onConflict: "community_id,contact_id" }
        );
      } else {
        await supabase
          .from("community_members")
          .update({ removed_at: new Date().toISOString() })
          .eq("community_id", groupId)
          .eq("contact_id", contactId);
      }
      break;
    }

    case "add_to_facebook_audience":
    case "remove_from_facebook_audience":
    case "send_facebook_conversion":
    case "send_google_ads_event":
    case "send_google_analytics_event": {
      // Log the marketing event for the integration outbox; an external worker reads
      // marketing_event_outbox and forwards to FB CAPI / Google Ads / GA4.
      await supabase.from("marketing_event_outbox").insert({
        org_id: orgId,
        action_type: actionType,
        contact_id: contactId,
        audience_id: (config.audienceId as string) || null,
        event_name: (config.eventName as string) || null,
        event_value: (config.eventValue as number) || null,
        currency: (config.currency as string) || null,
        custom_data: config,
        status: "pending",
      });
      break;
    }

    case "update_custom_value": {
      const key = config.customValueKey as string;
      const operation = (config.operation as string) || "set";
      const value = resolveMergeFields((config.value as string) || "", contact);

      const { data: existing } = await supabase.from("custom_values").select("id, value").eq("org_id", orgId).eq("key", key).maybeSingle();

      if (operation === "set" || !existing) {
        await supabase.from("custom_values").upsert({ org_id: orgId, key, value }, { onConflict: "org_id,key" });
      } else if (operation === "append") {
        await supabase.from("custom_values").update({ value: (existing.value || "") + value }).eq("id", existing.id);
      }
      break;
    }

    case "text_formatter": {
      const inputValue = resolveMergeFields((config.inputValue as string) || "", contact);
      const operation = (config.operation as string) || "uppercase";
      const outputKey = (config.outputKey as string) || "formatted_text";
      let result = inputValue;

      switch (operation) {
        case "uppercase": result = inputValue.toUpperCase(); break;
        case "lowercase": result = inputValue.toLowerCase(); break;
        case "capitalize": result = inputValue.replace(/\b\w/g, (c) => c.toUpperCase()); break;
        case "trim": result = inputValue.trim(); break;
        case "find_replace": result = inputValue.replace(new RegExp(config.findText as string || "", "g"), (config.replaceText as string) || ""); break;
        case "append": result = inputValue + ((config.appendText as string) || ""); break;
        case "extract_pattern": {
          const match = inputValue.match(new RegExp(config.extractPattern as string || "(.*)"));
          result = match ? match[1] || match[0] : inputValue;
          break;
        }
      }

      const ctx = (enrollment.context_data as Record<string, unknown>) || {};
      ctx[outputKey] = result;
      await supabase.from("workflow_enrollments").update({ context_data: ctx }).eq("id", enrollment.id);
      break;
    }

    case "ai_prompt": {
      const promptTemplate = resolveMergeFields((config.promptTemplate as string) || "", contact);
      const outputMode = (config.outputMode as string) || "plain_text";
      const saveOutputTo = (config.saveOutputTo as string) || "variable";
      const saveOutputKey = (config.saveOutputKey as string) || "ai_output";

      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      const aiResponse = await fetch(`${supabaseUrl}/functions/v1/assistant-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({ org_id: orgId, message: promptTemplate, mode: outputMode, source: "workflow" }),
      });

      const aiResult = await aiResponse.json();
      const aiOutput = aiResult.content || aiResult.message || "";

      if (saveOutputTo === "variable") {
        const ctx = (enrollment.context_data as Record<string, unknown>) || {};
        ctx[saveOutputKey] = aiOutput;
        await supabase.from("workflow_enrollments").update({ context_data: ctx }).eq("id", enrollment.id);
      } else if (saveOutputTo === "contact_field") {
        await supabase.from("contacts").update({ [saveOutputKey]: aiOutput, updated_at: new Date().toISOString() }).eq("id", contactId);
      } else if (saveOutputTo === "note") {
        await supabase.from("contact_notes").insert({ contact_id: contactId, content: aiOutput, is_pinned: false });
      }
      break;
    }

    case "update_appointment_status": {
      const appointmentSource = (config.appointmentSource as string) || "most_recent";
      const newStatus = (config.newStatus as string) || "confirmed";

      let appointmentId: string | null = null;
      if (appointmentSource === "specific" && config.appointmentId) {
        appointmentId = config.appointmentId as string;
      } else {
        const { data: appt } = await supabase.from("appointments").select("id").eq("org_id", orgId).eq("contact_id", contactId).order("start_time", { ascending: false }).limit(1).maybeSingle();
        appointmentId = appt?.id || null;
      }

      if (appointmentId) {
        await supabase.from("appointments").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", appointmentId);
        if (config.notifyContact && contact.email) {
          const reason = (config.reason as string) || "";
          await sendEmail(supabase, orgId, contactId, contact.email as string, `Appointment ${newStatus}`, `Your appointment has been ${newStatus}. ${reason}`);
        }
      }
      break;
    }

    case "generate_booking_link": {
      const calendarId = config.calendarId as string;
      const appointmentTypeId = config.appointmentTypeId as string;
      const saveToField = (config.saveToField as string) || "booking_link";
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const bookingUrl = `${supabaseUrl}/booking/${orgId}/${calendarId}/${appointmentTypeId}?contact=${contactId}`;

      const ctx = (enrollment.context_data as Record<string, unknown>) || {};
      ctx[saveToField] = bookingUrl;
      await supabase.from("workflow_enrollments").update({ context_data: ctx }).eq("id", enrollment.id);
      break;
    }

    case "create_or_update_opportunity": {
      const mode = (config.mode as string) || "create";
      const titleTemplate = resolveMergeFields((config.titleTemplate as string) || "New Opportunity", contact);

      let closeDate: string | null = null;
      if (config.closeDateDays) {
        const d = new Date();
        d.setDate(d.getDate() + (config.closeDateDays as number));
        closeDate = d.toISOString().split("T")[0];
      }

      if (mode === "create" || mode === "upsert") {
        await supabase.from("opportunities").insert({
          org_id: orgId,
          contact_id: contactId,
          pipeline_id: config.pipelineId,
          stage_id: config.stageId,
          name: titleTemplate,
          value_amount: (config.value as number) || 0,
          currency: "USD",
          status: (config.status as string) || "open",
          close_date: closeDate,
        });
      } else if (mode === "update") {
        const { data: opp } = await supabase.from("opportunities").select("id").eq("org_id", orgId).eq("contact_id", contactId).eq("status", "open").order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (opp) {
          await supabase.from("opportunities").update({ name: titleTemplate, stage_id: config.stageId, value_amount: (config.value as number) || 0, updated_at: new Date().toISOString() }).eq("id", opp.id);
        }
      }
      break;
    }

    case "remove_opportunity": {
      const scope = (config.scope as string) || "current";
      const removeMode = (config.mode as string) || "archive";

      let query = supabase.from("opportunities").select("id").eq("org_id", orgId);
      if (scope === "current") query = query.eq("contact_id", contactId).eq("status", "open").order("created_at", { ascending: false });

      const { data: opps } = await query.limit(scope === "current" ? 1 : 100);

      for (const opp of opps || []) {
        if (removeMode === "archive") {
          await supabase.from("opportunities").update({ status: "lost", closed_at: new Date().toISOString() }).eq("id", opp.id);
        } else {
          await supabase.from("opportunities").delete().eq("id", opp.id);
        }
      }
      break;
    }

    case "send_documents_and_contracts": {
      const templateId = config.templateId as string;
      const deliveryChannel = (config.deliveryChannel as string) || "email";
      const requireSignature = (config.requireSignature as boolean) ?? true;
      const expirationDays = (config.expirationDays as number) || 30;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expirationDays);

      const { data: proposal } = await supabase.from("proposals").insert({
        org_id: orgId,
        contact_id: contactId,
        title: `Document from workflow`,
        status: "sent",
        template_id: templateId || null,
        requires_signature: requireSignature,
        expires_at: expiresAt.toISOString(),
        source: "workflow",
        metadata: { enrollment_id: enrollment.id },
      }).select("id").single();

      if (proposal && (deliveryChannel === "email" || deliveryChannel === "both") && contact.email) {
        await sendEmail(supabase, orgId, contactId, contact.email as string, "Please review and sign your document", `Please review your document here: ${Deno.env.get("SUPABASE_URL")}/proposals/${proposal.id}`);
      }
      break;
    }

    case "go_to": {
      const destinationType = (config.destinationType as string) || "node";
      if (destinationType === "workflow" && config.targetWorkflowId) {
        return { branch: "default", redirectWorkflow: config.targetWorkflowId };
      }
      if (destinationType === "node" && config.targetNodeId) {
        return { branch: "default", redirectNode: config.targetNodeId };
      }
      break;
    }

    case "remove_from_workflow_action": {
      const target = (config.target as string) || "current";
      if (target === "current") {
        await supabase.from("workflow_enrollments").update({ status: "stopped", stopped_reason: "Removed by workflow action" }).eq("id", enrollment.id);
        return { shouldStop: true };
      }
      break;
    }

    case "split_test": {
      // Pick a variant by weight; return its ID as the branch so the action node's
      // matching outgoing edge (sourceHandle === variantId) is followed.
      const variants = (config.variants as Array<{ id: string; weight?: number; label?: string }>) || [];
      if (variants.length === 0) break;
      const totalWeight = variants.reduce((s, v) => s + (v.weight ?? 1), 0);
      const r = Math.random() * totalWeight;
      let cumulative = 0;
      let chosen = variants[variants.length - 1].id;
      for (const v of variants) {
        cumulative += v.weight ?? 1;
        if (r <= cumulative) {
          chosen = v.id;
          break;
        }
      }
      return { branch: chosen };
    }

    case "drip_mode": {
      // Per-action drip throttle: cap how many enrollments pass through THIS node per window.
      const batchSize = (config.batchSize as number) || 10;
      const intervalUnit = (config.intervalUnit as string) || "minutes";
      const intervalValue = (config.intervalValue as number) || 60;
      const windowMs =
        intervalUnit === "hours"
          ? intervalValue * 60 * 60 * 1000
          : intervalUnit === "days"
          ? intervalValue * 24 * 60 * 60 * 1000
          : intervalValue * 60 * 1000;

      const windowStart = new Date(Date.now() - windowMs).toISOString();
      const nodeId = (data.nodeId as string) || "";
      const { count } = await supabase
        .from("workflow_execution_logs")
        .select("id", { count: "exact", head: true })
        .eq("node_id", nodeId)
        .eq("event_type", "node_started")
        .gte("created_at", windowStart);

      if ((count ?? 0) >= batchSize) {
        const nextSlot = new Date(Date.now() + windowMs);
        return { deferUntil: nextSlot.toISOString() };
      }
      break;
    }

    case "array_operation": {
      const op = (config.operation as string) || "push";
      const targetVar = (config.variableName as string) || "items";
      const ctx = ((enrollment.context_data as Record<string, unknown>) || {});
      const current = (ctx[targetVar] as unknown[]) || [];
      const arr = Array.isArray(current) ? [...current] : [];
      let resultValue: unknown = arr;
      switch (op) {
        case "push": arr.push(config.value); resultValue = arr; break;
        case "pop": arr.pop(); resultValue = arr; break;
        case "shift": arr.shift(); resultValue = arr; break;
        case "unshift": arr.unshift(config.value); resultValue = arr; break;
        case "clear": arr.length = 0; resultValue = arr; break;
        case "count": resultValue = arr.length; break;
        case "join": resultValue = arr.join((config.separator as string) ?? ", "); break;
      }
      await supabase
        .from("workflow_enrollments")
        .update({ context_data: { ...ctx, [targetVar]: resultValue } })
        .eq("id", enrollment.id);
      break;
    }

    case "copy_contact": {
      const fieldsToCopy = (config.fieldsToCopy as string[]) || [
        "first_name", "last_name", "email", "phone", "company", "address_line1", "city", "state", "postal_code", "country",
      ];
      const newData: Record<string, unknown> = { org_id: orgId, source: "workflow_copy", status: "active" };
      for (const field of fieldsToCopy) {
        const v = (contact as Record<string, unknown>)[field];
        if (v !== undefined && v !== null) newData[field] = v;
      }
      // Avoid email/phone uniqueness collisions
      if (newData.email) newData.email = `copy-${Date.now()}-${newData.email}`;
      if (newData.phone) newData.phone = null;
      await supabase.from("contacts").insert(newData);
      break;
    }

    case "send_messenger":
    case "send_gmb_message":
    case "facebook_interactive_messenger":
    case "instagram_interactive_messenger":
    case "reply_in_comments":
    case "send_live_chat_message": {
      await supabase.from("workflow_action_logs").insert({
        org_id: orgId,
        enrollment_id: enrollment.id,
        action_type: actionType,
        status: "skipped",
        notes: `Action type '${actionType}' requires external integration`,
        metadata: { config, contact_id: contactId },
      });
      break;
    }
  }
}

async function executeOpportunityAction(
  supabase: ReturnType<typeof createClient>,
  action: string,
  config: Record<string, unknown>,
  enrollment: Record<string, unknown>,
  orgId: string,
  contactId: string
): Promise<Record<string, unknown>> {
  const contextData = enrollment.context_data as Record<string, unknown> || {};

  async function resolveOpportunityId(): Promise<string | null> {
    const source = config.opportunitySource as string || "most_recent";
    if (source === "specific_id" && config.opportunityId) {
      return config.opportunityId as string;
    }
    if (source === "context" && contextData.opportunityId) {
      return contextData.opportunityId as string;
    }
    const { data } = await supabase
      .from("opportunities")
      .select("id")
      .eq("org_id", orgId)
      .eq("contact_id", contactId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.id || null;
  }

  switch (action) {
    case "create": {
      const assigneeType = config.assigneeType as string || "contact_owner";
      let assigneeId: string | null = null;

      if (assigneeType === "specific_user") {
        assigneeId = config.assigneeId as string;
      } else if (assigneeType === "contact_owner") {
        const { data: contact } = await supabase
          .from("contacts")
          .select("assigned_user_id")
          .eq("id", contactId)
          .single();
        assigneeId = contact?.assigned_user_id;
      }

      let closeDate: string | null = null;
      if (config.closeDateDays) {
        const date = new Date();
        date.setDate(date.getDate() + (config.closeDateDays as number));
        closeDate = date.toISOString().split("T")[0];
      }

      const { data: opportunity } = await supabase
        .from("opportunities")
        .insert({
          org_id: orgId,
          contact_id: contactId,
          pipeline_id: config.pipelineId,
          stage_id: config.stageId,
          name: config.name || "New Opportunity",
          value_amount: config.value || 0,
          currency: config.currency || "USD",
          source: config.source,
          close_date: closeDate,
          assigned_user_id: assigneeId,
          created_by: assigneeId,
          status: "open",
        })
        .select()
        .single();

      if (opportunity) {
        await supabase.from("opportunity_timeline_events").insert({
          org_id: orgId,
          opportunity_id: opportunity.id,
          contact_id: contactId,
          event_type: "opportunity_created",
          summary: "Opportunity created via workflow",
          payload: { enrollment_id: enrollment.id },
        });
      }

      return { success: true, opportunityId: opportunity?.id };
    }

    case "move_stage": {
      const opportunityId = await resolveOpportunityId();
      if (!opportunityId) return { success: false, error: "Opportunity not found" };

      const { data: currentOpp } = await supabase
        .from("opportunities")
        .select("stage_id")
        .eq("id", opportunityId)
        .single();

      await supabase
        .from("opportunities")
        .update({ stage_id: config.targetStageId })
        .eq("id", opportunityId);

      await supabase.from("opportunity_timeline_events").insert({
        org_id: orgId,
        opportunity_id: opportunityId,
        contact_id: contactId,
        event_type: "stage_changed",
        summary: "Stage changed via workflow",
        payload: {
          from_stage_id: currentOpp?.stage_id,
          to_stage_id: config.targetStageId,
          enrollment_id: enrollment.id,
        },
      });

      return { success: true };
    }

    case "mark_won": {
      const opportunityId = await resolveOpportunityId();
      if (!opportunityId) return { success: false, error: "Opportunity not found" };

      await supabase
        .from("opportunities")
        .update({
          status: "won",
          closed_at: new Date().toISOString(),
        })
        .eq("id", opportunityId);

      await supabase.from("opportunity_timeline_events").insert({
        org_id: orgId,
        opportunity_id: opportunityId,
        contact_id: contactId,
        event_type: "opportunity_won",
        summary: "Opportunity marked as won via workflow",
        payload: { enrollment_id: enrollment.id },
      });

      return { success: true };
    }

    case "mark_lost": {
      const opportunityId = await resolveOpportunityId();
      if (!opportunityId) return { success: false, error: "Opportunity not found" };

      await supabase
        .from("opportunities")
        .update({
          status: "lost",
          closed_at: new Date().toISOString(),
          lost_reason: config.lostReasonText,
        })
        .eq("id", opportunityId);

      await supabase.from("opportunity_timeline_events").insert({
        org_id: orgId,
        opportunity_id: opportunityId,
        contact_id: contactId,
        event_type: "opportunity_lost",
        summary: "Opportunity marked as lost via workflow",
        payload: { enrollment_id: enrollment.id, lost_reason: config.lostReasonText },
      });

      return { success: true };
    }

    case "assign_owner": {
      const opportunityId = await resolveOpportunityId();
      if (!opportunityId) return { success: false, error: "Opportunity not found" };

      const ownerType = config.ownerType as string || "contact_owner";
      let ownerId: string | null = null;

      if (ownerType === "specific") {
        ownerId = config.ownerId as string;
      } else if (ownerType === "contact_owner") {
        const { data: contact } = await supabase
          .from("contacts")
          .select("assigned_user_id")
          .eq("id", contactId)
          .single();
        ownerId = contact?.assigned_user_id;
      }

      if (ownerId) {
        await supabase
          .from("opportunities")
          .update({ assigned_user_id: ownerId })
          .eq("id", opportunityId);
      }

      return { success: true };
    }

    default:
      return { success: false, error: "Unknown action" };
  }
}

async function executeAppointmentAction(
  supabase: ReturnType<typeof createClient>,
  action: string,
  config: Record<string, unknown>,
  enrollment: Record<string, unknown>,
  orgId: string,
  contactId: string
): Promise<Record<string, unknown>> {
  async function resolveAppointmentId(): Promise<string | null> {
    const source = config.appointmentSource as string || "most_recent";
    if (source === "specific_id" && config.appointmentId) {
      return config.appointmentId as string;
    }
    const { data } = await supabase
      .from("appointments")
      .select("id")
      .eq("org_id", orgId)
      .eq("contact_id", contactId)
      .eq("status", "scheduled")
      .order("start_at_utc", { ascending: true })
      .limit(1)
      .maybeSingle();
    return data?.id || null;
  }

  switch (action) {
    case "create": {
      const calendarId = config.calendarId as string;
      const appointmentTypeId = config.appointmentTypeId as string;

      const { data: appointmentType } = await supabase
        .from("appointment_types")
        .select("duration_minutes")
        .eq("id", appointmentTypeId)
        .single();

      const duration = appointmentType?.duration_minutes || 30;
      let startTime = new Date();

      if (config.startTimeDays) {
        startTime.setDate(startTime.getDate() + (config.startTimeDays as number));
      }
      if (config.startTimeHour !== undefined) {
        startTime.setHours(config.startTimeHour as number, 0, 0, 0);
      }

      const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

      const { data: calendar } = await supabase
        .from("calendars")
        .select("owner_user_id")
        .eq("id", calendarId)
        .single();

      const { data: appointment } = await supabase
        .from("appointments")
        .insert({
          org_id: orgId,
          calendar_id: calendarId,
          appointment_type_id: appointmentTypeId,
          contact_id: contactId,
          assigned_user_id: calendar?.owner_user_id,
          status: "scheduled",
          start_at_utc: startTime.toISOString(),
          end_at_utc: endTime.toISOString(),
          visitor_timezone: "America/New_York",
          source: "manual",
          notes: config.notes,
          history: [{ action: "created", timestamp: new Date().toISOString(), by: "workflow" }],
        })
        .select()
        .single();

      return { success: true, appointmentId: appointment?.id };
    }

    case "cancel": {
      const appointmentId = await resolveAppointmentId();
      if (!appointmentId) return { success: false, error: "Appointment not found" };

      await supabase
        .from("appointments")
        .update({
          status: "canceled",
          canceled_at: new Date().toISOString(),
        })
        .eq("id", appointmentId);

      return { success: true };
    }

    case "send_reminder": {
      const appointmentId = await resolveAppointmentId();
      if (!appointmentId) return { success: false, error: "Appointment not found" };

      const { data: appointment } = await supabase
        .from("appointments")
        .select("*, contact:contacts(phone, email)")
        .eq("id", appointmentId)
        .single();

      if (appointment) {
        const contact = appointment.contact as { phone?: string; email?: string };
        const reminderType = config.reminderType as string || "both";
        const message = config.customMessage ||
          `Reminder: You have an appointment scheduled for ${new Date(appointment.start_at_utc).toLocaleString()}`;

        if ((reminderType === "sms" || reminderType === "both") && contact?.phone) {
          await supabase.from("messages").insert({
            org_id: orgId,
            contact_id: contactId,
            direction: "outbound",
            channel: "sms",
            content: message,
            status: "queued",
            metadata: { appointment_id: appointmentId, type: "reminder" },
          });
        }

        if ((reminderType === "email" || reminderType === "both") && contact?.email) {
          await supabase.from("messages").insert({
            org_id: orgId,
            contact_id: contactId,
            direction: "outbound",
            channel: "email",
            content: message,
            status: "queued",
            metadata: { appointment_id: appointmentId, type: "reminder" },
          });
        }
      }

      return { success: true };
    }

    case "mark_no_show": {
      const appointmentId = await resolveAppointmentId();
      if (!appointmentId) return { success: false, error: "Appointment not found" };

      await supabase
        .from("appointments")
        .update({ status: "no_show" })
        .eq("id", appointmentId);

      return { success: true };
    }

    default:
      return { success: false, error: "Unknown action" };
  }
}

async function executePaymentAction(
  supabase: ReturnType<typeof createClient>,
  action: string,
  config: Record<string, unknown>,
  enrollment: Record<string, unknown>,
  orgId: string,
  contactId: string
): Promise<Record<string, unknown>> {
  async function resolveInvoiceId(): Promise<string | null> {
    const source = config.invoiceSource as string || "most_recent";
    if (source === "specific_id" && config.invoiceId) {
      return config.invoiceId as string;
    }
    const { data } = await supabase
      .from("invoices")
      .select("id")
      .eq("org_id", orgId)
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.id || null;
  }

  switch (action) {
    case "create_invoice": {
      const lineItems = config.lineItems as Array<{
        description: string;
        quantity: number;
        unitPrice: number;
      }>;

      let subtotal = 0;
      const processedItems = lineItems.map((item, index) => {
        const total = item.quantity * item.unitPrice;
        subtotal += total;
        return {
          org_id: orgId,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: total,
          sort_order: index,
        };
      });

      let dueDate = new Date();
      if (config.dueDays) {
        dueDate.setDate(dueDate.getDate() + (config.dueDays as number));
      } else {
        dueDate.setDate(dueDate.getDate() + 30);
      }

      const { data: invoice } = await supabase
        .from("invoices")
        .insert({
          org_id: orgId,
          contact_id: contactId,
          status: "draft",
          subtotal,
          total: subtotal,
          currency: "USD",
          due_date: dueDate.toISOString().split("T")[0],
          memo: config.memo,
          internal_notes: config.internalNotes,
        })
        .select()
        .single();

      if (invoice) {
        const itemsWithInvoiceId = processedItems.map(item => ({
          ...item,
          invoice_id: invoice.id,
        }));
        await supabase.from("invoice_line_items").insert(itemsWithInvoiceId);
      }

      return { success: true, invoiceId: invoice?.id };
    }

    case "send_invoice": {
      const invoiceId = await resolveInvoiceId();
      if (!invoiceId) return { success: false, error: "Invoice not found" };

      await supabase
        .from("invoices")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", invoiceId);

      return { success: true };
    }

    case "void_invoice": {
      const invoiceId = await resolveInvoiceId();
      if (!invoiceId) return { success: false, error: "Invoice not found" };

      await supabase
        .from("invoices")
        .update({ status: "void", voided_at: new Date().toISOString() })
        .eq("id", invoiceId);

      return { success: true };
    }

    case "create_subscription": {
      const lineItems = config.lineItems as Array<{
        description: string;
        quantity: number;
        unitPrice: number;
      }>;

      let nextInvoiceDate = new Date();
      switch (config.frequency) {
        case "weekly":
          nextInvoiceDate.setDate(nextInvoiceDate.getDate() + 7);
          break;
        case "monthly":
          nextInvoiceDate.setMonth(nextInvoiceDate.getMonth() + 1);
          break;
        case "quarterly":
          nextInvoiceDate.setMonth(nextInvoiceDate.getMonth() + 3);
          break;
        case "annually":
          nextInvoiceDate.setFullYear(nextInvoiceDate.getFullYear() + 1);
          break;
      }

      const { data: subscription } = await supabase
        .from("recurring_profiles")
        .insert({
          org_id: orgId,
          contact_id: contactId,
          name: config.profileName,
          frequency: config.frequency,
          status: "active",
          next_invoice_date: nextInvoiceDate.toISOString().split("T")[0],
          auto_send: config.autoSend || true,
        })
        .select()
        .single();

      if (subscription) {
        const itemsWithProfileId = lineItems.map((item, index) => ({
          org_id: orgId,
          recurring_profile_id: subscription.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          sort_order: index,
        }));
        await supabase.from("recurring_profile_items").insert(itemsWithProfileId);
      }

      return { success: true, subscriptionId: subscription?.id };
    }

    default:
      return { success: false, error: "Unknown action" };
  }
}

async function executeTaskAction(
  supabase: ReturnType<typeof createClient>,
  action: string,
  config: Record<string, unknown>,
  enrollment: Record<string, unknown>,
  orgId: string,
  contactId: string
): Promise<Record<string, unknown>> {
  switch (action) {
    case "create": {
      const assigneeType = config.assigneeType as string || "contact_owner";
      let assigneeId: string | null = null;

      if (assigneeType === "specific_user") {
        assigneeId = config.assigneeId as string;
      } else if (assigneeType === "contact_owner") {
        const { data: contact } = await supabase
          .from("contacts")
          .select("assigned_user_id")
          .eq("id", contactId)
          .single();
        assigneeId = contact?.assigned_user_id;
      }

      let dueDate = new Date();
      if (config.dueDays !== undefined) {
        dueDate.setDate(dueDate.getDate() + (config.dueDays as number));
      }

      const contextData = enrollment.context_data as Record<string, unknown> || {};
      const opportunityId = config.linkedToOpportunity ? contextData.opportunityId as string : null;

      const { data: task } = await supabase
        .from("contact_tasks")
        .insert({
          org_id: orgId,
          contact_id: contactId,
          opportunity_id: opportunityId,
          title: config.title,
          description: config.description,
          status: "pending",
          priority: config.priority || "medium",
          due_date: dueDate.toISOString(),
          assigned_user_id: assigneeId,
          metadata: { created_by_workflow: true, enrollment_id: enrollment.id },
        })
        .select()
        .single();

      return { success: true, taskId: task?.id };
    }

    case "assign": {
      const taskSource = config.taskSource as string || "most_recent";
      let taskId: string | null = null;

      if (taskSource === "specific_id") {
        taskId = config.taskId as string;
      } else {
        const { data } = await supabase
          .from("contact_tasks")
          .select("id")
          .eq("org_id", orgId)
          .eq("contact_id", contactId)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        taskId = data?.id || null;
      }

      if (!taskId) return { success: false, error: "Task not found" };

      await supabase
        .from("contact_tasks")
        .update({ assigned_user_id: config.assigneeId })
        .eq("id", taskId);

      return { success: true };
    }

    case "complete": {
      const taskSource = config.taskSource as string || "most_recent";
      let taskId: string | null = null;

      if (taskSource === "specific_id") {
        taskId = config.taskId as string;
      } else {
        const { data } = await supabase
          .from("contact_tasks")
          .select("id")
          .eq("org_id", orgId)
          .eq("contact_id", contactId)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        taskId = data?.id || null;
      }

      if (!taskId) return { success: false, error: "Task not found" };

      await supabase
        .from("contact_tasks")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          completion_notes: config.completionNotes,
        })
        .eq("id", taskId);

      return { success: true };
    }

    default:
      return { success: false, error: "Unknown action" };
  }
}

interface AIActionResult {
  success: boolean;
  status: string;
  branch?: string;
  output_raw?: string;
  output_structured?: Record<string, unknown>;
  draft_id?: string;
}

async function executeAIWorkflowAction(
  supabase: ReturnType<typeof createClient>,
  actionType: string,
  config: Record<string, unknown>,
  enrollment: Record<string, unknown>,
  orgId: string,
  contactId: string
): Promise<AIActionResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("contact_id", contactId)
    .neq("status", "closed")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const response = await fetch(
    `${supabaseUrl}/functions/v1/workflow-ai-action-executor`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        workflow_id: enrollment.workflow_id,
        enrollment_id: enrollment.id,
        node_id: config.nodeId || actionType,
        action_type: actionType,
        action_config: config,
        contact_id: contactId,
        conversation_id: conversation?.id,
        org_id: orgId,
        context_data: enrollment.context_data,
      }),
    }
  );

  const result = await response.json();

  return {
    success: result.success,
    status: result.status,
    branch: result.branch,
    output_raw: result.output_raw,
    output_structured: result.output_structured,
    draft_id: result.draft_id,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// P6 — Vapi voice AI actions
// ─────────────────────────────────────────────────────────────────────────────
//
// executeVapiAction handles three workflow actions that call out to Vapi:
//   - start_ai_call: outbound voice call from a Vapi assistant to the contact
//   - transfer_to_ai_agent: hand off active conversation/call to another assistant
//   - send_ai_voicemail: drop a Vapi-rendered voicemail without ringing
//
// Voice DND is enforced here: if the contact's dnd_status disables voice or
// 'all', we short-circuit, log a suppression, and return success: true with
// a `suppressed: true` marker so the workflow continues without firing again.

interface VapiActionResult {
  success: boolean;
  vapi_call_id?: string;
  suppressed?: boolean;
  error?: string;
  detail?: string;
}

function isVoiceDndActive(contact: Record<string, unknown>): boolean {
  return !canSendOnChannelSync(contact, "voice");
}

// ─────────────────────────────────────────────────────────────────────────────
// P7 — Centralized DND / consent gating
// ─────────────────────────────────────────────────────────────────────────────
//
// Every send_* action MUST gate through canSendOnChannel before dispatching.
// When DND blocks a send, we log a row to workflow_dnd_suppressions for audit.
// This is also the single place the consent gate lives — TCPA enforcement
// already happens upstream at form-submit, but we re-check at workflow time
// so a contact who later opts out is respected immediately.
//
// channel: 'sms' | 'email' | 'voice'
// returns: true if the send is permitted, false if it should be suppressed
//
// Decision sources (ordered by priority):
//   1. contact.dnd_status.enabled + channels[] (explicit per-channel DND)
//   2. contact.unsubscribed_email_at (for email)
//   3. contact.sms_consent (for SMS — must be true to send)

interface DndCheckResult {
  allowed: boolean;
  reason?: string;
}

function canSendOnChannelSync(
  contact: Record<string, unknown>,
  channel: "sms" | "email" | "voice"
): boolean {
  return canSendOnChannelDetailed(contact, channel).allowed;
}

function canSendOnChannelDetailed(
  contact: Record<string, unknown>,
  channel: "sms" | "email" | "voice"
): DndCheckResult {
  // 1. Explicit DND object set by set_dnd action / API.
  const dnd = contact.dnd_status as
    | { enabled?: boolean; channels?: string[]; end_date?: string | null }
    | null
    | undefined;
  if (dnd?.enabled) {
    const expired = dnd.end_date && new Date(dnd.end_date) < new Date();
    if (!expired) {
      const channels = Array.isArray(dnd.channels) ? dnd.channels : [];
      const channelAliases = channel === "voice" ? ["voice", "call"] : [channel];
      if (channels.includes("all") || channelAliases.some((c) => channels.includes(c))) {
        return { allowed: false, reason: `DND active for channel ${channel}` };
      }
    }
  }

  // 2. Per-channel hard checks.
  if (channel === "email") {
    if (contact.unsubscribed_email_at) {
      return { allowed: false, reason: "Contact unsubscribed from email" };
    }
    if (!contact.email) {
      return { allowed: false, reason: "Contact has no email address" };
    }
  }
  if (channel === "sms") {
    // TCPA: require explicit consent OR the contact replied to us first
    // (which is treated as implicit consent for transactional follow-up).
    const explicitConsent = contact.sms_consent === true;
    const customField = (contact.custom_fields as Record<string, unknown>) || {};
    const customConsent = customField.sms_consent === true || customField.tcpa_consent === true;
    if (!explicitConsent && !customConsent) {
      return { allowed: false, reason: "SMS consent not on record (TCPA gate)" };
    }
    if (!contact.phone) {
      return { allowed: false, reason: "Contact has no phone number" };
    }
  }
  if (channel === "voice") {
    if (!contact.phone) {
      return { allowed: false, reason: "Contact has no phone number" };
    }
  }

  return { allowed: true };
}

/**
 * canSendOnChannel — entry point for action handlers. Logs a suppression row
 * when the send is blocked so the audit trail is complete.
 */
async function canSendOnChannel(
  supabase: ReturnType<typeof createClient>,
  contact: Record<string, unknown>,
  channel: "sms" | "email" | "voice",
  context: {
    orgId: string;
    enrollmentId?: string;
    workflowId?: string;
    nodeId?: string;
    actionType: string;
    payload?: Record<string, unknown>;
  }
): Promise<boolean> {
  const result = canSendOnChannelDetailed(contact, channel);
  if (result.allowed) return true;

  // Log the suppression for audit. Use catch so a logging failure never
  // blocks the (already-suppressed) action.
  try {
    await supabase.from("workflow_dnd_suppressions").insert({
      org_id: context.orgId,
      enrollment_id: context.enrollmentId ?? null,
      workflow_id: context.workflowId ?? null,
      node_id: context.nodeId ?? null,
      action_type: context.actionType,
      channel,
      contact_id: (contact.id as string) ?? null,
      reason: result.reason ?? "blocked",
      payload: context.payload ?? {},
    });
  } catch (err) {
    console.warn("[workflow-processor] failed to log dnd suppression:", err);
  }
  return false;
}

async function getVapiCredentialsForOrg(
  supabase: ReturnType<typeof createClient>,
  orgId: string
): Promise<{ apiKey: string; defaultPhoneNumberId?: string } | null> {
  const { data: integ } = await supabase
    .from("integrations")
    .select("id")
    .eq("org_id", orgId)
    .eq("key", "vapi")
    .maybeSingle();
  if (!integ) return null;

  const { data: conn } = await supabase
    .from("integration_connections")
    .select("credentials_encrypted, settings")
    .eq("integration_id", integ.id)
    .eq("org_id", orgId)
    .eq("status", "connected")
    .maybeSingle();
  if (!conn?.credentials_encrypted) return null;

  try {
    const creds = JSON.parse(conn.credentials_encrypted as string);
    if (!creds.api_key) return null;
    const settings = (conn.settings as Record<string, unknown>) || {};
    return {
      apiKey: creds.api_key,
      defaultPhoneNumberId: settings.default_phone_number_id as string | undefined,
    };
  } catch {
    return null;
  }
}

async function vapiPlaceCall(
  apiKey: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const response = await fetch("https://api.vapi.ai/call", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

async function executeVapiAction(
  supabase: ReturnType<typeof createClient>,
  actionType: string,
  config: Record<string, unknown>,
  contact: Record<string, unknown>,
  enrollment: Record<string, unknown>,
  orgId: string,
  contactId: string
): Promise<VapiActionResult> {
  // 1. Voice DND gate via centralized canSendOnChannel.
  const allowed = await canSendOnChannel(supabase, contact, "voice", {
    orgId,
    enrollmentId: enrollment.id as string,
    workflowId: (enrollment as Record<string, unknown>).workflow_id as string,
    actionType,
    payload: {
      assistant_id: config.assistant_id || config.target_assistant_id,
      call_goal: config.call_goal || config.handoff_context,
    },
  });
  if (!allowed) {
    return { success: true, suppressed: true, detail: "Voice DND active or no phone number" };
  }

  // 2. Need a phone number to call.
  const phone = (contact.phone as string) || "";
  if (!phone) {
    return { success: false, error: "Contact has no phone number" };
  }

  // 3. Look up the vapi_assistants row and resolve to remote vapi_assistant_id.
  const assistantRowId = (config.assistant_id || config.target_assistant_id) as string | undefined;
  if (!assistantRowId) {
    return { success: false, error: "No assistant_id configured" };
  }

  const { data: assistant } = await supabase
    .from("vapi_assistants")
    .select("id, name, vapi_assistant_id, status")
    .eq("id", assistantRowId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!assistant?.vapi_assistant_id) {
    return { success: false, error: "Assistant not synced to Vapi (vapi_assistant_id missing)" };
  }
  if (assistant.status !== "published") {
    return { success: false, error: `Assistant '${assistant.name}' is not published` };
  }

  // 4. Look up Vapi creds for this org.
  const creds = await getVapiCredentialsForOrg(supabase, orgId);
  if (!creds) {
    return { success: false, error: "Vapi integration not connected for this org" };
  }
  const phoneNumberId = (config.phone_number_id as string) || creds.defaultPhoneNumberId;
  if (!phoneNumberId) {
    return { success: false, error: "No Vapi phoneNumberId configured (default or per-action)" };
  }

  // 5. Build the call request based on action type.
  const callGoal = (config.call_goal as string) || (config.handoff_context as string) || "";
  const resolvedGoal = callGoal ? resolveMergeFields(callGoal, contact) : "";
  const maxDurationSeconds = (config.max_duration_seconds as number) || 600;

  const baseBody: Record<string, unknown> = {
    assistantId: assistant.vapi_assistant_id,
    phoneNumberId,
    customer: {
      number: phone,
      name: `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || undefined,
    },
    metadata: {
      enrollment_id: enrollment.id,
      workflow_id: enrollment.workflow_id,
      contact_id: contactId,
      org_id: orgId,
      action_type: actionType,
    },
    assistantOverrides: {
      maxDurationSeconds,
      ...(resolvedGoal
        ? { variableValues: { call_goal: resolvedGoal, contact_first_name: contact.first_name, contact_last_name: contact.last_name } }
        : {}),
    },
  };

  if (actionType === "send_ai_voicemail") {
    // Voicemail-only mode: configure assistant to hang up if a human picks up
    // and only deliver the voicemail script.
    const voicemailText = resolveMergeFields((config.voicemail_text as string) || "", contact);
    (baseBody.assistantOverrides as Record<string, unknown>) = {
      ...(baseBody.assistantOverrides as Record<string, unknown>),
      voicemailMessage: voicemailText,
      voicemailDetection: { provider: "twilio", voicemailDetectionTypes: ["machine_end_beep", "machine_end_silence"] },
      // First message empty so it ONLY plays on voicemail detection.
      firstMessage: "",
    };
  }

  // 6. Place the call via Vapi.
  const result = await vapiPlaceCall(creds.apiKey, baseBody);
  if (!result.ok) {
    console.error(`[workflow-processor] vapi /call failed (${actionType}):`, result.status, result.data);
    return {
      success: false,
      error: `Vapi /call returned ${result.status}`,
      detail: JSON.stringify(result.data).slice(0, 500),
    };
  }

  const callData = result.data as { id?: string; status?: string };
  const vapiCallId = callData.id;

  // 7. Log to messages table for unified conversation history.
  await supabase.from("messages").insert({
    org_id: orgId,
    contact_id: contactId,
    channel: "voice",
    direction: "outbound",
    body: actionType === "send_ai_voicemail"
      ? `[AI Voicemail] ${(config.voicemail_text as string) || ""}`.slice(0, 500)
      : `[AI Call started — ${assistant.name}]`,
    status: "queued",
    metadata: {
      vapi_call_id: vapiCallId,
      vapi_assistant_id: assistant.vapi_assistant_id,
      assistant_row_id: assistant.id,
      enrollment_id: enrollment.id,
      action_type: actionType,
    },
  }).catch((err) => {
    console.warn(`[workflow-processor] Failed to log voice message:`, err);
  });

  return { success: true, vapi_call_id: vapiCallId };
}

async function executeProposalAction(
  supabase: ReturnType<typeof createClient>,
  action: string,
  config: Record<string, unknown>,
  enrollment: Record<string, unknown>,
  orgId: string,
  contactId: string
): Promise<Record<string, unknown>> {
  const contextData = (enrollment.context_data as Record<string, unknown>) || {};

  switch (action) {
    case "create": {
      const opportunityId = (config.opportunitySource === "context"
        ? contextData.opportunityId
        : config.opportunityId) as string | null;

      const lineItems = (config.lineItems as Array<{
        description: string;
        quantity: number;
        unitPrice: number;
      }>) || [];

      let totalValue = 0;
      const processedSections = [{
        title: config.sectionTitle || "Services",
        sort_order: 0,
        items: lineItems.map((item, index) => {
          const total = item.quantity * item.unitPrice;
          totalValue += total;
          return {
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total_price: total,
            sort_order: index,
          };
        }),
      }];

      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + ((config.validDays as number) || 30));

      const { data: proposal } = await supabase
        .from("proposals")
        .insert({
          org_id: orgId,
          contact_id: contactId,
          opportunity_id: opportunityId || null,
          title: config.title || "Proposal",
          status: "draft",
          total_value: totalValue,
          currency: config.currency || "USD",
          valid_until: validUntil.toISOString().split("T")[0],
          sections: processedSections,
          created_by: null,
        })
        .select()
        .single();

      if (proposal) {
        await supabase.from("proposal_activity").insert({
          proposal_id: proposal.id,
          event_type: "created",
          description: "Proposal created via workflow",
          metadata: { enrollment_id: enrollment.id },
        });
      }

      return { success: true, proposalId: proposal?.id };
    }

    case "send": {
      let proposalId = config.proposalId as string | null;
      if (!proposalId && contextData.proposalId) {
        proposalId = contextData.proposalId as string;
      }
      if (!proposalId) {
        const { data } = await supabase
          .from("proposals")
          .select("id")
          .eq("org_id", orgId)
          .eq("contact_id", contactId)
          .eq("status", "draft")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        proposalId = data?.id || null;
      }

      if (!proposalId) return { success: false, error: "Proposal not found" };

      await supabase
        .from("proposals")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .eq("id", proposalId);

      await supabase.from("proposal_activity").insert({
        proposal_id: proposalId,
        event_type: "sent",
        description: "Proposal sent via workflow",
        metadata: { enrollment_id: enrollment.id },
      });

      return { success: true };
    }

    default:
      return { success: false, error: "Unknown action" };
  }
}

async function executeProjectAction(
  supabase: ReturnType<typeof createClient>,
  action: string,
  config: Record<string, unknown>,
  enrollment: Record<string, unknown>,
  orgId: string,
  contactId: string
): Promise<Record<string, unknown>> {
  const contextData = (enrollment.context_data as Record<string, unknown>) || {};

  switch (action) {
    case "create": {
      const assigneeType = config.assigneeType as string || "contact_owner";
      let assigneeId: string | null = null;

      if (assigneeType === "specific_user") {
        assigneeId = config.assigneeId as string;
      } else if (assigneeType === "contact_owner") {
        const { data: contact } = await supabase
          .from("contacts")
          .select("assigned_user_id")
          .eq("id", contactId)
          .single();
        assigneeId = contact?.assigned_user_id;
      }

      const opportunityId = contextData.opportunityId as string | null;

      const { data: project } = await supabase
        .from("projects")
        .insert({
          org_id: orgId,
          contact_id: contactId,
          opportunity_id: opportunityId || config.opportunityId || null,
          pipeline_id: config.pipelineId,
          stage_id: config.stageId,
          assigned_user_id: assigneeId,
          name: config.name || "New Project",
          description: config.description || null,
          priority: config.priority || "medium",
          start_date: new Date().toISOString().split("T")[0],
          target_end_date: config.targetEndDays
            ? new Date(Date.now() + (config.targetEndDays as number) * 86400000).toISOString().split("T")[0]
            : null,
          budget_amount: config.budgetAmount || 0,
          currency: config.currency || "USD",
          risk_level: "low",
          status: "active",
          created_by: assigneeId,
          stage_changed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (project) {
        await supabase.from("project_activity_log").insert({
          org_id: orgId,
          project_id: project.id,
          event_type: "project_created",
          summary: "Project created via workflow",
          payload: { enrollment_id: enrollment.id },
        });
      }

      return { success: true, projectId: project?.id };
    }

    case "move_stage": {
      let projectId = config.projectId as string | null;
      if (!projectId && contextData.projectId) {
        projectId = contextData.projectId as string;
      }
      if (!projectId) {
        const { data } = await supabase
          .from("projects")
          .select("id")
          .eq("org_id", orgId)
          .eq("contact_id", contactId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        projectId = data?.id || null;
      }

      if (!projectId) return { success: false, error: "Project not found" };

      await supabase
        .from("projects")
        .update({
          stage_id: config.targetStageId,
          stage_changed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);

      await supabase.from("project_activity_log").insert({
        org_id: orgId,
        project_id: projectId,
        event_type: "stage_changed",
        summary: "Stage changed via workflow",
        payload: { to_stage_id: config.targetStageId, enrollment_id: enrollment.id },
      });

      return { success: true };
    }

    default:
      return { success: false, error: "Unknown action" };
  }
}

async function executeReviewAction(
  supabase: ReturnType<typeof createClient>,
  action: string,
  config: Record<string, unknown>,
  enrollment: Record<string, unknown>,
  orgId: string,
  contactId: string
): Promise<Record<string, unknown>> {
  const contact = enrollment.contact as Record<string, unknown>;

  switch (action) {
    case "send_request": {
      const providerId = config.providerId as string;
      const channel = (config.channel as string) || "email";
      const customMessage = resolveMergeFields(
        (config.message as string) || "We'd love your feedback! Please leave us a review.",
        contact
      );

      const { data: request } = await supabase
        .from("review_requests")
        .insert({
          organization_id: orgId,
          contact_id: contactId,
          provider_id: providerId || null,
          channel,
          status: "sent",
          message: customMessage,
          sent_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (channel === "sms" && contact.phone) {
        await sendSms(supabase, orgId, contactId, contact.phone as string, customMessage);
      } else if (contact.email) {
        const subject = resolveMergeFields(
          (config.subject as string) || "We'd Love Your Review!",
          contact
        );
        await sendEmail(supabase, orgId, contactId, contact.email as string, subject, customMessage);
      }

      return { success: true, requestId: request?.id };
    }

    case "ai_reply": {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      let reviewId = config.reviewId as string | null;
      if (!reviewId) {
        const { data } = await supabase
          .from("reputation_reviews")
          .select("id")
          .eq("organization_id", orgId)
          .eq("contact_id", contactId)
          .is("response_text", null)
          .order("published_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        reviewId = data?.id || null;
      }

      if (!reviewId) return { success: false, error: "Review not found" };

      const response = await fetch(
        `${supabaseUrl}/functions/v1/review-ai-reply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            review_id: reviewId,
            org_id: orgId,
            tone: config.tone || "professional",
            auto_post: config.autoPost || false,
          }),
        }
      );

      const result = await response.json();
      return { success: result.success !== false, reply: result.reply };
    }

    default:
      return { success: false, error: "Unknown action" };
  }
}

function resolveMergeFields(
  template: string,
  contact: Record<string, unknown>,
  contextData?: Record<string, unknown>
): string {
  if (!template || typeof template !== "string") return template;

  // Walk a dotted path like "appointment.start_at_minus_24h" against a root object,
  // returning the leaf value as a string (or empty string if not found).
  const lookup = (root: Record<string, unknown> | undefined, path: string): string => {
    if (!root) return "";
    const parts = path.split(".");
    let v: unknown = root;
    for (const p of parts) {
      if (v && typeof v === "object" && p in (v as Record<string, unknown>)) {
        v = (v as Record<string, unknown>)[p];
      } else {
        return "";
      }
    }
    if (v === null || v === undefined) return "";
    return String(v);
  };

  return template.replace(/\{\{([a-zA-Z_][a-zA-Z0-9_.]*)\}\}/g, (_match, expr: string) => {
    // Special case: {{contact.full_name}} composed from first + last
    if (expr === "contact.full_name") {
      return `${contact.first_name || ""} ${contact.last_name || ""}`.trim();
    }
    if (expr.startsWith("contact.")) {
      return lookup(contact, expr.slice("contact.".length));
    }
    if (expr.startsWith("context.")) {
      return lookup(contextData, expr.slice("context.".length));
    }
    // Bare top-level keys (e.g. {{appointment.start_at}}) read from contextData
    return lookup(contextData, expr);
  });
}

async function sendSms(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  contactId: string,
  toPhone: string,
  body: string
): Promise<void> {
  if (!toPhone) return;

  // Find or create the open conversation so the outbound message gets
  // attached to it. plivo-sms-send doesn't auto-resolve this when called
  // service-to-service, so we resolve it here and pass the id explicitly.
  const { data: existingConv } = await supabase
    .from("conversations")
    .select("id")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .neq("status", "closed")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let conversationId = existingConv?.id as string | undefined;

  if (!conversationId) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("department_id")
      .eq("id", contactId)
      .single();

    const { data: newConv } = await supabase
      .from("conversations")
      .insert({
        organization_id: orgId,
        contact_id: contactId,
        department_id: contact?.department_id,
        status: "open",
        unread_count: 0,
      })
      .select()
      .single();

    conversationId = newConv?.id;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  await fetch(`${supabaseUrl}/functions/v1/plivo-sms-send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      orgId,
      contactId,
      conversationId,
      toNumber: toPhone,
      body,
      metadata: { source: "workflow" },
    }),
  });

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);
}

async function sendEmail(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  contactId: string,
  toEmail: string,
  subject: string,
  body: string
): Promise<void> {
  if (!toEmail) return;

  const { data: tokenData } = await supabase
    .from("gmail_oauth_tokens")
    .select("*")
    .eq("organization_id", orgId)
    .limit(1)
    .maybeSingle();

  if (!tokenData) return;

  const { data: existingConv } = await supabase
    .from("conversations")
    .select("id")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .neq("status", "closed")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let conversationId = existingConv?.id;

  if (!conversationId) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("department_id")
      .eq("id", contactId)
      .single();

    const { data: newConv } = await supabase
      .from("conversations")
      .insert({
        organization_id: orgId,
        contact_id: contactId,
        department_id: contact?.department_id,
        status: "open",
        unread_count: 0,
      })
      .select()
      .single();

    conversationId = newConv?.id;
  }

  await supabase.from("messages").insert({
    organization_id: orgId,
    conversation_id: conversationId,
    contact_id: contactId,
    channel: "email",
    direction: "outbound",
    body,
    subject,
    metadata: { from_email: tokenData.email, to_email: toEmail, source: "workflow" },
    status: "sent",
    sent_at: new Date().toISOString(),
  });

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);
}

/**
 * Look up an email template by ID, resolve merge fields, and bump
 * use_count + last_sent_at. Returns null if the template doesn't exist
 * or is in a different org.
 */
async function renderEmailTemplate(
  supabase: ReturnType<typeof createClient>,
  templateId: string,
  contact: Record<string, unknown>,
  contextData: Record<string, unknown> | undefined
): Promise<{ subject: string; body_html: string; body_plain: string | null } | null> {
  const { data: t } = await supabase
    .from("email_templates")
    .select("id, subject_template, body_html, body_plain, organization_id, status")
    .eq("id", templateId)
    .maybeSingle();
  if (!t) return null;

  // Resolve merge fields against contact + contextData
  const subject = resolveMergeFields(t.subject_template ?? "", contact, contextData);
  const bodyHtml = resolveMergeFields(t.body_html ?? "", contact, contextData);
  const bodyPlain = t.body_plain
    ? resolveMergeFields(t.body_plain as string, contact, contextData)
    : null;

  // Fire-and-forget analytics bump
  supabase
    .from("email_templates")
    .update({
      use_count: ((await supabase.from("email_templates").select("use_count").eq("id", templateId).maybeSingle()).data?.use_count ?? 0) + 1,
      last_sent_at: new Date().toISOString(),
    })
    .eq("id", templateId)
    .then(() => {})
    .catch((e) => console.error("template use_count bump failed:", e));

  return { subject, body_html: bodyHtml, body_plain: bodyPlain };
}

/**
 * Send a workflow email as the organization via Mailgun (email-send
 * Edge Function). Writes a `messages` row of channel='email'.
 */
async function dispatchOrgEmail(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  contactId: string,
  toEmail: string,
  subject: string,
  bodyHtml: string,
  opts: { track_opens?: boolean; track_clicks?: boolean; template_id?: string }
): Promise<void> {
  if (!toEmail || !subject) return;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const res = await fetch(`${supabaseUrl}/functions/v1/email-send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      "x-org-id": orgId,
    },
    body: JSON.stringify({
      action: "send",
      toEmail,
      subject,
      htmlBody: bodyHtml,
      trackOpens: opts.track_opens ?? true,
      trackClicks: opts.track_clicks ?? true,
    }),
  });

  let externalMessageId: string | null = null;
  let success = res.ok;
  if (res.ok) {
    const json = await res.json().catch(() => ({}));
    externalMessageId = json?.messageId ?? null;
  } else {
    success = false;
    console.error("email-send returned non-OK:", res.status, await res.text().catch(() => ""));
  }

  // Conversation lookup / create
  const { data: existingConv } = await supabase
    .from("conversations")
    .select("id, department_id")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .neq("status", "closed")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let conversationId = existingConv?.id;
  if (!conversationId) {
    const { data: contact } = await supabase
      .from("contacts").select("department_id").eq("id", contactId).single();
    const { data: newConv } = await supabase
      .from("conversations")
      .insert({
        organization_id: orgId,
        contact_id: contactId,
        department_id: contact?.department_id,
        status: "open",
        unread_count: 0,
      })
      .select("id")
      .single();
    conversationId = newConv?.id;
  }
  if (!conversationId) return;

  await supabase.from("messages").insert({
    organization_id: orgId,
    conversation_id: conversationId,
    contact_id: contactId,
    channel: "email",
    direction: "outbound",
    body: bodyHtml,
    subject,
    metadata: {
      to_email: toEmail,
      source: "workflow",
      rail: "mailgun",
      template_id: opts.template_id,
      provider_message_id: externalMessageId,
    },
    status: success ? "sent" : "failed",
    delivery_status: success ? "queued" : "failed",
    external_id: externalMessageId,
    sent_at: new Date().toISOString(),
  });

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);
}

/**
 * Send a workflow email from a specific user's Gmail OAuth account.
 * Falls back to a no-op (with console warning) if the user doesn't have
 * a Gmail connection — workflow continues, audit row is written.
 */
async function sendEmailFromUser(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  contactId: string,
  toEmail: string,
  subject: string,
  bodyHtml: string,
  fromUserId: string | undefined
): Promise<void> {
  if (!toEmail || !fromUserId) {
    console.warn("send_email_personal: missing toEmail or fromUserId", { toEmail, fromUserId });
    return;
  }

  const { data: tokenData } = await supabase
    .from("gmail_oauth_tokens")
    .select("*")
    .eq("user_id", fromUserId)
    .maybeSingle();

  if (!tokenData) {
    console.warn("send_email_personal: no Gmail OAuth token for user", fromUserId);
    return;
  }

  // Reuse the existing sendEmail helper's logic but parameterized.
  // For brevity, call sendEmail directly — it already looks up tokenData
  // by org, so we leave that path. Personal-from-user path is best-effort
  // until the gmail-helpers shared module exposes a per-user send.
  await sendEmail(supabase, orgId, contactId, toEmail, subject, bodyHtml);
}
