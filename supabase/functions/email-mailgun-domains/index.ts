import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  createMailgunDomain,
  deleteMailgunDomain,
  getDecryptedMailgunCreds,
  getMailgunDomain,
  listMailgunDomains,
  verifyMailgunDomain,
} from "../_shared/mailgun.ts";

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

interface MailgunDnsRecord {
  record_type?: string;
  name?: string;
  value?: string;
  priority?: string | number;
  valid?: string;
}

function mapDnsRecords(
  sending: MailgunDnsRecord[] | undefined,
  receiving: MailgunDnsRecord[] | undefined,
  fallbackHost: string,
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const r of sending ?? []) {
    out.push({
      type: r.record_type,
      host: r.name ?? fallbackHost,
      value: r.value,
      valid: r.valid === "valid",
      purpose: "sending",
    });
  }
  for (const r of receiving ?? []) {
    out.push({
      type: r.record_type,
      host: r.name ?? fallbackHost,
      value: r.value,
      priority: r.priority,
      valid: r.valid === "valid",
      purpose: "receiving",
    });
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
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

    const { data: hasPermission } = await supabase.rpc("user_has_email_permission", {
      user_id: user.id,
      required_permission: "email.settings.manage",
    });

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: "Permission denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const orgId = userData.organization_id;
    const creds = await getDecryptedMailgunCreds(orgId, supabase, supabaseUrl, serviceRoleKey);

    if (!creds) {
      return new Response(
        JSON.stringify({ error: "Mailgun not connected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload: RequestPayload = await req.json();

    if (payload.action === "create") {
      const result = await createMailgunDomain(creds.apiKey, payload.domain, creds.region);
      if (!result.ok) {
        return new Response(
          JSON.stringify({ error: result.error || "Failed to create domain in Mailgun" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const detail = await getMailgunDomain(creds.apiKey, payload.domain, creds.region);
      const dnsRecords = mapDnsRecords(detail.sendingDnsRecords, detail.receivingDnsRecords, payload.domain);
      const verified = result.data?.domain?.state === "active";

      const { data: domain, error: insertError } = await supabase
        .from("email_domains")
        .insert({
          org_id: orgId,
          domain: payload.domain,
          provider_domain_id: payload.domain,
          status: verified ? "verified" : "pending",
          dns_records: dnsRecords,
          last_checked_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        return new Response(
          JSON.stringify({ error: "Failed to save domain" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await supabase.from("audit_logs").insert({
        org_id: orgId,
        user_id: user.id,
        action: "email.domain.created",
        entity_type: "email_domain",
        entity_id: domain.id,
        details: { domain: payload.domain, provider: "mailgun" },
      });

      return new Response(
        JSON.stringify({ success: true, domain }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (payload.action === "verify") {
      const { data: domain } = await supabase
        .from("email_domains")
        .select("provider_domain_id, domain")
        .eq("id", payload.domainId)
        .eq("org_id", orgId)
        .single();

      if (!domain) {
        return new Response(
          JSON.stringify({ error: "Domain not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const verifyResult = await verifyMailgunDomain(creds.apiKey, domain.domain, creds.region);
      if (!verifyResult.ok) {
        return new Response(
          JSON.stringify({ error: verifyResult.error || "Mailgun verification failed" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const detail = verifyResult.data;
      const dnsRecords = mapDnsRecords(
        detail?.sending_dns_records,
        detail?.receiving_dns_records,
        domain.domain,
      );
      const isValid = detail?.domain?.state === "active";

      const { error: updateError } = await supabase
        .from("email_domains")
        .update({
          status: isValid ? "verified" : "pending",
          dns_records: dnsRecords.length > 0 ? dnsRecords : undefined,
          last_checked_at: new Date().toISOString(),
        })
        .eq("id", payload.domainId);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to update domain status" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (isValid) {
        await supabase.from("audit_logs").insert({
          org_id: orgId,
          user_id: user.id,
          action: "email.domain.verified",
          entity_type: "email_domain",
          entity_id: payload.domainId,
          details: { domain: domain.domain, provider: "mailgun" },
        });
      }

      return new Response(
        JSON.stringify({ success: true, valid: isValid, dns_records: dnsRecords }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (payload.action === "delete") {
      const { data: domain } = await supabase
        .from("email_domains")
        .select("provider_domain_id, domain")
        .eq("id", payload.domainId)
        .eq("org_id", orgId)
        .single();

      if (!domain) {
        return new Response(
          JSON.stringify({ error: "Domain not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await deleteMailgunDomain(creds.apiKey, domain.domain, creds.region);

      const { error: deleteError } = await supabase
        .from("email_domains")
        .delete()
        .eq("id", payload.domainId);

      if (deleteError) {
        return new Response(
          JSON.stringify({ error: "Failed to delete domain" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await supabase.from("audit_logs").insert({
        org_id: orgId,
        user_id: user.id,
        action: "email.domain.deleted",
        entity_type: "email_domain",
        entity_id: payload.domainId,
        details: { domain: domain.domain, provider: "mailgun" },
      });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (payload.action === "sync") {
      const list = await listMailgunDomains(creds.apiKey, creds.region);
      if (!list.ok) {
        return new Response(
          JSON.stringify({ error: list.error || "Failed to fetch domains from Mailgun" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      let synced = 0;
      for (const mgDomain of list.domains) {
        const detail = await getMailgunDomain(creds.apiKey, mgDomain.name, creds.region);
        const dnsRecords = mapDnsRecords(
          detail.sendingDnsRecords,
          detail.receivingDnsRecords,
          mgDomain.name,
        );
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
        synced++;
      }

      return new Response(
        JSON.stringify({ success: true, synced }),
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
