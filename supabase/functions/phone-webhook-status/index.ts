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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const formData = await req.formData();
    const body: Record<string, string> = {};
    formData.forEach((value, key) => {
      body[key] = value.toString();
    });

    const {
      AccountSid,
      MessageSid,
      MessageStatus,
      CallSid,
      CallStatus,
      CallDuration,
      RecordingUrl,
      RecordingSid,
      RecordingDuration,
      TranscriptionText,
      ErrorCode,
      ErrorMessage,
      From,
      To,
    } = body;

    const isMessage = !!MessageSid;
    const isCall = !!CallSid && !MessageSid;
    const isRecording = !!RecordingSid;

    const phoneNumber = To || From;
    const { data: number } = await supabase
      .from("twilio_numbers")
      .select("org_id")
      .or(`phone_number.eq.${phoneNumber},phone_number.eq.${From}`)
      .maybeSingle();

    if (number?.org_id) {
      await supabase
        .from("webhook_health")
        .upsert({
          org_id: number.org_id,
          webhook_type: "status",
          last_received_at: new Date().toISOString(),
        }, { onConflict: "org_id,webhook_type" });
    }

    if (isMessage && MessageSid) {
      const { data: message } = await supabase
        .from("messages")
        .select("id, organization_id")
        .eq("external_id", MessageSid)
        .maybeSingle();

      if (message) {
        const statusMap: Record<string, string> = {
          queued: "pending",
          sending: "pending",
          sent: "sent",
          delivered: "delivered",
          undelivered: "failed",
          failed: "failed",
        };

        await supabase
          .from("messages")
          .update({
            status: statusMap[MessageStatus] || MessageStatus,
            metadata: supabase.rpc("jsonb_set_key", {
              target: "metadata",
              key: "deliveryStatus",
              value: JSON.stringify({
                status: MessageStatus,
                errorCode: ErrorCode,
                errorMessage: ErrorMessage,
                updatedAt: new Date().toISOString(),
              }),
            }),
          })
          .eq("id", message.id);
      }
    }

    if (isCall && CallSid) {
      const { data: callLog } = await supabase
        .from("call_logs")
        .select("id, organization_id")
        .eq("call_sid", CallSid)
        .maybeSingle();

      if (callLog) {
        const updateData: Record<string, any> = {
          status: CallStatus,
        };

        if (CallDuration) {
          updateData.duration = parseInt(CallDuration, 10);
        }

        if (RecordingUrl) {
          updateData.recording_url = RecordingUrl;
          updateData.recording_duration = RecordingDuration ? parseInt(RecordingDuration, 10) : null;
        }

        await supabase
          .from("call_logs")
          .update(updateData)
          .eq("id", callLog.id);
      }
    }

    if (isRecording && CallSid) {
      const { data: callLog } = await supabase
        .from("call_logs")
        .select("id")
        .eq("call_sid", CallSid)
        .maybeSingle();

      if (callLog) {
        const updateData: Record<string, any> = {
          recording_url: RecordingUrl,
          recording_sid: RecordingSid,
        };

        if (RecordingDuration) {
          updateData.recording_duration = parseInt(RecordingDuration, 10);
        }

        if (TranscriptionText) {
          updateData.transcription = TranscriptionText;
        }

        await supabase
          .from("call_logs")
          .update(updateData)
          .eq("id", callLog.id);
      }
    }

    return new Response("OK", {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Status webhook error:", error);

    return new Response("OK", {
      status: 200,
      headers: corsHeaders,
    });
  }
});
