import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PROVIDER_MAP: Record<string, string> = {
  facebook: "FACEBOOK",
  instagram: "INSTAGRAM",
  linkedin: "LINKEDIN",
  google_business: "GOOGLE",
  youtube: "GOOGLE",
  tiktok: "TIKTOK",
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
    const unipileDsn = Deno.env.get("UNIPILE_DSN");
    const unipileApiKey = Deno.env.get("UNIPILE_API_KEY");

    if (!unipileDsn || !unipileApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "CONFIG_ERROR", message: "Unipile not configured" },
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
    const { provider, reconnect_account_id, success_redirect_url, failure_redirect_url } = body;

    if (!provider || !PROVIDER_MAP[provider]) {
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

    const isReconnect = !!reconnect_account_id;
    const nameTag = `${userData.organization_id}:${userData.id}:${provider}`;
    const webhookUrl = `${supabaseUrl}/functions/v1/unipile-account-webhook`;
    const appBaseUrl =
      Deno.env.get("APP_BASE_URL") || supabaseUrl.replace(/\.supabase\.co.*/, ".supabase.co");
    const successUrl = success_redirect_url || `${appBaseUrl}/marketing/social/accounts?unipile=success`;
    const failureUrl = failure_redirect_url || `${appBaseUrl}/marketing/social/accounts?unipile=error`;

    const expiresOn = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const unipilePayload: Record<string, unknown> = {
      type: isReconnect ? "reconnect" : "create",
      providers: [PROVIDER_MAP[provider]],
      api_url: unipileDsn,
      expiresOn,
      success_redirect_url: successUrl,
      failure_redirect_url: failureUrl,
      notify_url: webhookUrl,
      name: nameTag,
    };

    if (isReconnect && reconnect_account_id) {
      unipilePayload.reconnect_account = reconnect_account_id;
    }

    const unipileResponse = await fetch(
      `${unipileDsn}/api/v1/hosted/accounts/link`,
      {
        method: "POST",
        headers: {
          "X-API-KEY": unipileApiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(unipilePayload),
      }
    );

    if (!unipileResponse.ok) {
      const errBody = await unipileResponse.text();
      console.error("Unipile connect error:", unipileResponse.status, errBody);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "UNIPILE_ERROR",
            message: "Failed to generate connection link",
          },
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const unipileData = await unipileResponse.json();
    const hostedUrl = unipileData.url;

    if (!hostedUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "UNIPILE_ERROR",
            message: "No auth URL returned from Unipile",
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
        data: { url: hostedUrl, provider, type: isReconnect ? "reconnect" : "create" },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("unipile-connect error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unexpected error",
        },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
