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
      CallSid,
      CallStatus,
      Direction,
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
      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry, this number is not configured. Goodbye.</Say>
  <Hangup/>
</Response>`, {
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    const orgId = number.org_id;

    await supabase
      .from("webhook_health")
      .upsert({
        org_id: orgId,
        webhook_type: "voice",
        last_received_at: new Date().toISOString(),
      }, { onConflict: "org_id,webhook_type" });

    const { data: settings } = await supabase
      .from("phone_settings")
      .select(`
        call_timeout,
        voicemail_fallback_number,
        record_inbound_calls,
        default_routing_group_id,
        default_routing_group:voice_routing_groups(
          id, name, strategy, ring_timeout, fallback_number,
          destinations:voice_routing_destinations(phone_number, label, sort_order, enabled)
        )
      `)
      .eq("org_id", orgId)
      .maybeSingle();

    let { data: contact } = await supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .eq("organization_id", orgId)
      .eq("phone", From)
      .maybeSingle();

    if (!contact) {
      const { data: newContact } = await supabase
        .from("contacts")
        .insert({
          organization_id: orgId,
          phone: From,
          source: "voice_inbound",
          status: "active",
        })
        .select("id, first_name, last_name")
        .single();
      contact = newContact;
    }

    await supabase.from("call_logs").insert({
      organization_id: orgId,
      contact_id: contact?.id,
      direction: "inbound",
      from_number: From,
      to_number: To,
      call_sid: CallSid,
      status: CallStatus || "ringing",
      department_id: number.department_id,
      metadata: {
        accountSid: AccountSid,
        fromCity: FromCity,
        fromState: FromState,
        fromCountry: FromCountry,
        direction: Direction,
      },
    });

    const routingGroup = settings?.default_routing_group;
    const destinations = routingGroup?.destinations
      ?.filter((d: any) => d.enabled)
      ?.sort((a: any, b: any) => a.sort_order - b.sort_order) || [];

    if (destinations.length === 0) {
      const fallback = settings?.voicemail_fallback_number || routingGroup?.fallback_number;

      if (fallback) {
        return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Please hold while we connect your call.</Say>
  <Dial timeout="${settings?.call_timeout || 30}"${settings?.record_inbound_calls ? ' record="record-from-answer"' : ''}>
    <Number>${fallback}</Number>
  </Dial>
  <Say>We're sorry, no one is available to take your call. Please leave a message after the tone.</Say>
  <Record maxLength="120" transcribe="true" />
  <Say>Goodbye.</Say>
</Response>`, {
          headers: { ...corsHeaders, "Content-Type": "application/xml" },
        });
      }

      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>We're sorry, no one is available to take your call. Please try again later. Goodbye.</Say>
  <Hangup/>
</Response>`, {
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    const timeout = routingGroup?.ring_timeout || settings?.call_timeout || 30;
    const strategy = routingGroup?.strategy || "simultaneous";
    const fallbackNumber = routingGroup?.fallback_number || settings?.voicemail_fallback_number;
    const recordAttr = settings?.record_inbound_calls ? ' record="record-from-answer"' : '';

    let twiml = '<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n';
    twiml += '  <Say>Please hold while we connect your call.</Say>\n';

    if (strategy === "simultaneous") {
      twiml += `  <Dial timeout="${timeout}"${recordAttr}>\n`;
      for (const dest of destinations) {
        twiml += `    <Number>${dest.phone_number}</Number>\n`;
      }
      twiml += '  </Dial>\n';
    } else {
      for (const dest of destinations) {
        twiml += `  <Dial timeout="${Math.floor(timeout / destinations.length)}"${recordAttr}>\n`;
        twiml += `    <Number>${dest.phone_number}</Number>\n`;
        twiml += '  </Dial>\n';
      }
    }

    if (fallbackNumber) {
      twiml += '  <Say>We\'re sorry, no one is available. Please leave a message after the tone.</Say>\n';
      twiml += '  <Record maxLength="120" transcribe="true" />\n';
    } else {
      twiml += '  <Say>We\'re sorry, no one is available to take your call. Please try again later.</Say>\n';
    }

    twiml += '  <Hangup/>\n';
    twiml += '</Response>';

    return new Response(twiml, {
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  } catch (error) {
    console.error("Voice webhook error:", error);

    return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>We're experiencing technical difficulties. Please try again later. Goodbye.</Say>
  <Hangup/>
</Response>`, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  }
});
