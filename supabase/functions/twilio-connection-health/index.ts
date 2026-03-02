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

async function verifyTwilioCredentials(accountSid: string, authToken: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: connections, error } = await supabase
      .from("twilio_connection")
      .select("id, org_id, account_sid, auth_token_encrypted, status")
      .not("auth_token_encrypted", "is", null)
      .neq("auth_token_encrypted", "");

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const conn of connections || []) {
      try {
        const authToken = await decrypt(conn.auth_token_encrypted);
        const isValid = await verifyTwilioCredentials(conn.account_sid, authToken);

        const newStatus = isValid ? "connected" : "disconnected";

        if (conn.status !== newStatus) {
          await supabase
            .from("twilio_connection")
            .update({
              status: newStatus,
              last_health_check_at: new Date().toISOString(),
            })
            .eq("id", conn.id);
        } else {
          await supabase
            .from("twilio_connection")
            .update({ last_health_check_at: new Date().toISOString() })
            .eq("id", conn.id);
        }

        results.push({ orgId: conn.org_id, accountSid: conn.account_sid, valid: isValid, status: newStatus });
      } catch (err) {
        results.push({ orgId: conn.org_id, accountSid: conn.account_sid, valid: false, error: String(err) });
      }
    }

    return new Response(JSON.stringify({ success: true, checked: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
