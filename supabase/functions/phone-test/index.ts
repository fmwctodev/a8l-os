import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ENCRYPTION_KEY = Deno.env.get("PHONE_ENCRYPTION_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.slice(0, 32);

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

async function getTwilioCredentials(supabase: any, orgId: string) {
  const { data: connection } = await supabase
    .from("twilio_connection")
    .select("account_sid, auth_token_encrypted, status")
    .eq("org_id", orgId)
    .maybeSingle();

  if (!connection || connection.status !== "connected") {
    throw new Error("Twilio not connected");
  }

  const authToken = await decrypt(connection.auth_token_encrypted);
  return { accountSid: connection.account_sid, authToken };
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
      case "sms": {
        const { toNumber, fromNumberId, messageBody } = payload;

        if (!toNumber || !messageBody) {
          return new Response(JSON.stringify({ error: "To number and message body are required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { accountSid, authToken } = await getTwilioCredentials(supabase, orgId);

        let fromNumber: string;
        if (fromNumberId) {
          const { data: number } = await supabase
            .from("twilio_numbers")
            .select("phone_number")
            .eq("id", fromNumberId)
            .eq("org_id", orgId)
            .maybeSingle();

          if (!number) {
            return new Response(JSON.stringify({ error: "From number not found" }), {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          fromNumber = number.phone_number;
        } else {
          const { data: defaultNumber } = await supabase
            .from("twilio_numbers")
            .select("phone_number")
            .eq("org_id", orgId)
            .eq("is_default_sms", true)
            .maybeSingle();

          if (!defaultNumber) {
            return new Response(JSON.stringify({ error: "No default SMS number configured" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          fromNumber = defaultNumber.phone_number;
        }

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: toNumber,
              From: fromNumber,
              Body: messageBody,
            }).toString(),
          }
        );

        const result = await response.json();

        const logEntry = {
          org_id: orgId,
          test_type: "sms",
          to_number: toNumber,
          from_number: fromNumber,
          message_body: messageBody,
          status: response.ok ? "sent" : "failed",
          twilio_sid: result.sid || null,
          error_message: response.ok ? null : result.message,
          tested_by: user.id,
        };

        await supabase.from("phone_test_logs").insert(logEntry);

        if (!response.ok) {
          return new Response(JSON.stringify({ error: result.message, details: result }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          success: true,
          messageSid: result.sid,
          status: result.status,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "call": {
        const { toNumber, fromNumberId, ttsMessage } = payload;

        if (!toNumber) {
          return new Response(JSON.stringify({ error: "To number is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { accountSid, authToken } = await getTwilioCredentials(supabase, orgId);

        let fromNumber: string;
        if (fromNumberId) {
          const { data: number } = await supabase
            .from("twilio_numbers")
            .select("phone_number")
            .eq("id", fromNumberId)
            .eq("org_id", orgId)
            .maybeSingle();

          if (!number) {
            return new Response(JSON.stringify({ error: "From number not found" }), {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          fromNumber = number.phone_number;
        } else {
          const { data: defaultNumber } = await supabase
            .from("twilio_numbers")
            .select("phone_number")
            .eq("org_id", orgId)
            .eq("is_default_voice", true)
            .maybeSingle();

          if (!defaultNumber) {
            return new Response(JSON.stringify({ error: "No default voice number configured" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          fromNumber = defaultNumber.phone_number;
        }

        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${ttsMessage || "This is a test call from your phone system. Goodbye!"}</Say>
  <Hangup/>
</Response>`;

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: toNumber,
              From: fromNumber,
              Twiml: twiml,
            }).toString(),
          }
        );

        const result = await response.json();

        const logEntry = {
          org_id: orgId,
          test_type: "call",
          to_number: toNumber,
          from_number: fromNumber,
          message_body: ttsMessage || "Default test message",
          status: response.ok ? "initiated" : "failed",
          twilio_sid: result.sid || null,
          error_message: response.ok ? null : result.message,
          tested_by: user.id,
        };

        await supabase.from("phone_test_logs").insert(logEntry);

        if (!response.ok) {
          return new Response(JSON.stringify({ error: result.message, details: result }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          success: true,
          callSid: result.sid,
          status: result.status,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "logs": {
        const { limit = 20 } = payload;

        const { data: logs, error } = await supabase
          .from("phone_test_logs")
          .select("*, tested_by_user:users!phone_test_logs_tested_by_fkey(id, name, email)")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ logs }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "webhook-health": {
        const { data: health, error } = await supabase
          .from("webhook_health")
          .select("*")
          .eq("org_id", orgId);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const healthMap: Record<string, any> = {};
        for (const h of health || []) {
          const total = h.success_count + h.failure_count;
          healthMap[h.webhook_type] = {
            lastReceived: h.last_received_at,
            successCount: h.success_count,
            failureCount: h.failure_count,
            failureRate: total > 0 ? (h.failure_count / total) * 100 : 0,
            lastError: h.last_error,
            status: !h.last_received_at
              ? "never_received"
              : h.failure_count > h.success_count
              ? "degraded"
              : "healthy",
          };
        }

        return new Response(JSON.stringify({ health: healthMap }), {
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
