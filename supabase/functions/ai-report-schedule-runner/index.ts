import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getSupabaseClient, isServiceRoleRequest } from "../_shared/auth.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const supabase = getSupabaseClient();

    if (!isServiceRoleRequest(req)) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return errorResponse("AUTH_REQUIRED", "Authentication required", 401);
      }
    }

    const { data: dueSchedules, error: fetchErr } = await supabase
      .from("ai_report_schedules")
      .select("*, user:users!ai_report_schedules_user_id_fkey(id, name, email, organization_id, role_id, department_id)")
      .eq("is_active", true)
      .lte("next_run_at", new Date().toISOString())
      .limit(10);

    if (fetchErr) {
      return errorResponse("DB_ERROR", `Failed to fetch schedules: ${fetchErr.message}`);
    }

    if (!dueSchedules || dueSchedules.length === 0) {
      return jsonResponse({ success: true, processed: 0, message: "No due schedules" });
    }

    const results: Array<{ schedule_id: string; report_id?: string; status: string; error?: string }> = [];

    for (const schedule of dueSchedules) {
      try {
        const now = new Date();
        const cadenceDays = schedule.cadence_days || 30;
        const end = now.toISOString();
        const start = new Date(now.getTime() - cadenceDays * 86400000).toISOString();

        const { data: reportRow, error: insertErr } = await supabase
          .from("ai_reports")
          .insert({
            organization_id: schedule.organization_id,
            created_by_user_id: schedule.user_id,
            scope: schedule.scope,
            report_name: schedule.report_name_template || `Scheduled Report - ${now.toLocaleDateString()}`,
            prompt: schedule.prompt_template || "Scheduled report generation",
            status: "running",
            timeframe_start: start,
            timeframe_end: end,
          })
          .select()
          .single();

        if (insertErr || !reportRow) {
          results.push({ schedule_id: schedule.id, status: "failed", error: "Failed to create report record" });
          continue;
        }

        const { data: llmProvider } = await supabase
          .from("llm_providers")
          .select("*, models:llm_models(*)")
          .eq("org_id", schedule.organization_id)
          .eq("enabled", true)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!llmProvider) {
          await supabase.from("ai_reports").update({ status: "failed", error_message: "No LLM provider" }).eq("id", reportRow.id);
          results.push({ schedule_id: schedule.id, report_id: reportRow.id, status: "failed", error: "No LLM provider" });
          continue;
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        const generateResponse = await fetch(`${supabaseUrl}/functions/v1/ai-report-generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            prompt: schedule.prompt_template,
            scope: schedule.scope,
            timeframe: { type: "custom", customStart: start, customEnd: end },
          }),
        });

        if (!generateResponse.ok) {
          const errText = await generateResponse.text();
          await supabase.from("ai_reports").update({
            status: "failed",
            error_message: `Generation failed: ${errText.slice(0, 500)}`,
          }).eq("id", reportRow.id);
          results.push({ schedule_id: schedule.id, report_id: reportRow.id, status: "failed", error: errText.slice(0, 200) });
        } else {
          results.push({ schedule_id: schedule.id, report_id: reportRow.id, status: "complete" });
        }

        const nextRun = new Date(now.getTime() + cadenceDays * 86400000);
        await supabase.from("ai_report_schedules").update({
          last_run_at: now.toISOString(),
          next_run_at: nextRun.toISOString(),
          updated_at: now.toISOString(),
        }).eq("id", schedule.id);

        try {
          await supabase.from("notifications").insert({
            organization_id: schedule.organization_id,
            user_id: schedule.user_id,
            title: "Scheduled Report Ready",
            body: `Your scheduled report "${schedule.report_name_template}" has been generated.`,
            type: "report",
            link: `/reporting/${reportRow.id}`,
          });
        } catch {
          // notification insert is best-effort
        }

      } catch (scheduleErr) {
        results.push({
          schedule_id: schedule.id,
          status: "failed",
          error: scheduleErr instanceof Error ? scheduleErr.message : "Unknown error",
        });
      }
    }

    return jsonResponse({
      success: true,
      processed: results.length,
      results,
    });

  } catch (error) {
    console.error("Schedule runner error:", error);
    return errorResponse(
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Internal server error",
      500
    );
  }
});
