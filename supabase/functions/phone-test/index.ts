import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!userData?.organization_id) return jsonResponse({ error: "No org" }, 403);

    const orgId = userData.organization_id;
    const { action, ...payload } = await req.json();

    switch (action) {
      case "sms": {
        const { toNumber, fromNumberId, messageBody } = payload as {
          toNumber?: string;
          fromNumberId?: string;
          messageBody?: string;
        };

        if (!toNumber || !messageBody) {
          return jsonResponse({ error: "To number and message body are required" }, 400);
        }

        let fromNumber: string | undefined;
        if (fromNumberId) {
          const { data: number } = await supabase
            .from("plivo_numbers")
            .select("phone_number")
            .eq("id", fromNumberId)
            .eq("org_id", orgId)
            .maybeSingle();
          if (!number) return jsonResponse({ error: "From number not found" }, 404);
          fromNumber = number.phone_number;
        }

        // plivo-sms-send falls back to default_sms_number_id when fromNumber is omitted
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const sendRes = await fetch(`${supabaseUrl}/functions/v1/plivo-sms-send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            orgId,
            toNumber,
            fromNumber,
            body: messageBody,
            metadata: { source: "test" },
          }),
        });
        const result = await sendRes.json();

        await supabase.from("phone_test_logs").insert({
          org_id: orgId,
          test_type: "sms",
          to_number: toNumber,
          from_number: fromNumber || "(default)",
          message_body: messageBody,
          status: sendRes.ok ? "sent" : "failed",
          provider_uuid: result.plivoMessageUuid || null,
          error_message: sendRes.ok ? null : result.error,
          tested_by: user.id,
        });

        if (!sendRes.ok) {
          return jsonResponse({ error: result.error || "Send failed", details: result }, 400);
        }
        return jsonResponse({
          success: true,
          messageId: result.messageId,
          plivoMessageUuid: result.plivoMessageUuid,
        });
      }

      case "call": {
        // Voice always routes through Vapi. Test calls should be initiated
        // by triggering a Vapi assistant directly via the Vapi dashboard or
        // the vapi-client edge function (action: create_outbound_call).
        return jsonResponse({
          error:
            "Voice tests now run through Vapi. Use the Vapi dashboard or the vapi-client create_outbound_call action to place a test call.",
        }, 400);
      }

      case "logs": {
        const { limit = 20 } = payload;
        const { data: logs, error } = await supabase
          .from("phone_test_logs")
          .select("*, tested_by_user:users!phone_test_logs_tested_by_fkey(id, name, email)")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ logs });
      }

      case "webhook-health": {
        const { data: health, error } = await supabase
          .from("webhook_health")
          .select("*")
          .eq("org_id", orgId);
        if (error) return jsonResponse({ error: error.message }, 500);

        const healthMap: Record<string, unknown> = {};
        for (const h of health || []) {
          const total = h.success_count + h.failure_count;
          healthMap[h.webhook_type] = {
            lastReceived: h.last_received_at,
            successCount: h.success_count,
            failureCount: h.failure_count,
            failureRate: total > 0 ? (h.failure_count / total) * 100 : 0,
            lastError: h.last_error,
            status: !h.last_received_at
              ? "never_received"
              : h.failure_count > h.success_count
              ? "degraded"
              : "healthy",
          };
        }
        return jsonResponse({ health: healthMap });
      }

      default:
        return jsonResponse({ error: "Invalid action" }, 400);
    }
  } catch (error) {
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
