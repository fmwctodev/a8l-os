import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing authorization header" }, 401);

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
      case "get": {
        const { data: settings } = await supabase
          .from("phone_settings")
          .select(`
            *,
            default_sms_number:plivo_numbers!phone_settings_default_sms_number_id_fkey(id, phone_number, friendly_name),
            default_voice_number:plivo_numbers!phone_settings_default_voice_number_id_fkey(id, phone_number, friendly_name),
            default_routing_group:voice_routing_groups(id, name)
          `)
          .eq("org_id", orgId)
          .maybeSingle();

        const { data: connection } = await supabase
          .from("plivo_connection")
          .select("id, auth_id, status, connected_at, friendly_name")
          .eq("org_id", orgId)
          .maybeSingle();

        const { count: numberCount } = await supabase
          .from("plivo_numbers")
          .select("*", { count: "exact", head: true })
          .eq("org_id", orgId)
          .eq("status", "active");

        const { data: webhookHealth } = await supabase
          .from("webhook_health")
          .select("*")
          .eq("org_id", orgId);

        const blockingReasons: string[] = [];
        if (!connection || connection.status !== "connected") blockingReasons.push("Plivo not connected");
        if (!numberCount || numberCount === 0) blockingReasons.push("No phone numbers configured");

        return jsonResponse({
          settings,
          connection: connection
            ? {
                id: connection.id,
                authId: connection.auth_id,
                status: connection.status,
                connectedAt: connection.connected_at,
                friendlyName: connection.friendly_name,
              }
            : null,
          numberCount: numberCount || 0,
          webhookHealth,
          isConfigured: blockingReasons.length === 0,
          blockingReasons,
        });
      }

      case "update": {
        const {
          defaultSmsNumberId,
          defaultVoiceNumberId,
          defaultRoutingGroupId,
          inboundSmsRoute,
          callTimeout,
          voicemailFallbackNumber,
          recordInboundCalls,
          recordOutboundCalls,
          recordVoicemail,
          recordingRetentionDays,
          quietHoursEnabled,
          quietHoursStart,
          quietHoursEnd,
          quietHoursTimezone,
          businessName,
          optOutLanguage,
          autoAppendOptOut,
        } = payload;

        const updateData: Record<string, unknown> = {};
        if (defaultSmsNumberId !== undefined) updateData.default_sms_number_id = defaultSmsNumberId || null;
        if (defaultVoiceNumberId !== undefined) updateData.default_voice_number_id = defaultVoiceNumberId || null;
        if (defaultRoutingGroupId !== undefined) updateData.default_routing_group_id = defaultRoutingGroupId || null;
        if (inboundSmsRoute !== undefined) updateData.inbound_sms_route = inboundSmsRoute;
        if (callTimeout !== undefined) updateData.call_timeout = callTimeout;
        if (voicemailFallbackNumber !== undefined) updateData.voicemail_fallback_number = voicemailFallbackNumber || null;
        if (recordInboundCalls !== undefined) updateData.record_inbound_calls = recordInboundCalls;
        if (recordOutboundCalls !== undefined) updateData.record_outbound_calls = recordOutboundCalls;
        if (recordVoicemail !== undefined) updateData.record_voicemail = recordVoicemail;
        if (recordingRetentionDays !== undefined) updateData.recording_retention_days = recordingRetentionDays;
        if (quietHoursEnabled !== undefined) updateData.quiet_hours_enabled = quietHoursEnabled;
        if (quietHoursStart !== undefined) updateData.quiet_hours_start = quietHoursStart || null;
        if (quietHoursEnd !== undefined) updateData.quiet_hours_end = quietHoursEnd || null;
        if (quietHoursTimezone !== undefined) updateData.quiet_hours_timezone = quietHoursTimezone;
        if (businessName !== undefined) updateData.business_name = businessName || null;
        if (optOutLanguage !== undefined) updateData.opt_out_language = optOutLanguage;
        if (autoAppendOptOut !== undefined) updateData.auto_append_opt_out = autoAppendOptOut;

        const { data, error } = await supabase
          .from("phone_settings")
          .update(updateData)
          .eq("org_id", orgId)
          .select()
          .single();

        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ success: true, settings: data });
      }

      case "get-status": {
        const { data: connection } = await supabase
          .from("plivo_connection")
          .select("status")
          .eq("org_id", orgId)
          .maybeSingle();

        const { count: activeNumbers } = await supabase
          .from("plivo_numbers")
          .select("*", { count: "exact", head: true })
          .eq("org_id", orgId)
          .eq("status", "active");

        const { data: settings } = await supabase
          .from("phone_settings")
          .select("default_sms_number_id, default_voice_number_id, inbound_sms_route")
          .eq("org_id", orgId)
          .maybeSingle();

        const { data: webhookHealth } = await supabase
          .from("webhook_health")
          .select("webhook_type, last_received_at, failure_count")
          .eq("org_id", orgId);

        const isConnected = connection?.status === "connected";
        const hasNumbers = (activeNumbers || 0) > 0;
        const hasDefaultSms = !!settings?.default_sms_number_id;

        const blockingReasons: string[] = [];
        if (!isConnected) blockingReasons.push("Plivo not connected");
        if (!hasNumbers) blockingReasons.push("No active phone numbers");
        if (!hasDefaultSms) blockingReasons.push("No default SMS sender configured");

        return jsonResponse({
          isConfigured: blockingReasons.length === 0,
          isConnected,
          activeNumbers: activeNumbers || 0,
          hasDefaultSms,
          hasDefaultVoice: !!settings?.default_voice_number_id,
          inboundSmsRoute: settings?.inbound_sms_route || "clara",
          webhookHealth,
          blockingReasons,
        });
      }

      default:
        return jsonResponse({ error: "Invalid action" }, 400);
    }
  } catch (error) {
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
