/**
 * approval-reminder-cron
 *
 * Scheduled task (every 30 minutes via pg_cron or Supabase scheduled functions).
 * Two responsibilities:
 *
 *   1. **Auto-expire stale approvals** — call expire_stale_approvals() RPC
 *      which walks every pending row past its expires_at and applies its
 *      expiration_branch ('approve' | 'reject' | 'escalate').
 *
 *   2. **Send reminder emails** — for pending approvals where
 *      last_reminder_sent_at is older than 24h (or null), send a nudge to
 *      every approver_user_id whose email we can resolve. Updates
 *      last_reminder_sent_at + reminder_count to avoid duplicate spam.
 *
 * Triggered via Supabase scheduled functions or an external cron POST.
 * No body required; service-role auth.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function getSupabase() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface ApprovalReminderRow {
  id: string;
  org_id: string;
  workflow_id: string;
  title: string | null;
  description: string | null;
  approver_user_ids: string[];
  reminder_count: number;
  last_reminder_sent_at: string | null;
  expires_at: string | null;
  created_at: string;
}

async function sendReminderEmails(
  supabase: ReturnType<typeof getSupabase>,
  approval: ApprovalReminderRow
): Promise<{ sent: number; failed: number }> {
  if (!approval.approver_user_ids?.length) return { sent: 0, failed: 0 };

  const { data: users } = await supabase
    .from("users")
    .select("id, email, full_name")
    .in("id", approval.approver_user_ids);

  if (!users?.length) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const dashboardUrl = `${Deno.env.get("APP_URL") ?? "https://os.autom8ionlab.com"}/automations/approvals/${approval.id}`;

  for (const user of users) {
    try {
      const subject = `Reminder: ${approval.title || "workflow approval needed"}`;
      const html = `
        <p>Hi ${user.full_name ?? ""},</p>
        <p>This workflow approval has been waiting for ${
          approval.last_reminder_sent_at
            ? "another"
            : "more than"
        } 24 hours:</p>
        <p><strong>${approval.title ?? "Approval"}</strong></p>
        <p>${approval.description ?? ""}</p>
        <p><a href="${dashboardUrl}" style="display:inline-block;padding:10px 16px;background:#0ea5e9;color:white;text-decoration:none;border-radius:6px;">Review in dashboard</a></p>
        ${approval.expires_at ? `<p style="font-size:12px;color:#6b7280;">This approval auto-expires on ${approval.expires_at}.</p>` : ""}
      `;

      // Dispatch via the org's SendGrid sender (email-send Edge Function).
      const response = await fetch(`${SUPABASE_URL}/functions/v1/email-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          orgId: approval.org_id,
          rail: "sendgrid",
          to: user.email,
          subject,
          body_html: html,
          metadata: { source: "approval_reminder", approval_id: approval.id },
        }),
      });

      if (response.ok) sent++;
      else failed++;
    } catch (err) {
      console.error(`[approval-reminder-cron] failed to email ${user.email}:`, err);
      failed++;
    }
  }

  // Audit: log the reminder dispatch to workflow_approval_decisions.
  await supabase.from("workflow_approval_decisions").insert({
    approval_id: approval.id,
    org_id: approval.org_id,
    decision: "reminder_sent",
    comment: `Reminder #${approval.reminder_count + 1} sent to ${sent} approver(s)`,
    via_magic_link: false,
  }).catch(() => {});

  return { sent, failed };
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Optional: require a cron-shared-secret header if not running via pg_cron.
  // For pg_cron, the function is invoked via service role token already.

  const supabase = getSupabase();

  // ─── 1. Auto-expire stale approvals ─────────────────────────────────
  let expiredCount = 0;
  try {
    const { data, error } = await supabase.rpc("expire_stale_approvals");
    if (error) {
      console.error("[approval-reminder-cron] expire_stale_approvals error:", error);
    } else {
      expiredCount = data ?? 0;
    }
  } catch (err) {
    console.error("[approval-reminder-cron] expire RPC threw:", err);
  }

  // ─── 2. Send reminders for >24h pending approvals ───────────────────
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: stale, error: staleErr } = await supabase
    .from("workflow_approval_queue")
    .select(
      "id, org_id, workflow_id, title, description, approver_user_ids, reminder_count, last_reminder_sent_at, expires_at, created_at"
    )
    .eq("status", "pending_approval")
    .or(`last_reminder_sent_at.is.null,last_reminder_sent_at.lt.${cutoff}`)
    .limit(50);

  if (staleErr) {
    console.error("[approval-reminder-cron] stale query error:", staleErr);
  }

  let totalSent = 0;
  let totalFailed = 0;
  if (stale?.length) {
    for (const row of stale as ApprovalReminderRow[]) {
      // Skip if reminder already sent enough times (cap at 4 to avoid spam).
      if (row.reminder_count >= 4) continue;
      const result = await sendReminderEmails(supabase, row);
      totalSent += result.sent;
      totalFailed += result.failed;

      if (result.sent > 0) {
        await supabase
          .from("workflow_approval_queue")
          .update({
            last_reminder_sent_at: new Date().toISOString(),
            reminder_count: row.reminder_count + 1,
          })
          .eq("id", row.id);
      }
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      expired: expiredCount,
      reminders_sent: totalSent,
      reminders_failed: totalFailed,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
