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

  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    }
  );

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
    const messageSid = formData.get("MessageSid") as string;
    const from = normalizePhoneNumber(formData.get("From") as string);
    const to = normalizePhoneNumber(formData.get("To") as string);
    const body = formData.get("Body") as string || "";
    const numMedia = parseInt(formData.get("NumMedia") as string || "0", 10);

    const mediaUrls: string[] = [];
    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = formData.get(`MediaUrl${i}`) as string;
      if (mediaUrl) {
        mediaUrls.push(mediaUrl);
      }
    }

    const { data: channelConfig } = await supabase
      .from("channel_configurations")
      .select("organization_id, config")
      .eq("channel_type", "twilio")
      .eq("is_active", true)
      .filter("config->phone_numbers", "cs", `["${to}"]`)
      .maybeSingle();

    if (!channelConfig) {
      const { data: anyConfig } = await supabase
        .from("channel_configurations")
        .select("organization_id")
        .eq("channel_type", "twilio")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (!anyConfig) {
        console.error("No Twilio configuration found for number:", to);
        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/xml" },
          }
        );
      }
    }

    const orgId = channelConfig?.organization_id;

    if (!orgId) {
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
      .eq("phone", from)
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

      const { data: newContact, error: createError } = await supabase
        .from("contacts")
        .insert({
          organization_id: orgId,
          department_id: defaultDept?.id,
          first_name: "Unknown",
          last_name: from,
          phone: from,
          source: "sms",
          status: "active",
        })
        .select("id, department_id, first_name, last_name")
        .single();

      if (createError) {
        console.error("Failed to create contact:", createError);
        throw createError;
      }

      contact = newContact;
    }

    let conversation = null;
    const { data: existingConversation } = await supabase
      .from("conversations")
      .select("id, status")
      .eq("organization_id", orgId)
      .eq("contact_id", contact.id)
      .neq("status", "closed")
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingConversation) {
      conversation = existingConversation;
    } else {
      const { data: newConversation, error: convError } = await supabase
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

      if (convError) {
        console.error("Failed to create conversation:", convError);
        throw convError;
      }

      conversation = newConversation;

      await supabase.from("inbox_events").insert({
        organization_id: orgId,
        conversation_id: conversation.id,
        event_type: "conversation_created",
        payload: { channel: "sms", contact_name: `${contact.first_name} ${contact.last_name}` },
      });
    }

    const { error: messageError } = await supabase.from("messages").insert({
      organization_id: orgId,
      conversation_id: conversation.id,
      contact_id: contact.id,
      channel: "sms",
      direction: "inbound",
      body,
      metadata: {
        from_number: from,
        to_number: to,
        media_urls: mediaUrls,
      },
      status: "delivered",
      external_id: messageSid,
      sent_at: new Date().toISOString(),
    });

    if (messageError) {
      console.error("Failed to create message:", messageError);
      throw messageError;
    }

    const { data: convData } = await supabase
      .from("conversations")
      .select("unread_count")
      .eq("id", conversation.id)
      .single();

    await supabase
      .from("conversations")
      .update({
        unread_count: (convData?.unread_count || 0) + 1,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: conversation.status === "closed" ? "open" : conversation.status,
      })
      .eq("id", conversation.id);

    await supabase.from("contact_timeline").insert({
      contact_id: contact.id,
      event_type: "message_received",
      event_data: {
        channel: "sms",
        preview: body.substring(0, 100),
        from: from,
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
    console.error("Twilio SMS webhook error:", error);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      }
    );
  }
});
