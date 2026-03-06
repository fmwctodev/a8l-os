import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  getAccessToken,
  processGmailMessage,
  GMAIL_API_URL,
  type GmailTokenRecord,
} from "../_shared/gmail-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const reqBody = await req.json().catch(() => ({}));
  const { org_id: orgId, user_id: userId } = reqBody;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing environment variables");
    }

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") || "";
    const isServiceRole = token === serviceRoleKey;

    if (!isServiceRole) {
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Missing authorization" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: authError } = await anonClient.auth.getUser(token);
      if (authError) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (!orgId || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing org_id or user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("gmail_sync_state")
      .upsert({
        organization_id: orgId,
        user_id: userId,
        sync_status: "syncing",
        error_message: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "organization_id,user_id" });

    const { data: tokenData } = await supabase
      .from("gmail_oauth_tokens")
      .select("*")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!tokenData) {
      return new Response(
        JSON.stringify({ error: "Gmail not connected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = await getAccessToken(
      supabase,
      tokenData as GmailTokenRecord
    );

    const daysBack = (reqBody.days_back as number) || 365;
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    const query = `after:${Math.floor(since.getTime() / 1000)}`;

    let processedCount = 0;
    let skippedCount = 0;
    let nextPageToken: string | undefined;
    let totalFetched = 0;
    const MAX_MESSAGES = 5000;
    const TOKEN_REFRESH_INTERVAL = 500;
    let currentAccessToken = accessToken;
    let messagesSinceRefresh = 0;

    do {
      let listUrl = `${GMAIL_API_URL}/users/me/messages?q=${encodeURIComponent(query)}&maxResults=500`;
      if (nextPageToken) listUrl += `&pageToken=${nextPageToken}`;

      const listResponse = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${currentAccessToken}` },
        signal: AbortSignal.timeout(15000),
      });

      if (listResponse.status === 401) {
        currentAccessToken = await getAccessToken(supabase, tokenData as GmailTokenRecord);
        const retryResponse = await fetch(listUrl, {
          headers: { Authorization: `Bearer ${currentAccessToken}` },
          signal: AbortSignal.timeout(15000),
        });
        if (!retryResponse.ok) throw new Error("Failed to fetch messages list after token refresh");
        const retryData = await retryResponse.json();
        nextPageToken = retryData.nextPageToken;
        const retryRefs: Array<{ id: string }> = retryData.messages || [];
        totalFetched += retryRefs.length;
        for (const ref of retryRefs) {
          if (totalFetched > MAX_MESSAGES) break;
          const { data: existingMessage } = await supabase.from("messages").select("id").eq("external_id", ref.id).maybeSingle();
          if (existingMessage) { skippedCount++; continue; }
          const msgResponse = await fetch(`${GMAIL_API_URL}/users/me/messages/${ref.id}`, { headers: { Authorization: `Bearer ${currentAccessToken}` }, signal: AbortSignal.timeout(15000) });
          if (!msgResponse.ok) continue;
          const msgData = await msgResponse.json();
          const result = await processGmailMessage(supabase, msgData, orgId, userId, tokenData.email, "initial_sync");
          if (result.processed) processedCount++; else skippedCount++;
          messagesSinceRefresh++;
        }
        if (totalFetched >= MAX_MESSAGES) break;
        continue;
      }

      if (!listResponse.ok) {
        throw new Error("Failed to fetch messages list");
      }

      const listData = await listResponse.json();
      const messageRefs: Array<{ id: string }> = listData.messages || [];
      nextPageToken = listData.nextPageToken;
      totalFetched += messageRefs.length;

      for (const ref of messageRefs) {
        if (totalFetched > MAX_MESSAGES) break;

        if (messagesSinceRefresh >= TOKEN_REFRESH_INTERVAL) {
          try {
            currentAccessToken = await getAccessToken(supabase, tokenData as GmailTokenRecord);
            messagesSinceRefresh = 0;
          } catch {
            console.warn("Mid-sync token refresh failed, continuing with current token");
          }
        }

        const { data: existingMessage } = await supabase
          .from("messages")
          .select("id")
          .eq("external_id", ref.id)
          .maybeSingle();

        if (existingMessage) {
          skippedCount++;
          continue;
        }

        const msgResponse = await fetch(
          `${GMAIL_API_URL}/users/me/messages/${ref.id}`,
          { headers: { Authorization: `Bearer ${currentAccessToken}` }, signal: AbortSignal.timeout(15000) }
        );

        if (msgResponse.status === 401) {
          currentAccessToken = await getAccessToken(supabase, tokenData as GmailTokenRecord);
          messagesSinceRefresh = 0;
          const retryMsg = await fetch(`${GMAIL_API_URL}/users/me/messages/${ref.id}`, { headers: { Authorization: `Bearer ${currentAccessToken}` }, signal: AbortSignal.timeout(15000) });
          if (!retryMsg.ok) continue;
          const msgData = await retryMsg.json();
          const result = await processGmailMessage(supabase, msgData, orgId, userId, tokenData.email, "initial_sync");
          if (result.processed) processedCount++; else skippedCount++;
          messagesSinceRefresh++;
          continue;
        }

        if (!msgResponse.ok) continue;

        const msgData = await msgResponse.json();
        const result = await processGmailMessage(
          supabase,
          msgData,
          orgId,
          userId,
          tokenData.email,
          "initial_sync"
        );

        if (result.processed) {
          processedCount++;
        } else {
          skippedCount++;
        }
        messagesSinceRefresh++;
      }

      if (totalFetched >= MAX_MESSAGES) {
        console.warn(`Gmail sync capped at ${MAX_MESSAGES} messages`);
        break;
      }
    } while (nextPageToken);

    const profileRes = await fetch(`${GMAIL_API_URL}/users/me/profile`, {
      headers: { Authorization: `Bearer ${currentAccessToken}` },
      signal: AbortSignal.timeout(15000),
    });
    let historyId: string | null = null;
    if (profileRes.ok) {
      const profile = await profileRes.json();
      historyId = String(profile.historyId);
    }

    const now = new Date().toISOString();
    await supabase
      .from("gmail_sync_state")
      .upsert({
        organization_id: orgId,
        user_id: userId,
        sync_status: "idle",
        last_full_sync_at: now,
        last_incremental_sync_at: now,
        history_id: historyId,
        error_message: null,
        updated_at: now,
      }, { onConflict: "organization_id,user_id" });

    await supabase
      .from("user_connected_accounts")
      .update({ last_synced_at: now })
      .eq("user_id", userId)
      .eq("provider", "google_gmail");

    await supabase
      .from("gmail_sync_jobs")
      .update({ status: "done", updated_at: now })
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .eq("job_type", "initial")
      .eq("status", "running");

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        skipped: skippedCount,
        total: totalFetched,
        historyId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceRoleKey && orgId && userId) {
      try {
        const supabase = createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        await supabase
          .from("gmail_sync_state")
          .upsert({
            organization_id: orgId,
            user_id: userId,
            sync_status: "error",
            error_message: (error as Error).message,
            updated_at: new Date().toISOString(),
          }, { onConflict: "organization_id,user_id" });
      } catch {
        // best-effort error logging
      }
    }

    console.error("Gmail sync error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
