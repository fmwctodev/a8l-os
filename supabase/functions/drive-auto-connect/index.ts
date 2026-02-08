import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing environment variables");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { provider_token, provider_refresh_token } = await req.json();

    if (!provider_token || !provider_refresh_token) {
      return jsonResponse(
        { error: "Missing provider_token or provider_refresh_token" },
        400
      );
    }

    const userinfoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${provider_token}` },
    });

    if (!userinfoRes.ok) {
      return jsonResponse({ error: "Failed to verify Google token" }, 400);
    }

    const userinfo = await userinfoRes.json();
    const email = userinfo.email;

    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!userData) {
      return jsonResponse({ error: "User not found" }, 404);
    }

    const tokenExpiry = new Date(Date.now() + 3600 * 1000).toISOString();

    const { error: upsertError } = await supabase
      .from("drive_connections")
      .upsert(
        {
          user_id: user.id,
          organization_id: userData.organization_id,
          connected_by: user.id,
          email,
          access_token_encrypted: provider_token,
          refresh_token_encrypted: provider_refresh_token,
          token_expiry: tokenExpiry,
          scopes: [
            "https://www.googleapis.com/auth/drive",
          ],
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("Failed to save drive connection:", upsertError);
      return jsonResponse(
        { error: "Failed to save Drive connection" },
        500
      );
    }

    const { error: flagError } = await supabase
      .from("users")
      .update({
        google_login_connected: true,
        google_drive_connected: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (flagError) {
      console.error("Failed to update user flags:", flagError);
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "drive_auto_connected",
      entity_type: "drive_connection",
      after_state: { email, organization_id: userData.organization_id },
    });

    return jsonResponse({ connected: true, email });
  } catch (err) {
    console.error("Drive auto-connect error:", err);
    return jsonResponse(
      { error: (err as Error).message || "An error occurred" },
      500
    );
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
