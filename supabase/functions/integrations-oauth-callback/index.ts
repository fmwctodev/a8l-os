import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GOOGLE_CLIENT_ID_MAP: Record<string, string> = {
  gmail: "GOOGLE_CLIENT_ID",
  google_workspace: "GOOGLE_CLIENT_ID",
  google_calendar: "GOOGLE_CLIENT_ID",
  google_ads: "GOOGLE_CLIENT_ID",
  google_chat: "GOOGLE_CLIENT_ID",
};

const GOOGLE_CLIENT_SECRET_MAP: Record<string, string> = {
  gmail: "GOOGLE_CLIENT_SECRET",
  google_workspace: "GOOGLE_CLIENT_SECRET",
  google_calendar: "GOOGLE_CLIENT_SECRET",
  google_ads: "GOOGLE_CLIENT_SECRET",
  google_chat: "GOOGLE_CLIENT_SECRET",
};

function getOAuthClientId(integrationKey: string): string {
  const envVarName = GOOGLE_CLIENT_ID_MAP[integrationKey] || `${integrationKey.toUpperCase()}_CLIENT_ID`;
  return Deno.env.get(envVarName) || "";
}

function getOAuthClientSecret(integrationKey: string): string {
  const envVarName = GOOGLE_CLIENT_SECRET_MAP[integrationKey] || `${integrationKey.toUpperCase()}_CLIENT_SECRET`;
  return Deno.env.get(envVarName) || "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const realmId = url.searchParams.get("realmId");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    const fallbackUrl = Deno.env.get("APP_URL") || "https://os.autom8ionlab.com";

    if (error) {
      const redirectUrl = new URL(`${fallbackUrl}/settings/integrations`);
      redirectUrl.searchParams.set("error", errorDescription || error);
      return Response.redirect(redirectUrl.toString(), 302);
    }

    if (!code || !state) {
      const redirectUrl = new URL(`${fallbackUrl}/settings/integrations`);
      redirectUrl.searchParams.set("error", "Missing authorization code or state");
      return Response.redirect(redirectUrl.toString(), 302);
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: oauthState, error: stateError } = await serviceClient
      .from("oauth_states")
      .select("*")
      .eq("state_token", state)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (stateError || !oauthState) {
      const redirectUrl = new URL(`${fallbackUrl}/settings/integrations`);
      redirectUrl.searchParams.set("error", "Invalid or expired state token");
      return Response.redirect(redirectUrl.toString(), 302);
    }

    const appUrl = oauthState.app_url || fallbackUrl;

    const { data: integration, error: intError } = await serviceClient
      .from("integrations")
      .select("*")
      .eq("org_id", oauthState.org_id)
      .eq("key", oauthState.integration_key)
      .single();

    if (intError || !integration) {
      const redirectUrl = new URL(`${appUrl}/settings/integrations`);
      redirectUrl.searchParams.set("error", "Integration not found");
      return Response.redirect(redirectUrl.toString(), 302);
    }

    const oauthConfig = integration.oauth_config;
    const clientId = getOAuthClientId(oauthState.integration_key);
    const clientSecret = getOAuthClientSecret(oauthState.integration_key);

    const isIntuit = oauthState.integration_key === "quickbooks_online";
    const tokenHeaders: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };
    const tokenBody: Record<string, string> = {
      grant_type: "authorization_code",
      code,
      redirect_uri: oauthState.redirect_uri,
    };

    if (isIntuit) {
      tokenHeaders["Authorization"] = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
    } else {
      tokenBody.client_id = clientId;
      tokenBody.client_secret = clientSecret;
    }

    const tokenResponse = await fetch(oauthConfig.token_url, {
      method: "POST",
      headers: tokenHeaders,
      body: new URLSearchParams(tokenBody),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange failed:", errorData);

      await serviceClient.from("integration_logs").insert({
        integration_id: integration.id,
        org_id: oauthState.org_id,
        user_id: oauthState.user_id,
        action: "connect",
        status: "failure",
        error_message: "Token exchange failed",
        request_meta: { error: errorData },
      });

      const redirectUrl = new URL(`${appUrl}/settings/integrations`);
      redirectUrl.searchParams.set("error", "Failed to exchange authorization code");
      return Response.redirect(redirectUrl.toString(), 302);
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    let accountInfo: Record<string, unknown> = {};
    if (oauthState.integration_key.startsWith("google")) {
      try {
        const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        if (userInfoResponse.ok) {
          const userInfo = await userInfoResponse.json();
          accountInfo = {
            email: userInfo.email,
            name: userInfo.name,
            avatar: userInfo.picture,
          };
        }
      } catch (e) {
        console.error("Failed to fetch user info:", e);
      }
    } else if (isIntuit && realmId) {
      accountInfo = { realm_id: realmId };
      try {
        const companyResponse = await fetch(
          `https://quickbooks.api.intuit.com/v3/company/${realmId}/companyinfo/${realmId}?minorversion=65`,
          { headers: { Authorization: `Bearer ${access_token}`, Accept: "application/json" } }
        );
        if (companyResponse.ok) {
          const companyData = await companyResponse.json();
          accountInfo.company_name = companyData.CompanyInfo?.CompanyName || "QuickBooks Company";
        }
      } catch (e) {
        console.error("Failed to fetch QBO company info:", e);
      }
    }

    const tokenExpiresAt = expires_in
      ? new Date(Date.now() + expires_in * 1000).toISOString()
      : null;

    const { data: existingConnection } = await serviceClient
      .from("integration_connections")
      .select("id")
      .eq("integration_id", integration.id)
      .eq("org_id", oauthState.org_id)
      .is("user_id", integration.scope === "global" ? null : oauthState.user_id)
      .maybeSingle();

    const connectionData = {
      integration_id: integration.id,
      org_id: oauthState.org_id,
      user_id: integration.scope === "global" ? null : oauthState.user_id,
      status: "connected",
      access_token_encrypted: access_token,
      refresh_token_encrypted: refresh_token || null,
      token_expires_at: tokenExpiresAt,
      account_info: accountInfo,
      connected_at: new Date().toISOString(),
      connected_by: oauthState.user_id,
      error_message: null,
    };

    if (existingConnection) {
      await serviceClient
        .from("integration_connections")
        .update(connectionData)
        .eq("id", existingConnection.id);
    } else {
      await serviceClient
        .from("integration_connections")
        .insert(connectionData);
    }

    await serviceClient
      .from("oauth_states")
      .delete()
      .eq("id", oauthState.id);

    await serviceClient.from("integration_logs").insert({
      integration_id: integration.id,
      org_id: oauthState.org_id,
      user_id: oauthState.user_id,
      action: "connect",
      status: "success",
      request_meta: { type: "oauth_completed", account_info: accountInfo },
    });

    const redirectUrl = new URL(`${appUrl}/settings/integrations`);
    redirectUrl.searchParams.set("success", "true");
    redirectUrl.searchParams.set("integration", oauthState.integration_key);
    return Response.redirect(redirectUrl.toString(), 302);

  } catch (error) {
    console.error("Error in integrations-oauth-callback:", error);
    const catchUrl = Deno.env.get("APP_URL") || "https://os.autom8ionlab.com";
    const redirectUrl = new URL(`${catchUrl}/settings/integrations`);
    redirectUrl.searchParams.set("error", "An unexpected error occurred");
    return Response.redirect(redirectUrl.toString(), 302);
  }
});
