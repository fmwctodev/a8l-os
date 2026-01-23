import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

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

    let stateData: {
      org_id: string;
      user_id: string;
      redirect_uri: string;
      client_id: string;
      client_secret: string;
      oauth_redirect_uri: string;
    };
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      return redirectWithError("Invalid state parameter");
    }

    const {
      org_id: orgId,
      user_id: userId,
      redirect_uri: appRedirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      oauth_redirect_uri: oauthRedirectUri,
    } = stateData;

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: oauthRedirectUri,
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

    const userinfoResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!userinfoResponse.ok) {
      return redirectWithError("Failed to get user info");
    }

    const userinfo = await userinfoResponse.json();
    const email = userinfo.email;

    const tokenExpiry = new Date(Date.now() + expires_in * 1000).toISOString();

    const { error: saveError } = await supabase
      .from("drive_connections")
      .upsert({
        organization_id: orgId,
        email,
        access_token_encrypted: access_token,
        refresh_token_encrypted: refresh_token,
        token_expiry: tokenExpiry,
        scopes: [
          "https://www.googleapis.com/auth/drive.file",
          "https://www.googleapis.com/auth/drive.metadata.readonly",
        ],
        is_active: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "organization_id",
      });

    if (saveError) {
      console.error("Failed to save tokens:", saveError);
      return redirectWithError("Failed to save Google Drive connection");
    }

    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "drive_connected",
      entity_type: "drive_connection",
      after_state: { email, organization_id: orgId },
    });

    const successUrl = new URL(appRedirectUri);
    successUrl.searchParams.set("drive_connected", "true");
    successUrl.searchParams.set("email", email);

    return Response.redirect(successUrl.toString(), 302);
  } catch (err) {
    console.error("Drive OAuth callback error:", err);
    return redirectWithError(err.message || "An error occurred");
  }
});

function redirectWithError(message: string): Response {
  return new Response(
    `<html><body>
      <h1>Google Drive Connection Failed</h1>
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
