import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  if (!phone.startsWith('+')) {
    return `+${digits}`;
  }
  return phone;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const formData = await req.formData();
    const callSid = formData.get("CallSid") as string;
    const from = normalizePhoneNumber(formData.get("From") as string);
    const to = normalizePhoneNumber(formData.get("To") as string);
    const callStatus = formData.get("CallStatus") as string;
    const direction = formData.get("Direction") as string;
    const duration = formData.get("CallDuration") as string | null;
    const recordingUrl = formData.get("RecordingUrl") as string | null;

    const isInbound = direction === "inbound";
    const contactPhone = isInbound ? from : to;
    const orgPhone = isInbound ? to : from;

    const { data: channelConfig } = await supabase
      .from("channel_configurations")
      .select("organization_id")
      .eq("channel_type", "twilio")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!channelConfig) {
      console.error("No Twilio configuration found");
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/xml" },
        }
      );
    }

    const orgId = channelConfig.organization_id;

    const { data: existingCallLog } = await supabase
      .from("call_logs")
      .select("id, conversation_id, contact_id")
      .eq("twilio_call_sid", callSid)
      .maybeSingle();

    if (existingCallLog) {
      const updateData: Record<string, unknown> = {
        status: callStatus,
      };

      if (duration) {
        updateData.duration = parseInt(duration, 10);
      }

      if (recordingUrl) {
        updateData.recording_url = recordingUrl;
      }

      await supabase
        .from("call_logs")
        .update(updateData)
        .eq("id", existingCallLog.id);

      if (callStatus === "completed" && duration) {
        await supabase.from("messages").insert({
          organization_id: orgId,
          conversation_id: existingCallLog.conversation_id,
          contact_id: existingCallLog.contact_id,
          channel: "voice",
          direction: isInbound ? "inbound" : "outbound",
          body: `Phone call ${isInbound ? "received" : "made"} - ${duration} seconds`,
          metadata: {
            call_sid: callSid,
            duration: parseInt(duration, 10),
            recording_url: recordingUrl,
          },
          status: "delivered",
          external_id: callSid,
        });

        await supabase
          .from("conversations")
          .update({
            last_message_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingCallLog.conversation_id);
      }

      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/xml" },
        }
      );
    }

    let contact = null;
    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id, department_id, first_name, last_name")
      .eq("organization_id", orgId)
      .eq("phone", contactPhone)
      .eq("status", "active")
      .maybeSingle();

    if (existingContact) {
      contact = existingContact;
    } else {
      const { data: defaultDept } = await supabase
        .from("departments")
        .select("id")
        .eq("organization_id", orgId)
        .limit(1)
        .maybeSingle();

      const { data: newContact } = await supabase
        .from("contacts")
        .insert({
          organization_id: orgId,
          department_id: defaultDept?.id,
          first_name: "Unknown",
          last_name: contactPhone,
          phone: contactPhone,
          source: "voice",
          status: "active",
        })
        .select("id, department_id, first_name, last_name")
        .single();

      contact = newContact;
    }

    if (!contact) {
      throw new Error("Failed to find or create contact");
    }

    let conversation = null;
    const { data: existingConversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("organization_id", orgId)
      .eq("contact_id", contact.id)
      .neq("status", "closed")
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingConversation) {
      conversation = existingConversation;
    } else {
      const { data: newConversation } = await supabase
        .from("conversations")
        .insert({
          organization_id: orgId,
          contact_id: contact.id,
          department_id: contact.department_id,
          status: "open",
          unread_count: 0,
        })
        .select()
        .single();

      conversation = newConversation;

      await supabase.from("inbox_events").insert({
        organization_id: orgId,
        conversation_id: conversation.id,
        event_type: "conversation_created",
        payload: { channel: "voice", contact_name: `${contact.first_name} ${contact.last_name}` },
      });
    }

    await supabase.from("call_logs").insert({
      organization_id: orgId,
      conversation_id: conversation.id,
      contact_id: contact.id,
      twilio_call_sid: callSid,
      direction: isInbound ? "inbound" : "outbound",
      from_number: from,
      to_number: to,
      status: callStatus,
    });

    await supabase.from("contact_timeline").insert({
      contact_id: contact.id,
      event_type: isInbound ? "call_received" : "call_made",
      event_data: {
        call_sid: callSid,
        status: callStatus,
        from: from,
        to: to,
      },
    });

    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      }
    );
  } catch (error) {
    console.error("Twilio voice webhook error:", error);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      }
    );
  }
});
