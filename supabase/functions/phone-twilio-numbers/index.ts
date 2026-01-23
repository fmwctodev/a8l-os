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

async function configureWebhooks(
  accountSid: string,
  authToken: string,
  phoneSid: string,
  baseUrl: string
) {
  const webhookUrl = `${baseUrl}/functions/v1`;

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers/${phoneSid}.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        SmsUrl: `${webhookUrl}/phone-webhook-sms`,
        SmsMethod: "POST",
        SmsStatusCallback: `${webhookUrl}/phone-webhook-status`,
        VoiceUrl: `${webhookUrl}/phone-webhook-voice`,
        VoiceMethod: "POST",
        StatusCallback: `${webhookUrl}/phone-webhook-status`,
      }).toString(),
    }
  );

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
      case "sync": {
        const { accountSid, authToken } = await getTwilioCredentials(supabase, orgId);
        const baseUrl = Deno.env.get("SUPABASE_URL")!;

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`,
          {
            headers: {
              Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
            },
          }
        );

        if (!response.ok) {
          return new Response(JSON.stringify({ error: "Failed to fetch numbers from Twilio" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const twilioData = await response.json();
        const numbers = twilioData.incoming_phone_numbers || [];

        const results = [];
        for (const num of numbers) {
          const capabilities = {
            sms: num.capabilities?.sms || false,
            mms: num.capabilities?.mms || false,
            voice: num.capabilities?.voice || false,
          };

          const { data, error } = await supabase
            .from("twilio_numbers")
            .upsert({
              org_id: orgId,
              phone_number: num.phone_number,
              phone_sid: num.sid,
              friendly_name: num.friendly_name,
              capabilities,
              country_code: num.phone_number?.slice(0, 2) === "+1" ? "US" : num.phone_number?.slice(1, 3),
              status: "active",
            }, { onConflict: "org_id,phone_sid" })
            .select()
            .single();

          if (!error && data) {
            const webhookConfigured = await configureWebhooks(accountSid, authToken, num.sid, baseUrl);

            if (webhookConfigured) {
              await supabase
                .from("twilio_numbers")
                .update({ webhook_configured: true })
                .eq("id", data.id);
            }

            results.push({ ...data, webhook_configured: webhookConfigured });
          }
        }

        return new Response(JSON.stringify({ success: true, numbers: results, count: results.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list": {
        const { data: numbers, error } = await supabase
          .from("twilio_numbers")
          .select("*, department:departments(id, name)")
          .eq("org_id", orgId)
          .order("phone_number");

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ numbers }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "enable": {
        const { numberId } = payload;
        const { accountSid, authToken } = await getTwilioCredentials(supabase, orgId);
        const baseUrl = Deno.env.get("SUPABASE_URL")!;

        const { data: number } = await supabase
          .from("twilio_numbers")
          .select("phone_sid")
          .eq("id", numberId)
          .eq("org_id", orgId)
          .maybeSingle();

        if (!number) {
          return new Response(JSON.stringify({ error: "Number not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const webhookConfigured = await configureWebhooks(accountSid, authToken, number.phone_sid, baseUrl);

        const { error } = await supabase
          .from("twilio_numbers")
          .update({ status: "active", webhook_configured: webhookConfigured })
          .eq("id", numberId)
          .eq("org_id", orgId);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "disable": {
        const { numberId } = payload;

        const { error } = await supabase
          .from("twilio_numbers")
          .update({ status: "disabled" })
          .eq("id", numberId)
          .eq("org_id", orgId);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "set-default-sms": {
        const { numberId } = payload;

        await supabase
          .from("twilio_numbers")
          .update({ is_default_sms: false })
          .eq("org_id", orgId);

        const { error } = await supabase
          .from("twilio_numbers")
          .update({ is_default_sms: true })
          .eq("id", numberId)
          .eq("org_id", orgId);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabase
          .from("phone_settings")
          .update({ default_sms_number_id: numberId })
          .eq("org_id", orgId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "set-default-voice": {
        const { numberId } = payload;

        await supabase
          .from("twilio_numbers")
          .update({ is_default_voice: false })
          .eq("org_id", orgId);

        const { error } = await supabase
          .from("twilio_numbers")
          .update({ is_default_voice: true })
          .eq("id", numberId)
          .eq("org_id", orgId);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabase
          .from("phone_settings")
          .update({ default_voice_number_id: numberId })
          .eq("org_id", orgId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "assign-department": {
        const { numberId, departmentId } = payload;

        const { error } = await supabase
          .from("twilio_numbers")
          .update({ department_id: departmentId || null })
          .eq("id", numberId)
          .eq("org_id", orgId);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
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
