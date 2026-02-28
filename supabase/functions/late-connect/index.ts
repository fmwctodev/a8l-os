import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const LATE_API_BASE = "https://getlate.dev/api/v1";

const PROVIDER_TO_LATE_PLATFORM: Record<string, string> = {
  facebook: "facebook",
  instagram: "instagram",
  linkedin: "linkedin",
  google_business: "googlebusiness",
  tiktok: "tiktok",
  youtube: "youtube",
  reddit: "reddit",
};

interface ConnectRequest {
  provider: string;
  reconnect_account_id?: string;
  success_redirect_url?: string;
  failure_redirect_url?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lateApiKey = Deno.env.get("LATE_API_KEY");

    if (!lateApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "CONFIG_ERROR", message: "Late.dev not configured" },
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "AUTH_REQUIRED", message: "Missing authorization" },
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "AUTH_FAILED", message: "Invalid credentials" },
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "USER_NOT_FOUND", message: "User not found" },
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body: ConnectRequest = await req.json();
    const {
      provider,
      reconnect_account_id,
      success_redirect_url,
      failure_redirect_url,
    } = body;

    const latePlatform = PROVIDER_TO_LATE_PLATFORM[provider];
    if (!provider || !latePlatform) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "INVALID_PROVIDER",
            message: `Unsupported provider: ${provider}`,
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const orgId = userData.organization_id;
    const lateHeaders = {
      Authorization: `Bearer ${lateApiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const { data: existingConnection } = await supabase
      .from("late_connections")
      .select("late_profile_id")
      .eq("org_id", orgId)
      .not("late_profile_id", "is", null)
      .limit(1)
      .maybeSingle();

    let profileId = existingConnection?.late_profile_id;

    if (!profileId) {
      const profileResponse = await fetch(`${LATE_API_BASE}/profiles`, {
        method: "POST",
        headers: lateHeaders,
        body: JSON.stringify({ name: `org-${orgId}` }),
      });

      if (!profileResponse.ok) {
        const errText = await profileResponse.text();
        console.error("[late-connect] Failed to create profile:", errText);
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "LATE_ERROR",
              message: "Failed to create Late.dev profile",
            },
          }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const profileData = await profileResponse.json();
      profileId = profileData.id || profileData.profileId;
    }

    const appBaseUrl =
      Deno.env.get("APP_BASE_URL") ||
      supabaseUrl.replace(/\.supabase\.co.*/, ".supabase.co");
    const callbackUrl = `${supabaseUrl}/functions/v1/late-callback?org_id=${orgId}&user_id=${userData.id}&provider=${provider}&profile_id=${profileId}`;
    const successUrl =
      success_redirect_url ||
      `${appBaseUrl}/marketing/social/accounts?late=success`;
    const failureUrl =
      failure_redirect_url ||
      `${appBaseUrl}/marketing/social/accounts?late=error`;

    let connectUrl = `${LATE_API_BASE}/connect/${latePlatform}?profileId=${profileId}&callbackUrl=${encodeURIComponent(callbackUrl)}&successUrl=${encodeURIComponent(successUrl)}&failureUrl=${encodeURIComponent(failureUrl)}`;

    if (reconnect_account_id) {
      connectUrl += `&reconnect=true&accountId=${encodeURIComponent(reconnect_account_id)}`;
    }

    const connectResponse = await fetch(connectUrl, {
      headers: lateHeaders,
    });

    if (!connectResponse.ok) {
      const errText = await connectResponse.text();
      console.error("[late-connect] Connect URL error:", errText);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "LATE_ERROR",
            message: "Failed to generate connection link",
          },
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const connectData = await connectResponse.json();
    const authUrl = connectData.authUrl || connectData.url || connectData.connectUrl;

    if (!authUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "LATE_ERROR",
            message: "No auth URL returned from Late.dev",
          },
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          url: authUrl,
          provider,
          type: reconnect_account_id ? "reconnect" : "create",
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[late-connect] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message:
            error instanceof Error ? error.message : "Unexpected error",
        },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
