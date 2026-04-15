import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const SAM_OPPORTUNITIES_URL =
  "https://api.sam.gov/opportunities/v2/search";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSamDate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/** Pause execution to stay within SAM.gov rate limits. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[sam-gov-alert-cron] Starting SAM.gov alert check");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("SAM_GOV_API_KEY");

    if (!apiKey) {
      throw new Error("SAM_GOV_API_KEY environment variable is not set");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Fetch all saved searches that have alerts enabled
    const { data: savedSearches, error: ssError } = await supabase
      .from("gov_saved_searches")
      .select("id, user_id, org_id, search_criteria, last_checked_at")
      .eq("alert_enabled", true);

    if (ssError) {
      console.error(
        "[sam-gov-alert-cron] Failed to load saved searches:",
        ssError.message
      );
      throw new Error(`Failed to load saved searches: ${ssError.message}`);
    }

    if (!savedSearches || savedSearches.length === 0) {
      console.log("[sam-gov-alert-cron] No saved searches with alerts enabled");
      return new Response(
        JSON.stringify({ success: true, message: "No alerts to process", alertsSent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      `[sam-gov-alert-cron] Processing ${savedSearches.length} saved searches`
    );

    let totalAlertsSent = 0;

    // 2. Process each saved search
    for (let i = 0; i < savedSearches.length; i++) {
      const search = savedSearches[i];

      // Space out requests to respect SAM.gov rate limits (10 req/day for
      // non-federal users). Wait 2 seconds between calls.
      if (i > 0) {
        await sleep(2000);
      }

      try {
        const criteria = (search.search_criteria ?? {}) as Record<
          string,
          unknown
        >;

        // Build date range: from last_checked_at (or 1 day ago) until now
        const now = new Date();
        const postedFrom = search.last_checked_at
          ? new Date(search.last_checked_at)
          : new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const qp = new URLSearchParams();
        qp.set("api_key", apiKey);

        if (criteria.keywords) qp.set("q", String(criteria.keywords));
        if (criteria.naicsCode) qp.set("ncode", String(criteria.naicsCode));
        if (criteria.pscCode) qp.set("ccode", String(criteria.pscCode));
        if (criteria.setAsideType)
          qp.set("typeOfSetAside", String(criteria.setAsideType));
        if (criteria.state) qp.set("state", String(criteria.state));
        if (criteria.agencyName)
          qp.set("organizationName", String(criteria.agencyName));
        if (criteria.procurementType)
          qp.set("ptype", String(criteria.procurementType));

        qp.set("postedFrom", formatSamDate(postedFrom));
        qp.set("postedTo", formatSamDate(now));
        qp.set("limit", "25");
        qp.set("offset", "0");

        const url = `${SAM_OPPORTUNITIES_URL}?${qp.toString()}`;
        console.log(
          `[sam-gov-alert-cron] Search ${search.id}: ${url.replace(/api_key=[^&]+/, "api_key=***")}`
        );

        const response = await fetch(url);

        if (response.status === 429) {
          console.warn(
            "[sam-gov-alert-cron] SAM.gov rate limit hit. Stopping further requests."
          );
          break;
        }

        if (!response.ok) {
          console.error(
            `[sam-gov-alert-cron] SAM.gov returned ${response.status} for search ${search.id}`
          );
          continue;
        }

        const data = (await response.json()) as Record<string, unknown>;
        const opportunities = (data.opportunitiesData ?? []) as Array<
          Record<string, unknown>
        >;

        if (opportunities.length === 0) {
          // No new results — just update the timestamp
          await supabase
            .from("gov_saved_searches")
            .update({ last_checked_at: now.toISOString(), results_count: 0 })
            .eq("id", search.id);
          continue;
        }

        // 3. Filter out opportunities already imported for this org
        const noticeIds = opportunities
          .map((o) => o.noticeId as string)
          .filter(Boolean);

        const { data: existingImports } = await supabase
          .from("gov_opportunity_imports")
          .select("sam_notice_id")
          .eq("org_id", search.org_id)
          .in("sam_notice_id", noticeIds);

        const existingSet = new Set(
          (existingImports ?? []).map(
            (r: { sam_notice_id: string }) => r.sam_notice_id
          )
        );

        const newOpportunities = opportunities.filter(
          (o) => o.noticeId && !existingSet.has(o.noticeId as string)
        );

        // 4. Create notifications for each new opportunity
        if (newOpportunities.length > 0) {
          const notifications = newOpportunities.map((opp) => ({
            user_id: search.user_id,
            type: "gov_opportunity",
            title: "New Government Opportunity",
            body: `${opp.title ?? "Untitled"} — ${opp.fullParentPathName ?? "Unknown Agency"}`,
            link: "/opportunities/government",
            metadata: {
              notice_id: opp.noticeId,
              solicitation_number: opp.solicitationNumber,
              saved_search_id: search.id,
            },
          }));

          const { error: notifErr } = await supabase
            .from("notifications")
            .insert(notifications);

          if (notifErr) {
            console.error(
              `[sam-gov-alert-cron] Failed to insert notifications for search ${search.id}:`,
              notifErr.message
            );
          } else {
            totalAlertsSent += newOpportunities.length;
            console.log(
              `[sam-gov-alert-cron] Sent ${newOpportunities.length} notifications for search ${search.id}`
            );
          }
        }

        // 5. Update the saved search record
        await supabase
          .from("gov_saved_searches")
          .update({
            last_checked_at: now.toISOString(),
            results_count: newOpportunities.length,
          })
          .eq("id", search.id);
      } catch (searchErr) {
        console.error(
          `[sam-gov-alert-cron] Error processing search ${search.id}:`,
          (searchErr as Error).message
        );
        // Continue to next search instead of aborting the whole run
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `[sam-gov-alert-cron] Complete. ${totalAlertsSent} alerts sent in ${elapsed}ms`
    );

    return new Response(
      JSON.stringify({
        success: true,
        searchesProcessed: savedSearches.length,
        alertsSent: totalAlertsSent,
        elapsedMs: elapsed,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(
      "[sam-gov-alert-cron] Fatal error:",
      (error as Error).message
    );
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
