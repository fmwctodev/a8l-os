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

const MAX_JOBS_PER_RUN = 5;
const MAX_RETRY_ATTEMPTS = 3;

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

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const now = new Date().toISOString();

    const { data: jobs } = await supabase
      .from("gmail_sync_jobs")
      .select("*")
      .in("status", ["queued", "retry"])
      .lte("run_at", now)
      .lt("attempts", MAX_RETRY_ATTEMPTS)
      .order("run_at", { ascending: true })
      .limit(MAX_JOBS_PER_RUN);

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No jobs to process", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Array<{ jobId: string; status: string; detail?: string }> = [];

    for (const job of jobs) {
      await supabase
        .from("gmail_sync_jobs")
        .update({
          status: "running",
          attempts: (job.attempts || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      try {
        if (job.job_type === "initial" || job.job_type === "full_resync") {
          await runFullSync(supabase, job.organization_id, job.user_id);
        } else if (job.job_type === "incremental") {
          await runIncrementalSync(supabase, job.organization_id, job.user_id);
        } else {
          throw new Error(`Unknown job type: ${job.job_type}`);
        }

        await supabase
          .from("gmail_sync_jobs")
          .update({
            status: "done",
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        results.push({ jobId: job.id, status: "done" });
      } catch (jobErr) {
        const errMsg = (jobErr as Error).message;
        const attempts = (job.attempts || 0) + 1;

        if (attempts >= MAX_RETRY_ATTEMPTS) {
          await supabase
            .from("gmail_sync_jobs")
            .update({
              status: "failed",
              last_error: errMsg,
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);

          results.push({ jobId: job.id, status: "failed", detail: errMsg });
        } else {
          const backoffMs = Math.pow(2, attempts) * 30_000;
          const retryAt = new Date(Date.now() + backoffMs).toISOString();

          await supabase
            .from("gmail_sync_jobs")
            .update({
              status: "retry",
              last_error: errMsg,
              run_at: retryAt,
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);

          results.push({ jobId: job.id, status: "retry", detail: `Retry at ${retryAt}` });
        }
      }
    }

    const { data: activeUsers } = await supabase
      .from("gmail_sync_state")
      .select("organization_id, user_id, history_id")
      .eq("sync_status", "idle")
      .not("history_id", "is", null);

    if (activeUsers && activeUsers.length > 0) {
      for (const user of activeUsers) {
        const { data: existingJob } = await supabase
          .from("gmail_sync_jobs")
          .select("id")
          .eq("organization_id", user.organization_id)
          .eq("user_id", user.user_id)
          .eq("job_type", "incremental")
          .in("status", ["queued", "running", "retry"])
          .maybeSingle();

        if (!existingJob) {
          await supabase.from("gmail_sync_jobs").insert({
            organization_id: user.organization_id,
            user_id: user.user_id,
            job_type: "incremental",
            status: "queued",
            run_at: new Date(Date.now() + 5 * 60_000).toISOString(),
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("gmail-sync-job-runner error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function runFullSync(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  userId: string
) {
  const { data: tokenData } = await supabase
    .from("gmail_oauth_tokens")
    .select("*")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!tokenData) throw new Error("Gmail not connected");

  await supabase
    .from("gmail_sync_state")
    .upsert({ organization_id: orgId, user_id: userId, sync_status: "syncing", error_message: null, updated_at: new Date().toISOString() }, { onConflict: "organization_id,user_id" });

  const accessToken = await getAccessToken(
    supabase,
    tokenData as GmailTokenRecord
  );

  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const query = `after:${Math.floor(oneYearAgo.getTime() / 1000)}`;

  let nextPageToken: string | undefined;

  do {
    let listUrl = `${GMAIL_API_URL}/users/me/messages?q=${encodeURIComponent(query)}&maxResults=500`;
    if (nextPageToken) listUrl += `&pageToken=${nextPageToken}`;

    const listResponse = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!listResponse.ok) throw new Error("Failed to fetch messages list");

    const listData = await listResponse.json();
    const messageRefs: Array<{ id: string }> = listData.messages || [];
    nextPageToken = listData.nextPageToken;

    for (const ref of messageRefs) {
      const { data: existing } = await supabase
        .from("messages")
        .select("id")
        .eq("external_id", ref.id)
        .maybeSingle();

      if (existing) continue;

      const msgRes = await fetch(
        `${GMAIL_API_URL}/users/me/messages/${ref.id}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!msgRes.ok) continue;

      const msgData = await msgRes.json();
      await processGmailMessage(supabase, msgData, orgId, userId, tokenData.email, "full_sync_job");
    }
  } while (nextPageToken);

  const profileRes = await fetch(`${GMAIL_API_URL}/users/me/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
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
}

async function runIncrementalSync(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  userId: string
) {
  const { data: syncState } = await supabase
    .from("gmail_sync_state")
    .select("*")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!syncState?.history_id) {
    throw new Error("No history_id, need initial sync first");
  }

  const { data: tokenData } = await supabase
    .from("gmail_oauth_tokens")
    .select("*")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!tokenData) throw new Error("Gmail not connected");

  await supabase
    .from("gmail_sync_state")
    .update({ sync_status: "syncing", error_message: null, updated_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .eq("user_id", userId);

  const accessToken = await getAccessToken(
    supabase,
    tokenData as GmailTokenRecord
  );

  let addedIds = new Set<string>();
  let deletedIds = new Set<string>();
  let nextPageToken: string | undefined;
  let latestHistoryId = syncState.history_id;

  do {
    let url = `${GMAIL_API_URL}/users/me/history?startHistoryId=${syncState.history_id}&historyTypes=messageAdded&historyTypes=messageDeleted&maxResults=500`;
    if (nextPageToken) url += `&pageToken=${nextPageToken}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 404) {
      throw new Error("History expired, need full resync");
    }
    if (!res.ok) throw new Error(`History API failed: ${res.status}`);

    const data = await res.json();
    for (const record of data.history || []) {
      if (record.messagesAdded) {
        for (const a of record.messagesAdded) {
          if (a.message?.id) addedIds.add(a.message.id);
        }
      }
      if (record.messagesDeleted) {
        for (const d of record.messagesDeleted) {
          if (d.message?.id) deletedIds.add(d.message.id);
        }
      }
    }

    if (data.historyId) latestHistoryId = data.historyId;
    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  for (const id of deletedIds) addedIds.delete(id);

  for (const gmailMsgId of addedIds) {
    const { data: existing } = await supabase
      .from("messages")
      .select("id")
      .eq("external_id", gmailMsgId)
      .maybeSingle();

    if (existing) continue;

    const msgRes = await fetch(
      `${GMAIL_API_URL}/users/me/messages/${gmailMsgId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!msgRes.ok) continue;

    const msgData = await msgRes.json();
    await processGmailMessage(supabase, msgData, orgId, userId, tokenData.email, "incremental_job");
  }

  for (const gmailMsgId of deletedIds) {
    await supabase
      .from("messages")
      .update({ hidden_at: new Date().toISOString() })
      .eq("external_id", gmailMsgId);
  }

  const now = new Date().toISOString();
  await supabase
    .from("gmail_sync_state")
    .upsert({
      organization_id: orgId,
      user_id: userId,
      history_id: latestHistoryId,
      last_incremental_sync_at: now,
      sync_status: "idle",
      error_message: null,
      updated_at: now,
    }, { onConflict: "organization_id,user_id" });

  await supabase
    .from("user_connected_accounts")
    .update({ last_synced_at: now })
    .eq("user_id", userId)
    .eq("provider", "google_gmail");
}
