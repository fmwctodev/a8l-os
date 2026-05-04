import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * plivo-sms-status — Plivo SMS delivery status callback.
 *
 * Plivo posts (form): MessageUUID, Status, To, From, ParentMessageUUID,
 * PartInfo, ErrorCode, Units, etc.
 *
 * We map Plivo statuses onto our messages.delivery_status column. The
 * existing messaging_error DB trigger fires on the failure values
 * (failed/undelivered/rejected) so workflow triggers run automatically.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Plivo-Signature-V3, X-Plivo-Signature-V3-Nonce",
};

const STATUS_MAP: Record<string, string> = {
  queued: "queued",
  sent: "sent",
  delivered: "delivered",
  undelivered: "undelivered",
  failed: "failed",
  rejected: "rejected",
};

function emptyXml(): Response {
  return new Response('<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>', {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/xml" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const formData = await req.formData();
    const messageUuid = formData.get("MessageUUID")?.toString() || "";
    const plivoStatus = (formData.get("Status")?.toString() || "").toLowerCase();
    const errorCode = formData.get("ErrorCode")?.toString() || null;
    const units = formData.get("Units")?.toString() || null;

    if (!messageUuid) return emptyXml();

    const mappedStatus = STATUS_MAP[plivoStatus] || plivoStatus;

    await supabase
      .from("messages")
      .update({
        delivery_status: mappedStatus,
        status: mappedStatus === "delivered" ? "delivered" : mappedStatus,
        metadata: {
          plivo_status: plivoStatus,
          plivo_error_code: errorCode,
          plivo_units: units,
          updated_at: new Date().toISOString(),
        },
      })
      .eq("external_id", messageUuid);

    return emptyXml();
  } catch (e) {
    console.error("plivo-sms-status error", e);
    return emptyXml();
  }
});
