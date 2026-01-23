import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ConnectRequest {
  action: "connect";
  apiKey: string;
  nickname?: string;
}

interface TestRequest {
  action: "test";
}

interface DisconnectRequest {
  action: "disconnect";
}

type RequestPayload = ConnectRequest | TestRequest | DisconnectRequest;

async function validateSendGridApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch("https://api.sendgrid.com/v3/user/profile", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      return { valid: true };
    }

    if (response.status === 401) {
      return { valid: false, error: "Invalid API key" };
    }

    return { valid: false, error: `SendGrid API error: ${response.status}` };
  } catch (error) {
    return { valid: false, error: "Failed to connect to SendGrid" };
  }
}

async function encryptApiKey(apiKey: string, supabaseUrl: string, serviceRoleKey: string): Promise<{ encrypted: string; iv: string }> {
  const response = await fetch(`${supabaseUrl}/functions/v1/email-crypto`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "encrypt", plaintext: apiKey }),
  });

  if (!response.ok) {
    throw new Error("Failed to encrypt API key");
  }

  return await response.json();
}

async function decryptApiKey(encrypted: string, iv: string, supabaseUrl: string, serviceRoleKey: string): Promise<string> {
  const response = await fetch(`${supabaseUrl}/functions/v1/email-crypto`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "decrypt", encrypted, iv }),
  });

  if (!response.ok) {
    throw new Error("Failed to decrypt API key");
  }

  const data = await response.json();
  return data.plaintext;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const userClient = createClient(supabaseUrl, authHeader.replace("Bearer ", ""), {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid user token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: userData, error: userDataError } = await supabase
      .from("users")
      .select("org_id, role_id")
      .eq("id", user.id)
      .single();

    if (userDataError || !userData) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: hasPermission } = await supabase.rpc("user_has_email_permission", {
      user_id: user.id,
      required_permission: "email.settings.manage",
    });

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: "Permission denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: RequestPayload = await req.json();
    const orgId = userData.org_id;

    if (payload.action === "connect") {
      const validation = await validateSendGridApiKey(payload.apiKey);
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: validation.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { encrypted, iv } = await encryptApiKey(payload.apiKey, supabaseUrl, serviceRoleKey);

      const { error: upsertError } = await supabase
        .from("email_providers")
        .upsert({
          org_id: orgId,
          provider: "sendgrid",
          api_key_encrypted: encrypted,
          api_key_iv: iv,
          account_nickname: payload.nickname || null,
          status: "connected",
          updated_at: new Date().toISOString(),
        }, { onConflict: "org_id" });

      if (upsertError) {
        return new Response(
          JSON.stringify({ error: "Failed to save provider configuration" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase.from("audit_logs").insert({
        org_id: orgId,
        user_id: user.id,
        action: "email.provider.connected",
        entity_type: "email_provider",
        details: { provider: "sendgrid", nickname: payload.nickname },
      });

      return new Response(
        JSON.stringify({ success: true, message: "SendGrid connected successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.action === "test") {
      const { data: provider, error: providerError } = await supabase
        .from("email_providers")
        .select("api_key_encrypted, api_key_iv, status")
        .eq("org_id", orgId)
        .single();

      if (providerError || !provider || provider.status !== "connected") {
        return new Response(
          JSON.stringify({ error: "No connected email provider found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const apiKey = await decryptApiKey(
        provider.api_key_encrypted,
        provider.api_key_iv,
        supabaseUrl,
        serviceRoleKey
      );

      const validation = await validateSendGridApiKey(apiKey);
      if (!validation.valid) {
        await supabase
          .from("email_providers")
          .update({ status: "disconnected" })
          .eq("org_id", orgId);

        return new Response(
          JSON.stringify({ success: false, error: validation.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Connection test successful" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.action === "disconnect") {
      const { error: updateError } = await supabase
        .from("email_providers")
        .update({
          status: "disconnected",
          api_key_encrypted: null,
          api_key_iv: null,
          updated_at: new Date().toISOString(),
        })
        .eq("org_id", orgId);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to disconnect provider" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase.from("audit_logs").insert({
        org_id: orgId,
        user_id: user.id,
        action: "email.provider.disconnected",
        entity_type: "email_provider",
        details: { provider: "sendgrid" },
      });

      return new Response(
        JSON.stringify({ success: true, message: "SendGrid disconnected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
