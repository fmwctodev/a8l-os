import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ScoreThresholdEvent {
  entity_type: string;
  entity_id: string;
  entity_name: string;
  model_id: string;
  model_name: string;
  previous_score: number;
  new_score: number;
  threshold: number;
  notify_in_app: boolean;
  notify_email: boolean;
  notify_sms: boolean;
  decay_triggered?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results = {
      eventsProcessed: 0,
      inAppSent: 0,
      emailsSent: 0,
      smsSent: 0,
      errors: [] as string[],
    };

    const { data: events, error: eventsError } = await supabase
      .from("event_outbox")
      .select("*")
      .eq("event_type", "score_threshold_crossed")
      .eq("processed", false)
      .order("created_at", { ascending: true })
      .limit(100);

    if (eventsError) {
      throw new Error(`Failed to fetch events: ${eventsError.message}`);
    }

    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ message: "No pending notifications", results }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const event of events) {
      try {
        results.eventsProcessed++;
        const payload = event.payload as ScoreThresholdEvent;
        const orgId = event.organization_id;

        const { data: orgAdmins } = await supabase
          .from("users")
          .select("id, email, phone, first_name, last_name")
          .eq("org_id", orgId)
          .eq("status", "active");

        if (!orgAdmins || orgAdmins.length === 0) {
          await markEventProcessed(supabase, event.id);
          continue;
        }

        const notificationTitle = "Score Alert";
        const notificationMessage = `${payload.entity_name}'s ${payload.model_name} dropped below ${payload.threshold} (now ${payload.new_score})`;

        if (payload.notify_in_app) {
          for (const admin of orgAdmins) {
            const { error: notifError } = await supabase.from("notifications").insert({
              user_id: admin.id,
              org_id: orgId,
              title: notificationTitle,
              message: notificationMessage,
              type: "score_alert",
              metadata: {
                entity_type: payload.entity_type,
                entity_id: payload.entity_id,
                model_id: payload.model_id,
                new_score: payload.new_score,
                threshold: payload.threshold,
              },
              read: false,
            });

            if (!notifError) {
              results.inAppSent++;
            }
          }
        }

        if (payload.notify_email) {
          for (const admin of orgAdmins) {
            if (!admin.email) continue;

            const { error: emailError } = await supabase.from("event_outbox").insert({
              organization_id: orgId,
              event_type: "send_email",
              payload: {
                to: admin.email,
                subject: `Score Alert: ${payload.entity_name}`,
                template: "score_threshold_alert",
                data: {
                  recipientName: [admin.first_name, admin.last_name].filter(Boolean).join(" ") || "User",
                  entityName: payload.entity_name,
                  entityType: payload.entity_type,
                  modelName: payload.model_name,
                  previousScore: payload.previous_score,
                  newScore: payload.new_score,
                  threshold: payload.threshold,
                  decayTriggered: payload.decay_triggered || false,
                },
              },
            });

            if (!emailError) {
              results.emailsSent++;
            }
          }
        }

        if (payload.notify_sms) {
          for (const admin of orgAdmins) {
            if (!admin.phone) continue;

            const smsMessage = `Score Alert: ${payload.entity_name}'s ${payload.model_name} is now ${payload.new_score} (below threshold of ${payload.threshold})`;

            const { error: smsError } = await supabase.from("event_outbox").insert({
              organization_id: orgId,
              event_type: "send_sms",
              payload: {
                to: admin.phone,
                message: smsMessage,
              },
            });

            if (!smsError) {
              results.smsSent++;
            }
          }
        }

        await markEventProcessed(supabase, event.id);
      } catch (eventError) {
        const message = eventError instanceof Error ? eventError.message : "Unknown error";
        results.errors.push(`Event ${event.id}: ${message}`);
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function markEventProcessed(supabase: ReturnType<typeof createClient>, eventId: string) {
  await supabase
    .from("event_outbox")
    .update({ processed: true, processed_at: new Date().toISOString() })
    .eq("id", eventId);
}
