import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestPayload {
  action: string;
  [key: string]: unknown;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("id, org_id, role_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!userData) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: RequestPayload = await req.json();
    const { action } = payload;

    let result: unknown;

    switch (action) {
      case "list-models":
        result = await listModels(supabase, userData.org_id);
        break;
      case "get-model":
        result = await getModel(supabase, userData.org_id, payload.modelId as string);
        break;
      case "create-model":
        result = await createModel(supabase, userData.org_id, payload);
        break;
      case "update-model":
        result = await updateModel(supabase, userData.org_id, payload.modelId as string, payload);
        break;
      case "delete-model":
        result = await deleteModel(supabase, userData.org_id, payload.modelId as string);
        break;
      case "toggle-model":
        result = await toggleModel(supabase, userData.org_id, payload.modelId as string, payload.active as boolean);
        break;
      case "set-primary":
        result = await setPrimaryModel(supabase, userData.org_id, payload.modelId as string);
        break;
      case "list-rules":
        result = await listRules(supabase, userData.org_id, payload.modelId as string);
        break;
      case "create-rule":
        result = await createRule(supabase, userData.org_id, payload);
        break;
      case "update-rule":
        result = await updateRule(supabase, userData.org_id, payload.ruleId as string, payload);
        break;
      case "delete-rule":
        result = await deleteRule(supabase, userData.org_id, payload.ruleId as string);
        break;
      case "toggle-rule":
        result = await toggleRule(supabase, userData.org_id, payload.ruleId as string, payload.active as boolean);
        break;
      case "adjust-score":
        result = await adjustScore(supabase, userData.org_id, user.id, payload);
        break;
      case "get-entity-scores":
        result = await getEntityScores(supabase, userData.org_id, payload.entityType as string, payload.entityId as string);
        break;
      case "get-score-history":
        result = await getScoreHistory(supabase, userData.org_id, payload);
        break;
      case "get-decay-config":
        result = await getDecayConfig(supabase, userData.org_id, payload.modelId as string);
        break;
      case "update-decay-config":
        result = await updateDecayConfig(supabase, userData.org_id, payload.modelId as string, payload);
        break;
      case "get-adjustment-limits":
        result = await getAdjustmentLimits(supabase, userData.org_id);
        break;
      case "update-adjustment-limits":
        result = await updateAdjustmentLimits(supabase, userData.org_id, payload);
        break;
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
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

async function listModels(supabase: ReturnType<typeof createClient>, orgId: string) {
  const { data, error } = await supabase
    .from("scoring_models")
    .select(`
      *,
      scoring_model_decay_config(*),
      scoring_rules(count)
    `)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return { models: data };
}

async function getModel(supabase: ReturnType<typeof createClient>, orgId: string, modelId: string) {
  const { data, error } = await supabase
    .from("scoring_models")
    .select(`
      *,
      scoring_model_decay_config(*),
      scoring_rules(*)
    `)
    .eq("id", modelId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Model not found");
  return { model: data };
}

async function createModel(supabase: ReturnType<typeof createClient>, orgId: string, payload: RequestPayload) {
  const { name, scope, startingScore, maxScore, isPrimary } = payload;

  if (isPrimary) {
    await supabase
      .from("scoring_models")
      .update({ is_primary: false })
      .eq("org_id", orgId)
      .eq("scope", scope as string);
  }

  const { data, error } = await supabase
    .from("scoring_models")
    .insert({
      org_id: orgId,
      name,
      scope,
      starting_score: startingScore || 0,
      max_score: maxScore || null,
      is_primary: isPrimary || false,
      active: true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await supabase
    .from("scoring_model_decay_config")
    .insert({
      model_id: data.id,
      enabled: false,
      decay_type: "linear",
      decay_amount: 5,
      interval_days: 30,
      min_score_floor: 0,
    });

  return { model: data };
}

async function updateModel(supabase: ReturnType<typeof createClient>, orgId: string, modelId: string, payload: RequestPayload) {
  const { name, startingScore, maxScore, isPrimary } = payload;

  const { data: existing } = await supabase
    .from("scoring_models")
    .select("scope")
    .eq("id", modelId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!existing) throw new Error("Model not found");

  if (isPrimary) {
    await supabase
      .from("scoring_models")
      .update({ is_primary: false })
      .eq("org_id", orgId)
      .eq("scope", existing.scope);
  }

  const { data, error } = await supabase
    .from("scoring_models")
    .update({
      name,
      starting_score: startingScore,
      max_score: maxScore || null,
      is_primary: isPrimary,
    })
    .eq("id", modelId)
    .eq("org_id", orgId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { model: data };
}

async function deleteModel(supabase: ReturnType<typeof createClient>, orgId: string, modelId: string) {
  const { error } = await supabase
    .from("scoring_models")
    .delete()
    .eq("id", modelId)
    .eq("org_id", orgId);

  if (error) throw new Error(error.message);
  return { success: true };
}

async function toggleModel(supabase: ReturnType<typeof createClient>, orgId: string, modelId: string, active: boolean) {
  const { data, error } = await supabase
    .from("scoring_models")
    .update({ active })
    .eq("id", modelId)
    .eq("org_id", orgId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { model: data };
}

async function setPrimaryModel(supabase: ReturnType<typeof createClient>, orgId: string, modelId: string) {
  const { data: model } = await supabase
    .from("scoring_models")
    .select("scope")
    .eq("id", modelId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!model) throw new Error("Model not found");

  await supabase
    .from("scoring_models")
    .update({ is_primary: false })
    .eq("org_id", orgId)
    .eq("scope", model.scope);

  const { data, error } = await supabase
    .from("scoring_models")
    .update({ is_primary: true })
    .eq("id", modelId)
    .eq("org_id", orgId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { model: data };
}

async function listRules(supabase: ReturnType<typeof createClient>, orgId: string, modelId: string) {
  const { data: model } = await supabase
    .from("scoring_models")
    .select("id")
    .eq("id", modelId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!model) throw new Error("Model not found");

  const { data, error } = await supabase
    .from("scoring_rules")
    .select("*")
    .eq("model_id", modelId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return { rules: data };
}

async function createRule(supabase: ReturnType<typeof createClient>, orgId: string, payload: RequestPayload) {
  const { modelId, name, triggerType, triggerConfig, points, frequencyType, cooldownInterval, cooldownUnit } = payload;

  const { data: model } = await supabase
    .from("scoring_models")
    .select("id")
    .eq("id", modelId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!model) throw new Error("Model not found");

  const { data, error } = await supabase
    .from("scoring_rules")
    .insert({
      model_id: modelId,
      name,
      trigger_type: triggerType,
      trigger_config: triggerConfig || {},
      points,
      frequency_type: frequencyType || "unlimited",
      cooldown_interval: cooldownInterval || null,
      cooldown_unit: cooldownUnit || null,
      active: true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { rule: data };
}

async function updateRule(supabase: ReturnType<typeof createClient>, orgId: string, ruleId: string, payload: RequestPayload) {
  const { name, triggerType, triggerConfig, points, frequencyType, cooldownInterval, cooldownUnit, active } = payload;

  const { data: rule } = await supabase
    .from("scoring_rules")
    .select("model_id")
    .eq("id", ruleId)
    .maybeSingle();

  if (!rule) throw new Error("Rule not found");

  const { data: model } = await supabase
    .from("scoring_models")
    .select("id")
    .eq("id", rule.model_id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!model) throw new Error("Model not found");

  const { data, error } = await supabase
    .from("scoring_rules")
    .update({
      name,
      trigger_type: triggerType,
      trigger_config: triggerConfig || {},
      points,
      frequency_type: frequencyType,
      cooldown_interval: cooldownInterval || null,
      cooldown_unit: cooldownUnit || null,
      active,
    })
    .eq("id", ruleId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { rule: data };
}

async function deleteRule(supabase: ReturnType<typeof createClient>, orgId: string, ruleId: string) {
  const { data: rule } = await supabase
    .from("scoring_rules")
    .select("model_id")
    .eq("id", ruleId)
    .maybeSingle();

  if (!rule) throw new Error("Rule not found");

  const { data: model } = await supabase
    .from("scoring_models")
    .select("id")
    .eq("id", rule.model_id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!model) throw new Error("Model not found");

  const { error } = await supabase
    .from("scoring_rules")
    .delete()
    .eq("id", ruleId);

  if (error) throw new Error(error.message);
  return { success: true };
}

async function toggleRule(supabase: ReturnType<typeof createClient>, orgId: string, ruleId: string, active: boolean) {
  const { data: rule } = await supabase
    .from("scoring_rules")
    .select("model_id")
    .eq("id", ruleId)
    .maybeSingle();

  if (!rule) throw new Error("Rule not found");

  const { data: model } = await supabase
    .from("scoring_models")
    .select("id")
    .eq("id", rule.model_id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!model) throw new Error("Model not found");

  const { data, error } = await supabase
    .from("scoring_rules")
    .update({ active })
    .eq("id", ruleId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { rule: data };
}

async function adjustScore(supabase: ReturnType<typeof createClient>, orgId: string, userId: string, payload: RequestPayload) {
  const { modelId, entityType, entityId, points, reason } = payload;

  const { data: limits } = await supabase
    .from("scoring_adjustment_limits")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  if (limits) {
    if (points > 0 && points > limits.max_positive_adjustment) {
      throw new Error(`Adjustment exceeds maximum positive limit of ${limits.max_positive_adjustment}`);
    }
    if (points < 0 && Math.abs(points) > limits.max_negative_adjustment) {
      throw new Error(`Adjustment exceeds maximum negative limit of ${limits.max_negative_adjustment}`);
    }
    if (limits.require_reason && (!reason || reason.trim() === "")) {
      throw new Error("A reason is required for manual adjustments");
    }
  }

  const { data: model } = await supabase
    .from("scoring_models")
    .select("id, max_score, starting_score")
    .eq("id", modelId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!model) throw new Error("Model not found");

  const { data: existingScore } = await supabase
    .from("entity_scores")
    .select("*")
    .eq("model_id", modelId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .maybeSingle();

  const currentScore = existingScore?.current_score ?? model.starting_score ?? 0;
  let newScore = currentScore + (points as number);

  if (model.max_score !== null && newScore > model.max_score) {
    newScore = model.max_score;
  }
  if (newScore < 0) {
    newScore = 0;
  }

  if (existingScore) {
    await supabase
      .from("entity_scores")
      .update({ current_score: newScore, last_updated_at: new Date().toISOString() })
      .eq("id", existingScore.id);
  } else {
    await supabase
      .from("entity_scores")
      .insert({
        org_id: orgId,
        model_id: modelId,
        entity_type: entityType,
        entity_id: entityId,
        current_score: newScore,
      });
  }

  await supabase
    .from("score_events")
    .insert({
      org_id: orgId,
      model_id: modelId,
      entity_type: entityType,
      entity_id: entityId,
      points_delta: points,
      previous_score: currentScore,
      new_score: newScore,
      reason: reason || "Manual adjustment",
      source: "manual",
      created_by: userId,
    });

  return { previousScore: currentScore, newScore, pointsDelta: points };
}

async function getEntityScores(supabase: ReturnType<typeof createClient>, orgId: string, entityType: string, entityId: string) {
  const { data, error } = await supabase
    .from("entity_scores")
    .select(`
      *,
      scoring_models(id, name, scope, max_score, is_primary)
    `)
    .eq("org_id", orgId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);

  if (error) throw new Error(error.message);
  return { scores: data };
}

async function getScoreHistory(supabase: ReturnType<typeof createClient>, orgId: string, payload: RequestPayload) {
  const { entityType, entityId, modelId, limit = 50, offset = 0 } = payload;

  let query = supabase
    .from("score_events")
    .select(`
      *,
      scoring_rules(name),
      users:created_by(id, first_name, last_name, email)
    `)
    .eq("org_id", orgId)
    .eq("entity_type", entityType as string)
    .eq("entity_id", entityId as string)
    .order("created_at", { ascending: false })
    .range(offset as number, (offset as number) + (limit as number) - 1);

  if (modelId) {
    query = query.eq("model_id", modelId as string);
  }

  const { data, error, count } = await query;

  if (error) throw new Error(error.message);
  return { events: data, total: count };
}

async function getDecayConfig(supabase: ReturnType<typeof createClient>, orgId: string, modelId: string) {
  const { data: model } = await supabase
    .from("scoring_models")
    .select("id")
    .eq("id", modelId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!model) throw new Error("Model not found");

  const { data, error } = await supabase
    .from("scoring_model_decay_config")
    .select("*")
    .eq("model_id", modelId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return { config: data };
}

async function updateDecayConfig(supabase: ReturnType<typeof createClient>, orgId: string, modelId: string, payload: RequestPayload) {
  const { enabled, decayType, decayAmount, intervalDays, minScoreFloor, notificationThreshold, notifyInApp, notifyEmail, notifySms } = payload;

  const { data: model } = await supabase
    .from("scoring_models")
    .select("id")
    .eq("id", modelId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!model) throw new Error("Model not found");

  const { data: existing } = await supabase
    .from("scoring_model_decay_config")
    .select("id")
    .eq("model_id", modelId)
    .maybeSingle();

  const configData = {
    enabled,
    decay_type: decayType,
    decay_amount: decayAmount,
    interval_days: intervalDays,
    min_score_floor: minScoreFloor,
    notification_threshold: notificationThreshold || null,
    notify_in_app: notifyInApp ?? true,
    notify_email: notifyEmail ?? false,
    notify_sms: notifySms ?? false,
  };

  let data;
  let error;

  if (existing) {
    ({ data, error } = await supabase
      .from("scoring_model_decay_config")
      .update(configData)
      .eq("model_id", modelId)
      .select()
      .single());
  } else {
    ({ data, error } = await supabase
      .from("scoring_model_decay_config")
      .insert({ model_id: modelId, ...configData })
      .select()
      .single());
  }

  if (error) throw new Error(error.message);
  return { config: data };
}

async function getAdjustmentLimits(supabase: ReturnType<typeof createClient>, orgId: string) {
  const { data, error } = await supabase
    .from("scoring_adjustment_limits")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return { limits: data || { max_positive_adjustment: 100, max_negative_adjustment: 100, require_reason: true } };
}

async function updateAdjustmentLimits(supabase: ReturnType<typeof createClient>, orgId: string, payload: RequestPayload) {
  const { maxPositiveAdjustment, maxNegativeAdjustment, requireReason } = payload;

  const { data: existing } = await supabase
    .from("scoring_adjustment_limits")
    .select("id")
    .eq("org_id", orgId)
    .maybeSingle();

  const limitsData = {
    max_positive_adjustment: maxPositiveAdjustment,
    max_negative_adjustment: maxNegativeAdjustment,
    require_reason: requireReason,
  };

  let data;
  let error;

  if (existing) {
    ({ data, error } = await supabase
      .from("scoring_adjustment_limits")
      .update(limitsData)
      .eq("org_id", orgId)
      .select()
      .single());
  } else {
    ({ data, error } = await supabase
      .from("scoring_adjustment_limits")
      .insert({ org_id: orgId, ...limitsData })
      .select()
      .single());
  }

  if (error) throw new Error(error.message);
  return { limits: data };
}
