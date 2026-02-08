import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_URL = "https://gmail.googleapis.com/gmail/v1";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const pubsubTopic = Deno.env.get("GMAIL_PUBSUB_TOPIC");

    if (!supabaseUrl || !serviceRoleKey || !clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: "Missing configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pubsubTopic) {
      return new Response(
        JSON.stringify({ error: "GMAIL_PUBSUB_TOPIC not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const twoDaysFromNow = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const { data: expiringSyncs, error: queryError } = await supabase
      .from("gmail_sync_state")
      .select("*, gmail_token:gmail_oauth_tokens!inner(id, access_token, refresh_token, token_expiry, email)")
      .or(`watch_expiration.is.null,watch_expiration.lt.${twoDaysFromNow}`);

    if (queryError) {
      console.error("Failed to query sync states:", queryError);
      return new Response(
        JSON.stringify({ error: "Failed to query sync states" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!expiringSyncs || expiringSyncs.length === 0) {
      return new Response(
        JSON.stringify({ renewed: 0, message: "No watches need renewal" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let renewed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const sync of expiringSyncs) {
      try {
        const tokenRecord = (sync as Record<string, unknown>).gmail_token as {
          id: string;
          access_token: string;
          refresh_token: string;
          token_expiry: string;
          email: string;
        };

        if (!tokenRecord) continue;

        let accessToken = tokenRecord.access_token;
        const tokenExpiry = new Date(tokenRecord.token_expiry);

        if (tokenExpiry < new Date(Date.now() + 5 * 60 * 1000)) {
          const refreshRes = await fetch(GOOGLE_TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              refresh_token: tokenRecord.refresh_token,
              client_id: clientId,
              client_secret: clientSecret,
              grant_type: "refresh_token",
            }),
          });

          if (!refreshRes.ok) {
            errors.push(`Token refresh failed for ${tokenRecord.email}`);
            failed++;
            continue;
          }

          const refreshData = await refreshRes.json();
          accessToken = refreshData.access_token;

          await supabase
            .from("gmail_oauth_tokens")
            .update({
              access_token: accessToken,
              token_expiry: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", tokenRecord.id);
        }

        const watchRes = await fetch(`${GMAIL_API_URL}/users/me/watch`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            topicName: pubsubTopic,
            labelIds: ["INBOX", "SENT"],
            labelFilterBehavior: "include",
          }),
        });

        if (!watchRes.ok) {
          const errText = await watchRes.text();
          errors.push(`Watch renewal failed for ${tokenRecord.email}: ${errText}`);
          failed++;
          continue;
        }

        const watchData = await watchRes.json();

        await supabase
          .from("gmail_sync_state")
          .update({
            history_id: String(watchData.historyId),
            watch_expiration: new Date(Number(watchData.expiration)).toISOString(),
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sync.id);

        renewed++;
      } catch (err) {
        errors.push(`Error for sync ${sync.id}: ${(err as Error).message}`);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ renewed, failed, total: expiringSyncs.length, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("gmail-watch-renew error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
