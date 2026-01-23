import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const formData = await req.formData();
    const body: Record<string, string> = {};
    formData.forEach((value, key) => {
      body[key] = value.toString();
    });

    const {
      AccountSid,
      From,
      To,
      Body,
      MessageSid,
      NumMedia,
      FromCity,
      FromState,
      FromCountry,
    } = body;

    const { data: number } = await supabase
      .from("twilio_numbers")
      .select("org_id, department_id")
      .eq("phone_number", To)
      .maybeSingle();

    if (!number) {
      console.error("Unknown destination number:", To);
      return new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", {
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    const orgId = number.org_id;

    await supabase
      .from("webhook_health")
      .upsert({
        org_id: orgId,
        webhook_type: "sms",
        last_received_at: new Date().toISOString(),
        success_count: supabase.rpc("increment_webhook_success", { org: orgId, wtype: "sms" }),
      }, { onConflict: "org_id,webhook_type" });

    const { data: dncEntry } = await supabase
      .from("dnc_numbers")
      .select("id")
      .eq("org_id", orgId)
      .eq("phone_number", From)
      .maybeSingle();

    const { data: dncContact } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", orgId)
      .eq("phone", From)
      .eq("dnc", true)
      .maybeSingle();

    if (dncEntry || dncContact) {
      console.log("Blocked DNC number:", From);
      return new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", {
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    const { data: settings } = await supabase
      .from("phone_settings")
      .select("quiet_hours_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_timezone")
      .eq("org_id", orgId)
      .maybeSingle();

    if (settings?.quiet_hours_enabled && settings.quiet_hours_start && settings.quiet_hours_end) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-US", {
        hour12: false,
        timeZone: settings.quiet_hours_timezone || "America/New_York",
      });
      const currentTime = timeStr.slice(0, 5);

      if (currentTime >= settings.quiet_hours_start && currentTime <= settings.quiet_hours_end) {
        console.log("Blocked by quiet hours:", From);
        return new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", {
          headers: { ...corsHeaders, "Content-Type": "application/xml" },
        });
      }
    }

    let { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", orgId)
      .eq("phone", From)
      .maybeSingle();

    if (!contact) {
      const { data: newContact } = await supabase
        .from("contacts")
        .insert({
          organization_id: orgId,
          phone: From,
          source: "sms_inbound",
          status: "active",
        })
        .select("id")
        .single();
      contact = newContact;
    }

    let { data: conversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("organization_id", orgId)
      .eq("contact_id", contact?.id)
      .eq("channel", "sms")
      .eq("status", "open")
      .maybeSingle();

    if (!conversation) {
      const { data: newConversation } = await supabase
        .from("conversations")
        .insert({
          organization_id: orgId,
          contact_id: contact?.id,
          channel: "sms",
          status: "open",
          subject: `SMS from ${From}`,
          department_id: number.department_id,
        })
        .select("id")
        .single();
      conversation = newConversation;
    }

    const mediaUrls: string[] = [];
    const numMediaInt = parseInt(NumMedia || "0", 10);
    for (let i = 0; i < numMediaInt; i++) {
      const mediaUrl = body[`MediaUrl${i}`];
      if (mediaUrl) {
        mediaUrls.push(mediaUrl);
      }
    }

    await supabase.from("messages").insert({
      organization_id: orgId,
      conversation_id: conversation?.id,
      direction: "inbound",
      channel: "sms",
      content: Body || "",
      sender_type: "contact",
      sender_id: contact?.id,
      external_id: MessageSid,
      metadata: {
        from: From,
        to: To,
        accountSid: AccountSid,
        fromCity: FromCity,
        fromState: FromState,
        fromCountry: FromCountry,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
      },
    });

    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        unread_count: supabase.rpc("increment_unread", { conv_id: conversation?.id }),
      })
      .eq("id", conversation?.id);

    return new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", {
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  } catch (error) {
    console.error("SMS webhook error:", error);

    return new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  }
});
