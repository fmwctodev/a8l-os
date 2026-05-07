import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { sendMailgunEmail, type MailgunRegion } from "../_shared/mailgun.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailQueueItem {
  id: string;
  organization_id: string;
  schedule_id: string;
  report_run_id: string;
  recipient_email: string;
  schedule: {
    report: {
      name: string;
      data_source: string;
    };
  };
  report_run: {
    row_count: number;
    started_at: string;
    finished_at: string;
  };
  export: {
    id: string;
    file_path: string;
    file_size: number;
  } | null;
}

async function sendWithMailgun(
  apiKey: string,
  domain: string,
  region: MailgunRegion,
  to: string,
  subject: string,
  htmlContent: string,
  textContent: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const result = await sendMailgunEmail({
    apiKey,
    domain,
    region,
    from: "Autom8ion Reports <reports@autom8ion.com>",
    to,
    subject,
    html: htmlContent,
    text: textContent,
    trackOpens: true,
    trackClicks: false,
  });
  if (result.ok) {
    return { success: true, messageId: result.messageId };
  }
  return { success: false, error: result.error };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildEmailContent(
  reportName: string,
  rowCount: number,
  runTime: string,
  downloadUrl: string | null,
  fileSize: number | null
): { html: string; text: string } {
  const text = `
Your scheduled report "${reportName}" is ready.

Report Summary:
- Records: ${rowCount.toLocaleString()}
- Generated: ${runTime}
${downloadUrl ? `- Download: ${downloadUrl}` : ''}
${fileSize ? `- File Size: ${formatBytes(fileSize)}` : ''}

This download link will expire in 14 days.

---
Autom8ion Reports
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); padding: 30px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Report Ready</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">${reportName}</p>
  </div>

  <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
    <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
      <h2 style="margin: 0 0 16px 0; font-size: 16px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Report Summary</h2>

      <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
        <span style="color: #64748b;">Records</span>
        <span style="font-weight: 600; color: #0f172a;">${rowCount.toLocaleString()}</span>
      </div>

      <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
        <span style="color: #64748b;">Generated</span>
        <span style="font-weight: 600; color: #0f172a;">${runTime}</span>
      </div>

      ${fileSize ? `
      <div style="display: flex; justify-content: space-between; padding: 12px 0;">
        <span style="color: #64748b;">File Size</span>
        <span style="font-weight: 600; color: #0f172a;">${formatBytes(fileSize)}</span>
      </div>
      ` : ''}
    </div>

    ${downloadUrl ? `
    <a href="${downloadUrl}" style="display: block; background: #0ea5e9; color: white; text-align: center; padding: 16px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
      Download CSV Report
    </a>
    <p style="text-align: center; color: #94a3b8; font-size: 13px; margin-top: 12px;">
      This link expires in 14 days
    </p>
    ` : '<p style="color: #94a3b8; text-align: center;">Export is still processing. You will receive another email when ready.</p>'}
  </div>

  <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 13px;">
    <p style="margin: 0;">Autom8ion Reports</p>
  </div>
</body>
</html>
  `.trim();

  return { html, text };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const mailgunApiKey = Deno.env.get("MAILGUN_API_KEY");
    const mailgunDomain = Deno.env.get("MAILGUN_DOMAIN");
    const mailgunRegion = ((Deno.env.get("MAILGUN_REGION") || "us").toLowerCase() === "eu"
      ? "eu"
      : "us") as MailgunRegion;
    if (!mailgunApiKey || !mailgunDomain) {
      return new Response(
        JSON.stringify({ error: "Mailgun API key/domain not configured (MAILGUN_API_KEY, MAILGUN_DOMAIN)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: pendingEmails, error: fetchError } = await supabase
      .from('report_email_queue')
      .select(`
        id,
        organization_id,
        schedule_id,
        report_run_id,
        recipient_email,
        schedule:report_schedules(
          report:reports(name, data_source)
        ),
        report_run:report_runs(row_count, started_at, finished_at)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      throw new Error(`Failed to fetch pending emails: ${fetchError.message}`);
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending emails', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: Array<{ emailId: string; status: string; error?: string }> = [];

    for (const emailData of pendingEmails) {
      const email = emailData as unknown as EmailQueueItem;

      try {
        const { data: exportData } = await supabase
          .from('report_exports')
          .select('id, file_path, file_size, status')
          .eq('report_run_id', email.report_run_id)
          .eq('status', 'complete')
          .maybeSingle();

        let downloadUrl: string | null = null;
        if (exportData?.file_path) {
          const { data: signedUrl } = await supabase.storage
            .from('report-exports')
            .createSignedUrl(exportData.file_path, 14 * 24 * 60 * 60);
          downloadUrl = signedUrl?.signedUrl || null;
        }

        const reportName = email.schedule?.report?.name || 'Report';
        const rowCount = email.report_run?.row_count || 0;
        const runTime = email.report_run?.finished_at
          ? formatDate(email.report_run.finished_at)
          : formatDate(new Date().toISOString());
        const fileSize = exportData?.file_size || null;

        const { html, text } = buildEmailContent(reportName, rowCount, runTime, downloadUrl, fileSize);

        const subject = `Your Report is Ready: ${reportName}`;

        const result = await sendWithMailgun(
          mailgunApiKey,
          mailgunDomain,
          mailgunRegion,
          email.recipient_email,
          subject,
          html,
          text,
        );

        if (result.success) {
          await supabase
            .from('report_email_queue')
            .update({
              status: 'sent',
              provider_message_id: result.messageId || null,
              sent_at: new Date().toISOString(),
            })
            .eq('id', email.id);

          results.push({ emailId: email.id, status: 'sent' });
        } else {
          await supabase
            .from('report_email_queue')
            .update({
              status: 'failed',
              error: result.error,
            })
            .eq('id', email.id);

          results.push({ emailId: email.id, status: 'failed', error: result.error });
        }
      } catch (error) {
        console.error(`Error sending email ${email.id}:`, error);

        await supabase
          .from('report_email_queue')
          .update({
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', email.id);

        results.push({
          emailId: email.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return new Response(
      JSON.stringify({
        sent: results.filter(r => r.status === 'sent').length,
        failed: results.filter(r => r.status === 'failed').length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Email sender error:', error);

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
