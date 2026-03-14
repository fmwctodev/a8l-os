import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateRequest {
  action: "create";
  domain: string;
}

interface VerifyRequest {
  action: "verify";
  domainId: string;
}

interface DeleteRequest {
  action: "delete";
  domainId: string;
}

interface SyncRequest {
  action: "sync";
}

type RequestPayload = CreateRequest | VerifyRequest | DeleteRequest | SyncRequest;

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

    const { data: hasPermission } = await supabase.rpc("user_has_email_permission", {
      user_id: user.id,
      required_permission: "email.settings.manage",
    });

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: "Permission denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orgId = userData.organization_id;
    const apiKey = await getDecryptedApiKey(orgId, supabase, supabaseUrl, serviceRoleKey);

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "SendGrid not connected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: RequestPayload = await req.json();

    if (payload.action === "create") {
      const sgResponse = await fetch("https://api.sendgrid.com/v3/whitelabel/domains", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domain: payload.domain,
          automatic_security: true,
        }),
      });

      if (!sgResponse.ok) {
        const errorData = await sgResponse.json();
        return new Response(
          JSON.stringify({ error: errorData.errors?.[0]?.message || "Failed to create domain in SendGrid" }),
          { status: sgResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sgDomain = await sgResponse.json();

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

      const { data: domain, error: insertError } = await supabase
        .from("email_domains")
        .insert({
          org_id: orgId,
          domain: payload.domain,
          sendgrid_domain_id: String(sgDomain.id),
          status: "pending",
          dns_records: dnsRecords,
        })
        .select()
        .single();

      if (insertError) {
        return new Response(
          JSON.stringify({ error: "Failed to save domain" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase.from("audit_logs").insert({
        org_id: orgId,
        user_id: user.id,
        action: "email.domain.created",
        entity_type: "email_domain",
        entity_id: domain.id,
        details: { domain: payload.domain },
      });

      return new Response(
        JSON.stringify({ success: true, domain }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.action === "verify") {
      const { data: domain } = await supabase
        .from("email_domains")
        .select("sendgrid_domain_id, domain")
        .eq("id", payload.domainId)
        .eq("org_id", orgId)
        .single();

      if (!domain) {
        return new Response(
          JSON.stringify({ error: "Domain not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sgResponse = await fetch(
        `https://api.sendgrid.com/v3/whitelabel/domains/${domain.sendgrid_domain_id}/validate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      const validationResult = await sgResponse.json();
      const isValid = validationResult.valid === true;

      const dnsRecords = [];
      if (validationResult.validation_results) {
        const vr = validationResult.validation_results;
        if (vr.mail_cname) {
          dnsRecords.push({
            type: "CNAME",
            host: vr.mail_cname.host || "",
            value: vr.mail_cname.data || "",
            valid: vr.mail_cname.valid,
          });
        }
        if (vr.dkim1) {
          dnsRecords.push({
            type: "CNAME",
            host: vr.dkim1.host || "",
            value: vr.dkim1.data || "",
            valid: vr.dkim1.valid,
          });
        }
        if (vr.dkim2) {
          dnsRecords.push({
            type: "CNAME",
            host: vr.dkim2.host || "",
            value: vr.dkim2.data || "",
            valid: vr.dkim2.valid,
          });
        }
      }

      const { error: updateError } = await supabase
        .from("email_domains")
        .update({
          status: isValid ? "verified" : "failed",
          dns_records: dnsRecords.length > 0 ? dnsRecords : undefined,
          last_checked_at: new Date().toISOString(),
        })
        .eq("id", payload.domainId);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to update domain status" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (isValid) {
        await supabase.from("audit_logs").insert({
          org_id: orgId,
          user_id: user.id,
          action: "email.domain.verified",
          entity_type: "email_domain",
          entity_id: payload.domainId,
          details: { domain: domain.domain },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          valid: isValid,
          dns_records: dnsRecords,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.action === "delete") {
      const { data: domain } = await supabase
        .from("email_domains")
        .select("sendgrid_domain_id, domain")
        .eq("id", payload.domainId)
        .eq("org_id", orgId)
        .single();

      if (!domain) {
        return new Response(
          JSON.stringify({ error: "Domain not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (domain.sendgrid_domain_id) {
        await fetch(
          `https://api.sendgrid.com/v3/whitelabel/domains/${domain.sendgrid_domain_id}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );
      }

      const { error: deleteError } = await supabase
        .from("email_domains")
        .delete()
        .eq("id", payload.domainId);

      if (deleteError) {
        return new Response(
          JSON.stringify({ error: "Failed to delete domain" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase.from("audit_logs").insert({
        org_id: orgId,
        user_id: user.id,
        action: "email.domain.deleted",
        entity_type: "email_domain",
        entity_id: payload.domainId,
        details: { domain: domain.domain },
      });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.action === "sync") {
      const sgResponse = await fetch("https://api.sendgrid.com/v3/whitelabel/domains", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!sgResponse.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch domains from SendGrid" }),
          { status: sgResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sgDomains = await sgResponse.json();

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

      return new Response(
        JSON.stringify({ success: true, synced: sgDomains.length }),
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
