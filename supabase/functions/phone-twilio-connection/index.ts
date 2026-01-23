import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ENCRYPTION_KEY = Deno.env.get("PHONE_ENCRYPTION_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.slice(0, 32);

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

async function verifyTwilioCredentials(accountSid: string, authToken: string): Promise<boolean> {
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
    headers: {
      Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
    },
  });
  return response.ok;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!userData?.organization_id) {
      return new Response(JSON.stringify({ error: "User not associated with organization" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = userData.organization_id;
    const { action, ...payload } = await req.json();

    switch (action) {
      case "connect": {
        const { accountSid, authToken, subaccountSid, friendlyName } = payload;

        if (!accountSid || !authToken) {
          return new Response(JSON.stringify({ error: "Account SID and Auth Token are required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const isValid = await verifyTwilioCredentials(accountSid, authToken);
        if (!isValid) {
          return new Response(JSON.stringify({ error: "Invalid Twilio credentials" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const encryptedToken = await encrypt(authToken);

        const { data, error } = await supabase
          .from("twilio_connection")
          .upsert({
            org_id: orgId,
            account_sid: accountSid,
            auth_token_encrypted: encryptedToken,
            subaccount_sid: subaccountSid || null,
            friendly_name: friendlyName || null,
            status: "connected",
            connected_at: new Date().toISOString(),
            connected_by: user.id,
          }, { onConflict: "org_id" })
          .select()
          .single();

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabase.from("audit_logs").insert({
          organization_id: orgId,
          user_id: user.id,
          action: "twilio.connect",
          entity_type: "twilio_connection",
          entity_id: data.id,
          details: { accountSid },
        });

        return new Response(JSON.stringify({
          success: true,
          connection: {
            id: data.id,
            accountSid: data.account_sid,
            subaccountSid: data.subaccount_sid,
            friendlyName: data.friendly_name,
            status: data.status,
            connectedAt: data.connected_at,
          },
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "test": {
        const { data: connection } = await supabase
          .from("twilio_connection")
          .select("*")
          .eq("org_id", orgId)
          .maybeSingle();

        if (!connection) {
          return new Response(JSON.stringify({ error: "No Twilio connection found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const authToken = await decrypt(connection.auth_token_encrypted);
        const isValid = await verifyTwilioCredentials(connection.account_sid, authToken);

        return new Response(JSON.stringify({
          success: isValid,
          status: isValid ? "connected" : "failed",
          accountSid: connection.account_sid,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "disconnect": {
        const { data: connection } = await supabase
          .from("twilio_connection")
          .select("id")
          .eq("org_id", orgId)
          .maybeSingle();

        if (!connection) {
          return new Response(JSON.stringify({ error: "No Twilio connection found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await supabase
          .from("twilio_connection")
          .update({
            status: "disconnected",
            auth_token_encrypted: "",
          })
          .eq("org_id", orgId);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabase.from("audit_logs").insert({
          organization_id: orgId,
          user_id: user.id,
          action: "twilio.disconnect",
          entity_type: "twilio_connection",
          entity_id: connection.id,
          details: {},
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get": {
        const { data: connection } = await supabase
          .from("twilio_connection")
          .select("id, account_sid, subaccount_sid, friendly_name, status, connected_at")
          .eq("org_id", orgId)
          .maybeSingle();

        return new Response(JSON.stringify({
          connection: connection ? {
            id: connection.id,
            accountSid: connection.account_sid,
            subaccountSid: connection.subaccount_sid,
            friendlyName: connection.friendly_name,
            status: connection.status,
            connectedAt: connection.connected_at,
          } : null,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
