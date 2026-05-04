import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * link-redirect — public click-tracker for the `trigger_link_clicked` workflow trigger.
 *
 * Flow:
 *   GET /link-redirect/:slug                       — looks up tracked_links row
 *   record click into tracked_link_clicks          — immutable click log
 *   bump click_count + last_clicked_at on parent
 *   INSERT INTO event_outbox                       — workflow-processor consumes
 *   302 → destination_url                          — user proceeds
 *
 * No JWT required (public endpoint).
 *
 * Optional query string `?c=<contact_id>` attributes the click to a contact
 * even if the parent row has no static contact_id (e.g. links rendered into
 * an outbound email get the recipient appended).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function htmlError(status: number, title: string, body: string): Response {
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
body{font:14px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;color:#333;max-width:520px;margin:80px auto;padding:0 24px;text-align:center}
h1{font-size:18px;font-weight:600;color:#111;margin-bottom:8px}
p{color:#666}
</style></head>
<body><h1>${title}</h1><p>${body}</p></body></html>`;
  return new Response(html, { status, headers: { ...corsHeaders, "Content-Type": "text/html" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return htmlError(500, "Server error", "Link redirect is misconfigured.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const slug = pathParts[pathParts.length - 1];

    if (!slug || slug === "link-redirect") {
      return htmlError(400, "Missing link", "No tracked link slug was provided.");
    }

    const { data: link, error } = await supabase
      .from("tracked_links")
      .select("id, org_id, destination_url, contact_id, workflow_id, metadata, is_active, expires_at, click_count")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !link) {
      return htmlError(404, "Link not found", "This tracked link doesn't exist or has been removed.");
    }

    if (!link.is_active) {
      return htmlError(410, "Link disabled", "This link has been disabled by the sender.");
    }

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return htmlError(410, "Link expired", "This link has expired.");
    }

    // Resolve contact: explicit ?c= query overrides the parent row
    const contactIdFromQuery = url.searchParams.get("c");
    const contactId = contactIdFromQuery || link.contact_id || null;

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
            || req.headers.get("x-real-ip")
            || null;
    const userAgent = req.headers.get("user-agent") || null;
    const referrer = req.headers.get("referer") || null;

    const queryParams: Record<string, string> = {};
    url.searchParams.forEach((v, k) => { queryParams[k] = v; });

    // Record the click (best-effort; never block the redirect on this)
    await supabase.from("tracked_link_clicks").insert({
      org_id: link.org_id,
      tracked_link_id: link.id,
      contact_id: contactId,
      ip_address: ip,
      user_agent: userAgent,
      referrer,
      query_params: Object.keys(queryParams).length ? queryParams : null,
    });

    await supabase
      .from("tracked_links")
      .update({
        click_count: (link.click_count || 0) + 1,
        last_clicked_at: new Date().toISOString(),
      })
      .eq("id", link.id);

    // Emit event_outbox so workflows with `trigger_link_clicked` fire
    await supabase.from("event_outbox").insert({
      org_id: link.org_id,
      event_type: "trigger_link_clicked",
      contact_id: contactId,
      entity_type: "tracked_link",
      entity_id: link.id,
      payload: {
        tracked_link_id: link.id,
        slug,
        destination_url: link.destination_url,
        workflow_id: link.workflow_id,
        contact_id: contactId,
        ip_address: ip,
        user_agent: userAgent,
        referrer,
        query_params: queryParams,
        clicked_at: new Date().toISOString(),
        metadata: link.metadata,
      },
      processed_at: null,
    });

    // 302 to destination
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: link.destination_url,
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (err) {
    console.error("link-redirect error:", err);
    return htmlError(500, "Server error", "Something went wrong handling that link.");
  }
});
