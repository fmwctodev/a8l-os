import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  exchangeCodeForTokens,
  writeMasterToken,
  graphRequest,
  hasCalendarScopes,
  hasOneDriveScopes,
  hasTeamsScopes,
  hasOutlookMailScopes,
} from "../_shared/microsoft-graph-helpers.ts";
import { encryptToken } from "../_shared/crypto.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return redirectWithError("Missing server configuration");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    if (error) {
      console.error("Microsoft OAuth error:", error, errorDescription);
      return redirectWithError(errorDescription || "Authorization denied by user");
    }

    if (!code || !state) {
      return redirectWithError("Missing authorization code or state");
    }

    // Decode state — mirrors gmail-oauth-callback pattern
    let stateData: {
      user_id: string;
      org_id: string;
      redirect_uri: string;
      oauth_redirect_uri: string;
    };
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      return redirectWithError("Invalid state parameter");
    }

    const {
      user_id: userId,
      org_id: orgId,
      redirect_uri: appRedirectUri,
      oauth_redirect_uri: oauthRedirectUri,
    } = stateData;

    // Resolve org_id if missing
    let finalOrgId = orgId;
    if (!finalOrgId) {
      const { data: userData } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", userId)
        .single();
      if (userData) {
        finalOrgId = userData.organization_id;
      }
    }

    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code, oauthRedirectUri);
    const { access_token, refresh_token, expires_in, scope } = tokens;

    if (!refresh_token) {
      return redirectWithError(
        "No refresh token received. Ensure offline_access scope is requested."
      );
    }

    // Fetch user profile from Microsoft Graph
    const { status: profileStatus, data: profileData } = await graphRequest(
      access_token,
      "/me",
      "GET"
    );

    if (profileStatus !== 200) {
      console.error("Microsoft profile fetch failed:", profileData);
      return redirectWithError("Failed to get Microsoft profile");
    }

    const profile = profileData as {
      mail?: string;
      userPrincipalName?: string;
      displayName?: string;
    };
    const email = profile.mail || profile.userPrincipalName || "";
    const displayName = profile.displayName || "";

    if (!email) {
      return redirectWithError("Could not determine email from Microsoft profile");
    }

    // Look up user in the users table
    const { data: userRow } = await supabase
      .from("users")
      .select("id, email, organization_id")
      .eq("id", userId)
      .single();

    if (!userRow) {
      return redirectWithError("User not found in the system");
    }

    const tokenExpiry = new Date(Date.now() + expires_in * 1000).toISOString();
    const grantedScopes = scope ? scope.split(" ").filter(Boolean) : [];

    // Write master token record
    await writeMasterToken(
      supabase,
      finalOrgId,
      userId,
      email,
      access_token,
      refresh_token,
      tokenExpiry,
      grantedScopes
    );

    // Track connected account
    await supabase.from("user_connected_accounts").upsert(
      {
        user_id: userId,
        provider: "microsoft",
        provider_account_id: email,
        provider_account_email: email,
        provider_display_name: displayName,
        scopes: grantedScopes,
        connected_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" }
    );

    // Cross-populate service-specific tables based on granted scopes
    try {
      if (hasCalendarScopes(grantedScopes)) {
        await supabase.from("microsoft_calendar_connections").upsert(
          {
            user_id: userId,
            organization_id: finalOrgId,
            email,
            display_name: displayName,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      }

      if (hasOneDriveScopes(grantedScopes)) {
        await supabase.from("onedrive_connections").upsert(
          {
            user_id: userId,
            organization_id: finalOrgId,
            email,
            display_name: displayName,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      }

      if (hasTeamsScopes(grantedScopes)) {
        await supabase.from("user_connected_accounts").upsert(
          {
            user_id: userId,
            provider: "microsoft_teams",
            provider_account_id: email,
            provider_account_email: email,
            provider_display_name: displayName,
            scopes: grantedScopes.filter((s) =>
              ["Chat.ReadWrite", "OnlineMeetings.ReadWrite"].includes(s)
            ),
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,provider" }
        );
      }
    } catch (crossErr) {
      console.error("Cross-populate failed (non-fatal):", crossErr);
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "microsoft_connected",
      entity_type: "microsoft_oauth",
      after_state: {
        email,
        organization_id: finalOrgId,
        scopes: grantedScopes,
      },
    });

    // Redirect to app with success
    const successUrl = new URL(appRedirectUri);
    successUrl.searchParams.set("microsoft_connected", "true");
    successUrl.searchParams.set("email", email);

    return Response.redirect(successUrl.toString(), 302);
  } catch (err) {
    console.error("Microsoft OAuth callback error:", err);
    return redirectWithError((err as Error).message || "An error occurred");
  }
});

function redirectWithError(message: string): Response {
  return new Response(
    `<html><body>
      <h1>Microsoft Connection Failed</h1>
      <p>${message}</p>
      <p>Please close this window and try again.</p>
    </body></html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html" },
    }
  );
}
