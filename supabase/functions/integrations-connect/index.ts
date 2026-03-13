import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CLIENT_ID_MAP: Record<string, string> = {
  gmail: "GOOGLE_CLIENT_ID",
  google_workspace: "GOOGLE_CLIENT_ID",
  google_calendar: "GOOGLE_CLIENT_ID",
  google_ads: "GOOGLE_CLIENT_ID",
  google_chat: "GOOGLE_CLIENT_ID",
  quickbooks_online: "QBO_CLIENT_ID",
};

function getOAuthClientIdEnvVar(integrationKey: string): string {
  const envVarName = CLIENT_ID_MAP[integrationKey] || `${integrationKey.toUpperCase()}_CLIENT_ID`;
  return Deno.env.get(envVarName) || "";
}

function getOAuthClientSecretEnvVar(integrationKey: string): string {
  const secretMap: Record<string, string> = {
    gmail: "GOOGLE_CLIENT_SECRET",
    google_workspace: "GOOGLE_CLIENT_SECRET",
    google_calendar: "GOOGLE_CLIENT_SECRET",
    google_ads: "GOOGLE_CLIENT_SECRET",
    google_chat: "GOOGLE_CLIENT_SECRET",
    quickbooks_online: "QBO_CLIENT_SECRET",
  };
  const envVarName = secretMap[integrationKey] || `${integrationKey.toUpperCase()}_CLIENT_SECRET`;
  return Deno.env.get(envVarName) || "";
}

interface RequestPayload {
  action: "initiate_oauth" | "connect_api_key" | "disconnect" | "test";
  integration_key: string;
  credentials?: Record<string, string>;
  force?: boolean;
  app_url?: string;
}

async function validateSendGridApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch("https://api.sendgrid.com/v3/user/profile", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    if (response.ok) return { valid: true };
    if (response.status === 401) return { valid: false, error: "Invalid API key" };
    return { valid: false, error: `SendGrid API error: ${response.status}` };
  } catch {
    return { valid: false, error: "Failed to connect to SendGrid" };
  }
}

