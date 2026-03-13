import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TestEmailRequest {
  action: "test";
  toEmail: string;
  fromAddressId: string;
  subject?: string;
  body?: string;
}

interface SendEmailRequest {
  action: "send";
  toEmail: string;
  toName?: string;
  fromAddressId?: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
  replyTo?: string;
  unsubscribeGroupId?: string;
  trackOpens?: boolean;
  trackClicks?: boolean;
  transactional?: boolean;
}

interface CheckStatusRequest {
  action: "check-status";
}

type RequestPayload = TestEmailRequest | SendEmailRequest | CheckStatusRequest;

interface EmailSetupStatus {
  isConfigured: boolean;
  providerConnected: boolean;
  verifiedDomainsCount: number;
  activeFromAddressesCount: number;
  hasDefaultFromAddress: boolean;
  hasDefaultUnsubscribeGroup: boolean;
  blockingReasons: string[];
}

async function getDecryptedApiKey(
  orgId: string,
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<string | null> {
  const { data: conn } = await supabase
    .from("integration_connections")
    .select("credentials_encrypted, credentials_iv, status, integrations!inner(key)")
    .eq("org_id", orgId)
    .eq("integrations.key", "sendgrid")
    .maybeSingle();

  if (!conn || conn.status !== "connected" || !conn.credentials_encrypted || !conn.credentials_iv) {
    return null;
  }

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

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data.plaintext;
}

async function getEmailSetupStatus(
  orgId: string,
  supabase: ReturnType<typeof createClient>
): Promise<EmailSetupStatus> {
  const status: EmailSetupStatus = {
    isConfigured: false,
    providerConnected: false,
    verifiedDomainsCount: 0,
    activeFromAddressesCount: 0,
    hasDefaultFromAddress: false,
    hasDefaultUnsubscribeGroup: false,
    blockingReasons: [],
  };

  const { data: conn } = await supabase
    .from("integration_connections")
    .select("status, integrations!inner(key)")
    .eq("org_id", orgId)
    .eq("integrations.key", "sendgrid")
    .maybeSingle();

  status.providerConnected = conn?.status === "connected";
  if (!status.providerConnected) {
    status.blockingReasons.push("SendGrid is not connected");
  }

  const { data: domains } = await supabase
    .from("email_domains")
    .select("id")
    .eq("org_id", orgId)
    .eq("status", "verified");

  status.verifiedDomainsCount = domains?.length || 0;
  if (status.verifiedDomainsCount === 0) {
    status.blockingReasons.push("No verified domains");
  }

  const { data: fromAddresses } = await supabase
    .from("email_from_addresses")
    .select("id, is_default")
    .eq("org_id", orgId)
    .eq("active", true);

  status.activeFromAddressesCount = fromAddresses?.length || 0;
  status.hasDefaultFromAddress = fromAddresses?.some(a => a.is_default) || false;

  if (status.activeFromAddressesCount === 0) {
    status.blockingReasons.push("No active from addresses");
  }

  const { data: defaults } = await supabase
    .from("email_defaults")
    .select("default_unsubscribe_group_id")
    .eq("org_id", orgId)
    .single();

  status.hasDefaultUnsubscribeGroup = !!defaults?.default_unsubscribe_group_id;

  status.isConfigured = status.blockingReasons.length === 0;

  return status;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const userClient = createClient(supabaseUrl, authHeader.replace("Bearer ", ""), {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid user token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: userData } = await supabase
      .from("users")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (!userData) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orgId = userData.org_id;
    const payload: RequestPayload = await req.json();

    if (payload.action === "check-status") {
      const { data: hasViewPermission } = await supabase.rpc("user_has_email_permission", {
        user_id: user.id,
        required_permission: "email.settings.view",
      });

      if (!hasViewPermission) {
        return new Response(
          JSON.stringify({ error: "Permission denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const status = await getEmailSetupStatus(orgId, supabase);
      return new Response(
        JSON.stringify({ success: true, status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.action === "test") {
      const { data: hasTestPermission } = await supabase.rpc("user_has_email_permission", {
        user_id: user.id,
        required_permission: "email.send.test",
      });

      if (!hasTestPermission) {
        return new Response(
          JSON.stringify({ error: "Permission denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const status = await getEmailSetupStatus(orgId, supabase);
      if (!status.isConfigured) {
        await supabase.from("email_test_logs").insert({
          org_id: orgId,
          sent_by: user.id,
          to_email: payload.toEmail,
          from_address_id: payload.fromAddressId,
          status: "failed",
          error_message: status.blockingReasons.join(", "),
        });

        return new Response(
          JSON.stringify({
            success: false,
            error: "Email not configured",
            blockingReasons: status.blockingReasons,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const apiKey = await getDecryptedApiKey(orgId, supabase, supabaseUrl, serviceRoleKey);
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "Failed to retrieve API key" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: fromAddress } = await supabase
        .from("email_from_addresses")
        .select("email, display_name, reply_to")
        .eq("id", payload.fromAddressId)
        .eq("org_id", orgId)
        .eq("active", true)
        .single();

      if (!fromAddress) {
        return new Response(
          JSON.stringify({ error: "From address not found or inactive" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: defaults } = await supabase
        .from("email_defaults")
        .select("track_opens, track_clicks, default_unsubscribe_group_id")
        .eq("org_id", orgId)
        .single();

      let asmGroupId: number | null = null;
      if (defaults?.default_unsubscribe_group_id) {
        const { data: unsubGroup } = await supabase
          .from("email_unsubscribe_groups")
          .select("sendgrid_group_id")
          .eq("id", defaults.default_unsubscribe_group_id)
          .single();

        if (unsubGroup) {
          asmGroupId = parseInt(unsubGroup.sendgrid_group_id);
        }
      }

      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", orgId)
        .single();

      const subject = payload.subject || `Test Email from ${org?.name || "Your Organization"}`;
      const body = payload.body || `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Test Email</h2>
          <p>This is a test email sent from your email services configuration.</p>
          <p>If you received this email, your SendGrid integration is working correctly.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">Sent from ${org?.name || "Your Organization"}</p>
        </div>
      `;

      const sendGridPayload: Record<string, unknown> = {
        personalizations: [{
          to: [{ email: payload.toEmail }],
        }],
        from: {
          email: fromAddress.email,
          name: fromAddress.display_name,
        },
        subject: subject,
        content: [
          { type: "text/html", value: body },
        ],
        tracking_settings: {
          open_tracking: { enable: defaults?.track_opens ?? true },
          click_tracking: { enable: defaults?.track_clicks ?? true },
        },
      };

      if (fromAddress.reply_to) {
        sendGridPayload.reply_to = { email: fromAddress.reply_to };
      }

      if (asmGroupId) {
        sendGridPayload.asm = { group_id: asmGroupId };
      }

      const sgResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sendGridPayload),
      });

      const messageId = sgResponse.headers.get("X-Message-Id");

      if (!sgResponse.ok) {
        let errorMessage = "Failed to send email";
        try {
          const errorData = await sgResponse.json();
          errorMessage = errorData.errors?.[0]?.message || errorMessage;
        } catch {
          // ignore parse error
        }

        await supabase.from("email_test_logs").insert({
          org_id: orgId,
          sent_by: user.id,
          to_email: payload.toEmail,
          from_address_id: payload.fromAddressId,
          status: "failed",
          error_message: errorMessage,
        });

        await supabase.from("audit_logs").insert({
          org_id: orgId,
          user_id: user.id,
          action: "email.test.failed",
          entity_type: "email_test",
          details: { to_email: payload.toEmail, error: errorMessage },
        });

        return new Response(
          JSON.stringify({ success: false, error: errorMessage }),
          { status: sgResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase.from("email_test_logs").insert({
        org_id: orgId,
        sent_by: user.id,
        to_email: payload.toEmail,
        from_address_id: payload.fromAddressId,
        status: "success",
        sendgrid_message_id: messageId,
      });

      await supabase.from("audit_logs").insert({
        org_id: orgId,
        user_id: user.id,
        action: "email.test.sent",
        entity_type: "email_test",
        details: { to_email: payload.toEmail, message_id: messageId },
      });

      return new Response(
        JSON.stringify({ success: true, messageId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.action === "send") {
      const status = await getEmailSetupStatus(orgId, supabase);
      if (!status.isConfigured) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Email not configured",
            blockingReasons: status.blockingReasons,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const apiKey = await getDecryptedApiKey(orgId, supabase, supabaseUrl, serviceRoleKey);
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "Failed to retrieve API key" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: defaults } = await supabase
        .from("email_defaults")
        .select("default_from_address_id, default_reply_to, track_opens, track_clicks, default_unsubscribe_group_id")
        .eq("org_id", orgId)
        .single();

      const fromAddressId = payload.fromAddressId || defaults?.default_from_address_id;
      if (!fromAddressId) {
        return new Response(
          JSON.stringify({ error: "No from address specified and no default configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: fromAddress } = await supabase
        .from("email_from_addresses")
        .select("email, display_name, reply_to")
        .eq("id", fromAddressId)
        .eq("org_id", orgId)
        .eq("active", true)
        .single();

      if (!fromAddress) {
        return new Response(
          JSON.stringify({ error: "From address not found or inactive" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let asmGroupId: number | null = null;
      if (!payload.transactional) {
        const unsubGroupId = payload.unsubscribeGroupId || defaults?.default_unsubscribe_group_id;
        if (unsubGroupId) {
          const { data: unsubGroup } = await supabase
            .from("email_unsubscribe_groups")
            .select("sendgrid_group_id")
            .eq("id", unsubGroupId)
            .single();

          if (unsubGroup) {
            asmGroupId = parseInt(unsubGroup.sendgrid_group_id);
          }
        }
      }

      const content = [];
      if (payload.textBody) {
        content.push({ type: "text/plain", value: payload.textBody });
      }
      if (payload.htmlBody) {
        content.push({ type: "text/html", value: payload.htmlBody });
      }
      if (content.length === 0) {
        return new Response(
          JSON.stringify({ error: "Email body required (htmlBody or textBody)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sendGridPayload: Record<string, unknown> = {
        personalizations: [{
          to: [{
            email: payload.toEmail,
            name: payload.toName,
          }],
        }],
        from: {
          email: fromAddress.email,
          name: fromAddress.display_name,
        },
        subject: payload.subject,
        content,
        tracking_settings: {
          open_tracking: { enable: payload.trackOpens ?? defaults?.track_opens ?? true },
          click_tracking: { enable: payload.trackClicks ?? defaults?.track_clicks ?? true },
        },
      };

      const replyTo = payload.replyTo || fromAddress.reply_to || defaults?.default_reply_to;
      if (replyTo) {
        sendGridPayload.reply_to = { email: replyTo };
      }

      if (asmGroupId) {
        sendGridPayload.asm = { group_id: asmGroupId };
      }

      const sgResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sendGridPayload),
      });

      const messageId = sgResponse.headers.get("X-Message-Id");

      if (!sgResponse.ok) {
        let errorMessage = "Failed to send email";
        try {
          const errorData = await sgResponse.json();
          errorMessage = errorData.errors?.[0]?.message || errorMessage;
        } catch {
          // ignore parse error
        }

        return new Response(
          JSON.stringify({ success: false, error: errorMessage }),
          { status: sgResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, messageId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
