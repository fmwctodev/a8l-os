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

    const reqBody = await req.json().catch(() => ({}));
    const { org_id: orgId, user_id: userId } = reqBody;

    if (!orgId || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing org_id or user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: syncState } = await supabase
      .from("gmail_sync_state")
      .select("*")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!syncState?.history_id) {
      return new Response(
        JSON.stringify({ error: "No history_id found. Run initial sync first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (syncState.sync_status === "syncing") {
      return new Response(
        JSON.stringify({ error: "Sync already in progress", status: syncState.sync_status }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    await supabase
      .from("gmail_sync_state")
      .update({ sync_status: "syncing", error_message: null, updated_at: new Date().toISOString() })
      .eq("organization_id", orgId)
      .eq("user_id", userId);

    const accessToken = await getAccessToken(
      supabase,
      tokenData as GmailTokenRecord
    );

    let allMessageIds = new Set<string>();
    let deletedMessageIds = new Set<string>();
    let nextPageToken: string | undefined;
    let latestHistoryId = syncState.history_id;

    do {
      let url = `${GMAIL_API_URL}/users/me/history?startHistoryId=${syncState.history_id}&historyTypes=messageAdded&historyTypes=messageDeleted&maxResults=500`;
      if (nextPageToken) {
        url += `&pageToken=${nextPageToken}`;
      }

      const historyRes = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (historyRes.status === 404) {
        const now = new Date().toISOString();
        await supabase
          .from("gmail_sync_state")
          .update({
            sync_status: "idle",
            error_message: "History expired. Queuing full resync.",
            updated_at: now,
          })
          .eq("organization_id", orgId)
          .eq("user_id", userId);

        await supabase.from("gmail_sync_jobs").insert({
          organization_id: orgId,
          user_id: userId,
          job_type: "full_resync",
          status: "queued",
          run_at: new Date().toISOString(),
        });

        return new Response(
          JSON.stringify({ success: false, error: "History expired, full resync queued" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!historyRes.ok) {
        throw new Error(`History API failed: ${historyRes.status}`);
      }

      const historyData = await historyRes.json();
      const records = historyData.history || [];

      for (const record of records) {
        if (record.messagesAdded) {
          for (const added of record.messagesAdded) {
            if (added.message?.id) allMessageIds.add(added.message.id);
          }
        }
        if (record.messagesDeleted) {
          for (const deleted of record.messagesDeleted) {
            if (deleted.message?.id) deletedMessageIds.add(deleted.message.id);
          }
        }
      }

      if (historyData.historyId) {
        latestHistoryId = historyData.historyId;
      }
      nextPageToken = historyData.nextPageToken;
    } while (nextPageToken);

    for (const id of deletedMessageIds) {
      allMessageIds.delete(id);
    }

    let processedCount = 0;
    let skippedCount = 0;

    for (const gmailMsgId of allMessageIds) {
      const { data: existing } = await supabase
        .from("messages")
        .select("id")
        .eq("external_id", gmailMsgId)
        .maybeSingle();

      if (existing) {
        skippedCount++;
        continue;
      }

      const msgRes = await fetch(
        `${GMAIL_API_URL}/users/me/messages/${gmailMsgId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!msgRes.ok) {
        skippedCount++;
        continue;
      }

      const msgData = await msgRes.json();
      const result = await processGmailMessage(
        supabase,
        msgData,
        orgId,
        userId,
        tokenData.email,
        "incremental_poll"
      );

      if (result.processed) {
        processedCount++;
      } else {
        skippedCount++;
      }
    }

    let deletedCount = 0;
    for (const gmailMsgId of deletedMessageIds) {
      const { count } = await supabase
        .from("messages")
        .update({ hidden_at: new Date().toISOString() })
        .eq("external_id", gmailMsgId)
        .select("id", { count: "exact", head: true });

      if (count && count > 0) deletedCount++;
    }

    if (processedCount > 0) {
      try {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "email",
          title: "New Email Received",
          body: processedCount === 1
            ? "You have 1 new email"
            : `You have ${processedCount} new emails`,
          link: "/conversations",
          metadata: { count: processedCount },
        });
      } catch {}
    }

    const now = new Date().toISOString();
    await supabase
      .from("gmail_sync_state")
      .update({
        history_id: latestHistoryId,
        last_incremental_sync_at: now,
        sync_status: "idle",
        error_message: null,
        updated_at: now,
      })
      .eq("organization_id", orgId)
      .eq("user_id", userId);

    await supabase
      .from("user_connected_accounts")
      .update({ last_synced_at: now })
      .eq("user_id", userId)
      .eq("provider", "google_gmail");

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        skipped: skippedCount,
        deleted: deletedCount,
        historyId: latestHistoryId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Gmail incremental sync error:", error);

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const reqBody = await req.clone().json().catch(() => ({}));
      if (supabaseUrl && serviceRoleKey && reqBody.org_id && reqBody.user_id) {
        const sb = createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        await sb
          .from("gmail_sync_state")
          .update({
            sync_status: "error",
            error_message: (error as Error).message,
            updated_at: new Date().toISOString(),
          })
          .eq("organization_id", reqBody.org_id)
          .eq("user_id", reqBody.user_id);
      }
    } catch {
      // best-effort error logging
    }

    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
