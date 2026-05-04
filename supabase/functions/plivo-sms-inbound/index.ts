import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * plivo-sms-inbound — public webhook Plivo POSTs when a number receives SMS/MMS.
 *
 * Routing:
 *   1. Look up the receiving plivo_numbers row by the To number.
 *   2. Find/create the contact based on the From number.
 *   3. Find/create an open conversation between this contact and the org.
 *   4. Insert the message row (channel='sms' or 'mms' if media_urls present).
 *   5. Emit `message_received` and `social_inbox_message` style events into
 *      event_outbox so workflows fire.
 *   6. Branch on plivo_numbers.sms_route:
 *        'clara' → invoke Clara (assistant-chat) to compose a draft reply
 *                  AND auto-send it via plivo-sms-send.
 *        'user'  → just create the message in the user's inbox; no auto-reply.
 *                  A future enhancement could push a notification to the
 *                  assigned user.
 *
 * Plivo posts these form fields (subset):
 *   From, To, Text, MessageUUID, Type ('sms'|'mms'), MediaCount, Media0..N
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Plivo-Signature-V3, X-Plivo-Signature-V3-Nonce",
};

function emptyXmlResponse(): Response {
  return new Response('<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>', {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/xml" },
  });
}

function normalizeE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (phone.startsWith("+")) return phone;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
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

    const fromNumber = normalizeE164(params.From || "");
    const toNumber = normalizeE164(params.To || "");
    const text = params.Text || "";
    const messageUuid = params.MessageUUID || "";
    const mediaCount = parseInt(params.MediaCount || "0", 10);
    const mediaUrls: string[] = [];
    for (let i = 0; i < mediaCount; i++) {
      const url = params[`Media${i}`];
      if (url) mediaUrls.push(url);
    }

    if (!fromNumber || !toNumber) {
      console.error("plivo-sms-inbound: missing From/To", params);
      return emptyXmlResponse();
    }

    // Find the receiving Plivo number row
    const { data: numRow } = await supabase
      .from("plivo_numbers")
      .select("id, org_id, sms_route, assigned_user_id, department_id")
      .eq("phone_number", toNumber)
      .eq("status", "active")
      .maybeSingle();
    if (!numRow) {
      console.error(`plivo-sms-inbound: no active Plivo number for ${toNumber}`);
      return emptyXmlResponse();
    }
    const orgId = numRow.org_id;

    // Idempotency — reject duplicate MessageUUID
    if (messageUuid) {
      const { data: dupe } = await supabase
        .from("messages")
        .select("id")
        .eq("organization_id", orgId)
        .eq("external_id", messageUuid)
        .maybeSingle();
      if (dupe) return emptyXmlResponse();
    }

    // Find or create contact
    let contactId: string | null = null;
    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id, department_id, first_name")
      .eq("organization_id", orgId)
      .eq("phone", fromNumber)
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
          last_name: fromNumber,
          phone: fromNumber,
          source: "sms",
          status: "active",
        })
        .select("id, department_id, first_name")
        .single();
      contactId = newContact?.id || null;
    }
    if (!contactId) return emptyXmlResponse();

    // Find or create open conversation
    let conversationId: string | null = null;
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
          unread_count: 1,
        })
        .select("id")
        .single();
      conversationId = newConv?.id || null;
    }
    if (!conversationId) return emptyXmlResponse();

    // Insert the inbound message
    const channel = mediaUrls.length > 0 ? "mms" : "sms";
    const { data: insertedMsg } = await supabase
      .from("messages")
      .insert({
        organization_id: orgId,
        conversation_id: conversationId,
        contact_id: contactId,
        channel,
        direction: "inbound",
        body: text,
        media_urls: mediaUrls.length > 0 ? mediaUrls : null,
        status: "delivered",
        delivery_status: "delivered",
        external_id: messageUuid || null,
        sent_at: new Date().toISOString(),
        metadata: {
          provider: "plivo",
          from_number: fromNumber,
          to_number: toNumber,
          plivo_number_id: numRow.id,
          sms_route: numRow.sms_route,
          assigned_user_id: numRow.assigned_user_id,
        },
      })
      .select("id")
      .single();

    // Bump conversation activity + unread
    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        unread_count: 1,
      })
      .eq("id", conversationId);

    // Emit message_received event for workflows
    try {
      await supabase.from("event_outbox").insert({
        org_id: orgId,
        event_type: "message_received",
        contact_id: contactId,
        entity_type: "message",
        entity_id: insertedMsg?.id || messageUuid,
        payload: {
          message_id: insertedMsg?.id,
          channel,
          conversation_id: conversationId,
          from_number: fromNumber,
          to_number: toNumber,
          body: text,
          media_urls: mediaUrls,
          plivo_message_uuid: messageUuid,
        },
        processed_at: null,
      });
    } catch (e) {
      console.error("event_outbox emit failed", e);
    }

    // Routing: Clara replies automatically; user-owned numbers just sit in
    // the user's inbox.
    if (numRow.sms_route === "clara") {
      // Fire-and-forget invoke Clara to draft + send a reply.
      // We don't await the result so the webhook returns 200 to Plivo
      // promptly; Clara's response will be inserted as a separate
      // outbound message by plivo-sms-send.
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      // Best-effort, intentional non-blocking
      fetch(`${supabaseUrl}/functions/v1/assistant-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          orgId,
          contactId,
          conversationId,
          messageBody: text,
          channel,
          replyVia: "sms",
          replyConfig: {
            fromNumber: toNumber, // Clara replies from the same number that received
            toNumber: fromNumber,
            mediaUrls,
          },
        }),
      }).catch((e) => console.error("clara invoke failed", e));
    }

    return emptyXmlResponse();
  } catch (e) {
    console.error("plivo-sms-inbound error", e);
    return emptyXmlResponse();
  }
});
