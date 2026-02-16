import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { writeMasterToken, crossPopulateServiceTables, DRIVE_SCOPES } from "../_shared/google-oauth-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!supabaseUrl || !serviceRoleKey || !clientId || !clientSecret) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
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
      user_id: string;
      redirect_uri: string;
      oauth_redirect_uri: string;
    };
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      return redirectWithError("Invalid state parameter");
    }

    const { user_id: userId, redirect_uri: appRedirectUri, oauth_redirect_uri: oauthRedirectUri } =
      stateData;

    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", userId)
      .single();

    if (!userData) {
      return redirectWithError("User not found");
    }

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
      const detail = tokenError?.error_description || tokenError?.error || "Unknown error";
      return redirectWithError(`Failed to exchange authorization code: ${detail}`);
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    if (!refresh_token) {
      return redirectWithError(
        "No refresh token received. Please revoke access and try again."
      );
    }

    const userinfoResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!userinfoResponse.ok) {
      const infoErr = await userinfoResponse.text();
      console.error("Userinfo fetch failed:", infoErr);
      return redirectWithError(`Failed to get user info: ${userinfoResponse.status}`);
    }

    const userinfo = await userinfoResponse.json();
    const email = userinfo.email;

    const tokenExpiry = new Date(
      Date.now() + expires_in * 1000
    ).toISOString();

    const { error: saveError } = await supabase
      .from("drive_connections")
      .upsert(
        {
          user_id: userId,
          organization_id: userData.organization_id,
          connected_by: userId,
          email,
          access_token_encrypted: access_token,
          refresh_token_encrypted: refresh_token,
          token_expiry: tokenExpiry,
          scopes: [
            "https://www.googleapis.com/auth/drive",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
          ],
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (saveError) {
      console.error("Failed to save tokens:", saveError);
      return redirectWithError("Failed to save Google Drive connection");
    }

    await supabase
      .from("users")
      .update({
        google_drive_connected: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "drive_connected",
      entity_type: "drive_connection",
      after_state: { email, organization_id: userData.organization_id },
    });

    const grantedScopes = tokens.scope
      ? tokens.scope.split(" ").filter(Boolean)
      : DRIVE_SCOPES.concat(["https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"]);

    try {
      await writeMasterToken(supabase, userData.organization_id, userId, email, access_token, refresh_token, tokenExpiry, grantedScopes);
      await crossPopulateServiceTables(supabase, userData.organization_id, userId, email, access_token, refresh_token, tokenExpiry, grantedScopes);
    } catch (crossErr) {
      console.error("Cross-populate failed (non-fatal):", crossErr);
    }

    const successUrl = new URL(appRedirectUri);
    successUrl.searchParams.set("drive_connected", "true");
    successUrl.searchParams.set("email", email);

    return Response.redirect(successUrl.toString(), 302);
  } catch (err) {
    console.error("Drive OAuth callback error:", err);
    return redirectWithError((err as Error).message || "An error occurred");
  }
});

function redirectWithError(message: string): Response {
  return new Response(
    `<html><body>
      <h1>Google Drive Connection Failed</h1>
      <p>${message}</p>
      <p>Please close this window and try again.</p>
    </body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}
