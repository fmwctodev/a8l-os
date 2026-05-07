import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getDecryptedMailgunCreds, sendMailgunEmail } from "../_shared/mailgun.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function buildTeamEmail(vars: {
  project_name: string;
  ticket_number: string;
  priority: string;
  severity_score: number;
  title: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  client_company: string | null;
  categoryLabel: string;
  request_type: string;
  environment: string;
  description: string;
  steps_to_reproduce: string | null;
  expected_behavior: string | null;
  actual_behavior: string | null;
  affected_area: string | null;
  affected_feature: string | null;
  affected_integration: string | null;
  error_messages: string | null;
  business_impact: string;
  impact_description: string | null;
  users_affected_count: number;
  workaround_available: boolean;
  browser_info: string | null;
  attachments: { name: string; url: string }[];
  priorityColor: string;
  priorityLabel: string;
  impactLabel: string;
}): string {
  const v = vars;
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 680px; margin: 0 auto; background: #f8fafc; padding: 24px;">
      <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px 32px;">
          <h1 style="color: white; margin: 0 0 4px 0; font-size: 18px;">New Support Ticket</h1>
          <p style="color: #94a3b8; margin: 0; font-size: 14px;">${v.project_name} &mdash; ${v.ticket_number}</p>
        </div>
        <div style="padding: 32px;">
          <div style="display: flex; gap: 12px; margin-bottom: 24px;">
            <span style="display: inline-block; background: ${v.priorityColor}20; color: ${v.priorityColor}; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">${v.priorityLabel} Priority</span>
            <span style="display: inline-block; background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">Severity: ${v.severity_score}/10</span>
          </div>
          <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 20px;">${v.title}</h2>
          <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <h3 style="color: #475569; margin: 0 0 12px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Client Information</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 4px 0; color: #64748b; font-size: 14px; width: 120px;">Name</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px; font-weight: 500;">${v.client_name}</td></tr>
              ${v.client_email ? `<tr><td style="padding: 4px 0; color: #64748b; font-size: 14px;">Email</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px;"><a href="mailto:${v.client_email}" style="color: #2563eb;">${v.client_email}</a></td></tr>` : ""}
              ${v.client_phone ? `<tr><td style="padding: 4px 0; color: #64748b; font-size: 14px;">Phone</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px;"><a href="tel:${v.client_phone}" style="color: #2563eb;">${v.client_phone}</a></td></tr>` : ""}
              ${v.client_company ? `<tr><td style="padding: 4px 0; color: #64748b; font-size: 14px;">Company</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px;">${v.client_company}</td></tr>` : ""}
            </table>
          </div>
          <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <h3 style="color: #475569; margin: 0 0 12px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Ticket Classification</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 4px 0; color: #64748b; font-size: 14px; width: 140px;">Category</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px; font-weight: 500;">${v.categoryLabel}</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b; font-size: 14px;">Request Type</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px;">${v.request_type.replace(/_/g, " ")}</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b; font-size: 14px;">Environment</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px;">${v.environment}</td></tr>
            </table>
          </div>
          <div style="margin-bottom: 24px;">
            <h3 style="color: #475569; margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Description</h3>
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
              <p style="color: #334155; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${v.description}</p>
            </div>
          </div>
          ${v.steps_to_reproduce ? `
          <div style="margin-bottom: 24px;">
            <h3 style="color: #475569; margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Steps to Reproduce</h3>
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
              <p style="color: #334155; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${v.steps_to_reproduce}</p>
            </div>
          </div>` : ""}
          ${v.expected_behavior ? `
          <div style="margin-bottom: 24px;">
            <h3 style="color: #475569; margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Expected Behavior</h3>
            <p style="color: #334155; font-size: 14px; line-height: 1.6; margin: 0;">${v.expected_behavior}</p>
          </div>` : ""}
          ${v.actual_behavior ? `
          <div style="margin-bottom: 24px;">
            <h3 style="color: #475569; margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Actual Behavior</h3>
            <p style="color: #334155; font-size: 14px; line-height: 1.6; margin: 0;">${v.actual_behavior}</p>
          </div>` : ""}
          ${v.affected_area || v.affected_feature || v.affected_integration ? `
          <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <h3 style="color: #475569; margin: 0 0 12px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Affected Area</h3>
            <table style="width: 100%; border-collapse: collapse;">
              ${v.affected_area ? `<tr><td style="padding: 4px 0; color: #64748b; font-size: 14px; width: 140px;">Module / Area</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px;">${v.affected_area}</td></tr>` : ""}
              ${v.affected_feature ? `<tr><td style="padding: 4px 0; color: #64748b; font-size: 14px;">Feature</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px;">${v.affected_feature}</td></tr>` : ""}
              ${v.affected_integration ? `<tr><td style="padding: 4px 0; color: #64748b; font-size: 14px;">Integration</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px;">${v.affected_integration}</td></tr>` : ""}
            </table>
          </div>` : ""}
          ${v.error_messages ? `
          <div style="margin-bottom: 24px;">
            <h3 style="color: #475569; margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Error Messages</h3>
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px;">
              <code style="color: #dc2626; font-size: 13px; white-space: pre-wrap;">${v.error_messages}</code>
            </div>
          </div>` : ""}
          <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <h3 style="color: #475569; margin: 0 0 12px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Business Impact</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 4px 0; color: #64748b; font-size: 14px; width: 140px;">Impact Level</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px; font-weight: 500;">${v.impactLabel}</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b; font-size: 14px;">Users Affected</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px;">${v.users_affected_count}</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b; font-size: 14px;">Workaround</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px;">${v.workaround_available ? "Yes" : "No"}</td></tr>
              ${v.impact_description ? `<tr><td style="padding: 4px 0; color: #64748b; font-size: 14px; vertical-align: top;">Details</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px;">${v.impact_description}</td></tr>` : ""}
            </table>
          </div>
          ${v.browser_info ? `
          <div style="margin-bottom: 24px;">
            <h3 style="color: #475569; margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Browser / Device Info</h3>
            <p style="color: #64748b; font-size: 13px; margin: 0;">${v.browser_info}</p>
          </div>` : ""}
          ${v.attachments && v.attachments.length > 0 ? `
          <div style="margin-bottom: 24px;">
            <h3 style="color: #475569; margin: 0 0 12px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Attachments (${v.attachments.length})</h3>
            ${v.attachments.map((a: { name: string; url: string }) => `
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
}

function buildClientConfirmationEmail(vars: {
  client_name: string;
  ticket_number: string;
  title: string;
  project_name: string;
  priorityLabel: string;
  priorityColor: string;
  org_name: string;
  support_email: string;
}): string {
  const v = vars;
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 24px;">
      <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px 32px;">
          <h1 style="color: white; margin: 0 0 4px 0; font-size: 18px;">Support Ticket Received</h1>
          <p style="color: #94a3b8; margin: 0; font-size: 14px;">${v.project_name}</p>
        </div>
        <div style="padding: 32px;">
          <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
            Hi ${v.client_name},
          </p>
          <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
            We've received your support ticket and our team has been notified. Here's a summary of what we received:
          </p>
          <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px; width: 120px;">Ticket #</td>
                <td style="padding: 6px 0; color: #0f172a; font-size: 14px; font-weight: 600;">${v.ticket_number}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Subject</td>
                <td style="padding: 6px 0; color: #0f172a; font-size: 14px; font-weight: 500;">${v.title}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Priority</td>
                <td style="padding: 6px 0; color: ${v.priorityColor}; font-size: 14px; font-weight: 500;">${v.priorityLabel}</td>
              </tr>
            </table>
          </div>
          <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 8px 0;">
            We'll review your ticket and get back to you as soon as possible. If you need to provide additional information, you can reply to this email or reach us at <a href="mailto:${v.support_email}" style="color: #2563eb;">${v.support_email}</a>.
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
    const { ticket_id, org_id } = await req.json();

    if (!ticket_id || !org_id || !UUID_RE.test(ticket_id) || !UUID_RE.test(org_id)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid ticket_id or org_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: ticket, error: ticketError } = await supabase
      .from("project_support_tickets")
      .select("*")
      .eq("id", ticket_id)
      .eq("org_id", org_id)
      .maybeSingle();

    console.log("Ticket lookup:", { found: !!ticket, error: ticketError?.message, ticket_id, org_id });

    if (ticketError || !ticket) {
      console.error("Ticket lookup failed:", ticketError?.message ?? "not found");
      return new Response(
        JSON.stringify({ success: false, error: "Ticket not found", detail: ticketError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const [{ data: org }, { data: project }] = await Promise.all([
      supabase.from("organizations").select("name, email").eq("id", org_id).maybeSingle(),
      supabase.from("projects").select("name").eq("id", ticket.project_id).maybeSingle(),
    ]);

    const project_name = project?.name || "Unknown Project";
    const org_name = org?.name || "Autom8ion Lab";
    const org_email = org?.email || "support@autom8ionlab.com";

    const ticket_number = ticket.ticket_number || `#${ticket.id.slice(0, 8)}`;
    const title = ticket.title || ticket.subject || "Untitled";
    const client_name = ticket.client_name || "Unknown";
    const client_email = ticket.client_email || null;
    const client_phone = ticket.client_phone || null;
    const client_company = ticket.company_name || null;
    const service_category = ticket.service_category || "other";
    const request_type = ticket.request_type || "general_inquiry";
    const priority = ticket.priority || "medium";
    const description = ticket.description || "";
    const steps_to_reproduce = ticket.steps_to_reproduce || null;
    const expected_behavior = ticket.expected_behavior || null;
    const actual_behavior = ticket.actual_behavior || null;
    const affected_area = ticket.affected_area || null;
    const affected_feature = ticket.affected_feature || null;
    const affected_integration = ticket.affected_integration || null;
    const environment = ticket.environment || "production";
    const browser_info = ticket.browser_info || null;
    const error_messages = ticket.error_messages || null;
    const business_impact = ticket.business_impact || "minimal";
    const impact_description = ticket.impact_description || null;
    const users_affected_count = ticket.users_affected_count ?? 0;
    const workaround_available = ticket.workaround_available ?? false;
    const severity_score = ticket.severity_score ?? 5;
    const attachments: { name: string; url: string }[] = Array.isArray(ticket.attachments)
      ? ticket.attachments
      : [];

    const mgCreds = await getDecryptedMailgunCreds(
      org_id,
      supabase,
      supabaseUrl,
      serviceRoleKey
    );

    if (!mgCreds) {
      return new Response(
        JSON.stringify({ success: false, error: "Mailgun not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
    const categoryLabel = SERVICE_CATEGORY_LABELS[service_category] || service_category;
    const priorityLabel = PRIORITY_LABELS[priority] || priority;
    const impactLabel = IMPACT_LABELS[business_impact] || business_impact;

    const teamEmailContent = buildTeamEmail({
      project_name,
      ticket_number,
      priority,
      severity_score,
      title,
      client_name,
      client_email,
      client_phone,
      client_company,
      categoryLabel,
      request_type,
      environment,
      description,
      steps_to_reproduce,
      expected_behavior,
      actual_behavior,
      affected_area,
      affected_feature,
      affected_integration,
      error_messages,
      business_impact,
      impact_description,
      users_affected_count,
      workaround_available,
      browser_info,
      attachments,
      priorityColor,
      priorityLabel,
      impactLabel,
    });

    const priorityPrefix = priority === "critical" ? "[CRITICAL] " : priority === "high" ? "[HIGH] " : "";
    const subject = `${priorityPrefix}New Support Ticket: ${title} (${ticket_number})`;

    console.log("Sending team email to support@autom8ionlab.com from", fromEmail);

    const teamEmailRes = await sendMailgunEmail({
      apiKey: mgCreds.apiKey,
      domain: mgCreds.domain,
      region: mgCreds.region,
      from: `${fromName} <${fromEmail}>`,
      to: "support@autom8ionlab.com",
      subject,
      html: teamEmailContent,
      trackOpens: true,
      trackClicks: false,
    });

    const teamStatus = teamEmailRes.status;
    let teamError = "";
    if (!teamEmailRes.ok) {
      teamError = teamEmailRes.error || "";
      console.error("Mailgun team email error:", teamStatus, teamError);
    } else {
      console.log("Team email sent successfully, status:", teamStatus);
    }

    let clientStatus = 0;
    let clientError = "";
    if (client_email) {
      console.log("Sending client confirmation to", client_email);

      const clientEmailContent = buildClientConfirmationEmail({
        client_name,
        ticket_number,
        title,
        project_name,
        priorityLabel,
        priorityColor,
        org_name,
        support_email: org_email,
      });

      const clientEmailRes = await sendMailgunEmail({
        apiKey: mgCreds.apiKey,
        domain: mgCreds.domain,
        region: mgCreds.region,
        from: `${fromName} <${fromEmail}>`,
        to: client_email,
        toName: client_name,
        replyTo: org_email,
        subject: `Your support ticket has been received (${ticket_number})`,
        html: clientEmailContent,
        trackOpens: true,
        trackClicks: false,
      });

      clientStatus = clientEmailRes.status;
      if (!clientEmailRes.ok) {
        clientError = clientEmailRes.error || "";
        console.error("Mailgun client email error:", clientStatus, clientError);
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
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Support ticket notification error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
