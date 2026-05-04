import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * plivo-voice-status — call lifecycle / hangup callback from Plivo.
 *
 * Plivo posts these as form params:
 *   CallUUID, Event ('Hangup'|'Recording'|...),
 *   CallStatus ('completed'|'no-answer'|'busy'|'failed'|'canceled'),
 *   From, To, Duration, RecordingUrl, BillDuration, HangupCause, etc.
 *
 * We update the call_logs row keyed by plivo_call_uuid and emit the right
 * workflow events:
 *   - call_completed    — when CallStatus='completed' AND Duration>0
 *   - missed_call       — when CallStatus IN ('no-answer','busy','failed','canceled')
 *                         on inbound calls only
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Plivo-Signature-V3, X-Plivo-Signature-V3-Nonce",
};

function emptyXml(): Response {
  return new Response('<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>', {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/xml" },
  });
}

const MISSED_STATUSES = new Set(["no-answer", "busy", "failed", "canceled"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    const formData = await req.formData();
    const callUuid = formData.get("CallUUID")?.toString() || "";
    const callStatus = (formData.get("CallStatus")?.toString() || "").toLowerCase();
    const duration = parseInt(formData.get("Duration")?.toString() || "0", 10);
    const billDuration = parseInt(formData.get("BillDuration")?.toString() || "0", 10);
    const hangupCause = formData.get("HangupCause")?.toString() || null;
    const recordingUrl = formData.get("RecordingUrl")?.toString() || null;

    if (!callUuid) return emptyXml();

    const { data: callLog } = await supabase
      .from("call_logs")
      .select("id, organization_id, contact_id, conversation_id, direction, from_number, to_number")
      .eq("plivo_call_uuid", callUuid)
      .maybeSingle();

    if (!callLog) {
      console.warn(`plivo-voice-status: no call_logs row for ${callUuid}`);
      return emptyXml();
    }

    // Persist the final state on call_logs
    const updateRow: Record<string, unknown> = {
      status: callStatus,
    };
    if (duration > 0) updateRow.duration = duration;
    if (recordingUrl) updateRow.recording_url = recordingUrl;
    await supabase.from("call_logs").update(updateRow).eq("id", callLog.id);

    const orgId = callLog.organization_id;
    const isInbound = callLog.direction === "inbound";

    if (callStatus === "completed" && billDuration > 0) {
      // Insert a voice-message row for the inbox so the call shows up in
      // the contact's conversation thread alongside SMS.
      if (callLog.conversation_id) {
        await supabase.from("messages").insert({
          organization_id: orgId,
          conversation_id: callLog.conversation_id,
          contact_id: callLog.contact_id,
          channel: "voice",
          direction: callLog.direction,
          body: `Phone call ${isInbound ? "received" : "made"} - ${duration} seconds`,
          metadata: {
            provider: "plivo",
            call_uuid: callUuid,
            duration,
            bill_duration: billDuration,
            recording_url: recordingUrl,
          },
          status: "delivered",
          delivery_status: "delivered",
          external_id: callUuid,
          sent_at: new Date().toISOString(),
        });

        await supabase
          .from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", callLog.conversation_id);
      }

      await emitCallEvent(supabase, {
        orgId,
        eventType: "call_completed",
        contactId: callLog.contact_id,
        callUuid,
        direction: callLog.direction,
        callStatus,
        fromNumber: callLog.from_number,
        toNumber: callLog.to_number,
        duration,
        recordingUrl,
        hangupCause,
      });
    } else if (isInbound && MISSED_STATUSES.has(callStatus)) {
      await emitCallEvent(supabase, {
        orgId,
        eventType: "missed_call",
        contactId: callLog.contact_id,
        callUuid,
        direction: "inbound",
        callStatus,
        fromNumber: callLog.from_number,
        toNumber: callLog.to_number,
        duration,
        recordingUrl: null,
        hangupCause,
      });
    }

    return emptyXml();
  } catch (e) {
    console.error("plivo-voice-status error", e);
    return emptyXml();
  }
});

async function emitCallEvent(
  supabase: ReturnType<typeof createClient>,
  args: {
    orgId: string;
    eventType: "missed_call" | "inbound_call" | "call_completed";
    contactId: string | null;
    callUuid: string;
    direction: string;
    callStatus: string;
    fromNumber: string;
    toNumber: string;
    duration: number;
    recordingUrl: string | null;
    hangupCause: string | null;
  }
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from("event_outbox")
      .select("id")
      .eq("org_id", args.orgId)
      .eq("event_type", args.eventType)
      .eq("entity_id", args.callUuid)
      .maybeSingle();
    if (existing) return;

    await supabase.from("event_outbox").insert({
      org_id: args.orgId,
      event_type: args.eventType,
      contact_id: args.contactId,
      entity_type: "call",
      entity_id: args.callUuid,
      payload: {
        provider: "plivo",
        call_uuid: args.callUuid,
        direction: args.direction,
        call_status: args.callStatus,
        from_number: args.fromNumber,
        to_number: args.toNumber,
        duration_seconds: args.duration,
        recording_url: args.recordingUrl,
        hangup_cause: args.hangupCause,
        emitted_at: new Date().toISOString(),
      },
      processed_at: null,
    });
  } catch (e) {
    console.error(`emitCallEvent (${args.eventType}) failed`, e);
  }
}
