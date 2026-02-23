import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  resolveRefreshToken,
  refreshAccessToken,
  writeMasterToken,
  crossPopulateServiceTables,
} from "../_shared/google-oauth-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();

    const { data: staleRows, error: fetchError } = await supabase
      .from("google_oauth_master")
      .select("id, org_id, user_id, email, granted_scopes, token_expiry, encrypted_refresh_token")
      .lt("token_expiry", new Date(Date.now() + 10 * 60 * 1000).toISOString());

    if (fetchError) {
      console.error("[TokenRefreshCron] Failed to fetch stale tokens:", fetchError);
      return new Response(JSON.stringify({ success: false, error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!staleRows || staleRows.length === 0) {
      return new Response(JSON.stringify({ success: true, refreshed: 0, message: "No tokens need refresh" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[TokenRefreshCron] Found ${staleRows.length} tokens to refresh`);

    let refreshed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of staleRows) {
      try {
        const resolved = await resolveRefreshToken(supabase, row.user_id, row.org_id);
        if (!resolved) {
          errors.push(`No refresh token for user ${row.user_id}`);
          failed++;
          continue;
        }

        const result = await refreshAccessToken(resolved.refreshToken);
        if (!result) {
          errors.push(`Google rejected refresh for user ${row.user_id}`);
          failed++;
          continue;
        }

        const newExpiry = new Date(Date.now() + result.expires_in * 1000).toISOString();
        const newRefreshToken = result.refresh_token || resolved.refreshToken;
        const scopes = row.granted_scopes || [];

        await writeMasterToken(supabase, row.org_id, row.user_id, row.email, result.access_token, newRefreshToken, newExpiry, scopes);
        await crossPopulateServiceTables(supabase, row.org_id, row.user_id, row.email, result.access_token, newRefreshToken, newExpiry, scopes);

        refreshed++;
        console.log(`[TokenRefreshCron] Refreshed token for user ${row.user_id}`);
      } catch (err) {
        const msg = (err as Error).message || String(err);
        errors.push(`User ${row.user_id}: ${msg}`);
        failed++;
        console.error(`[TokenRefreshCron] Failed for user ${row.user_id}:`, msg);
      }
    }

    return new Response(JSON.stringify({ success: true, total: staleRows.length, refreshed, failed, errors: errors.length > 0 ? errors : undefined }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[TokenRefreshCron] Unhandled error:", error);
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
