import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateWebhookPayload {
  action: "create";
  name: string;
  url: string;
  events: string[];
  headers?: Record<string, string>;
  retry_count?: number;
}

interface TestWebhookPayload {
  action: "test";
  webhook_id: string;
}

type RequestPayload = CreateWebhookPayload | TestWebhookPayload;

function generateSigningSecret(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, messageData);
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, organization_id, role:roles(name)")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const roleName = (userData.role as { name: string })?.name;
    if (!["SuperAdmin", "Admin"].includes(roleName)) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload: RequestPayload = await req.json();

    if (payload.action === "create") {
      const { name, url, events, headers, retry_count } = payload;

      if (!name || !url || !events?.length) {
        return new Response(
          JSON.stringify({ error: "Name, URL, and events are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        new URL(url);
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid URL format" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const signingSecret = generateSigningSecret();
      const iv = crypto.randomUUID().replace(/-/g, "").slice(0, 32);

      const { data: webhook, error: createError } = await serviceClient
        .from("outgoing_webhooks")
        .insert({
          org_id: userData.organization_id,
          name,
          url,
          events,
          headers: headers || {},
          signing_secret_encrypted: signingSecret,
          signing_secret_iv: iv,
          retry_count: retry_count || 3,
          enabled: true,
          created_by: user.id,
        })
        .select()
        .single();

      if (createError) throw createError;

      return new Response(
        JSON.stringify({ ...webhook, signing_secret: signingSecret }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.action === "test") {
      const { webhook_id } = payload;

      const { data: webhook, error: webhookError } = await serviceClient
        .from("outgoing_webhooks")
        .select("*")
        .eq("id", webhook_id)
        .eq("org_id", userData.organization_id)
        .single();

      if (webhookError || !webhook) {
        return new Response(
          JSON.stringify({ error: "Webhook not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const testPayload = {
        event_type: "test",
        timestamp: new Date().toISOString(),
        data: {
          message: "This is a test webhook delivery",
          webhook_id: webhook.id,
          webhook_name: webhook.name,
        },
      };

      const payloadString = JSON.stringify(testPayload);
      const signature = await signPayload(payloadString, webhook.signing_secret_encrypted);

      const webhookHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Timestamp": new Date().toISOString(),
        ...(webhook.headers || {}),
      };

      try {
        const response = await fetch(webhook.url, {
          method: "POST",
          headers: webhookHeaders,
          body: payloadString,
        });

        await serviceClient.from("webhook_deliveries").insert({
          webhook_id: webhook.id,
          org_id: userData.organization_id,
          event_type: "test",
          payload: testPayload,
          status: response.ok ? "delivered" : "failed",
          response_code: response.status,
          response_body: await response.text().catch(() => null),
          attempts: 1,
          delivered_at: response.ok ? new Date().toISOString() : null,
        });

        return new Response(
          JSON.stringify({
            success: response.ok,
            response_code: response.status,
            error: response.ok ? undefined : `HTTP ${response.status}`,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        await serviceClient.from("webhook_deliveries").insert({
          webhook_id: webhook.id,
          org_id: userData.organization_id,
          event_type: "test",
          payload: testPayload,
          status: "failed",
          response_body: error.message,
          attempts: 1,
        });

        return new Response(
          JSON.stringify({
            success: false,
            error: error.message || "Failed to deliver webhook",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in integrations-webhooks:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
