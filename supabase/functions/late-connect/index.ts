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
          error: { code: "CONFIG_ERROR", message: "Late.dev not configured — set LATE_API_KEY" },
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: { code: "AUTH_REQUIRED", message: "Missing authorization" } }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: { code: "AUTH_FAILED", message: "Invalid credentials" } }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        JSON.stringify({ success: false, error: { code: "USER_NOT_FOUND", message: "User not found" } }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ConnectRequest = await req.json();
    const { provider, reconnect_account_id } = body;

    const latePlatform = PROVIDER_TO_LATE_PLATFORM[provider];
    if (!provider || !latePlatform) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "INVALID_PROVIDER", message: `Unsupported provider: ${provider}` },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orgId = userData.organization_id;
    const lateHeaders = {
      Authorization: `Bearer ${lateApiKey}`,
      Accept: "application/json",
    };

    const lateProfileId = Deno.env.get("LATE_PROFILE_ID") || "69a352613ecb689ae9742cc0";
    const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://os.autom8ionlab.com";
    const returnPath = body.return_path || "";
    let redirectUrl = `${supabaseUrl}/functions/v1/late-callback?org_id=${orgId}&user_id=${userData.id}&provider=${provider}&app_base_url=${encodeURIComponent(appBaseUrl)}`;
    if (returnPath) {
      redirectUrl += `&return_path=${encodeURIComponent(returnPath)}`;
    }

    const connectParams = new URLSearchParams({
      profileId: lateProfileId,
      redirect_url: redirectUrl,
    });

    if (reconnect_account_id) {
      connectParams.set("accountId", reconnect_account_id);
    }

    const connectUrl = `${LATE_API_BASE}/connect/${latePlatform}?${connectParams.toString()}`;
    console.log("[late-connect] Calling GET", connectUrl);

    const connectResponse = await fetch(connectUrl, {
      method: "GET",
      headers: lateHeaders,
    });

    const connectRaw = await connectResponse.text();
    console.log("[late-connect] Connect response status:", connectResponse.status, "body:", connectRaw.slice(0, 500));

    if (!connectResponse.ok) {
      let parsedErr: unknown;
      try { parsedErr = JSON.parse(connectRaw); } catch { parsedErr = connectRaw; }
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "LATE_ERROR",
            message: "Failed to generate connection link",
            detail: parsedErr,
            status: connectResponse.status,
          },
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let connectData: Record<string, unknown>;
    try {
      connectData = JSON.parse(connectRaw);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: { code: "LATE_ERROR", message: "Invalid response from Late.dev" } }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authUrl =
      (connectData.url as string) ||
      (connectData.authUrl as string) ||
      (connectData.connectUrl as string) ||
      (connectData.oauthUrl as string) ||
      ((connectData.data as Record<string, unknown>)?.url as string);

    if (!authUrl) {
      console.error("[late-connect] No URL in response:", JSON.stringify(connectData));
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "LATE_ERROR", message: "No auth URL returned from Late.dev", detail: connectData },
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[late-connect] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Unexpected error" },
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
