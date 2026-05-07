import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyMailgunWebhookSignature } from "../_shared/mailgun.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

interface MailgunSignaturePayload {
  timestamp: string;
  token: string;
  signature: string;
}

interface MailgunEventDataPayload {
  event?: string;
  id?: string;
  recipient?: string;
  reason?: string;
  severity?: string;
  message?: {
    headers?: {
      "message-id"?: string;
      to?: string;
      from?: string;
      subject?: string;
    };
  };
  "delivery-status"?: {
    code?: number;
    description?: string;
    message?: string;
  };
  tags?: string[];
}

interface MailgunWebhookPayload {
  signature: MailgunSignaturePayload;
  "event-data": MailgunEventDataPayload;
}

const MAX_AGE_SECONDS = 15 * 60;

async function decryptOrgSigningKey(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceRoleKey: string,
  encrypted: string,
  iv: string,
): Promise<string | null> {
  const response = await fetch(`${supabaseUrl}/functions/v1/email-crypto`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "decrypt", encrypted, iv }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  try {
    const parsed = JSON.parse(data.plaintext);
    return typeof parsed.webhook_signing_key === "string" && parsed.webhook_signing_key.length > 0
      ? parsed.webhook_signing_key
      : null;
  } catch {
    return null;
  }
}

async function findVerifiedOrg(
  payload: MailgunWebhookPayload,
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<{ orgId: string | null; signingKey: string | null }> {
  // Try platform-level signing key first
  const platformKey = Deno.env.get("MAILGUN_WEBHOOK_SIGNING_KEY");
  if (platformKey) {
    const ok = await verifyMailgunWebhookSignature(
      payload.signature.timestamp,
      payload.signature.token,
      payload.signature.signature,
      platformKey,
    );
    if (ok) return { orgId: null, signingKey: platformKey };
  }

  // Otherwise iterate connected Mailgun integration_connections and try each
  // org's signing key. We accept the first match.
  const { data: integration } = await supabase
    .from("integrations")
    .select("id")
    .eq("key", "mailgun")
    .maybeSingle();

  if (!integration) return { orgId: null, signingKey: null };

  const { data: conns } = await supabase
    .from("integration_connections")
    .select("org_id, credentials_encrypted, credentials_iv")
    .eq("integration_id", integration.id)
    .eq("status", "connected")
    .not("credentials_encrypted", "is", null);

  for (const conn of conns ?? []) {
    if (!conn.credentials_encrypted || !conn.credentials_iv) continue;
    const signingKey = await decryptOrgSigningKey(
      supabase,
      supabaseUrl,
      serviceRoleKey,
      conn.credentials_encrypted,
      conn.credentials_iv,
    );
    if (!signingKey) continue;
    const ok = await verifyMailgunWebhookSignature(
      payload.signature.timestamp,
      payload.signature.token,
      payload.signature.signature,
      signingKey,
    );
    if (ok) return { orgId: conn.org_id as string, signingKey };
  }

  return { orgId: null, signingKey: null };
}

function extractMessageId(eventData: MailgunEventDataPayload): string | null {
  const headerId = eventData.message?.headers?.["message-id"];
  if (typeof headerId === "string" && headerId.length > 0) {
    return headerId.replace(/^<|>$/g, "");
  }
  return null;
}

async function handleEvent(
  supabase: ReturnType<typeof createClient>,
  orgId: string | null,
  eventData: MailgunEventDataPayload,
): Promise<void> {
  const event = eventData.event;
  const messageId = extractMessageId(eventData);
  if (!event || !messageId) return;

  const failureReason = eventData.reason ||
    eventData["delivery-status"]?.message ||
    eventData["delivery-status"]?.description ||
    null;

  // email_test_logs: track delivery success/failure status
  if (event === "delivered" || event === "failed" || event === "permanent_failure") {
    const updateBuilder = supabase
      .from("email_test_logs")
      .update({
        status: event === "delivered" ? "success" : "failed",
        error_message: event === "delivered" ? null : failureReason,
      })
      .eq("provider_message_id", messageId);
    if (orgId) updateBuilder.eq("org_id", orgId);
    await updateBuilder;
  }

  // proposal_signature_requests: track send_status
  if (event === "delivered") {
    const updateBuilder = supabase
      .from("proposal_signature_requests")
      .update({ send_status: "sent" })
      .eq("provider_message_id", messageId);
    await updateBuilder;
  } else if (event === "failed" || event === "permanent_failure") {
    const updateBuilder = supabase
      .from("proposal_signature_requests")
      .update({ send_status: "failed", send_error: failureReason })
      .eq("provider_message_id", messageId);
    await updateBuilder;
  }

  // report_email_queue: track delivery
  if (event === "delivered") {
    const updateBuilder = supabase
      .from("report_email_queue")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("provider_message_id", messageId);
    if (orgId) updateBuilder.eq("organization_id", orgId);
    await updateBuilder;
  } else if (event === "failed" || event === "permanent_failure") {
    const updateBuilder = supabase
      .from("report_email_queue")
      .update({ status: "failed", error: failureReason })
      .eq("provider_message_id", messageId);
    if (orgId) updateBuilder.eq("organization_id", orgId);
    await updateBuilder;
  }

  // messages (workflow-driven outbound emails) — update by external_id
  if (event === "delivered" || event === "failed" || event === "permanent_failure") {
    const updateBuilder = supabase
      .from("messages")
      .update({
        delivery_status: event === "delivered" ? "delivered" : "failed",
        status: event === "delivered" ? "sent" : "failed",
      })
      .eq("external_id", messageId);
    if (orgId) updateBuilder.eq("organization_id", orgId);
    await updateBuilder;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let payload: MailgunWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!payload.signature?.timestamp || !payload.signature?.token || !payload.signature?.signature) {
    return new Response(
      JSON.stringify({ error: "Missing signature fields" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Replay protection: signature timestamp must be within 15 minutes
  const tsSeconds = parseInt(payload.signature.timestamp, 10);
  if (!Number.isFinite(tsSeconds)) {
    return new Response(
      JSON.stringify({ error: "Invalid timestamp" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - tsSeconds) > MAX_AGE_SECONDS) {
    return new Response(
      JSON.stringify({ error: "Timestamp too old" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const verified = await findVerifiedOrg(payload, supabase, supabaseUrl, serviceRoleKey);
  if (!verified.signingKey) {
    return new Response(
      JSON.stringify({ error: "Signature verification failed" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    await handleEvent(supabase, verified.orgId, payload["event-data"]);
  } catch (e) {
    // Log but still return 200 — Mailgun retries on non-2xx and we don't want
    // to spam its retry queue if our DB has a transient hiccup.
    console.error("mailgun-webhook: handler error", e);
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
