import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * plivo-voice-answer — public webhook Plivo POSTs when one of our numbers
 * receives an inbound call. Returns Plivo XML that dials a SIP URI for the
 * Vapi assistant bound 1:1 to the called number.
 *
 * Plivo posts (form): CallUUID, From, To, CallStatus, Direction, etc.
 *
 * Side effects:
 *   - Look up the receiving plivo_numbers row + its vapi_assistant_id.
 *   - Find/create the contact + open conversation (parity with the SMS path
 *     so the Vapi-handled call shows up in the same inbox).
 *   - Insert a placeholder call_logs row keyed by plivo_call_uuid.
 *   - Emit `inbound_call` event into event_outbox so workflows fire.
 *   - Return Plivo XML <Response><Dial><User>sip:&lt;assistant&gt;@sip.vapi.ai</User></Dial></Response>.
 *     If no assistant is bound, return a polite voicemail message instead.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Plivo-Signature-V3, X-Plivo-Signature-V3-Nonce",
};

function xmlResponse(body: string, status = 200): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<Response>${body}</Response>`, {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/xml" },
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (phone.startsWith("+")) return phone;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function buildVapiSipUri(vapiAssistantId: string): string {
  return `sip:${vapiAssistantId}@sip.vapi.ai`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    const formData = await req.formData();
    const params: Record<string, string> = {};
    for (const [k, v] of formData.entries()) params[k] = v.toString();

    const callUuid = params.CallUUID || "";
    const from = normalizeE164(params.From || "");
    const to = normalizeE164(params.To || "");
    const direction = (params.Direction || "inbound").toLowerCase();

    if (!from || !to) {
      console.error("plivo-voice-answer: missing From/To", params);
      return xmlResponse("<Hangup/>");
    }

    // Look up the called number + the Vapi assistant bound to it
    const { data: numRow } = await supabase
      .from("plivo_numbers")
      .select(`
        id, org_id, phone_number, department_id, vapi_assistant_id,
        vapi_assistant:vapi_assistants!vapi_assistant_id(id, vapi_assistant_id, name)
      `)
      .eq("phone_number", to)
      .eq("status", "active")
      .maybeSingle();

    if (!numRow) {
      console.error(`plivo-voice-answer: no active number for ${to}`);
      return xmlResponse(`<Speak voice="Polly.Joanna">This number is not currently in service.</Speak><Hangup/>`);
    }

    const orgId = numRow.org_id;
    const assistant = (numRow as { vapi_assistant?: { vapi_assistant_id?: string; name?: string } }).vapi_assistant;
    const sipAssistantId = assistant?.vapi_assistant_id;

    // Resolve / create contact based on caller number
    let contactId: string | null = null;
    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id, department_id")
      .eq("organization_id", orgId)
      .eq("phone", from)
      .eq("status", "active")
      .maybeSingle();

    if (existingContact) {
      contactId = existingContact.id;
    } else {
      const { data: newContact } = await supabase
        .from("contacts")
        .insert({
          organization_id: orgId,
          department_id: numRow.department_id,
          first_name: "Unknown",
          last_name: from,
          phone: from,
          source: "voice",
          status: "active",
        })
        .select("id")
        .single();
      contactId = newContact?.id || null;
    }

    // Find or create open conversation
    let conversationId: string | null = null;
    if (contactId) {
      const { data: openConv } = await supabase
        .from("conversations")
        .select("id")
        .eq("organization_id", orgId)
        .eq("contact_id", contactId)
        .neq("status", "closed")
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (openConv) {
        conversationId = openConv.id;
      } else {
        const { data: newConv } = await supabase
          .from("conversations")
          .insert({
            organization_id: orgId,
            contact_id: contactId,
            department_id: numRow.department_id,
            status: "open",
            unread_count: 0,
          })
          .select("id")
          .single();
        conversationId = newConv?.id || null;
      }
    }

    // Idempotency — only insert call_logs row once per CallUUID
    if (callUuid) {
      const { data: dupe } = await supabase
        .from("call_logs")
        .select("id")
        .eq("plivo_call_uuid", callUuid)
        .maybeSingle();
      if (!dupe) {
        await supabase.from("call_logs").insert({
          organization_id: orgId,
          conversation_id: conversationId,
          contact_id: contactId,
          plivo_call_uuid: callUuid,
          direction,
          from_number: from,
          to_number: to,
          status: "ringing",
        });
      }
    }

    // Emit inbound_call event_outbox (workflow-processor consumes)
    try {
      await supabase.from("event_outbox").insert({
        org_id: orgId,
        event_type: "inbound_call",
        contact_id: contactId,
        entity_type: "call",
        entity_id: callUuid,
        payload: {
          call_uuid: callUuid,
          direction: "inbound",
          from_number: from,
          to_number: to,
          plivo_number_id: numRow.id,
          vapi_assistant_id: numRow.vapi_assistant_id,
          assistant_name: assistant?.name || null,
        },
        processed_at: null,
      });
    } catch (e) {
      console.error("event_outbox emit failed", e);
    }

    // Without a Vapi assistant bound, we can't route the call — give the
    // caller a graceful message instead of dropping.
    if (!sipAssistantId) {
      return xmlResponse(
        `<Speak voice="Polly.Joanna">Thanks for calling. No agent is currently configured for this number. Please send a text message and we'll get back to you.</Speak><Hangup/>`
      );
    }

    // Forward the call to the assigned Vapi assistant via SIP
    const sipUri = buildVapiSipUri(sipAssistantId);
    return xmlResponse(
      `<Dial callerId="${escapeXml(from)}" timeout="30"><User>${escapeXml(sipUri)}</User></Dial>`
    );
  } catch (e) {
    console.error("plivo-voice-answer error", e);
    return xmlResponse("<Hangup/>");
  }
});
