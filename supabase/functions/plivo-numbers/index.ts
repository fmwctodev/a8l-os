import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ENCRYPTION_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.slice(0, 32);

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

async function fetchPlivoNumbers(authId: string, authToken: string): Promise<PlivoNumber[]> {
  const all: PlivoNumber[] = [];
  let offset = 0;
  const limit = 100;
  for (;;) {
    const url = `https://api.plivo.com/v1/Account/${authId}/Number/?limit=${limit}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${btoa(`${authId}:${authToken}`)}` },
    });
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
          .select("auth_id, auth_token_encrypted, status")
          .eq("org_id", orgId)
          .maybeSingle();
        if (!conn || conn.status !== "connected") {
          return jsonResponse({ error: "Plivo not connected" }, 400);
        }
        const authToken = await decrypt(conn.auth_token_encrypted);
        const remote = await fetchPlivoNumbers(conn.auth_id, authToken);

        let synced = 0;
        let added = 0;
        for (const n of remote) {
          const { data: existing } = await supabase
            .from("plivo_numbers")
            .select("id")
            .eq("org_id", orgId)
            .eq("phone_number", n.number)
            .maybeSingle();

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
        return jsonResponse({ success: true, synced, added, total: remote.length });
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