async function encryptWithCrypto(
  plaintext: string,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<{ encrypted: string; iv: string }> {
  const response = await fetch(`${supabaseUrl}/functions/v1/email-crypto`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "encrypt", plaintext }),
  });
  if (!response.ok) throw new Error("Failed to encrypt credentials");
  return await response.json();
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

    const payload: RequestPayload = await req.json();
    const { action, integration_key, credentials, force, app_url } = payload;

    const { data: integration, error: intError } = await supabase
      .from("integrations")
      .select("*")
      .eq("org_id", userData.organization_id)
      .eq("key", integration_key)
      .single();

    if (intError || !integration) {
      return new Response(
        JSON.stringify({ error: "Integration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    switch (action) {
      case "initiate_oauth": {
        if (integration.connection_type !== "oauth") {
          return new Response(
            JSON.stringify({ error: "Integration does not support OAuth" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const stateToken = crypto.randomUUID();
        const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/integrations-oauth-callback`;

        await serviceClient.from("oauth_states").insert({
          org_id: userData.organization_id,
          user_id: user.id,
          integration_key,
          state_token: stateToken,
          redirect_uri: redirectUri,
          scope_requested: integration.oauth_config?.scopes?.join(" ") || "",
          app_url: app_url || null,
        });

        const oauthConfig = integration.oauth_config;
        const authUrl = new URL(oauthConfig.auth_url);
        authUrl.searchParams.set("client_id", getOAuthClientIdEnvVar(integration_key));
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("state", stateToken);
        if (oauthConfig.scopes?.length) {
          authUrl.searchParams.set("scope", oauthConfig.scopes.join(" "));
        }
        authUrl.searchParams.set("access_type", "offline");
        authUrl.searchParams.set("prompt", "consent");

        await serviceClient.from("integration_logs").insert({
          integration_id: integration.id,
          org_id: userData.organization_id,
          user_id: user.id,
          action: "connect",
          status: "success",
          request_meta: { type: "oauth_initiated" },
        });

        return new Response(
          JSON.stringify({ authorization_url: authUrl.toString(), state_token: stateToken }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "connect_api_key": {
        if (integration.connection_type !== "api_key") {
          return new Response(
            JSON.stringify({ error: "Integration does not support API key connection" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!credentials || Object.keys(credentials).length === 0) {
          return new Response(
            JSON.stringify({ error: "Credentials required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        let credentialsEncrypted: string;
        let credentialsIv: string;
        let accountInfo: Record<string, unknown> = {};

        if (integration_key === "sendgrid") {
          const apiKey = credentials.api_key;
          if (!apiKey) {
            return new Response(
              JSON.stringify({ error: "API key is required" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const validation = await validateSendGridApiKey(apiKey);
          if (!validation.valid) {
            return new Response(
              JSON.stringify({ error: validation.error }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const encrypted = await encryptWithCrypto(apiKey, supabaseUrl, serviceRoleKey);
          credentialsEncrypted = encrypted.encrypted;
          credentialsIv = encrypted.iv;
          accountInfo = {
            provider: "sendgrid",
            configured: true,
            api_key_set: true,
            nickname: credentials.nickname || null,
          };
        } else {
          credentialsIv = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
          credentialsEncrypted = JSON.stringify(credentials);
          accountInfo = {};
        }

        const { data: existingConnection } = await serviceClient
          .from("integration_connections")
          .select("id")
          .eq("integration_id", integration.id)
          .eq("org_id", userData.organization_id)
          .is("user_id", integration.scope === "global" ? null : user.id)
          .maybeSingle();

        const connectionData = {
          integration_id: integration.id,
          org_id: userData.organization_id,
          user_id: integration.scope === "global" ? null : user.id,
          status: "connected",
          credentials_encrypted: credentialsEncrypted,
          credentials_iv: credentialsIv,
          account_info: accountInfo,
          connected_at: new Date().toISOString(),
          connected_by: user.id,
        };

        let connection;
        if (existingConnection) {
          const { data, error } = await serviceClient
            .from("integration_connections")
            .update(connectionData)
            .eq("id", existingConnection.id)
            .select()
            .single();
          if (error) throw error;
          connection = data;
        } else {
          const { data, error } = await serviceClient
            .from("integration_connections")
            .insert(connectionData)
            .select()
            .single();
          if (error) throw error;
          connection = data;
        }

        await serviceClient.from("integration_logs").insert({
          integration_id: integration.id,
          org_id: userData.organization_id,
          user_id: user.id,
          action: "connect",
          status: "success",
          request_meta: { type: "api_key", integration_key },
        });

        return new Response(
          JSON.stringify(connection),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "disconnect": {
        const { data: affectedModules } = await serviceClient
          .from("module_integration_requirements")
          .select("module_key, feature_description")
          .eq("org_id", userData.organization_id)
          .eq("integration_key", integration_key);

        if (affectedModules?.length && !force) {
          return new Response(
            JSON.stringify({
              success: false,
              affected_modules: affectedModules.map((m) => m.module_key),
              message: "This integration is used by other modules. Set force=true to disconnect anyway.",
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await serviceClient
          .from("integration_connections")
          .update({
            status: "disconnected",
            credentials_encrypted: null,
            credentials_iv: null,
            access_token_encrypted: null,
            refresh_token_encrypted: null,
            error_message: null,
          })
          .eq("integration_id", integration.id)
          .eq("org_id", userData.organization_id);

        await serviceClient.from("integration_logs").insert({
          integration_id: integration.id,
          org_id: userData.organization_id,
          user_id: user.id,
          action: "disconnect",
          status: "success",
        });

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "test": {
        if (integration_key === "sendgrid") {
          const sgUrl = Deno.env.get("SUPABASE_URL")!;
          const sgSrk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

          const { data: conn } = await serviceClient
            .from("integration_connections")
            .select("credentials_encrypted, credentials_iv, status")
            .eq("integration_id", integration.id)
            .eq("org_id", userData.organization_id)
            .maybeSingle();

          if (!conn || conn.status !== "connected" || !conn.credentials_encrypted || !conn.credentials_iv) {
            return new Response(
              JSON.stringify({ success: false, message: "SendGrid is not connected" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const decryptRes = await fetch(`${sgUrl}/functions/v1/email-crypto`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${sgSrk}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ action: "decrypt", encrypted: conn.credentials_encrypted, iv: conn.credentials_iv }),
          });

          if (!decryptRes.ok) {
            return new Response(
              JSON.stringify({ success: false, message: "Failed to decrypt credentials" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const { plaintext: apiKey } = await decryptRes.json();
          const validation = await validateSendGridApiKey(apiKey);

          await serviceClient.from("integration_logs").insert({
            integration_id: integration.id,
            org_id: userData.organization_id,
            user_id: user.id,
            action: "test",
            status: validation.valid ? "success" : "failure",
            request_meta: { message: validation.valid ? "SendGrid API key is valid" : validation.error },
          });

          if (!validation.valid) {
            await serviceClient
              .from("integration_connections")
              .update({ status: "error", error_message: validation.error })
              .eq("integration_id", integration.id)
              .eq("org_id", userData.organization_id);

            return new Response(
              JSON.stringify({ success: false, message: validation.error }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          return new Response(
            JSON.stringify({ success: true, message: "SendGrid connection is healthy" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await serviceClient.from("integration_logs").insert({
          integration_id: integration.id,
          org_id: userData.organization_id,
          user_id: user.id,
          action: "test",
          status: "success",
          request_meta: { message: "Connection test successful" },
        });

        return new Response(
          JSON.stringify({ success: true, message: "Connection test successful" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Error in integrations-connect:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
