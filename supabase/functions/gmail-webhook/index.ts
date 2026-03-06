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
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response("Missing config", { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const messageData = body?.message?.data;
    if (!messageData) {
      return new Response("OK", { status: 200 });
    }

    let notification: { emailAddress: string; historyId: string };
    try {
      notification = JSON.parse(atob(messageData));
    } catch {
      console.error("Failed to decode Pub/Sub message data");
      return new Response("OK", { status: 200 });
    }

    const { emailAddress, historyId: newHistoryId } = notification;
    if (!emailAddress || !newHistoryId) {
      return new Response("OK", { status: 200 });
    }

    const { data: tokenData } = await supabase
      .from("gmail_oauth_tokens")
      .select("*")
      .ilike("email", emailAddress)
      .maybeSingle();

    if (!tokenData) {
      console.log(`No token found for ${emailAddress}`);
      return new Response("OK", { status: 200 });
    }

    const orgId = tokenData.organization_id;
    const userId = tokenData.user_id;

    const { data: syncState } = await supabase
      .from("gmail_sync_state")
      .select("*")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    const storedHistoryId = syncState?.history_id;
    if (!storedHistoryId) {
      await supabase
        .from("gmail_sync_state")
        .upsert(
          {
            organization_id: orgId,
            user_id: userId,
            history_id: newHistoryId,
            sync_status: "idle",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,user_id" }
        );
      return new Response("OK", { status: 200 });
    }

    if (syncState?.sync_status === "syncing") {
      console.log(`Skipping webhook for ${emailAddress}: sync already in progress`);
      return new Response("OK", { status: 200 });
    }

    const { data: claimed } = await supabase
      .from("gmail_sync_state")
      .update({ sync_status: "syncing", updated_at: new Date().toISOString() })
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .eq("sync_status", "idle")
      .select("organization_id")
      .maybeSingle();

    if (!claimed) {
      console.log(`Could not acquire sync lock for ${emailAddress}`);
      return new Response("OK", { status: 200 });
    }

    const accessToken = await getAccessToken(
      supabase,
      tokenData as GmailTokenRecord
    );

    const historyUrl = `${GMAIL_API_URL}/users/me/history?startHistoryId=${storedHistoryId}&historyTypes=messageAdded&historyTypes=messageDeleted&historyTypes=labelAdded&historyTypes=labelRemoved&maxResults=500`;

    const historyRes = await fetch(historyUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15000),
    });

    if (historyRes.status === 404) {
      await supabase
        .from("gmail_sync_state")
        .update({
          history_id: newHistoryId,
          sync_status: "idle",
          error_message: "History expired, need full resync",
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", orgId)
        .eq("user_id", userId);
      return new Response("OK", { status: 200 });
    }

    if (!historyRes.ok) {
      console.error("History list failed:", historyRes.status);
      await supabase
        .from("gmail_sync_state")
        .update({
          sync_status: "error",
          error_message: `History fetch failed: ${historyRes.status}`,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", orgId)
        .eq("user_id", userId);
      return new Response("OK", { status: 200 });
    }

    const historyData = await historyRes.json();
    const historyRecords = historyData.history || [];

    const processedMessageIds = new Set<string>();
    let processedCount = 0;

    for (const record of historyRecords) {
      if (record.messagesAdded) {
        for (const added of record.messagesAdded) {
          const gmailMsgId = added.message?.id;
          if (!gmailMsgId || processedMessageIds.has(gmailMsgId)) continue;
          processedMessageIds.add(gmailMsgId);

          const { data: existing } = await supabase
            .from("messages")
            .select("id")
            .eq("external_id", gmailMsgId)
            .maybeSingle();

          if (existing) continue;

          const msgRes = await fetch(
            `${GMAIL_API_URL}/users/me/messages/${gmailMsgId}`,
            { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000) }
          );

          if (!msgRes.ok) continue;

          const msgData = await msgRes.json();
          const result = await processGmailMessage(
            supabase,
            msgData,
            orgId,
            userId,
            tokenData.email,
            "push"
          );

          if (result.processed) processedCount++;
        }
      }

      if (record.messagesDeleted) {
        for (const deleted of record.messagesDeleted) {
          const gmailMsgId = deleted.message?.id;
          if (!gmailMsgId) continue;

          await supabase
            .from("messages")
            .update({ hidden_at: new Date().toISOString() })
            .eq("external_id", gmailMsgId);
        }
      }
    }

    const now = new Date().toISOString();
    await supabase
      .from("gmail_sync_state")
      .update({
        history_id: historyData.historyId || newHistoryId,
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

    console.log(`Processed ${processedCount} messages for ${emailAddress}`);
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("gmail-webhook error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
