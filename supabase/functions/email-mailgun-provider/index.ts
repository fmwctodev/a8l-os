import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  encryptMailgunCreds,
  getDecryptedMailgunCreds,
  validateMailgunCredentials,
  type MailgunRegion,
} from "../_shared/mailgun.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ConnectRequest {
  action: "connect";
  apiKey: string;
  domain: string;
  webhookSigningKey?: string;
  region?: MailgunRegion;
  nickname?: string;
}

interface TestRequest {
  action: "test";
}

interface DisconnectRequest {
  action: "disconnect";
}

interface StatusRequest {
  action: "status";
}

type RequestPayload = ConnectRequest | TestRequest | DisconnectRequest | StatusRequest;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid user token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!userData) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: hasPermission } = await supabase.rpc("user_has_email_permission", {
      user_id: user.id,
      required_permission: "email.settings.manage",
    });

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: "Permission denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload: RequestPayload = await req.json();
    const orgId = userData.organization_id;

    if (payload.action === "connect") {
      const region: MailgunRegion = payload.region === "eu" ? "eu" : "us";
      const validation = await validateMailgunCredentials(payload.apiKey, region);
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: validation.error || "Invalid Mailgun credentials" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Verify the supplied domain exists in this account
      const matchingDomain = (validation.domains ?? []).find((d) => d.name === payload.domain);
      if (!matchingDomain) {
        return new Response(
          JSON.stringify({
            error: `Domain '${payload.domain}' not found in your Mailgun account. Available: ${(validation.domains ?? []).map((d) => d.name).join(", ") || "(none)"}`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { encrypted, iv } = await encryptMailgunCreds(
        {
          api_key: payload.apiKey,
          domain: payload.domain,
          webhook_signing_key: payload.webhookSigningKey ?? null,
          region,
        },
        supabaseUrl,
        serviceRoleKey,
      );

      const { data: integration } = await supabase
        .from("integrations")
        .select("id")
        .eq("key", "mailgun")
        .maybeSingle();

      if (!integration) {
        return new Response(
          JSON.stringify({ error: "Mailgun integration not found in catalog" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { error: upsertError } = await supabase
        .from("integration_connections")
        .upsert({
          org_id: orgId,
          integration_id: integration.id,
          status: "connected",
          credentials_encrypted: encrypted,
          credentials_iv: iv,
          account_info: {
            nickname: payload.nickname || null,
            domain: payload.domain,
            region,
          },
          connected_at: new Date().toISOString(),
          connected_by: user.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: "org_id,integration_id" });

      if (upsertError) {
        return new Response(
          JSON.stringify({ error: "Failed to save provider configuration" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await supabase.from("audit_logs").insert({
        org_id: orgId,
        user_id: user.id,
        action: "email.provider.connected",
        entity_type: "integration_connection",
        details: { provider: "mailgun", domain: payload.domain, region },
      });

      return new Response(
        JSON.stringify({ success: true, message: "Mailgun connected successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (payload.action === "status") {
      const { data: conn } = await supabase
        .from("integration_connections")
        .select("status, account_info, connected_at, integrations!inner(key)")
        .eq("org_id", orgId)
        .eq("integrations.key", "mailgun")
        .maybeSingle();

      return new Response(
        JSON.stringify({
          success: true,
          connected: conn?.status === "connected",
          nickname: conn?.account_info?.nickname || null,
          domain: conn?.account_info?.domain || null,
          region: conn?.account_info?.region || null,
          connectedAt: conn?.connected_at || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (payload.action === "test") {
      const creds = await getDecryptedMailgunCreds(orgId, supabase, supabaseUrl, serviceRoleKey);
      if (!creds) {
        return new Response(
          JSON.stringify({ error: "No connected email provider found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const validation = await validateMailgunCredentials(creds.apiKey, creds.region);
      if (!validation.valid) {
        const { data: integration } = await supabase
          .from("integrations")
          .select("id")
          .eq("key", "mailgun")
          .maybeSingle();

        if (integration) {
          await supabase
            .from("integration_connections")
            .update({ status: "error", updated_at: new Date().toISOString() })
            .eq("org_id", orgId)
            .eq("integration_id", integration.id);
        }

        return new Response(
          JSON.stringify({ success: false, error: validation.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Connection test successful" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (payload.action === "disconnect") {
      const { data: integration } = await supabase
        .from("integrations")
        .select("id")
        .eq("key", "mailgun")
        .maybeSingle();

      if (integration) {
        await supabase
          .from("integration_connections")
          .update({
            status: "disconnected",
            credentials_encrypted: null,
            credentials_iv: null,
            updated_at: new Date().toISOString(),
          })
          .eq("org_id", orgId)
          .eq("integration_id", integration.id);
      }

      await supabase.from("audit_logs").insert({
        org_id: orgId,
        user_id: user.id,
        action: "email.provider.disconnected",
        entity_type: "integration_connection",
        details: { provider: "mailgun" },
      });

      return new Response(
        JSON.stringify({ success: true, message: "Mailgun disconnected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
