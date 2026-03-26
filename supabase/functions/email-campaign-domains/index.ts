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
  friendly_label?: string;
  target_daily_volume?: number;
}

interface VerifyRequest {
  action: "verify";
  domainId: string;
}

interface DeleteRequest {
  action: "delete";
  domainId: string;
}

interface StartWarmupRequest {
  action: "start_warmup";
  domainId: string;
}

interface PauseWarmupRequest {
  action: "pause_warmup";
  domainId: string;
  reason?: string;
}

interface ResumeWarmupRequest {
  action: "resume_warmup";
  domainId: string;
}

interface SyncStatsRequest {
  action: "sync_stats";
  domainId: string;
}

interface ApplyRecommendationRequest {
  action: "apply_recommendation";
  recommendationId: string;
}

type RequestPayload =
  | CreateRequest
  | VerifyRequest
  | DeleteRequest
  | StartWarmupRequest
  | PauseWarmupRequest
  | ResumeWarmupRequest
  | SyncStatsRequest
  | ApplyRecommendationRequest;

async function getDecryptedApiKey(
  orgId: string,
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<string | null> {
  const envKey = Deno.env.get("SENDGRID_API_KEY");
  if (envKey) return envKey;

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

async function logDomainEvent(
  supabase: ReturnType<typeof createClient>,
  domainId: string,
  eventType: string,
  actorType: "user" | "system" | "ai",
  actorId: string | null,
  reason?: string,
  aiRecommendationText?: string,
  metadata?: Record<string, unknown>
) {
  await supabase.from("email_campaign_domain_events").insert({
    campaign_domain_id: domainId,
    event_type: eventType,
    actor_type: actorType,
    actor_id: actorId,
    reason,
    ai_recommendation_text: aiRecommendationText,
    metadata: metadata || {},
  });
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
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!userData) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: permissions } = await supabase
      .from("role_permissions")
      .select("permissions(key)")
      .eq("role_id", (await supabase.from("users").select("role_id").eq("id", user.id).single()).data?.role_id);

    const userPermissions = permissions?.map((p: { permissions: { key: string } }) => p.permissions.key) || [];
    const hasManagePermission = userPermissions.includes("email.settings.manage") ||
                                userPermissions.includes("email.campaign_domains.manage");

    if (!hasManagePermission) {
      return new Response(
        JSON.stringify({ error: "Permission denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orgId = userData.organization_id;
    const payload: RequestPayload = await req.json();

    if (payload.action === "create") {
      const apiKey = await getDecryptedApiKey(orgId, supabase, supabaseUrl, serviceRoleKey);
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "SendGrid not connected" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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
        .from("email_campaign_domains")
        .insert({
          organization_id: orgId,
          domain: payload.domain,
          friendly_label: payload.friendly_label || null,
          sendgrid_domain_id: String(sgDomain.id),
          status: "pending_verification",
          target_daily_volume: payload.target_daily_volume || 10000,
          dns_records: dnsRecords,
        })
        .select()
        .single();

      if (insertError) {
        return new Response(
          JSON.stringify({ error: "Failed to save campaign domain" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase.from("email_warmup_config").insert({
        campaign_domain_id: domain.id,
      });

      await logDomainEvent(supabase, domain.id, "created", "user", user.id, null, null, {
        domain: payload.domain,
      });

      return new Response(
        JSON.stringify({ success: true, domain }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.action === "verify") {
      const { data: domain } = await supabase
        .from("email_campaign_domains")
        .select("sendgrid_domain_id, domain, status")
        .eq("id", payload.domainId)
        .eq("organization_id", orgId)
        .single();

      if (!domain) {
        return new Response(
          JSON.stringify({ error: "Domain not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const apiKey = await getDecryptedApiKey(orgId, supabase, supabaseUrl, serviceRoleKey);
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "SendGrid not connected" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

      const newStatus = isValid ? "verified" : "pending_verification";

      await supabase
        .from("email_campaign_domains")
        .update({
          status: newStatus,
          dns_records: dnsRecords.length > 0 ? dnsRecords : undefined,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", payload.domainId);

      if (isValid && domain.status !== "verified") {
        await logDomainEvent(supabase, payload.domainId, "dns_verified", "user", user.id);
      }

      return new Response(
        JSON.stringify({ success: true, verified: isValid, dns_records: dnsRecords }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.action === "delete") {
      const { data: domain } = await supabase
        .from("email_campaign_domains")
        .select("sendgrid_domain_id, domain")
        .eq("id", payload.domainId)
        .eq("organization_id", orgId)
        .single();

      if (!domain) {
        return new Response(
          JSON.stringify({ error: "Domain not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const apiKey = await getDecryptedApiKey(orgId, supabase, supabaseUrl, serviceRoleKey);
      if (apiKey && domain.sendgrid_domain_id) {
        await fetch(
          `https://api.sendgrid.com/v3/whitelabel/domains/${domain.sendgrid_domain_id}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${apiKey}` },
          }
        );
      }

      await logDomainEvent(supabase, payload.domainId, "deleted", "user", user.id, null, null, {
        domain: domain.domain,
      });

      await supabase
        .from("email_campaign_domains")
        .delete()
        .eq("id", payload.domainId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.action === "start_warmup") {
      const { data: domain } = await supabase
        .from("email_campaign_domains")
        .select("*, warmup_config:email_warmup_config(*)")
        .eq("id", payload.domainId)
        .eq("organization_id", orgId)
        .single();

      if (!domain) {
        return new Response(
          JSON.stringify({ error: "Domain not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (domain.status !== "verified") {
        return new Response(
          JSON.stringify({ error: "Domain must be verified before starting warm-up" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const config = domain.warmup_config?.[0];
      const startVolume = config?.start_daily_volume || 25;

      await supabase
        .from("email_campaign_domains")
        .update({
          status: "warming_up",
          warmup_progress_percent: 0,
          current_daily_limit: startVolume,
          warmup_started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", payload.domainId);

      await logDomainEvent(supabase, payload.domainId, "warmup_started", "user", user.id, null, null, {
        start_volume: startVolume,
      });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.action === "pause_warmup") {
      const { data: domain } = await supabase
        .from("email_campaign_domains")
        .select("status")
        .eq("id", payload.domainId)
        .eq("organization_id", orgId)
        .single();

      if (!domain) {
        return new Response(
          JSON.stringify({ error: "Domain not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (domain.status !== "warming_up") {
        return new Response(
          JSON.stringify({ error: "Domain is not currently warming up" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("email_campaign_domains")
        .update({
          status: "paused",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payload.domainId);

      await logDomainEvent(
        supabase,
        payload.domainId,
        "warmup_paused",
        "user",
        user.id,
        payload.reason || "User paused warm-up"
      );

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.action === "resume_warmup") {
      const { data: domain } = await supabase
        .from("email_campaign_domains")
        .select("status")
        .eq("id", payload.domainId)
        .eq("organization_id", orgId)
        .single();

      if (!domain) {
        return new Response(
          JSON.stringify({ error: "Domain not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (domain.status !== "paused") {
        return new Response(
          JSON.stringify({ error: "Domain is not paused" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("email_campaign_domains")
        .update({
          status: "warming_up",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payload.domainId);

      await logDomainEvent(supabase, payload.domainId, "warmup_resumed", "user", user.id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.action === "sync_stats") {
      const { data: domain } = await supabase
        .from("email_campaign_domains")
        .select("sendgrid_domain_id, domain")
        .eq("id", payload.domainId)
        .eq("organization_id", orgId)
        .single();

      if (!domain) {
        return new Response(
          JSON.stringify({ error: "Domain not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const apiKey = await getDecryptedApiKey(orgId, supabase, supabaseUrl, serviceRoleKey);
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "SendGrid not connected" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const formatDate = (d: Date) => d.toISOString().split("T")[0];

      const sgResponse = await fetch(
        `https://api.sendgrid.com/v3/stats?start_date=${formatDate(startDate)}&end_date=${formatDate(endDate)}&aggregated_by=day`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      );

      if (!sgResponse.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch stats from SendGrid" }),
          { status: sgResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const statsData = await sgResponse.json();

      for (const dayStat of statsData) {
        const metrics = dayStat.stats?.[0]?.metrics || {};
        await supabase.from("email_warmup_daily_stats").upsert(
          {
            campaign_domain_id: payload.domainId,
            date: dayStat.date,
            emails_sent: metrics.requests || 0,
            emails_delivered: metrics.delivered || 0,
            bounces: (metrics.bounces || 0) + (metrics.bounce_drops || 0),
            spam_complaints: metrics.spam_reports || 0,
            opens: metrics.unique_opens || 0,
            clicks: metrics.unique_clicks || 0,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "campaign_domain_id,date" }
        );
      }

      await supabase
        .from("email_campaign_domains")
        .update({
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", payload.domainId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.action === "apply_recommendation") {
      const { data: recommendation } = await supabase
        .from("email_warmup_ai_recommendations")
        .select("*, campaign_domain:email_campaign_domains(organization_id, status)")
        .eq("id", payload.recommendationId)
        .single();

      if (!recommendation) {
        return new Response(
          JSON.stringify({ error: "Recommendation not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (recommendation.campaign_domain?.organization_id !== orgId) {
        return new Response(
          JSON.stringify({ error: "Permission denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const domainId = recommendation.campaign_domain_id;
      const recType = recommendation.recommendation_type;

      let newStatus = recommendation.campaign_domain?.status;
      if (recType === "pause") {
        newStatus = "paused";
      } else if (recType === "resume") {
        newStatus = "warming_up";
      }

      if (recType === "pause" || recType === "resume") {
        await supabase
          .from("email_campaign_domains")
          .update({
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", domainId);
      }

      await supabase
        .from("email_warmup_ai_recommendations")
        .update({ applied_at: new Date().toISOString() })
        .eq("id", payload.recommendationId);

      await logDomainEvent(
        supabase,
        domainId,
        "ai_recommendation_applied",
        "user",
        user.id,
        recommendation.reason,
        recommendation.reason,
        { recommendation_type: recType }
      );

      return new Response(
        JSON.stringify({ success: true }),
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
