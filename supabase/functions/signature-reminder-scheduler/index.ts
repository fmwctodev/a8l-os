import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const APP_BASE_URL = "https://os.autom8ionlab.com";

async function computeHash(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateSecureToken(): { raw: string; hashPromise: Promise<string> } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { raw, hashPromise: computeHash(raw) };
}

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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();

    const { data: pendingRequests, error: fetchError } = await supabase
      .from("proposal_signature_requests")
      .select(
        `
        id,
        org_id,
        proposal_id,
        signer_name,
        signer_email,
        access_token_hash,
        status,
        expires_at,
        last_reminder_sent_at,
        reminder_count,
        created_at,
        proposal:proposals!proposal_signature_requests_proposal_id_fkey(
          id, title, total_value, currency
        )
      `
      )
      .in("status", ["pending", "viewed"])
      .gt("expires_at", now.toISOString())
      .order("created_at", { ascending: true })
      .limit(50);

    if (fetchError) {
      throw new Error(`Failed to fetch requests: ${fetchError.message}`);
    }

    if (!pendingRequests || pendingRequests.length === 0) {
      return new Response(
        JSON.stringify({ message: "No requests need reminders", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const reminderIntervalHours = 48;
    let sentCount = 0;
    let skippedCount = 0;

    for (const req of pendingRequests) {
      const lastSent = req.last_reminder_sent_at
        ? new Date(req.last_reminder_sent_at)
        : new Date(req.created_at);
      const hoursSinceLast =
        (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);

      if (hoursSinceLast < reminderIntervalHours) {
        skippedCount++;
        continue;
      }

      if ((req.reminder_count || 0) >= 3) {
        skippedCount++;
        continue;
      }

      const expiresAt = new Date(req.expires_at);
      const daysRemaining = Math.ceil(
        (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      const proposal = req.proposal as unknown as {
        id: string;
        title: string;
        total_value: number;
        currency: string;
      };

      if (!proposal) {
        skippedCount++;
        continue;
      }

      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", req.org_id)
        .single();

      const companyName = org?.name || "Our Company";

      const token = generateSecureToken();
      const tokenHash = await token.hashPromise;

      await supabase
        .from("proposal_signature_requests")
        .update({ access_token_hash: tokenHash })
        .eq("id", req.id);

      const signingUrl = `${APP_BASE_URL}/sign/proposal/${req.id}?token=${encodeURIComponent(token.raw)}`;

      const expiresFormatted = expiresAt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const urgencyText =
        daysRemaining <= 1
          ? "This request expires tomorrow."
          : `This request expires in ${daysRemaining} days.`;

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="padding: 40px 32px 32px;">
            <p style="font-size: 16px; color: #1e293b; margin: 0 0 20px;">Hi ${req.signer_name},</p>
            <p style="font-size: 16px; color: #334155; line-height: 1.6; margin: 0 0 16px;">
              This is a friendly reminder that your signature is still needed on the following proposal:
            </p>
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px;">
              <p style="font-size: 14px; color: #92400e; font-weight: 600; margin: 0;">${urgencyText}</p>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 0 0 28px;">
              <p style="font-size: 18px; color: #0f172a; font-weight: 600; margin: 0;">${proposal.title}</p>
              <p style="font-size: 13px; color: #94a3b8; margin: 4px 0 0;">Expires: ${expiresFormatted}</p>
            </div>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${signingUrl}" style="display: inline-block; padding: 14px 40px; background-color: #0891b2; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Review &amp; Sign Now
              </a>
            </div>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
              Sent by ${companyName}
            </p>
          </div>
        </div>
      `;

      const { data: fromAddress } = await supabase
        .from("email_from_addresses")
        .select("id")
        .eq("org_id", req.org_id)
        .eq("is_default", true)
        .maybeSingle();

      let sendgridMessageId: string | null = null;
      let sendError: string | null = null;

      if (fromAddress) {
        try {
          const emailRes = await fetch(`${supabaseUrl}/functions/v1/email-send`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              action: "send",
              toEmail: req.signer_email,
              toName: req.signer_name,
              fromAddressId: fromAddress.id,
              subject: `Reminder: Please sign "${proposal.title}"`,
              htmlBody: htmlBody,
              trackOpens: true,
              trackClicks: false,
              transactional: true,
            }),
          });
          const emailResult = await emailRes.json();
          if (emailRes.ok && emailResult.success) {
            sendgridMessageId = emailResult.messageId || null;
          } else {
            sendError = emailResult.error || "Email send failed";
          }
        } catch (emailErr) {
          sendError = emailErr instanceof Error ? emailErr.message : "Email send failed";
        }
      }

      await supabase
        .from("proposal_signature_requests")
        .update({
          last_reminder_sent_at: now.toISOString(),
          reminder_count: (req.reminder_count || 0) + 1,
          send_status: sendError ? "failed" : "sent",
          sendgrid_message_id: sendgridMessageId,
          send_error: sendError,
        })
        .eq("id", req.id);

      await supabase.from("proposal_audit_events").insert({
        org_id: req.org_id,
        proposal_id: req.proposal_id,
        event_type: "reminder_sent",
        actor_type: "system",
        metadata: {
          request_id: req.id,
          reminder_number: (req.reminder_count || 0) + 1,
          days_remaining: daysRemaining,
          sendgrid_message_id: sendgridMessageId,
          send_error: sendError,
        },
      });

      sentCount++;
    }

    return new Response(
      JSON.stringify({
        processed: pendingRequests.length,
        sent: sentCount,
        skipped: skippedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Signature reminder scheduler error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
