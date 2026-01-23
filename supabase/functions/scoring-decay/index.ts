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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results = {
      modelsProcessed: 0,
      scoresDecayed: 0,
      notificationsQueued: 0,
      errors: [] as string[],
    };

    const { data: modelsWithDecay, error: modelsError } = await supabase
      .from("scoring_model_decay_config")
      .select(`
        *,
        scoring_models!inner(id, org_id, name, active)
      `)
      .eq("enabled", true)
      .eq("scoring_models.active", true);

    if (modelsError) {
      throw new Error(`Failed to fetch models: ${modelsError.message}`);
    }

    if (!modelsWithDecay || modelsWithDecay.length === 0) {
      return new Response(JSON.stringify({ message: "No models with decay enabled", results }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const config of modelsWithDecay) {
      try {
        results.modelsProcessed++;
        const model = config.scoring_models;
        const intervalMs = config.interval_days * 24 * 60 * 60 * 1000;
        const cutoffDate = new Date(Date.now() - intervalMs).toISOString();

        const { data: scoresToDecay, error: scoresError } = await supabase
          .from("entity_scores")
          .select("*")
          .eq("model_id", model.id)
          .gt("current_score", config.min_score_floor)
          .or(`last_decay_at.is.null,last_decay_at.lt.${cutoffDate}`);

        if (scoresError) {
          results.errors.push(`Model ${model.id}: ${scoresError.message}`);
          continue;
        }

        if (!scoresToDecay || scoresToDecay.length === 0) {
          continue;
        }

        for (const score of scoresToDecay) {
          const previousScore = score.current_score;
          let newScore: number;

          if (config.decay_type === "linear") {
            newScore = Math.max(config.min_score_floor, previousScore - config.decay_amount);
          } else {
            newScore = Math.max(config.min_score_floor, previousScore - config.decay_amount);
          }

          if (newScore === previousScore) {
            continue;
          }

          const { error: updateError } = await supabase
            .from("entity_scores")
            .update({
              current_score: newScore,
              last_decay_at: new Date().toISOString(),
              last_updated_at: new Date().toISOString(),
            })
            .eq("id", score.id);

          if (updateError) {
            results.errors.push(`Score ${score.id}: ${updateError.message}`);
            continue;
          }

          await supabase.from("score_events").insert({
            org_id: score.org_id,
            model_id: model.id,
            entity_type: score.entity_type,
            entity_id: score.entity_id,
            points_delta: newScore - previousScore,
            previous_score: previousScore,
            new_score: newScore,
            reason: `Automatic decay (-${config.decay_amount} points, ${config.interval_days} day interval)`,
            source: "decay",
          });

          results.scoresDecayed++;

          if (
            config.notification_threshold !== null &&
            previousScore >= config.notification_threshold &&
            newScore < config.notification_threshold
          ) {
            let entityName = "Unknown";

            if (score.entity_type === "contact") {
              const { data: contact } = await supabase
                .from("contacts")
                .select("first_name, last_name, email, phone")
                .eq("id", score.entity_id)
                .maybeSingle();

              if (contact) {
                entityName = [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
                  contact.email ||
                  contact.phone ||
                  "Unknown Contact";
              }
            } else if (score.entity_type === "opportunity") {
              const { data: opportunity } = await supabase
                .from("opportunities")
                .select("name")
                .eq("id", score.entity_id)
                .maybeSingle();

              if (opportunity) {
                entityName = opportunity.name || "Unknown Opportunity";
              }
            }

            await supabase.from("event_outbox").insert({
              organization_id: score.org_id,
              event_type: "score_threshold_crossed",
              payload: {
                entity_type: score.entity_type,
                entity_id: score.entity_id,
                entity_name: entityName,
                model_id: model.id,
                model_name: model.name,
                previous_score: previousScore,
                new_score: newScore,
                threshold: config.notification_threshold,
                notify_in_app: config.notify_in_app,
                notify_email: config.notify_email,
                notify_sms: config.notify_sms,
                decay_triggered: true,
              },
            });

            results.notificationsQueued++;
          }
        }
      } catch (modelError) {
        const message = modelError instanceof Error ? modelError.message : "Unknown error";
        results.errors.push(`Model ${config.model_id}: ${message}`);
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
