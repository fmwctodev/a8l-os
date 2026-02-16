import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { encryptToken } from "../_shared/crypto.ts";
import { writeMasterToken, crossPopulateServiceTables, GMAIL_SCOPES } from "../_shared/google-oauth-helpers.ts";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_URL = "https://gmail.googleapis.com/gmail/v1";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!supabaseUrl || !serviceRoleKey || !clientId || !clientSecret) {
      return redirectWithError("Missing server configuration");
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

    if (!orgId) {
      const { data: userData } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", userId)
        .single();
      if (userData) {
        stateData.org_id = userData.organization_id;
      }
    }

    const finalOrgId = stateData.org_id;

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
      return redirectWithError("Failed to exchange authorization code");
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    if (!refresh_token) {
      return redirectWithError("No refresh token received. Please revoke access and try again.");
    }

    const profileResponse = await fetch(`${GMAIL_API_URL}/users/me/profile`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!profileResponse.ok) {
      return redirectWithError("Failed to get Gmail profile");
    }

    const profile = await profileResponse.json();
    const email = profile.emailAddress;

    const tokenExpiry = new Date(Date.now() + expires_in * 1000).toISOString();

    let encryptedAccess: string;
    let encryptedRefresh: string;
    try {
      encryptedAccess = await encryptToken(access_token);
      encryptedRefresh = await encryptToken(refresh_token);
    } catch (encErr) {
      console.error("Token encryption failed, storing plain:", encErr);
      encryptedAccess = access_token;
      encryptedRefresh = refresh_token;
    }

    const { error: saveError } = await supabase
      .from("gmail_oauth_tokens")
      .upsert(
        {
          organization_id: finalOrgId,
          user_id: userId,
          access_token: encryptedAccess,
          refresh_token: encryptedRefresh,
          token_expiry: tokenExpiry,
          email,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,user_id" }
      );

    if (saveError) {
      console.error("Failed to save tokens:", saveError);
      return redirectWithError("Failed to save Gmail connection");
    }

    await supabase
      .from("user_connected_accounts")
      .upsert(
        {
          user_id: userId,
          provider: "google_gmail",
          provider_account_id: email,
          provider_account_email: email,
          scopes: ["gmail.readonly", "gmail.send", "gmail.modify"],
          connected_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" }
      );

    await supabase
      .from("users")
      .update({
        gmail_connected: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    const grantedScopes = tokens.scope
      ? tokens.scope.split(" ").filter(Boolean)
      : GMAIL_SCOPES.concat(["https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"]);

    try {
      await writeMasterToken(supabase, finalOrgId, userId, email, access_token, refresh_token, tokenExpiry, grantedScopes);
      await crossPopulateServiceTables(supabase, finalOrgId, userId, email, access_token, refresh_token, tokenExpiry, grantedScopes);
    } catch (crossErr) {
      console.error("Cross-populate failed (non-fatal):", crossErr);
    }

    let watchHistoryId: string | null = null;
    let watchExpiration: string | null = null;

    const pubsubTopic = Deno.env.get("GMAIL_PUBSUB_TOPIC");
    if (pubsubTopic) {
      try {
        const watchResponse = await fetch(`${GMAIL_API_URL}/users/me/watch`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            topicName: pubsubTopic,
            labelIds: ["INBOX", "SENT"],
            labelFilterBehavior: "include",
          }),
        });

        if (watchResponse.ok) {
          const watchData = await watchResponse.json();
          watchHistoryId = String(watchData.historyId);
          watchExpiration = new Date(Number(watchData.expiration)).toISOString();
        } else {
          console.error("Gmail watch registration failed:", await watchResponse.text());
        }
      } catch (watchErr) {
        console.error("Gmail watch error:", watchErr);
      }
    }

    await supabase
      .from("gmail_sync_state")
      .upsert(
        {
          organization_id: finalOrgId,
          user_id: userId,
          history_id: watchHistoryId,
          watch_expiration: watchExpiration,
          sync_status: "idle",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,user_id" }
      );

    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "gmail_connected",
      entity_type: "gmail_oauth",
      after_state: { email, organization_id: finalOrgId },
    });

    await supabase.from("gmail_sync_jobs").insert({
      organization_id: finalOrgId,
      user_id: userId,
      job_type: "initial",
      status: "queued",
      run_at: new Date().toISOString(),
    });

    try {
      await fetch(`${supabaseUrl}/functions/v1/gmail-sync`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ org_id: finalOrgId, user_id: userId }),
      });
    } catch (syncErr) {
      console.error("Initial sync trigger failed:", syncErr);
    }

    const successUrl = new URL(appRedirectUri);
    successUrl.searchParams.set("gmail_connected", "true");
    successUrl.searchParams.set("email", email);

    return Response.redirect(successUrl.toString(), 302);
  } catch (err) {
    console.error("Gmail OAuth callback error:", err);
    return redirectWithError((err as Error).message || "An error occurred");
  }
});

function redirectWithError(message: string): Response {
  return new Response(
    `<html><body>
      <h1>Gmail Connection Failed</h1>
      <p>${message}</p>
      <p>Please close this window and try again.</p>
    </body></html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html" },
    }
  );
}
