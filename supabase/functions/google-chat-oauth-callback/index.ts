import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { encryptToken } from "../_shared/crypto.ts";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      const errorDesc = url.searchParams.get("error_description") || "OAuth error";
      return createRedirectResponse(`/settings/integrations?error=${encodeURIComponent(errorDesc)}`);
    }

    if (!code || !state) {
      return createRedirectResponse("/settings/integrations?error=missing_params");
    }

    let stateData: { userId: string; orgId: string; redirectUrl?: string };
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      return createRedirectResponse("/settings/integrations?error=invalid_state");
    }

    const { userId, orgId, redirectUrl } = stateData;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const callbackUrl = `${supabaseUrl}/functions/v1/google-chat-oauth-callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      return createRedirectResponse("/settings/integrations?error=token_exchange_failed");
    }

    const tokens: TokenResponse = await tokenResponse.json();

    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    let googleUserInfo: GoogleUserInfo | null = null;
    if (userInfoResponse.ok) {
      googleUserInfo = await userInfoResponse.json();
    }

    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);
    const scopes = tokens.scope.split(" ");

    let encChatAccess: string;
    let encChatRefresh: string | null;
    try {
      encChatAccess = await encryptToken(tokens.access_token);
      encChatRefresh = tokens.refresh_token ? await encryptToken(tokens.refresh_token) : null;
    } catch {
      encChatAccess = tokens.access_token;
      encChatRefresh = tokens.refresh_token || null;
    }

    const { error: upsertError } = await supabase
      .from("google_chat_tokens")
      .upsert({
        user_id: userId,
        org_id: orgId,
        access_token: encChatAccess,
        refresh_token: encChatRefresh,
        token_expiry: tokenExpiry.toISOString(),
        google_email: googleUserInfo?.email || null,
        google_user_id: googleUserInfo?.id || null,
        scopes,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (upsertError) {
      console.error("Failed to store tokens:", upsertError);
      return createRedirectResponse("/settings/integrations?error=storage_failed");
    }

    const finalRedirect = redirectUrl || "/conversations?tab=team-messaging&connected=true";
    return createRedirectResponse(finalRedirect);
  } catch (err) {
    console.error("OAuth callback error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function createRedirectResponse(path: string): Response {
  const appUrl = Deno.env.get("APP_URL") || "http://localhost:5173";
  const redirectUrl = path.startsWith("http") ? path : `${appUrl}${path}`;

  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      Location: redirectUrl,
    },
  });
}
