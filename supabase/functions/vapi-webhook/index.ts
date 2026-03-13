import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function getSupabase() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface VapiWebhookPayload {
  message: {
    type: string;
    call?: {
      id: string;
      assistantId?: string;
      phoneNumberId?: string;
      customer?: { number?: string };
      status?: string;
      startedAt?: string;
      endedAt?: string;
    };
    transcript?: string;
    summary?: string;
    recordingUrl?: string;
    artifact?: {
      transcript?: string;
      messages?: Array<{ role: string; content: string }>;
      recordingUrl?: string;
    };
    endedReason?: string;
    [key: string]: unknown;
  };
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const payload: VapiWebhookPayload = await req.json();
    const { message } = payload;
    const eventType = message.type;

    const supabase = getSupabase();

    const vapiAssistantId = message.call?.assistantId;
    let orgId: string | null = null;
    let internalAssistantId: string | null = null;

    if (vapiAssistantId) {
      const { data: assistant } = await supabase
        .from("vapi_assistants")
        .select("id, org_id")
        .eq("vapi_assistant_id", vapiAssistantId)
        .maybeSingle();

      if (assistant) {
        orgId = assistant.org_id;
        internalAssistantId = assistant.id;
      }
    }

    await supabase.from("vapi_webhook_logs").insert({
      org_id: orgId,
      event_type: eventType,
      vapi_call_id: message.call?.id || null,
      payload: message,
      processed: false,
    });

    const vapiCallId = message.call?.id;

    switch (eventType) {
      case "call.started":
      case "call-started": {
        if (!vapiCallId || !orgId) break;

        const { data: existing } = await supabase
          .from("vapi_calls")
          .select("id")
          .eq("vapi_call_id", vapiCallId)
          .maybeSingle();

        if (!existing) {
          await supabase.from("vapi_calls").insert({
            org_id: orgId,
            assistant_id: internalAssistantId,
            vapi_call_id: vapiCallId,
            direction: "inbound",
            status: "in-progress",
            from_number: message.call?.customer?.number || null,
            to_number: null,
            started_at: message.call?.startedAt || new Date().toISOString(),
            metadata: { source: "webhook" },
          });
        } else {
          await supabase
            .from("vapi_calls")
            .update({
              status: "in-progress",
              started_at: message.call?.startedAt || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("vapi_call_id", vapiCallId);
        }
        break;
      }

      case "call.ended":
      case "end-of-call-report": {
        if (!vapiCallId) break;

        const transcript = message.artifact?.transcript || message.transcript || null;
        const summary = message.summary || null;
        const endedAt = message.call?.endedAt || new Date().toISOString();
        const startedAt = message.call?.startedAt;

        let durationSeconds: number | null = null;
        if (startedAt && endedAt) {
          durationSeconds = Math.round(
            (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
          );
        }

        await supabase
          .from("vapi_calls")
          .update({
            status: "completed",
            ended_at: endedAt,
            duration_seconds: durationSeconds,
            transcript,
            summary,
            metadata: {
              ended_reason: message.endedReason || null,
              recording_url: message.artifact?.recordingUrl || message.recordingUrl || null,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("vapi_call_id", vapiCallId);

        await supabase
          .from("vapi_webhook_logs")
          .update({ processed: true })
          .eq("vapi_call_id", vapiCallId)
          .eq("event_type", eventType);

        break;
      }

      case "status-update": {
        if (!vapiCallId) break;
        const newStatus = message.call?.status;
        if (newStatus) {
          await supabase
            .from("vapi_calls")
            .update({
              status: newStatus,
              updated_at: new Date().toISOString(),
            })
            .eq("vapi_call_id", vapiCallId);
        }
        break;
      }

      case "transcript": {
        break;
      }

      case "speech-update": {
        break;
      }

      case "hang": {
        if (vapiCallId) {
          await supabase
            .from("vapi_calls")
            .update({
              status: "completed",
              ended_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("vapi_call_id", vapiCallId);
        }
        break;
      }

      default: {
        console.log(`[vapi-webhook] Unhandled event type: ${eventType}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[vapi-webhook] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
