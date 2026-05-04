import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ENCRYPTION_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.slice(0, 32);
const PLIVO_APP_NAME = "Autom8ion Lab Webhooks";

async function decrypt(encryptedText: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32));
  const key = await crypto.subtle.importKey("raw", keyData, { name: "AES-GCM" }, false, ["decrypt"]);
  const combined = Uint8Array.from(atob(encryptedText), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

interface PlivoNumber {
  number: string;
  alias?: string;
  application?: string;
  number_type?: string;
  region?: string;
  voice_enabled?: boolean;
  sms_enabled?: boolean;
  mms_enabled?: boolean;
  resource_uri?: string;
}

function basicAuth(authId: string, authToken: string): string {
  return `Basic ${btoa(`${authId}:${authToken}`)}`;
}

function buildAppUrls() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
  return {
    answer_url: `${supabaseUrl}/functions/v1/plivo-voice-answer`,
    answer_method: "POST",
    hangup_url: `${supabaseUrl}/functions/v1/plivo-voice-status`,
    hangup_method: "POST",
    message_url: `${supabaseUrl}/functions/v1/plivo-sms-inbound`,
    message_method: "POST",
    fallback_answer_url: `${supabaseUrl}/functions/v1/plivo-voice-answer`,
    default_number_app: true,
    app_name: PLIVO_APP_NAME,
  };
}

async function fetchPlivoNumbers(authId: string, authToken: string): Promise<PlivoNumber[]> {
  const all: PlivoNumber[] = [];
  let offset = 0;
  const limit = 100;
  for (;;) {
    const url = `https://api.plivo.com/v1/Account/${authId}/Number/?limit=${limit}&offset=${offset}`;
    const res = await fetch(url, { headers: { Authorization: basicAuth(authId, authToken) } });
    if (!res.ok) break;
    const data = await res.json();
    const objects = (data.objects || []) as PlivoNumber[];
    all.push(...objects);
    if (objects.length < limit) break;
    offset += limit;
    if (offset > 1000) break;
  }
  return all;
}

/**
 * Ensure a single Plivo Application exists for this org with our 4 webhook
 * URLs. If knownAppId is supplied, PATCH the existing app with the latest
 * URLs (handles env URL drift). Otherwise POST a new one and return its id.
 *
 * Plivo Application API docs:
 *   POST   /v1/Account/{auth_id}/Application/         — create
 *   POST   /v1/Account/{auth_id}/Application/{app}/   — update
 *
 * Returns the resolved app_id or null on hard failure.
 */
async function ensurePlivoApplication(
  authId: string,
  authToken: string,
  knownAppId: string | null
): Promise<{ appId: string | null; error: string | null }> {
  const urls = buildAppUrls();
  const headers = { Authorization: basicAuth(authId, authToken), "Content-Type": "application/json" };

  if (knownAppId) {
    // Verify the app still exists, then PATCH the URLs in case they drifted.
    const verifyRes = await fetch(
      `https://api.plivo.com/v1/Account/${authId}/Application/${knownAppId}/`,
      { headers: { Authorization: basicAuth(authId, authToken) } }
    );
    if (verifyRes.ok) {
      const updateRes = await fetch(
        `https://api.plivo.com/v1/Account/${authId}/Application/${knownAppId}/`,
        { method: "POST", headers, body: JSON.stringify(urls) }
      );
      if (updateRes.ok || updateRes.status === 202) {
        return { appId: knownAppId, error: null };
      }
      const text = await updateRes.text();
      console.error(`ensurePlivoApplication update failed: status=${updateRes.status} body=${text.slice(0, 500)}`);
      return { appId: knownAppId, error: `Update failed: Plivo ${updateRes.status}: ${text.slice(0, 300)}` };
    }
    // Fall through and create a new one if the cached id no longer exists
    console.warn(`ensurePlivoApplication: cached app ${knownAppId} not found (${verifyRes.status}), creating new`);
  }

  const createRes = await fetch(
    `https://api.plivo.com/v1/Account/${authId}/Application/`,
    { method: "POST", headers, body: JSON.stringify(urls) }
  );
  const createText = await createRes.text();
  let created: Record<string, unknown> = {};
  try { created = JSON.parse(createText); } catch { /* not json */ }
  if (!createRes.ok && createRes.status !== 201 && createRes.status !== 202) {
    console.error(`ensurePlivoApplication create failed: status=${createRes.status} body=${createText.slice(0, 500)}`);
    return { appId: null, error: `Create failed: Plivo ${createRes.status}: ${createText.slice(0, 300)}` };
  }
  const appId = (created.app_id as string) || (created.id as string) || null;
  if (!appId) {
    console.error(`ensurePlivoApplication: no app_id in response: ${createText.slice(0, 500)}`);
    return { appId: null, error: "Plivo created the app but returned no app_id" };
  }
  return { appId, error: null };
}

