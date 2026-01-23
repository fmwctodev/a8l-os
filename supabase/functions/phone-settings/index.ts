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
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!userData?.organization_id) {
      return new Response(JSON.stringify({ error: "User not associated with organization" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = userData.organization_id;
    const { action, ...payload } = await req.json();

    switch (action) {
      case "get": {
        const { data: settings } = await supabase
          .from("phone_settings")
          .select(`
            *,
            default_sms_number:twilio_numbers!phone_settings_default_sms_number_id_fkey(id, phone_number, friendly_name),
            default_voice_number:twilio_numbers!phone_settings_default_voice_number_id_fkey(id, phone_number, friendly_name),
            default_messaging_service:twilio_messaging_services(id, name, service_sid),
            default_routing_group:voice_routing_groups(id, name)
          `)
          .eq("org_id", orgId)
          .maybeSingle();

        const { data: connection } = await supabase
          .from("twilio_connection")
          .select("id, account_sid, status, connected_at, friendly_name")
          .eq("org_id", orgId)
          .maybeSingle();

        const { count: numberCount } = await supabase
          .from("twilio_numbers")
          .select("*", { count: "exact", head: true })
          .eq("org_id", orgId)
          .eq("status", "active");

        const { data: webhookHealth } = await supabase
          .from("webhook_health")
          .select("*")
          .eq("org_id", orgId);

        const blockingReasons = [];
        if (!connection || connection.status !== "connected") {
          blockingReasons.push("Twilio not connected");
        }
        if (!numberCount || numberCount === 0) {
          blockingReasons.push("No phone numbers configured");
        }

        return new Response(JSON.stringify({
          settings,
          connection: connection ? {
            id: connection.id,
            accountSid: connection.account_sid,
            status: connection.status,
            connectedAt: connection.connected_at,
            friendlyName: connection.friendly_name,
          } : null,
          numberCount: numberCount || 0,
          webhookHealth,
          isConfigured: blockingReasons.length === 0,
          blockingReasons,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update": {
        const {
          defaultSmsMode,
          defaultSmsNumberId,
          defaultMessagingServiceId,
          defaultVoiceNumberId,
          defaultRoutingGroupId,
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

        const updateData: any = {};

        if (defaultSmsMode !== undefined) updateData.default_sms_mode = defaultSmsMode;
        if (defaultSmsNumberId !== undefined) updateData.default_sms_number_id = defaultSmsNumberId || null;
        if (defaultMessagingServiceId !== undefined) updateData.default_messaging_service_id = defaultMessagingServiceId || null;
        if (defaultVoiceNumberId !== undefined) updateData.default_voice_number_id = defaultVoiceNumberId || null;
        if (defaultRoutingGroupId !== undefined) updateData.default_routing_group_id = defaultRoutingGroupId || null;
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

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, settings: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get-status": {
        const { data: connection } = await supabase
          .from("twilio_connection")
          .select("status")
          .eq("org_id", orgId)
          .maybeSingle();

        const { count: activeNumbers } = await supabase
          .from("twilio_numbers")
          .select("*", { count: "exact", head: true })
          .eq("org_id", orgId)
          .eq("status", "active");

        const { data: settings } = await supabase
          .from("phone_settings")
          .select("default_sms_mode, default_sms_number_id, default_messaging_service_id, default_voice_number_id")
          .eq("org_id", orgId)
          .maybeSingle();

        const { data: webhookHealth } = await supabase
          .from("webhook_health")
          .select("webhook_type, last_received_at, failure_count")
          .eq("org_id", orgId);

        const isConnected = connection?.status === "connected";
        const hasNumbers = (activeNumbers || 0) > 0;
        const hasDefaultSms = settings?.default_sms_mode === "messaging_service"
          ? !!settings?.default_messaging_service_id
          : !!settings?.default_sms_number_id;

        const blockingReasons = [];
        if (!isConnected) blockingReasons.push("Twilio not connected");
        if (!hasNumbers) blockingReasons.push("No active phone numbers");
        if (!hasDefaultSms) blockingReasons.push("No default SMS sender configured");

        return new Response(JSON.stringify({
          isConfigured: blockingReasons.length === 0,
          isConnected,
          activeNumbers: activeNumbers || 0,
          hasDefaultSms,
          hasDefaultVoice: !!settings?.default_voice_number_id,
          webhookHealth,
          blockingReasons,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
