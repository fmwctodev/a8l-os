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
  const envKey = Deno.env.get("SENDGRID_API_KEY");
  if (envKey) {
    return envKey;
  }

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

async function autoSyncFromSendGrid(
  orgId: string,
  apiKey: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  try {
    const sgDomainsRes = await fetch("https://api.sendgrid.com/v3/whitelabel/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (sgDomainsRes.ok) {
      const sgDomains = await sgDomainsRes.json();
      for (const sgDomain of sgDomains) {
        const dnsRecords = [
          ...(sgDomain.dns?.mail_cname ? [{
            type: "CNAME",
            host: sgDomain.dns.mail_cname.host,
            value: sgDomain.dns.mail_cname.data,
            valid: sgDomain.dns.mail_cname.valid,
          }] : []),
          ...(sgDomain.dns?.dkim1 ? [{
            type: "CNAME",
            host: sgDomain.dns.dkim1.host,
            value: sgDomain.dns.dkim1.data,
            valid: sgDomain.dns.dkim1.valid,
          }] : []),
          ...(sgDomain.dns?.dkim2 ? [{
            type: "CNAME",
            host: sgDomain.dns.dkim2.host,
            value: sgDomain.dns.dkim2.data,
            valid: sgDomain.dns.dkim2.valid,
          }] : []),
        ];

        await supabase
          .from("email_domains")
          .upsert({
            org_id: orgId,
            domain: sgDomain.domain,
            sendgrid_domain_id: String(sgDomain.id),
            status: sgDomain.valid ? "verified" : "pending",
            dns_records: dnsRecords,
            last_checked_at: new Date().toISOString(),
          }, { onConflict: "org_id,domain" });
      }
    }

    const { data: orgDomains } = await supabase
      .from("email_domains")
      .select("id, domain")
      .eq("org_id", orgId);

    const domainMap = new Map<string, string>();
    for (const d of orgDomains || []) {
      domainMap.set(d.domain, d.id);
    }

    const sgSendersRes = await fetch("https://api.sendgrid.com/v3/verified_senders", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (sgSendersRes.ok) {
      const sgData = await sgSendersRes.json();
      const sgSenders = sgData.results || [];
      let synced = 0;

      for (let i = 0; i < sgSenders.length; i++) {
        const sender = sgSenders[i];
        if (!sender.verified) continue;

        const senderEmail = sender.from_email;
        const senderDomain = senderEmail.split("@")[1];
        const domainId = domainMap.get(senderDomain) || null;

        await supabase
          .from("email_from_addresses")
          .upsert({
            org_id: orgId,
            email: senderEmail,
            display_name: sender.from_name || sender.nickname || senderEmail.split("@")[0],
            reply_to: sender.reply_to || null,
            sendgrid_sender_id: String(sender.id),
            domain_id: domainId,
            active: true,
            is_default: synced === 0,
          }, { onConflict: "org_id,email" });

        synced++;
      }

      if (synced > 0) {
        const { data: firstAddr } = await supabase
          .from("email_from_addresses")
          .select("id")
          .eq("org_id", orgId)
          .eq("is_default", true)
          .maybeSingle();

        if (firstAddr) {
          await supabase
            .from("email_defaults")
            .update({ default_from_address_id: firstAddr.id })
            .eq("org_id", orgId);
        }
      }
    }
  } catch {
    // auto-sync is best-effort; don't block check-status
  }
}

async function getEmailSetupStatus(
  orgId: string,
  supabase: ReturnType<typeof createClient>,
  supabaseUrl?: string,
  serviceRoleKey?: string
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
    return status;
  }

  const { data: domains } = await supabase
    .from("email_domains")
    .select("id")
    .eq("org_id", orgId)
    .eq("status", "verified");

  const { data: fromAddresses } = await supabase
    .from("email_from_addresses")
    .select("id, is_default")
    .eq("org_id", orgId)
    .eq("active", true);

  const domainsEmpty = !domains || domains.length === 0;
  const sendersEmpty = !fromAddresses || fromAddresses.length === 0;

  if ((domainsEmpty || sendersEmpty) && supabaseUrl && serviceRoleKey) {
    const apiKey = await getDecryptedApiKey(orgId, supabase, supabaseUrl, serviceRoleKey);
    if (apiKey) {
      await autoSyncFromSendGrid(orgId, apiKey, supabase);

      const { data: freshDomains } = await supabase
        .from("email_domains")
        .select("id")
        .eq("org_id", orgId)
        .eq("status", "verified");

      const { data: freshAddresses } = await supabase
        .from("email_from_addresses")
        .select("id, is_default")
        .eq("org_id", orgId)
        .eq("active", true);

      status.verifiedDomainsCount = freshDomains?.length || 0;
      status.activeFromAddressesCount = freshAddresses?.length || 0;
      status.hasDefaultFromAddress = freshAddresses?.some(a => a.is_default) || false;

      if (status.verifiedDomainsCount === 0) {
        status.blockingReasons.push("No verified domains");
      }
      if (status.activeFromAddressesCount === 0) {
        status.blockingReasons.push("No active from addresses");
      }

      const { data: defaults } = await supabase
        .from("email_defaults")
        .select("default_unsubscribe_group_id")
        .eq("org_id", orgId)
        .maybeSingle();

      status.hasDefaultUnsubscribeGroup = !!defaults?.default_unsubscribe_group_id;
      status.isConfigured = status.blockingReasons.length === 0;
      return status;
    }
  }

  status.verifiedDomainsCount = domains?.length || 0;
  if (status.verifiedDomainsCount === 0) {
    status.blockingReasons.push("No verified domains");
  }

  status.activeFromAddressesCount = fromAddresses?.length || 0;
  status.hasDefaultFromAddress = fromAddresses?.some(a => a.is_default) || false;

  if (status.activeFromAddressesCount === 0) {
    status.blockingReasons.push("No active from addresses");
  }

  const { data: defaults } = await supabase
    .from("email_defaults")
    .select("default_unsubscribe_group_id")
    .eq("org_id", orgId)
    .maybeSingle();

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

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
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
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!userData) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orgId = userData.organization_id;
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

      const status = await getEmailSetupStatus(orgId, supabase, supabaseUrl, serviceRoleKey);
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