/**
 * Assign a Plivo Application to a phone number so inbound SMS / voice route
 * to our edge functions. Plivo's number-update endpoint accepts an `app_id`
 * field that re-points the number's webhook configuration in one shot.
 *
 * Plivo expects bare digits in the URL path (no leading +, no formatting).
 */
async function assignAppToNumber(
  authId: string,
  authToken: string,
  e164: string,
  appId: string
): Promise<{ ok: boolean; error: string | null }> {
  const bare = e164.replace(/\D/g, "");
  const url = `https://api.plivo.com/v1/Account/${authId}/Number/${bare}/`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: basicAuth(authId, authToken), "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: appId }),
  });
  if (res.ok || res.status === 202) return { ok: true, error: null };
  const text = await res.text().catch(() => "");
  console.error(`assignAppToNumber failed: POST ${url} status=${res.status} body=${text.slice(0, 500)}`);
  return { ok: false, error: `Plivo ${res.status}: ${text.slice(0, 300)}` };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing authorization" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!userData?.organization_id) return jsonResponse({ error: "No org" }, 403);

    const orgId = userData.organization_id;
    const body = await req.json().catch(() => ({}));
    const action = body.action || "list";

    switch (action) {
      case "list": {
        const { data } = await supabase
          .from("plivo_numbers")
          .select(`
            *,
            assigned_user:users!assigned_user_id(id, name, email),
            vapi_assistant:vapi_assistants!vapi_assistant_id(id, name, slug)
          `)
          .eq("org_id", orgId)
          .order("created_at", { ascending: false });
        return jsonResponse({ numbers: data || [] });
      }

      case "sync": {
        const { data: conn } = await supabase
          .from("plivo_connection")
          .select("auth_id, auth_token_encrypted, status, plivo_app_id")
          .eq("org_id", orgId)
          .maybeSingle();
        if (!conn || conn.status !== "connected") {
          return jsonResponse({ error: "Plivo not connected" }, 400);
        }
        const authToken = await decrypt(conn.auth_token_encrypted);
        const remote = await fetchPlivoNumbers(conn.auth_id, authToken);

        // 1) Ensure the org's webhook Application exists / is up-to-date
        const { appId, error: appErr } = await ensurePlivoApplication(
          conn.auth_id,
          authToken,
          conn.plivo_app_id
        );
        if (appErr) console.warn(`plivo-numbers sync: app ensure warning: ${appErr}`);
        if (appId && appId !== conn.plivo_app_id) {
          await supabase
            .from("plivo_connection")
            .update({ plivo_app_id: appId })
            .eq("org_id", orgId);
        }

        // 2) Upsert + assign the app to each number
        let synced = 0;
        let added = 0;
        let webhooksConfigured = 0;
        let webhooksFailed = 0;
        const errors: string[] = [];

        for (const n of remote) {
          const { data: existing } = await supabase
            .from("plivo_numbers")
            .select("id")
            .eq("org_id", orgId)
            .eq("phone_number", n.number)
            .maybeSingle();

          let webhookOk = false;
          if (appId) {
            const r = await assignAppToNumber(conn.auth_id, authToken, n.number, appId);
            webhookOk = r.ok;
            if (!r.ok) {
              webhooksFailed++;
              errors.push(`${n.number}: ${r.error}`);
            } else {
              webhooksConfigured++;
            }
          }

          const row = {
            org_id: orgId,
            phone_number: n.number,
            plivo_number_uuid: n.number,
            friendly_name: n.alias || null,
            capabilities: {
              sms: !!n.sms_enabled,
              mms: !!n.mms_enabled,
              voice: !!n.voice_enabled,
            },
            country_code: n.region || null,
            status: "active" as const,
            webhook_configured: webhookOk,
            updated_at: new Date().toISOString(),
          };

          if (existing) {
            await supabase.from("plivo_numbers").update(row).eq("id", existing.id);
            synced++;
          } else {
            await supabase.from("plivo_numbers").insert(row);
            added++;
          }
        }
        return jsonResponse({
          success: true,
          synced,
          added,
          total: remote.length,
          webhooks_configured: webhooksConfigured,
          webhooks_failed: webhooksFailed,
          app_id: appId,
          errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
        });
      }

      case "configure_webhooks_for_number": {
        const { numberId } = body;
        if (!numberId) return jsonResponse({ error: "numberId required" }, 400);

        const { data: conn } = await supabase
          .from("plivo_connection")
          .select("auth_id, auth_token_encrypted, status, plivo_app_id")
          .eq("org_id", orgId)
          .maybeSingle();
        if (!conn || conn.status !== "connected") {
          return jsonResponse({ error: "Plivo not connected" }, 400);
        }
        const authToken = await decrypt(conn.auth_token_encrypted);

        const { data: num } = await supabase
          .from("plivo_numbers")
          .select("phone_number")
          .eq("id", numberId)
          .eq("org_id", orgId)
          .maybeSingle();
        if (!num) return jsonResponse({ error: "Number not found" }, 404);

        const { appId, error: appErr } = await ensurePlivoApplication(
          conn.auth_id,
          authToken,
          conn.plivo_app_id
        );
        if (!appId) return jsonResponse({ error: appErr || "Could not ensure Plivo app" }, 500);
        if (appId !== conn.plivo_app_id) {
          await supabase.from("plivo_connection").update({ plivo_app_id: appId }).eq("org_id", orgId);
        }

        const r = await assignAppToNumber(conn.auth_id, authToken, num.phone_number, appId);
        await supabase
          .from("plivo_numbers")
          .update({ webhook_configured: r.ok, updated_at: new Date().toISOString() })
          .eq("id", numberId);

        if (!r.ok) return jsonResponse({ error: r.error || "Plivo update failed" }, 500);
        return jsonResponse({ success: true });
      }

      case "update_assignment": {
        const { numberId, smsRoute, assignedUserId, vapiAssistantId } = body;
        if (!numberId) return jsonResponse({ error: "numberId required" }, 400);

        // Sanity-check the patch matches the route semantics:
        //   sms_route='user' implies assigned_user_id is set
        //   sms_route='clara' clears assigned_user_id
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (smsRoute === "user") {
          patch.sms_route = "user";
          patch.assigned_user_id = assignedUserId || null;
        } else if (smsRoute === "clara") {
          patch.sms_route = "clara";
          patch.assigned_user_id = null;
        }
        if (vapiAssistantId !== undefined) {
          patch.vapi_assistant_id = vapiAssistantId || null;
        }

        const { data, error } = await supabase
          .from("plivo_numbers")
          .update(patch)
          .eq("id", numberId)
          .eq("org_id", orgId)
          .select()
          .single();
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ success: true, number: data });
      }

      case "delete": {
        const { numberId } = body;
        if (!numberId) return jsonResponse({ error: "numberId required" }, 400);
        // Soft-delete: just set status=disabled. Plivo number stays rented at Plivo.
        const { error } = await supabase
          .from("plivo_numbers")
          .update({ status: "disabled" })
          .eq("id", numberId)
          .eq("org_id", orgId);
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ success: true });
      }

      default:
        return jsonResponse({ error: "Invalid action" }, 400);
    }
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
