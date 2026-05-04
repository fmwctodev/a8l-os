import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * plivo-sms-send — outbound SMS / MMS via Plivo.
 *
 * Body:
 *   {
 *     orgId: string,
 *     contactId?: string,
 *     conversationId?: string,
 *     fromNumber?: string,         // E.164; if omitted uses default_sms_number_id
 *     toNumber: string,
 *     body: string,
 *     mediaUrls?: string[],        // MMS — array of public URLs
 *     metadata?: Record<string, unknown>,
 *   }
 *
 * Either trusted service-role auth (workflow processor / clara replies) or
 * authenticated user. Writes a `messages` row, calls Plivo REST, then
 * updates the row with the returned message UUID and provisional status.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ENCRYPTION_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.slice(0, 32);

async function decrypt(encryptedText: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32));
  const key = await crypto.subtle.importKey("raw", keyData, { name: "AES-GCM" }, false, ["decrypt"]);
  const combined = Uint8Array.from(atob(encryptedText), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = await req.json();
    const orgId = body.orgId as string;
    const toNumber = body.toNumber as string;
    const text = body.body as string;
    const mediaUrls = (body.mediaUrls as string[]) || [];
    const contactId = (body.contactId as string) || null;
    const conversationId = (body.conversationId as string) || null;
    const metadata = (body.metadata as Record<string, unknown>) || {};

    if (!orgId || !toNumber || !text) {
      return jsonResponse({ error: "orgId, toNumber, body required" }, 400);
    }

    const { data: conn } = await supabase
      .from("plivo_connection")
      .select("auth_id, auth_token_encrypted, status")
      .eq("org_id", orgId)
      .maybeSingle();
    if (!conn || conn.status !== "connected") {
      return jsonResponse({ error: "Plivo not connected" }, 400);
    }

    // Resolve the from number — explicit > default for the org
    let fromNumber = body.fromNumber as string | undefined;
    if (!fromNumber) {
      const { data: settings } = await supabase
        .from("phone_settings")
        .select("default_sms_number_id")
        .eq("org_id", orgId)
        .maybeSingle();
      if (settings?.default_sms_number_id) {
        const { data: defNum } = await supabase
          .from("plivo_numbers")
          .select("phone_number")
          .eq("id", settings.default_sms_number_id)
          .maybeSingle();
        fromNumber = defNum?.phone_number;
      }
    }
    if (!fromNumber) {
      // Fall back to first active SMS-capable number in the org
      const { data: anyNum } = await supabase
        .from("plivo_numbers")
        .select("phone_number")
        .eq("org_id", orgId)
        .eq("status", "active")
        .order("is_default_sms", { ascending: false })
        .limit(1)
        .maybeSingle();
      fromNumber = anyNum?.phone_number;
    }
    if (!fromNumber) {
      return jsonResponse({ error: "No available SMS-capable Plivo number" }, 400);
    }

    // Insert pending message row first so we have an id to update with the
    // Plivo MessageUUID once the send completes.
    const { data: msgRow, error: msgErr } = await supabase
      .from("messages")
      .insert({
        organization_id: orgId,
        conversation_id: conversationId,
        contact_id: contactId,
        channel: mediaUrls.length > 0 ? "mms" : "sms",
        direction: "outbound",
        body: text,
        media_urls: mediaUrls.length > 0 ? mediaUrls : null,
        status: "queued",
        delivery_status: "queued",
        metadata: { ...metadata, from_number: fromNumber, to_number: toNumber, provider: "plivo" },
        sent_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (msgErr) return jsonResponse({ error: msgErr.message }, 500);

    const authToken = await decrypt(conn.auth_token_encrypted);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const callbackUrl = `${supabaseUrl}/functions/v1/plivo-sms-status`;

    const reqBody: Record<string, unknown> = {
      src: fromNumber,
      dst: toNumber,
      text,
      url: callbackUrl,
      method: "POST",
      log: true,
    };
    if (mediaUrls.length > 0) {
      reqBody.media_urls = mediaUrls;
      reqBody.type = "mms";
    }

    const plivoRes = await fetch(`https://api.plivo.com/v1/Account/${conn.auth_id}/Message/`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${conn.auth_id}:${authToken}`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reqBody),
    });

    const plivoData = await plivoRes.json().catch(() => ({}));

    if (!plivoRes.ok) {
      await supabase
        .from("messages")
        .update({
          status: "failed",
          delivery_status: "failed",
          metadata: { ...metadata, plivo_error: plivoData },
        })
        .eq("id", msgRow.id);
      return jsonResponse({ error: "Plivo send failed", details: plivoData }, plivoRes.status);
    }

    const messageUuid = (plivoData.message_uuid && plivoData.message_uuid[0]) || null;
    await supabase
      .from("messages")
      .update({
        status: "sent",
        delivery_status: "sent",
        external_id: messageUuid,
      })
      .eq("id", msgRow.id);

    return jsonResponse({
      success: true,
      messageId: msgRow.id,
      plivoMessageUuid: messageUuid,
    });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
