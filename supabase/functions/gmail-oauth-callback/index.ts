import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_URL = "https://gmail.googleapis.com/gmail/v1";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      return redirectWithError("Authorization denied by user");
    }

    if (!code || !state) {
      return redirectWithError("Missing authorization code or state");
    }

    let stateData: { org_id: string; user_id: string; redirect_uri: string };
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      return redirectWithError("Invalid state parameter");
    }

    const { org_id: orgId, user_id: userId, redirect_uri: appRedirectUri } = stateData;

    const { data: gmailConfig } = await supabase
      .from("channel_configurations")
      .select("config")
      .eq("organization_id", orgId)
      .eq("channel_type", "gmail")
      .maybeSingle();

    if (!gmailConfig?.config) {
      return redirectWithError("Gmail not configured for this organization");
    }

    const config = gmailConfig.config as {
      client_id: string;
      client_secret: string;
      redirect_uri: string;
    };

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: config.client_id,
        client_secret: config.client_secret,
        redirect_uri: config.redirect_uri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.json();
      console.error("Token exchange failed:", tokenError);
      return redirectWithError("Failed to exchange authorization code");
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    if (!refresh_token) {
      return redirectWithError("No refresh token received. Please revoke access and try again.");
    }

    const profileResponse = await fetch(`${GMAIL_API_URL}/users/me/profile`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!profileResponse.ok) {
      return redirectWithError("Failed to get Gmail profile");
    }

    const profile = await profileResponse.json();
    const email = profile.emailAddress;

    const tokenExpiry = new Date(Date.now() + expires_in * 1000).toISOString();

    const { error: saveError } = await supabase
      .from("gmail_oauth_tokens")
      .upsert({
        organization_id: orgId,
        user_id: userId,
        access_token,
        refresh_token,
        token_expiry: tokenExpiry,
        email,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "organization_id,user_id",
      });

    if (saveError) {
      console.error("Failed to save tokens:", saveError);
      return redirectWithError("Failed to save Gmail connection");
    }

    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "connect",
      entity_type: "gmail_oauth",
      after_state: { email, organization_id: orgId },
    });

    const successUrl = new URL(appRedirectUri);
    successUrl.searchParams.set("gmail_connected", "true");
    successUrl.searchParams.set("email", email);

    return Response.redirect(successUrl.toString(), 302);
  } catch (err) {
    console.error("Gmail OAuth callback error:", err);
    return redirectWithError(err.message || "An error occurred");
  }
});

function redirectWithError(message: string): Response {
  const errorUrl = new URL("/admin/settings", Deno.env.get("SUPABASE_URL") || "");
  errorUrl.searchParams.set("gmail_error", message);

  return new Response(
    `<html><body>
      <h1>Gmail Connection Failed</h1>
      <p>${message}</p>
      <p>Please close this window and try again.</p>
    </body></html>`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html",
      },
    }
  );
}
