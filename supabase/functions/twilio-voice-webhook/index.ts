import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  if (!phone.startsWith('+')) {
    return `+${digits}`;
  }
  return phone;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const formData = await req.formData();
    const callSid = formData.get("CallSid") as string;
    const from = normalizePhoneNumber(formData.get("From") as string);
    const to = normalizePhoneNumber(formData.get("To") as string);
    const callStatus = formData.get("CallStatus") as string;
    const direction = formData.get("Direction") as string;
    const duration = formData.get("CallDuration") as string | null;
    const recordingUrl = formData.get("RecordingUrl") as string | null;

    const isInbound = direction === "inbound";
    const contactPhone = isInbound ? from : to;
    const orgPhone = isInbound ? to : from;

    const { data: channelConfig } = await supabase
      .from("channel_configurations")
      .select("organization_id")
      .eq("channel_type", "twilio")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!channelConfig) {
      console.error("No Twilio configuration found");
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/xml" },
        }
      );
    }

    const orgId = channelConfig.organization_id;

    const { data: existingCallLog } = await supabase
      .from("call_logs")
      .select("id, conversation_id, contact_id")
      .eq("twilio_call_sid", callSid)
      .maybeSingle();

    if (existingCallLog) {
      const updateData: Record<string, unknown> = {
        status: callStatus,
      };

      if (duration) {
        updateData.duration = parseInt(duration, 10);
      }

      if (recordingUrl) {
        updateData.recording_url = recordingUrl;
      }

      await supabase
        .from("call_logs")
        .update(updateData)
        .eq("id", existingCallLog.id);

      if (callStatus === "completed" && duration) {
        await supabase.from("messages").insert({
          organization_id: orgId,
          conversation_id: existingCallLog.conversation_id,
          contact_id: existingCallLog.contact_id,
          channel: "voice",
          direction: isInbound ? "inbound" : "outbound",
          body: `Phone call ${isInbound ? "received" : "made"} - ${duration} seconds`,
          metadata: {
            call_sid: callSid,
            duration: parseInt(duration, 10),
            recording_url: recordingUrl,
          },
          status: "delivered",
          external_id: callSid,
        });

        await supabase
          .from("conversations")
          .update({
            last_message_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingCallLog.conversation_id);

        // Emit `call_completed` event for workflow triggers
        await emitCallEvent(supabase, {
          orgId,
          eventType: "call_completed",
          contactId: existingCallLog.contact_id,
          callSid,
          direction: isInbound ? "inbound" : "outbound",
          callStatus,
          fromNumber: from,
          toNumber: to,
          durationSeconds: parseInt(duration, 10),
          recordingUrl: recordingUrl || null,
        });
      } else if (
        isInbound &&
        ["no-answer", "busy", "failed", "canceled"].includes(callStatus)
      ) {
        // Inbound call that we did not pick up → missed_call
        await emitCallEvent(supabase, {
          orgId,
          eventType: "missed_call",
          contactId: existingCallLog.contact_id,
          callSid,
          direction: "inbound",
          callStatus,
          fromNumber: from,
          toNumber: to,
          durationSeconds: duration ? parseInt(duration, 10) : 0,
          recordingUrl: null,
        });
      }

      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/xml" },
        }
      );
    }

    let contact = null;
    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id, department_id, first_name, last_name")
      .eq("organization_id", orgId)
      .eq("phone", contactPhone)
      .eq("status", "active")
      .maybeSingle();

    if (existingContact) {
      contact = existingContact;
    } else {
      const { data: defaultDept } = await supabase
        .from("departments")
        .select("id")
        .eq("organization_id", orgId)
        .limit(1)
        .maybeSingle();

      const { data: newContact } = await supabase
        .from("contacts")
        .insert({
          organization_id: orgId,
          department_id: defaultDept?.id,
          first_name: "Unknown",
          last_name: contactPhone,
          phone: contactPhone,
          source: "voice",
          status: "active",
        })
        .select("id, department_id, first_name, last_name")
        .single();

      contact = newContact;
    }

    if (!contact) {
      throw new Error("Failed to find or create contact");
    }

    let conversation = null;
    const { data: existingConversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("organization_id", orgId)
      .eq("contact_id", contact.id)
      .neq("status", "closed")
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingConversation) {
      conversation = existingConversation;
    } else {
      const { data: newConversation } = await supabase
        .from("conversations")
        .insert({
          organization_id: orgId,
          contact_id: contact.id,
          department_id: contact.department_id,
          status: "open",
          unread_count: 0,
        })
        .select()
        .single();

      conversation = newConversation;

      await supabase.from("inbox_events").insert({
        organization_id: orgId,
        conversation_id: conversation.id,
        event_type: "conversation_created",
        payload: { channel: "voice", contact_name: `${contact.first_name} ${contact.last_name}` },
      });
    }

    await supabase.from("call_logs").insert({
      organization_id: orgId,
      conversation_id: conversation.id,
      contact_id: contact.id,
      twilio_call_sid: callSid,
      direction: isInbound ? "inbound" : "outbound",
      from_number: from,
      to_number: to,
      status: callStatus,
    });

    await supabase.from("contact_timeline").insert({
      contact_id: contact.id,
      event_type: isInbound ? "call_received" : "call_made",
      event_data: {
        call_sid: callSid,
        status: callStatus,
        from: from,
        to: to,
      },
    });

    // Emit `inbound_call` for workflow triggers (initial ring of an inbound call)
    if (isInbound) {
      await emitCallEvent(supabase, {
        orgId,
        eventType: "inbound_call",
        contactId: contact.id,
        callSid,
        direction: "inbound",
        callStatus,
        fromNumber: from,
        toNumber: to,
        durationSeconds: 0,
        recordingUrl: null,
      });
    }

    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      }
    );
  } catch (error) {
    console.error("Twilio voice webhook error:", error);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      }
    );
  }
});

/**
 * Emit a workflow event into event_outbox so any workflow whose trigger
 * matches `eventType` (missed_call, inbound_call, call_completed) fires.
 *
 * Idempotent per event_type+entity_id (call_sid).
 */
async function emitCallEvent(
  supabase: ReturnType<typeof createClient>,
  args: {
    orgId: string;
    eventType: "missed_call" | "inbound_call" | "call_completed";
    contactId: string | null;
    callSid: string;
    direction: "inbound" | "outbound";
    callStatus: string;
    fromNumber: string;
    toNumber: string;
    durationSeconds: number;
    recordingUrl: string | null;
  }
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from("event_outbox")
      .select("id")
      .eq("org_id", args.orgId)
      .eq("event_type", args.eventType)
      .eq("entity_id", args.callSid)
      .maybeSingle();

    if (existing) return;

    await supabase.from("event_outbox").insert({
      org_id: args.orgId,
      event_type: args.eventType,
      contact_id: args.contactId,
      entity_type: "call",
      entity_id: args.callSid,
      payload: {
        call_sid: args.callSid,
        direction: args.direction,
        call_status: args.callStatus,
        from_number: args.fromNumber,
        to_number: args.toNumber,
        duration_seconds: args.durationSeconds,
        recording_url: args.recordingUrl,
        emitted_at: new Date().toISOString(),
      },
      processed_at: null,
    });
  } catch (err) {
    console.error(`emitCallEvent (${args.eventType}) failed:`, err);
  }
}
