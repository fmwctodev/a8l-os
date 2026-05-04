import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_PER_RUN = 50;

function getSupabaseClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    const { data: followUps, error: fetchError } = await supabase
      .from("meeting_follow_ups")
      .select(`
        *,
        contact:contacts(id, first_name, last_name, email, phone, organization_id),
        meeting:meeting_transcriptions(meeting_title, meeting_date)
      `)
      .eq("status", "scheduled")
      .lte("scheduled_for", now)
      .order("scheduled_for", { ascending: true })
      .limit(MAX_PER_RUN);

    if (fetchError) {
      throw new Error(`Failed to fetch follow-ups: ${fetchError.message}`);
    }

    if (!followUps || followUps.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No follow-ups due" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    let sent = 0;
    let failed = 0;

    for (const followUp of followUps) {
      try {
        const contact = followUp.contact as {
          id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone: string;
          organization_id: string;
        } | null;

        if (!contact) {
          await markFailed(supabase, followUp.id, "Contact not found");
          failed++;
          continue;
        }

        let conversationId = followUp.conversation_id;
        if (!conversationId) {
          const { data: existingConv } = await supabase
            .from("conversations")
            .select("id")
            .eq("organization_id", followUp.org_id)
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
                organization_id: followUp.org_id,
                contact_id: contact.id,
                status: "open",
                unread_count: 0,
              })
              .select("id")
              .maybeSingle();
            conversationId = newConv?.id || null;
          }
        }

        if (followUp.channel === "sms") {
          if (!contact.phone) {
            await markFailed(supabase, followUp.id, "Contact has no phone number");
            failed++;
            continue;
          }

          const { data: msg } = await supabase
            .from("messages")
            .insert({
              organization_id: followUp.org_id,
              conversation_id: conversationId,
              contact_id: contact.id,
              channel: "sms",
              direction: "outbound",
              body: followUp.ai_draft_content,
              status: "queued",
              sender_type: "system",
              metadata: {
                source: "meeting_follow_up",
                meeting_transcription_id: followUp.meeting_transcription_id,
                follow_up_id: followUp.id,
              },
              sent_at: new Date().toISOString(),
            })
            .select("id")
            .maybeSingle();

          if (msg) {
            await supabase
              .from("meeting_follow_ups")
              .update({
                status: "sent",
                sent_at: new Date().toISOString(),
                message_id: msg.id,
                conversation_id: conversationId,
                updated_at: new Date().toISOString(),
              })
              .eq("id", followUp.id);
          }

          try {
            await fetch(`${supabaseUrl}/functions/v1/plivo-sms-send`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                orgId: followUp.org_id,
                toNumber: contact.phone,
                body: followUp.ai_draft_content,
                contactId: contact.id,
                conversationId,
                metadata: { source: "meeting-follow-up", message_id: msg?.id },
              }),
            });
          } catch (plivoErr) {
            console.warn(`[MeetFollowUpSender] Plivo send error:`, (plivoErr as Error).message);
          }
        } else {
          if (!contact.email) {
            await markFailed(supabase, followUp.id, "Contact has no email");
            failed++;
            continue;
          }

          const { data: msg } = await supabase
            .from("messages")
            .insert({
              organization_id: followUp.org_id,
              conversation_id: conversationId,
              contact_id: contact.id,
              channel: "email",
              direction: "outbound",
              subject: followUp.ai_draft_subject || `Follow-up: Meeting`,
              body: followUp.ai_draft_content,
              status: "queued",
              sender_type: "system",
              metadata: {
                source: "meeting_follow_up",
                meeting_transcription_id: followUp.meeting_transcription_id,
                follow_up_id: followUp.id,
              },
              sent_at: new Date().toISOString(),
            })
            .select("id")
            .maybeSingle();

          if (msg) {
            await supabase
              .from("meeting_follow_ups")
              .update({
                status: "sent",
                sent_at: new Date().toISOString(),
                message_id: msg.id,
                conversation_id: conversationId,
                updated_at: new Date().toISOString(),
              })
              .eq("id", followUp.id);
          }

          try {
            await fetch(`${supabaseUrl}/functions/v1/email-send`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                org_id: followUp.org_id,
                to: contact.email,
                subject: followUp.ai_draft_subject || "Meeting Follow-up",
                body: followUp.ai_draft_content,
                message_id: msg?.id,
              }),
            });
          } catch (emailErr) {
            console.warn(`[MeetFollowUpSender] Email send error:`, (emailErr as Error).message);
          }
        }

        if (conversationId) {
          await supabase
            .from("conversations")
            .update({
              last_message_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", conversationId);
        }

        const meetingTitle = (followUp.meeting as { meeting_title: string } | null)?.meeting_title || "Meeting";

        await supabase.from("contact_timeline").insert({
          contact_id: contact.id,
          event_type: "follow_up_sent",
          metadata: {
            meeting_transcription_id: followUp.meeting_transcription_id,
            channel: followUp.channel,
            follow_up_id: followUp.id,
            meeting_title: meetingTitle,
            conversation_id: conversationId,
          },
        });

        sent++;
      } catch (err) {
        console.error(`[MeetFollowUpSender] Error sending follow-up ${followUp.id}:`, (err as Error).message);
        await markFailed(supabase, followUp.id, (err as Error).message);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, failed, total: followUps.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[MeetFollowUpSender] Unhandled error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function markFailed(
  supabase: ReturnType<typeof getSupabaseClient>,
  followUpId: string,
  errorMessage: string
): Promise<void> {
  await supabase
    .from("meeting_follow_ups")
    .update({
      status: "failed",
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", followUpId);
}
