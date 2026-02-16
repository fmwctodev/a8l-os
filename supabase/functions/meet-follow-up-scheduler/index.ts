import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestPayload {
  meeting_transcription_id: string;
  org_id: string;
  user_id: string;
}

function getSupabaseClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function isInternalEmail(email: string, internalDomains: string[]): boolean {
  if (!email || internalDomains.length === 0) return false;
  const domain = email.split("@")[1]?.toLowerCase();
  return internalDomains.some((d) => d.toLowerCase() === domain);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();
    const payload: RequestPayload = await req.json();
    const { meeting_transcription_id, org_id, user_id } = payload;

    const { data: settings } = await supabase
      .from("meeting_follow_up_settings")
      .select("*")
      .eq("org_id", org_id)
      .maybeSingle();

    if (!settings || !settings.enabled) {
      return new Response(
        JSON.stringify({
          success: true,
          scheduled: 0,
          message: "Follow-up automation is not enabled for this organization",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: linkedContacts } = await supabase
      .from("meeting_transcription_contacts")
      .select("contact_id, participant_email, contact:contacts(id, first_name, last_name, email, phone)")
      .eq("meeting_transcription_id", meeting_transcription_id);

    if (!linkedContacts || linkedContacts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, scheduled: 0, message: "No linked contacts" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: orgUsers } = await supabase
      .from("users")
      .select("email")
      .eq("organization_id", org_id);

    const orgUserEmails = new Set(
      (orgUsers || []).map((u: { email: string }) => u.email?.toLowerCase()).filter(Boolean)
    );

    const channels: ("sms" | "email")[] = [];
    if (settings.default_channel === "sms" || settings.default_channel === "both") {
      channels.push("sms");
    }
    if (settings.default_channel === "email" || settings.default_channel === "both") {
      channels.push("email");
    }

    const delayMs = (settings.default_delay_minutes || 120) * 60 * 1000;
    let scheduledFor = new Date(Date.now() + delayMs);

    if (settings.respect_quiet_hours) {
      const hour = scheduledFor.getUTCHours();
      if (hour >= 21 || hour < 8) {
        scheduledFor.setUTCDate(scheduledFor.getUTCDate() + (hour >= 21 ? 1 : 0));
        scheduledFor.setUTCHours(9, 0, 0, 0);
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let scheduled = 0;
    let skipped = 0;

    for (const link of linkedContacts) {
      const contact = link.contact as { id: string; first_name: string; last_name: string; email: string; phone: string } | null;
      if (!contact) continue;

      const contactEmail = contact.email?.toLowerCase();

      if (contactEmail && orgUserEmails.has(contactEmail)) {
        skipped++;
        continue;
      }

      if (settings.exclude_internal && contactEmail) {
        const internalDomains = settings.internal_domains || [];
        if (isInternalEmail(contactEmail, internalDomains)) {
          skipped++;
          continue;
        }
      }

      for (const channel of channels) {
        if (channel === "sms" && !contact.phone) continue;
        if (channel === "email" && !contact.email) continue;

        const { data: existing } = await supabase
          .from("meeting_follow_ups")
          .select("id")
          .eq("meeting_transcription_id", meeting_transcription_id)
          .eq("contact_id", contact.id)
          .eq("channel", channel)
          .maybeSingle();

        if (existing) continue;

        try {
          const genResponse = await fetch(
            `${supabaseUrl}/functions/v1/meet-follow-up-generator`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                meeting_transcription_id,
                contact_id: contact.id,
                channel,
                org_id,
                ai_instructions: settings.ai_instructions || undefined,
              }),
            }
          );

          if (!genResponse.ok) {
            console.warn(`[MeetFollowUpScheduler] Generator failed for contact ${contact.id}:`, await genResponse.text());
            continue;
          }

          const genResult = await genResponse.json();
          if (!genResult.success || !genResult.follow_up_id) continue;

          const targetStatus = settings.auto_send ? "scheduled" : "draft";

          let conversationId: string | null = null;
          const { data: existingConv } = await supabase
            .from("conversations")
            .select("id")
            .eq("organization_id", org_id)
            .eq("contact_id", contact.id)
            .neq("status", "closed")
            .order("last_message_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingConv) {
            conversationId = existingConv.id;
          } else {
            const { data: newConv } = await supabase
              .from("conversations")
              .insert({
                organization_id: org_id,
                contact_id: contact.id,
                status: "open",
                unread_count: 0,
              })
              .select("id")
              .maybeSingle();
            conversationId = newConv?.id || null;
          }

          await supabase
            .from("meeting_follow_ups")
            .update({
              status: targetStatus,
              scheduled_for: targetStatus === "scheduled" ? scheduledFor.toISOString() : null,
              conversation_id: conversationId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", genResult.follow_up_id);

          await supabase.from("contact_timeline").insert({
            contact_id: contact.id,
            user_id,
            event_type: "follow_up_draft_generated",
            metadata: {
              meeting_transcription_id,
              channel,
              follow_up_id: genResult.follow_up_id,
              auto_send: settings.auto_send,
            },
          });

          scheduled++;
        } catch (err) {
          console.warn(`[MeetFollowUpScheduler] Error for contact ${contact.id}, channel ${channel}:`, (err as Error).message);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, scheduled, skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[MeetFollowUpScheduler] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
