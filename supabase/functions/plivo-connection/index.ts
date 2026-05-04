import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ENCRYPTION_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.slice(0, 32);

async function encrypt(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const keyData = encoder.encode(ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32));
  const key = await crypto.subtle.importKey("raw", keyData, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

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

async function verifyPlivoCredentials(authId: string, authToken: string): Promise<boolean> {
  const res = await fetch(`https://api.plivo.com/v1/Account/${authId}/`, {
    headers: { Authorization: `Basic ${btoa(`${authId}:${authToken}`)}` },
  });
  return res.ok;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!userData?.organization_id) {
      return jsonResponse({ error: "User not associated with organization" }, 403);
    }

    const orgId = userData.organization_id;
    const { action, ...payload } = await req.json();

    switch (action) {
      case "connect": {
        const { authId, authToken, subaccountAuthId, friendlyName } = payload;
        if (!authId || !authToken) {
          return jsonResponse({ error: "Auth ID and Auth Token are required" }, 400);
        }

        const isValid = await verifyPlivoCredentials(authId, authToken);
        if (!isValid) return jsonResponse({ error: "Invalid Plivo credentials" }, 400);

        const encryptedToken = await encrypt(authToken);

        const { data, error } = await supabase
          .from("plivo_connection")
          .upsert(
            {
              org_id: orgId,
              auth_id: authId,
              auth_token_encrypted: encryptedToken,
              subaccount_auth_id: subaccountAuthId || null,
              friendly_name: friendlyName || null,
              status: "connected",
              connected_at: new Date().toISOString(),
              connected_by: user.id,
            },
            { onConflict: "org_id" }
          )
          .select()
          .single();

        if (error) return jsonResponse({ error: error.message }, 500);

        await supabase.from("audit_logs").insert({
          organization_id: orgId,
          user_id: user.id,
          action: "plivo.connect",
          entity_type: "plivo_connection",
          entity_id: data.id,
          details: { authId },
        });

        return jsonResponse({
          success: true,
          connection: {
            id: data.id,
            authId: data.auth_id,
            subaccountAuthId: data.subaccount_auth_id,
            friendlyName: data.friendly_name,
            status: data.status,
            connectedAt: data.connected_at,
          },
        });
      }

      case "test": {
        const { data: connection } = await supabase
          .from("plivo_connection")
          .select("*")
          .eq("org_id", orgId)
          .maybeSingle();

        if (!connection) return jsonResponse({ error: "No Plivo connection found" }, 404);

        const authToken = await decrypt(connection.auth_token_encrypted);
        const isValid = await verifyPlivoCredentials(connection.auth_id, authToken);

        return jsonResponse({
          success: isValid,
          status: isValid ? "connected" : "failed",
          authId: connection.auth_id,
        });
      }

      case "disconnect": {
        const { data: connection } = await supabase
          .from("plivo_connection")
          .select("id")
          .eq("org_id", orgId)
          .maybeSingle();

        if (!connection) return jsonResponse({ error: "No Plivo connection found" }, 404);

        const { error } = await supabase
          .from("plivo_connection")
          .update({ status: "disconnected", auth_token_encrypted: "" })
          .eq("org_id", orgId);

        if (error) return jsonResponse({ error: error.message }, 500);

        await supabase.from("audit_logs").insert({
          organization_id: orgId,
          user_id: user.id,
          action: "plivo.disconnect",
          entity_type: "plivo_connection",
          entity_id: connection.id,
          details: {},
        });

        return jsonResponse({ success: true });
      }

      case "get": {
        const { data: connection } = await supabase
          .from("plivo_connection")
          .select("id, auth_id, subaccount_auth_id, friendly_name, status, connected_at, vapi_sip_username")
          .eq("org_id", orgId)
          .maybeSingle();

        return jsonResponse({
          connection: connection
            ? {
                id: connection.id,
                authId: connection.auth_id,
                subaccountAuthId: connection.subaccount_auth_id,
                friendlyName: connection.friendly_name,
                status: connection.status,
                connectedAt: connection.connected_at,
                vapiSipUsername: connection.vapi_sip_username,
              }
            : null,
        });
      }

      case "set_vapi_sip": {
        // Store the SIP credentials Plivo needs to forward inbound calls to
        // Vapi (and that Vapi needs to call out via Plivo). The username is
        // not secret; the password is encrypted at rest.
        const { sipUsername, sipPassword } = payload;
        if (!sipUsername || !sipPassword) {
          return jsonResponse({ error: "sipUsername and sipPassword are required" }, 400);
        }
        const encryptedPwd = await encrypt(sipPassword);
        const { error } = await supabase
          .from("plivo_connection")
          .update({
            vapi_sip_username: sipUsername,
            vapi_sip_password_encrypted: encryptedPwd,
          })
          .eq("org_id", orgId);
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ success: true });
      }

      default:
        return jsonResponse({ error: "Invalid action" }, 400);
    }
  } catch (error) {
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
