import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getDecryptedSendGridKey(
  orgId: string,
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<string | null> {
  const envKey = Deno.env.get("SENDGRID_API_KEY");
  if (envKey) return envKey;

  const { data: conn } = await supabase
    .from("integration_connections")
    .select(
      "credentials_encrypted, credentials_iv, status, integrations!inner(key)"
    )
    .eq("org_id", orgId)
    .eq("integrations.key", "sendgrid")
    .maybeSingle();

  if (
    !conn ||
    conn.status !== "connected" ||
    !conn.credentials_encrypted ||
    !conn.credentials_iv
  )
    return null;

  const response = await fetch(`${supabaseUrl}/functions/v1/email-crypto`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "decrypt",
      encrypted: conn.credentials_encrypted,
      iv: conn.credentials_iv,
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.plaintext;
}

const TYPE_LABELS: Record<string, string> = {
  scope: "Scope Change",
  timeline: "Timeline Adjustment",
  design: "Design Change",
  feature: "New Feature",
  bugfix: "Bug Fix",
  support: "Support Request",
  other: "Other",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "#64748b",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};

const SOURCE_LABELS: Record<string, string> = {
  public_form: "Client Portal",
  internal: "Internal (Staff)",
  ai: "AI Generated",
};

function buildTeamEmail(v: {
  project_name: string;
  reference_id: string;
  priority: string;
  priorityLabel: string;
  priorityColor: string;
  title: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  typeLabel: string;
  sourceLabel: string;
  requested_due_date: string | null;
  description: string;
}): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 680px; margin: 0 auto; background: #f8fafc; padding: 24px;">
      <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px 32px;">
          <h1 style="color: white; margin: 0 0 4px 0; font-size: 18px;">New Change Request</h1>
          <p style="color: #94a3b8; margin: 0; font-size: 14px;">${v.project_name} &mdash; ${v.reference_id}</p>
        </div>
        <div style="padding: 32px;">
          <div style="display: flex; gap: 12px; margin-bottom: 24px;">
            <span style="display: inline-block; background: ${v.priorityColor}20; color: ${v.priorityColor}; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">${v.priorityLabel} Priority</span>
          </div>
          <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 20px;">${v.title}</h2>
          <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <h3 style="color: #475569; margin: 0 0 12px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Client Information</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 4px 0; color: #64748b; font-size: 14px; width: 120px;">Name</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px; font-weight: 500;">${v.client_name}</td></tr>
              ${v.client_email ? `<tr><td style="padding: 4px 0; color: #64748b; font-size: 14px;">Email</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px;"><a href="mailto:${v.client_email}" style="color: #2563eb;">${v.client_email}</a></td></tr>` : ""}
              ${v.client_phone ? `<tr><td style="padding: 4px 0; color: #64748b; font-size: 14px;">Phone</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px;"><a href="tel:${v.client_phone}" style="color: #2563eb;">${v.client_phone}</a></td></tr>` : ""}
            </table>
          </div>
          <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <h3 style="color: #475569; margin: 0 0 12px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Request Classification</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 4px 0; color: #64748b; font-size: 14px; width: 140px;">Change Type</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px; font-weight: 500;">${v.typeLabel}</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b; font-size: 14px;">Priority</td><td style="padding: 4px 0; color: ${v.priorityColor}; font-size: 14px; font-weight: 500;">${v.priorityLabel}</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b; font-size: 14px;">Source</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px;">${v.sourceLabel}</td></tr>
              ${v.requested_due_date ? `<tr><td style="padding: 4px 0; color: #64748b; font-size: 14px;">Requested By</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px;">${v.requested_due_date}</td></tr>` : ""}
            </table>
          </div>
          <div style="margin-bottom: 24px;">
            <h3 style="color: #475569; margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Description</h3>
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
              <p style="color: #334155; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${v.description}</p>
            </div>
          </div>
        </div>
      </div>
      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">
        This notification was sent by Autom8ion Lab OS.
      </p>
    </div>
  `;
}

function buildClientConfirmationEmail(v: {
  client_name: string;
  reference_id: string;
  title: string;
  project_name: string;
  typeLabel: string;
  priorityLabel: string;
  priorityColor: string;
  org_name: string;
  support_email: string;
}): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 24px;">
      <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px 32px;">
          <h1 style="color: white; margin: 0 0 4px 0; font-size: 18px;">Change Request Received</h1>
          <p style="color: #94a3b8; margin: 0; font-size: 14px;">${v.project_name}</p>
        </div>
        <div style="padding: 32px;">
          <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
            Hi ${v.client_name},
          </p>
          <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
            We've received your change request and our team has been notified. Here's a summary of what we received:
          </p>
          <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px; width: 120px;">Reference</td>
                <td style="padding: 6px 0; color: #0f172a; font-size: 14px; font-weight: 600;">${v.reference_id}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Subject</td>
                <td style="padding: 6px 0; color: #0f172a; font-size: 14px; font-weight: 500;">${v.title}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Type</td>
                <td style="padding: 6px 0; color: #0f172a; font-size: 14px;">${v.typeLabel}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Priority</td>
                <td style="padding: 6px 0; color: ${v.priorityColor}; font-size: 14px; font-weight: 500;">${v.priorityLabel}</td>
              </tr>
            </table>
          </div>
          <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 8px 0;">
            We'll review your request and get back to you as soon as possible. If you need to provide additional information, you can reply to this email or reach us at <a href="mailto:${v.support_email}" style="color: #2563eb;">${v.support_email}</a>.
          </p>
        </div>
      </div>
      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">
        ${v.org_name} &mdash; Powered by Autom8ion Lab OS
      </p>
    </div>
  `;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { request_id, org_id } = await req.json();

    if (
      !request_id ||
      !org_id ||
      !UUID_RE.test(request_id) ||
      !UUID_RE.test(org_id)
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid request_id or org_id",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: cr, error: crError } = await supabase
      .from("project_change_requests")
      .select("*")
      .eq("id", request_id)
      .eq("org_id", org_id)
      .maybeSingle();

    console.log("Change request lookup:", {
      found: !!cr,
      error: crError?.message,
      request_id,
      org_id,
    });

    if (crError || !cr) {
      console.error(
        "Change request lookup failed:",
        crError?.message ?? "not found"
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: "Change request not found",
          detail: crError?.message,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const [{ data: org }, { data: project }] = await Promise.all([
      supabase
        .from("organizations")
        .select("name, email")
        .eq("id", org_id)
        .maybeSingle(),
      supabase
        .from("projects")
        .select("name")
        .eq("id", cr.project_id)
        .maybeSingle(),
    ]);

    const project_name = project?.name || "Unknown Project";
    const org_name = org?.name || "Autom8ion Lab";
    const org_email = org?.email || "support@autom8ionlab.com";

    const reference_id = `CR-${cr.id.slice(0, 8).toUpperCase()}`;
    const title = cr.title || "Untitled";
    const client_name = cr.client_name || "Unknown";
    const client_email = cr.client_email || null;
    const client_phone = cr.client_phone || null;
    const request_type = cr.request_type || "other";
    const priority = cr.priority || "medium";
    const description = cr.description || "";
    const source = cr.source || "internal";
    const requested_due_date = cr.requested_due_date || null;

    const sendgridKey = await getDecryptedSendGridKey(
      org_id,
      supabase,
      supabaseUrl,
      serviceRoleKey
    );

    if (!sendgridKey) {
      return new Response(
        JSON.stringify({ success: false, error: "SendGrid not configured" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: fromAddress } = await supabase
      .from("email_from_addresses")
      .select("email, display_name")
      .eq("org_id", org_id)
      .eq("active", true)
      .eq("is_default", true)
      .maybeSingle();

    const fromEmail = fromAddress?.email || "notifications@autom8ion.com";
    const fromName = fromAddress?.display_name || "Autom8ion Lab";

    const priorityColor = PRIORITY_COLORS[priority] || "#64748b";
    const priorityLabel = PRIORITY_LABELS[priority] || priority;
    const typeLabel = TYPE_LABELS[request_type] || request_type;
    const sourceLabel = SOURCE_LABELS[source] || source;

    const teamEmailContent = buildTeamEmail({
      project_name,
      reference_id,
      priority,
      priorityLabel,
      priorityColor,
      title,
      client_name,
      client_email,
      client_phone,
      typeLabel,
      sourceLabel,
      requested_due_date,
      description,
    });

    const priorityPrefix =
      priority === "critical"
        ? "[CRITICAL] "
        : priority === "high"
          ? "[HIGH] "
          : "";
    const subject = `${priorityPrefix}New Change Request: ${title} (${reference_id})`;

    console.log(
      "Sending team email to support@autom8ionlab.com from",
      fromEmail
    );

    const teamEmailRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sendgridKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: "support@autom8ionlab.com" }] }],
        from: { email: fromEmail, name: fromName },
        subject,
        content: [{ type: "text/html", value: teamEmailContent }],
        tracking_settings: {
          open_tracking: { enable: true },
          click_tracking: { enable: false },
        },
      }),
    });

    const teamStatus = teamEmailRes.status;
    let teamError = "";
    if (!teamEmailRes.ok) {
      teamError = await teamEmailRes.text().catch(() => "");
      console.error("SendGrid team email error:", teamStatus, teamError);
    } else {
      console.log("Team email sent successfully, status:", teamStatus);
    }

    let clientStatus = 0;
    let clientError = "";
    if (client_email) {
      console.log("Sending client confirmation to", client_email);

      const clientEmailContent = buildClientConfirmationEmail({
        client_name,
        reference_id,
        title,
        project_name,
        typeLabel,
        priorityLabel,
        priorityColor,
        org_name,
        support_email: org_email,
      });

      const clientEmailRes = await fetch(
        "https://api.sendgrid.com/v3/mail/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sendgridKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [
              { to: [{ email: client_email, name: client_name }] },
            ],
            from: { email: fromEmail, name: fromName },
            reply_to: { email: org_email, name: org_name },
            subject: `Your change request has been received (${reference_id})`,
            content: [{ type: "text/html", value: clientEmailContent }],
            tracking_settings: {
              open_tracking: { enable: true },
              click_tracking: { enable: false },
            },
          }),
        }
      );

      clientStatus = clientEmailRes.status;
      if (!clientEmailRes.ok) {
        clientError = await clientEmailRes.text().catch(() => "");
        console.error(
          "SendGrid client email error:",
          clientStatus,
          clientError
        );
      } else {
        console.log("Client email sent successfully, status:", clientStatus);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        team_email_status: teamStatus,
        team_email_error: teamError || undefined,
        client_email_status: clientStatus || undefined,
        client_email_error: clientError || undefined,
        from: fromEmail,
        to_team: "support@autom8ionlab.com",
        to_client: client_email,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Change request notification error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
