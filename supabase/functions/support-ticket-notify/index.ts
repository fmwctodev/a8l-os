import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function getDecryptedSendGridKey(
  orgId: string,
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<string | null> {
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

const SERVICE_CATEGORY_LABELS: Record<string, string> = {
  ai_automation: "AI Automation System",
  crm_pipeline: "CRM / Pipeline System",
  content_automation: "Content Automation Engine",
  integration_api: "Integration / API System",
  workflow_automation: "Workflow Automation",
  custom_software: "Custom Software Development",
  data_analytics: "Data / Analytics System",
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

const IMPACT_LABELS: Record<string, string> = {
  revenue_affecting: "Revenue Affecting",
  operations_blocked: "Operations Blocked",
  team_productivity: "Team Productivity",
  client_facing: "Client-Facing",
  internal_only: "Internal Only",
  minimal: "Minimal",
};

interface TicketPayload {
  ticket_id: string;
  org_id: string;
  project_name: string;
  ticket_number: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  client_company: string | null;
  title: string;
  service_category: string;
  request_type: string;
  priority: string;
  description: string;
  steps_to_reproduce: string | null;
  expected_behavior: string | null;
  actual_behavior: string | null;
  affected_area: string | null;
  affected_feature: string | null;
  affected_integration: string | null;
  environment: string;
  browser_info: string | null;
  error_messages: string | null;
  business_impact: string;
  impact_description: string | null;
  users_affected_count: number;
  workaround_available: boolean;
  severity_score: number;
  attachments: { name: string; url: string }[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const payload: TicketPayload = await req.json();
    const {
      org_id,
      project_name,
      ticket_number,
      client_name,
      client_email,
      client_phone,
      client_company,
      title,
      service_category,
      request_type,
      priority,
      description,
      steps_to_reproduce,
      expected_behavior,
      actual_behavior,
      affected_area,
      affected_feature,
      affected_integration,
      environment,
      browser_info,
      error_messages,
      business_impact,
      impact_description,
      users_affected_count,
      workaround_available,
      severity_score,
      attachments,
    } = payload;

    const sendgridKey = await getDecryptedSendGridKey(
      org_id,
      supabase,
      supabaseUrl,
      serviceRoleKey
    );

    if (!sendgridKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "SendGrid not configured",
        }),
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
    const categoryLabel =
      SERVICE_CATEGORY_LABELS[service_category] || service_category;
    const priorityLabel = PRIORITY_LABELS[priority] || priority;
    const impactLabel = IMPACT_LABELS[business_impact] || business_impact;

    const emailContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 680px; margin: 0 auto; background: #f8fafc; padding: 24px;">
        <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px 32px;">
            <h1 style="color: white; margin: 0 0 4px 0; font-size: 18px;">New Support Ticket</h1>
            <p style="color: #94a3b8; margin: 0; font-size: 14px;">${project_name} &mdash; ${ticket_number}</p>
          </div>

          <div style="padding: 32px;">
            <div style="display: flex; gap: 12px; margin-bottom: 24px;">
              <span style="display: inline-block; background: ${priorityColor}20; color: ${priorityColor}; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">${priorityLabel} Priority</span>
              <span style="display: inline-block; background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">Severity: ${severity_score}/10</span>
            </div>

            <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 20px;">${title}</h2>

            <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <h3 style="color: #475569; margin: 0 0 12px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Client Information</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 4px 0; color: #64748b; font-size: 14px; width: 120px;">Name</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px; font-weight: 500;">${client_name}</td></tr>
                ${client_email ? `<tr><td style="padding: 4px 0; color: #64748b; font-size: 14px;">Email</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px;"><a href="mailto:${client_email}" style="color: #2563eb;">${client_email}</a></td></tr>` : ""}
                ${client_phone ? `<tr><td style="padding: 4px 0; color: #64748b; font-size: 14px;">Phone</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px;"><a href="tel:${client_phone}" style="color: #2563eb;">${client_phone}</a></td></tr>` : ""}
                ${client_company ? `<tr><td style="padding: 4px 0; color: #64748b; font-size: 14px;">Company</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px;">${client_company}</td></tr>` : ""}
              </table>
            </div>

            <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <h3 style="color: #475569; margin: 0 0 12px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Ticket Classification</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 4px 0; color: #64748b; font-size: 14px; width: 140px;">Category</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px; font-weight: 500;">${categoryLabel}</td></tr>
                <tr><td style="padding: 4px 0; color: #64748b; font-size: 14px;">Request Type</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px;">${request_type.replace(/_/g, " ")}</td></tr>
                <tr><td style="padding: 4px 0; color: #64748b; font-size: 14px;">Environment</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px;">${environment}</td></tr>
              </table>
            </div>

            <div style="margin-bottom: 24px;">
              <h3 style="color: #475569; margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Description</h3>
              <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
                <p style="color: #334155; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${description}</p>
              </div>
            </div>

            ${steps_to_reproduce ? `
            <div style="margin-bottom: 24px;">
              <h3 style="color: #475569; margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Steps to Reproduce</h3>
              <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
                <p style="color: #334155; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${steps_to_reproduce}</p>
              </div>
            </div>` : ""}

            ${expected_behavior ? `
            <div style="margin-bottom: 24px;">
              <h3 style="color: #475569; margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Expected Behavior</h3>
              <p style="color: #334155; font-size: 14px; line-height: 1.6; margin: 0;">${expected_behavior}</p>
            </div>` : ""}

            ${actual_behavior ? `
            <div style="margin-bottom: 24px;">
              <h3 style="color: #475569; margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Actual Behavior</h3>
              <p style="color: #334155; font-size: 14px; line-height: 1.6; margin: 0;">${actual_behavior}</p>
            </div>` : ""}

            ${affected_area || affected_feature || affected_integration ? `
            <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <h3 style="color: #475569; margin: 0 0 12px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Affected Area</h3>
              <table style="width: 100%; border-collapse: collapse;">
                ${affected_area ? `<tr><td style="padding: 4px 0; color: #64748b; font-size: 14px; width: 140px;">Module / Area</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px;">${affected_area}</td></tr>` : ""}
                ${affected_feature ? `<tr><td style="padding: 4px 0; color: #64748b; font-size: 14px;">Feature</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px;">${affected_feature}</td></tr>` : ""}
                ${affected_integration ? `<tr><td style="padding: 4px 0; color: #64748b; font-size: 14px;">Integration</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px;">${affected_integration}</td></tr>` : ""}
              </table>
            </div>` : ""}

            ${error_messages ? `
            <div style="margin-bottom: 24px;">
              <h3 style="color: #475569; margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Error Messages</h3>
              <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px;">
                <code style="color: #dc2626; font-size: 13px; white-space: pre-wrap;">${error_messages}</code>
              </div>
            </div>` : ""}

            <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <h3 style="color: #475569; margin: 0 0 12px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Business Impact</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 4px 0; color: #64748b; font-size: 14px; width: 140px;">Impact Level</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px; font-weight: 500;">${impactLabel}</td></tr>
                <tr><td style="padding: 4px 0; color: #64748b; font-size: 14px;">Users Affected</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px;">${users_affected_count}</td></tr>
                <tr><td style="padding: 4px 0; color: #64748b; font-size: 14px;">Workaround</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px;">${workaround_available ? "Yes" : "No"}</td></tr>
                ${impact_description ? `<tr><td style="padding: 4px 0; color: #64748b; font-size: 14px; vertical-align: top;">Details</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px;">${impact_description}</td></tr>` : ""}
              </table>
            </div>

            ${browser_info ? `
            <div style="margin-bottom: 24px;">
              <h3 style="color: #475569; margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Browser / Device Info</h3>
              <p style="color: #64748b; font-size: 13px; margin: 0;">${browser_info}</p>
            </div>` : ""}

            ${attachments && attachments.length > 0 ? `
            <div style="margin-bottom: 24px;">
              <h3 style="color: #475569; margin: 0 0 12px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Attachments (${attachments.length})</h3>
              ${attachments.map((a: { name: string; url: string }) => `
                <div style="margin-bottom: 8px;">
                  <a href="${a.url}" style="color: #2563eb; font-size: 14px; text-decoration: none;">${a.name}</a>
                </div>
              `).join("")}
            </div>` : ""}
          </div>
        </div>

        <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">
          This notification was sent by Autom8ion Lab OS.
        </p>
      </div>
    `;

    const priorityPrefix = priority === "critical" ? "[CRITICAL] " : priority === "high" ? "[HIGH] " : "";
    const subject = `${priorityPrefix}New Support Ticket: ${title} (${ticket_number})`;

    await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sendgridKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [
          { to: [{ email: "support@autom8ionlab.com" }] },
        ],
        from: { email: fromEmail, name: fromName },
        subject,
        content: [{ type: "text/html", value: emailContent }],
      }),
    });

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Support ticket notification error:", error);
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
