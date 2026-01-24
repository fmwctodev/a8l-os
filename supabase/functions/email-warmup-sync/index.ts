import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WarmingDomain {
  id: string;
  organization_id: string;
  domain: string;
  sendgrid_domain_id: string;
  status: string;
  warmup_progress_percent: number;
  current_daily_limit: number;
  target_daily_volume: number;
  warmup_started_at: string;
  warmup_config: {
    start_daily_volume: number;
    ramp_duration_days: number;
    daily_increase_type: string;
    pause_on_bounce_spike: boolean;
    pause_on_spam_complaints: boolean;
    auto_throttle_low_engagement: boolean;
    ai_recommendations_enabled: boolean;
  } | null;
}

async function getDecryptedApiKey(
  orgId: string,
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<string | null> {
  const { data: provider } = await supabase
    .from("email_providers")
    .select("api_key_encrypted, api_key_iv, status")
    .eq("org_id", orgId)
    .single();

  if (!provider || provider.status !== "connected") {
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
      encrypted: provider.api_key_encrypted,
      iv: provider.api_key_iv,
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
  reason?: string,
  aiRecommendationText?: string,
  metadata?: Record<string, unknown>
) {
  await supabase.from("email_campaign_domain_events").insert({
    campaign_domain_id: domainId,
    event_type: eventType,
    actor_type: actorType,
    actor_id: null,
    reason,
    ai_recommendation_text: aiRecommendationText,
    metadata: metadata || {},
  });
}

async function createAIRecommendation(
  supabase: ReturnType<typeof createClient>,
  domainId: string,
  type: string,
  reason: string,
  confidence: number
) {
  await supabase.from("email_warmup_ai_recommendations").insert({
    campaign_domain_id: domainId,
    recommendation_type: type,
    reason,
    confidence_score: confidence,
  });
}

function calculateWarmupProgress(
  startedAt: string,
  rampDurationDays: number
): number {
  const startDate = new Date(startedAt);
  const now = new Date();
  const daysPassed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  return Math.min(100, Math.round((daysPassed / rampDurationDays) * 100));
}

function calculateDailyLimit(
  startVolume: number,
  targetVolume: number,
  rampDurationDays: number,
  daysPassed: number,
  increaseType: string
): number {
  if (daysPassed >= rampDurationDays) {
    return targetVolume;
  }

  if (increaseType === "linear") {
    const dailyIncrease = (targetVolume - startVolume) / rampDurationDays;
    return Math.round(startVolume + dailyIncrease * daysPassed);
  }

  const progress = daysPassed / rampDurationDays;
  const exponentialProgress = Math.pow(progress, 1.5);
  return Math.round(startVolume + (targetVolume - startVolume) * exponentialProgress);
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
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: warmingDomains, error: fetchError } = await supabase
      .from("email_campaign_domains")
      .select(`
        id,
        organization_id,
        domain,
        sendgrid_domain_id,
        status,
        warmup_progress_percent,
        current_daily_limit,
        target_daily_volume,
        warmup_started_at,
        warmup_config:email_warmup_config(
          start_daily_volume,
          ramp_duration_days,
          daily_increase_type,
          pause_on_bounce_spike,
          pause_on_spam_complaints,
          auto_throttle_low_engagement,
          ai_recommendations_enabled
        )
      `)
      .eq("status", "warming_up");

    if (fetchError) {
      throw fetchError;
    }

    const results: { domainId: string; success: boolean; error?: string }[] = [];

    for (const domainRow of warmingDomains || []) {
      const domain = domainRow as unknown as WarmingDomain;
      const config = Array.isArray(domain.warmup_config)
        ? domain.warmup_config[0]
        : domain.warmup_config;

      try {
        const apiKey = await getDecryptedApiKey(
          domain.organization_id,
          supabase,
          supabaseUrl,
          serviceRoleKey
        );

        if (!apiKey) {
          results.push({ domainId: domain.id, success: false, error: "No API key" });
          continue;
        }

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        const formatDate = (d: Date) => d.toISOString().split("T")[0];

        const sgResponse = await fetch(
          `https://api.sendgrid.com/v3/stats?start_date=${formatDate(startDate)}&end_date=${formatDate(endDate)}&aggregated_by=day`,
          {
            headers: { Authorization: `Bearer ${apiKey}` },
          }
        );

        if (!sgResponse.ok) {
          results.push({ domainId: domain.id, success: false, error: "SendGrid API error" });
          continue;
        }

        const statsData = await sgResponse.json();

        let totalSent = 0;
        let totalDelivered = 0;
        let totalBounces = 0;
        let totalSpamComplaints = 0;
        let totalOpens = 0;

        for (const dayStat of statsData) {
          const metrics = dayStat.stats?.[0]?.metrics || {};
          const sent = metrics.requests || 0;
          const delivered = metrics.delivered || 0;
          const bounces = (metrics.bounces || 0) + (metrics.bounce_drops || 0);
          const spamComplaints = metrics.spam_reports || 0;
          const opens = metrics.unique_opens || 0;
          const clicks = metrics.unique_clicks || 0;

          totalSent += sent;
          totalDelivered += delivered;
          totalBounces += bounces;
          totalSpamComplaints += spamComplaints;
          totalOpens += opens;

          await supabase.from("email_warmup_daily_stats").upsert(
            {
              campaign_domain_id: domain.id,
              date: dayStat.date,
              emails_sent: sent,
              emails_delivered: delivered,
              bounces,
              spam_complaints: spamComplaints,
              opens,
              clicks,
              synced_at: new Date().toISOString(),
            },
            { onConflict: "campaign_domain_id,date" }
          );
        }

        const bounceRate = totalSent > 0 ? (totalBounces / totalSent) * 100 : 0;
        const spamRate = totalSent > 0 ? (totalSpamComplaints / totalSent) * 100 : 0;
        const openRate = totalDelivered > 0 ? (totalOpens / totalDelivered) * 100 : 0;

        let shouldPause = false;
        let pauseReason = "";

        if (config?.pause_on_bounce_spike && bounceRate > 2) {
          shouldPause = true;
          pauseReason = `High bounce rate detected: ${bounceRate.toFixed(2)}% (threshold: 2%)`;
        }

        if (config?.pause_on_spam_complaints && spamRate > 0.1) {
          shouldPause = true;
          pauseReason = `High spam complaint rate detected: ${spamRate.toFixed(3)}% (threshold: 0.1%)`;
        }

        if (shouldPause) {
          await supabase
            .from("email_campaign_domains")
            .update({
              status: "paused",
              updated_at: new Date().toISOString(),
            })
            .eq("id", domain.id);

          await logDomainEvent(
            supabase,
            domain.id,
            "auto_paused",
            "system",
            pauseReason
          );

          results.push({ domainId: domain.id, success: true });
          continue;
        }

        if (config?.ai_recommendations_enabled) {
          if (bounceRate > 1.5 && bounceRate <= 2) {
            await createAIRecommendation(
              supabase,
              domain.id,
              "slow_down",
              `Bounce rate is elevated at ${bounceRate.toFixed(2)}%. Consider reducing send volume to protect domain reputation.`,
              0.75
            );
          }

          if (openRate < 10 && totalDelivered > 100) {
            await createAIRecommendation(
              supabase,
              domain.id,
              "slow_down",
              `Low engagement detected (${openRate.toFixed(1)}% open rate). Slowing down may improve deliverability.`,
              0.65
            );
          }

          if (bounceRate < 0.5 && spamRate < 0.05 && openRate > 25) {
            await createAIRecommendation(
              supabase,
              domain.id,
              "speed_up",
              `Excellent metrics: ${bounceRate.toFixed(2)}% bounce rate, ${openRate.toFixed(1)}% open rate. Consider accelerating warm-up.`,
              0.70
            );
          }
        }

        const startDate2 = new Date(domain.warmup_started_at);
        const daysPassed = Math.floor((Date.now() - startDate2.getTime()) / (1000 * 60 * 60 * 24));
        const rampDuration = config?.ramp_duration_days || 21;
        const startVolume = config?.start_daily_volume || 25;
        const increaseType = config?.daily_increase_type || "linear";

        const newProgress = calculateWarmupProgress(domain.warmup_started_at, rampDuration);
        const newDailyLimit = calculateDailyLimit(
          startVolume,
          domain.target_daily_volume,
          rampDuration,
          daysPassed,
          increaseType
        );

        const isComplete = newProgress >= 100;

        await supabase
          .from("email_campaign_domains")
          .update({
            warmup_progress_percent: newProgress,
            current_daily_limit: newDailyLimit,
            status: isComplete ? "warmed" : "warming_up",
            warmup_completed_at: isComplete ? new Date().toISOString() : null,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", domain.id);

        if (isComplete) {
          await logDomainEvent(
            supabase,
            domain.id,
            "warmup_completed",
            "system",
            `Warm-up completed after ${daysPassed} days. Final daily limit: ${domain.target_daily_volume}`
          );
        }

        results.push({ domainId: domain.id, success: true });
      } catch (domainError) {
        const errorMsg = domainError instanceof Error ? domainError.message : "Unknown error";
        results.push({ domainId: domain.id, success: false, error: errorMsg });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
