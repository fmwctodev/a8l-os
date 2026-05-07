import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  getDecryptedMailgunCreds,
  listMailgunDomains,
  getMailgunDomain,
  sendMailgunEmail,
} from "../_shared/mailgun.ts";

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

async function autoSyncFromMailgun(
  orgId: string,
  apiKey: string,
  region: "us" | "eu",
  supabase: ReturnType<typeof createClient>,
): Promise<void> {
  try {
    const list = await listMailgunDomains(apiKey, region);
    if (!list.ok) return;

    for (const mgDomain of list.domains) {
      // Fetch full domain details to get DNS records
      const detail = await getMailgunDomain(apiKey, mgDomain.name, region);
      const dnsRecords: Array<Record<string, unknown>> = [];
      if (detail.ok) {
        for (const r of detail.sendingDnsRecords ?? []) {
          dnsRecords.push({
            type: r.record_type,
            host: r.name ?? mgDomain.name,
            value: r.value,
            valid: r.valid === "valid",
            purpose: "sending",
          });
        }
        for (const r of detail.receivingDnsRecords ?? []) {
          dnsRecords.push({
            type: r.record_type,
            host: r.name ?? mgDomain.name,
            value: r.value,
            priority: r.priority,
            valid: r.valid === "valid",
            purpose: "receiving",
          });
        }
      }

      const verified = mgDomain.state === "active" || mgDomain.state === "verified";

      await supabase
        .from("email_domains")
        .upsert({
          org_id: orgId,
          domain: mgDomain.name,
          provider_domain_id: mgDomain.name,
          status: verified ? "verified" : "pending",
          dns_records: dnsRecords,
          last_checked_at: new Date().toISOString(),
        }, { onConflict: "org_id,domain" });
    }

    // Mailgun has no concept of "verified senders" — any address on a verified
    // domain can send. We leave email_from_addresses as a user-curated list
    // and only ensure a default exists if rows are present.
    const { data: addresses } = await supabase
      .from("email_from_addresses")
      .select("id, is_default")
      .eq("org_id", orgId)
      .eq("active", true);

    if (addresses && addresses.length > 0 && !addresses.some((a: { is_default: boolean }) => a.is_default)) {
      await supabase
        .from("email_from_addresses")
        .update({ is_default: true })
        .eq("id", addresses[0].id);
    }

    if (addresses && addresses.length > 0) {
      const { data: defaults } = await supabase
        .from("email_defaults")
        .select("default_from_address_id")
        .eq("org_id", orgId)
        .maybeSingle();

      if (!defaults?.default_from_address_id) {
        const defaultAddr = addresses.find((a: { is_default: boolean }) => a.is_default) ?? addresses[0];
        if (defaultAddr) {
          await supabase
            .from("email_defaults")
            .upsert({ org_id: orgId, default_from_address_id: defaultAddr.id }, { onConflict: "org_id" });
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
  serviceRoleKey?: string,
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
    .eq("integrations.key", "mailgun")
    .maybeSingle();

  status.providerConnected = conn?.status === "connected";
  if (!status.providerConnected) {
    status.blockingReasons.push("Mailgun is not connected");
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

  if (domainsEmpty && supabaseUrl && serviceRoleKey) {
    const creds = await getDecryptedMailgunCreds(orgId, supabase, supabaseUrl, serviceRoleKey);
    if (creds) {
      await autoSyncFromMailgun(orgId, creds.apiKey, creds.region, supabase);

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
      status.hasDefaultFromAddress = freshAddresses?.some((a: { is_default: boolean }) => a.is_default) || false;

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
  status.hasDefaultFromAddress = fromAddresses?.some((a: { is_default: boolean }) => a.is_default) || false;

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
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const status = await getEmailSetupStatus(orgId, supabase, supabaseUrl, serviceRoleKey);
      return new Response(
        JSON.stringify({ success: true, status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
          provider: "mailgun",
        });

        return new Response(
          JSON.stringify({
            success: false,
            error: "Email not configured",
            blockingReasons: status.blockingReasons,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const creds = await getDecryptedMailgunCreds(orgId, supabase, supabaseUrl, serviceRoleKey);
      if (!creds) {
        return new Response(
          JSON.stringify({ error: "Failed to retrieve Mailgun credentials" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: defaults } = await supabase
        .from("email_defaults")
        .select("track_opens, track_clicks, default_unsubscribe_group_id")
        .eq("org_id", orgId)
        .single();

      let unsubscribeTag: string | null = null;
      if (defaults?.default_unsubscribe_group_id) {
        const { data: unsubGroup } = await supabase
          .from("email_unsubscribe_groups")
          .select("provider_group_id, name")
          .eq("id", defaults.default_unsubscribe_group_id)
          .single();

        if (unsubGroup) {
          unsubscribeTag = unsubGroup.provider_group_id || unsubGroup.name || null;
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
          <p>If you received this email, your Mailgun integration is working correctly.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">Sent from ${org?.name || "Your Organization"}</p>
        </div>
      `;

      const result = await sendMailgunEmail({
        apiKey: creds.apiKey,
        domain: creds.domain,
        region: creds.region,
        from: `${fromAddress.display_name} <${fromAddress.email}>`,
        to: payload.toEmail,
        subject,
        html: body,
        replyTo: fromAddress.reply_to ?? undefined,
        trackOpens: defaults?.track_opens ?? true,
        trackClicks: defaults?.track_clicks ?? true,
        tags: unsubscribeTag ? [unsubscribeTag] : undefined,
      });

      if (!result.ok) {
        await supabase.from("email_test_logs").insert({
          org_id: orgId,
          sent_by: user.id,
          to_email: payload.toEmail,
          from_address_id: payload.fromAddressId,
          status: "failed",
          error_message: result.error,
          provider: "mailgun",
        });

        await supabase.from("audit_logs").insert({
          org_id: orgId,
          user_id: user.id,
          action: "email.test.failed",
          entity_type: "email_test",
          details: { to_email: payload.toEmail, error: result.error },
        });

        return new Response(
          JSON.stringify({ success: false, error: result.error }),
          { status: result.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await supabase.from("email_test_logs").insert({
        org_id: orgId,
        sent_by: user.id,
        to_email: payload.toEmail,
        from_address_id: payload.fromAddressId,
        status: "success",
        provider_message_id: result.messageId,
        provider: "mailgun",
      });

      await supabase.from("audit_logs").insert({
        org_id: orgId,
        user_id: user.id,
        action: "email.test.sent",
        entity_type: "email_test",
        details: { to_email: payload.toEmail, message_id: result.messageId },
      });

      return new Response(
        JSON.stringify({ success: true, messageId: result.messageId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const creds = await getDecryptedMailgunCreds(orgId, supabase, supabaseUrl, serviceRoleKey);
      if (!creds) {
        return new Response(
          JSON.stringify({ error: "Failed to retrieve Mailgun credentials" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      let unsubscribeTag: string | null = null;
      if (!payload.transactional) {
        const unsubGroupId = payload.unsubscribeGroupId || defaults?.default_unsubscribe_group_id;
        if (unsubGroupId) {
          const { data: unsubGroup } = await supabase
            .from("email_unsubscribe_groups")
            .select("provider_group_id, name")
            .eq("id", unsubGroupId)
            .single();

          if (unsubGroup) {
            unsubscribeTag = unsubGroup.provider_group_id || unsubGroup.name || null;
          }
        }
      }

      if (!payload.htmlBody && !payload.textBody) {
        return new Response(
          JSON.stringify({ error: "Email body required (htmlBody or textBody)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const replyTo = payload.replyTo || fromAddress.reply_to || defaults?.default_reply_to;

      const result = await sendMailgunEmail({
        apiKey: creds.apiKey,
        domain: creds.domain,
        region: creds.region,
        from: `${fromAddress.display_name} <${fromAddress.email}>`,
        to: payload.toEmail,
        toName: payload.toName,
        subject: payload.subject,
        html: payload.htmlBody,
        text: payload.textBody,
        replyTo: replyTo ?? undefined,
        trackOpens: payload.trackOpens ?? defaults?.track_opens ?? true,
        trackClicks: payload.trackClicks ?? defaults?.track_clicks ?? true,
        tags: unsubscribeTag ? [unsubscribeTag] : undefined,
      });

      if (!result.ok) {
        return new Response(
          JSON.stringify({ success: false, error: result.error }),
          { status: result.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, messageId: result.messageId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
