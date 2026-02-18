import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ENCRYPTION_KEY =
  Deno.env.get("PHONE_ENCRYPTION_KEY") ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.slice(0, 32);

async function decrypt(encryptedText: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32));
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const combined = Uint8Array.from(atob(encryptedText), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

async function getTwilioCredentials(supabase: ReturnType<typeof createClient>, orgId: string) {
  const { data: connection } = await supabase
    .from("twilio_connection")
    .select("account_sid, auth_token_encrypted, status")
    .eq("org_id", orgId)
    .maybeSingle();

  if (!connection || connection.status !== "connected") {
    throw new Error("Twilio not connected for this organization");
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
      return new Response(JSON.stringify({ error: "User not associated with an organization" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = userData.organization_id;
    const { messageId } = await req.json();

    if (!messageId) {
      return new Response(JSON.stringify({ error: "messageId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: message, error: msgError } = await supabase
      .from("messages")
      .select("*")
      .eq("id", messageId)
      .eq("organization_id", orgId)
      .single();

    if (msgError || !message) {
      return new Response(JSON.stringify({ error: "Message not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (message.channel !== "sms") {
      return new Response(JSON.stringify({ error: "Message is not an SMS" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metadata = (message.metadata || {}) as Record<string, unknown>;
    const toNumber = metadata.to_number as string | undefined;
    const fromNumber = metadata.from_number as string | undefined;
    const mediaUrls = (message.media_urls as string[] | null) || [];

    if (!toNumber) {
      await supabase
        .from("messages")
        .update({
          status: "failed",
          metadata: { ...metadata, error_message: "No recipient phone number found on message" },
        })
        .eq("id", messageId);

      return new Response(JSON.stringify({ error: "No recipient phone number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let resolvedFromNumber = fromNumber;
    if (!resolvedFromNumber) {
      const { data: defaultNum } = await supabase
        .from("twilio_numbers")
        .select("phone_number")
        .eq("org_id", orgId)
        .eq("is_default_sms", true)
        .eq("status", "active")
        .maybeSingle();

      if (defaultNum) {
        resolvedFromNumber = defaultNum.phone_number;
      } else {
        const { data: anyNum } = await supabase
          .from("twilio_numbers")
          .select("phone_number")
          .eq("org_id", orgId)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();

        resolvedFromNumber = anyNum?.phone_number;
      }
    }

    if (!resolvedFromNumber) {
      await supabase
        .from("messages")
        .update({
          status: "failed",
          metadata: { ...metadata, error_message: "No active Twilio number available to send from" },
        })
        .eq("id", messageId);

      return new Response(JSON.stringify({ error: "No active Twilio number available" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { accountSid, authToken } = await getTwilioCredentials(supabase, orgId);

    const params = new URLSearchParams({
      To: toNumber,
      From: resolvedFromNumber,
      Body: message.body || "",
    });

    for (const url of mediaUrls) {
      params.append("MediaUrl", url);
    }

    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      const errorMessage = twilioData.message || "Twilio API error";
      const errorCode = twilioData.code;

      await supabase
        .from("messages")
        .update({
          status: "failed",
          metadata: {
            ...metadata,
            error_message: errorMessage,
            error_code: errorCode,
            from_number: resolvedFromNumber,
          },
        })
        .eq("id", messageId);

      return new Response(
        JSON.stringify({ error: errorMessage, code: errorCode }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    await supabase
      .from("messages")
      .update({
        status: "sent",
        external_id: twilioData.sid,
        metadata: {
          ...metadata,
          from_number: resolvedFromNumber,
          twilio_status: twilioData.status,
        },
      })
      .eq("id", messageId);

    return new Response(
      JSON.stringify({ success: true, sid: twilioData.sid, status: twilioData.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-sms error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
