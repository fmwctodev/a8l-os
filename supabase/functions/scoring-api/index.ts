import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  corsHeaders,
  handleCors,
  successResponse,
} from "../_shared/cors.ts";
import {
  getSupabaseClient,
  extractUserContext,
  requireAuth,
  AuthError,
} from "../_shared/auth.ts";
import {
  requirePermission,
  PermissionError,
} from "../_shared/permissions.ts";
import { handleError } from "../_shared/errors.ts";
import { auditAction } from "../_shared/audit.ts";
import type { UserContext } from "../_shared/types.ts";

const PERMISSIONS = {
  VIEW: "scoring.view",
  MANAGE: "scoring.manage",
  ADJUST: "scoring.adjust",
};

interface RequestPayload {
  action: string;
  [key: string]: unknown;
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getSupabaseClient();
    const userContext = await extractUserContext(req, supabase);
    const user = requireAuth(userContext);

    const payload: RequestPayload = await req.json();
    const { action } = payload;

    let result: unknown;

    switch (action) {
      case "list-models":
        requirePermission(user, PERMISSIONS.VIEW);
        result = await listModels(supabase, user.orgId);
        break;

      case "get-model":
        requirePermission(user, PERMISSIONS.VIEW);
        result = await getModel(supabase, user.orgId, payload.modelId as string);
        break;

      case "create-model":
        requirePermission(user, PERMISSIONS.MANAGE);
        result = await createModel(supabase, user.orgId, payload);
        await auditAction(supabase, user, "create", "scoring_model", (result as { model: { id: string } }).model.id);
        break;

      case "update-model":
        requirePermission(user, PERMISSIONS.MANAGE);
        result = await updateModel(supabase, user.orgId, payload.modelId as string, payload);
        await auditAction(supabase, user, "update", "scoring_model", payload.modelId as string);
        break;

      case "delete-model":
        requirePermission(user, PERMISSIONS.MANAGE);
        result = await deleteModel(supabase, user.orgId, payload.modelId as string);
        await auditAction(supabase, user, "delete", "scoring_model", payload.modelId as string);
        break;

      case "toggle-model":
        requirePermission(user, PERMISSIONS.MANAGE);
        result = await toggleModel(supabase, user.orgId, payload.modelId as string, payload.active as boolean);
        await auditAction(supabase, user, "update", "scoring_model", payload.modelId as string, {
          metadata: { action: payload.active ? "enabled" : "disabled" },
        });
        break;

      case "set-primary":
        requirePermission(user, PERMISSIONS.MANAGE);
        result = await setPrimaryModel(supabase, user.orgId, payload.modelId as string);
        await auditAction(supabase, user, "update", "scoring_model", payload.modelId as string, {
          metadata: { action: "set_primary" },
        });
        break;

      case "list-rules":
        requirePermission(user, PERMISSIONS.VIEW);
        result = await listRules(supabase, user.orgId, payload.modelId as string);
        break;

      case "create-rule":
        requirePermission(user, PERMISSIONS.MANAGE);
        result = await createRule(supabase, user.orgId, payload);
        await auditAction(supabase, user, "create", "scoring_rule", (result as { rule: { id: string } }).rule.id);
        break;

      case "update-rule":
        requirePermission(user, PERMISSIONS.MANAGE);
        result = await updateRule(supabase, user.orgId, payload.ruleId as string, payload);
        await auditAction(supabase, user, "update", "scoring_rule", payload.ruleId as string);
        break;

      case "delete-rule":
        requirePermission(user, PERMISSIONS.MANAGE);
        result = await deleteRule(supabase, user.orgId, payload.ruleId as string);
        await auditAction(supabase, user, "delete", "scoring_rule", payload.ruleId as string);
        break;

      case "toggle-rule":
        requirePermission(user, PERMISSIONS.MANAGE);
        result = await toggleRule(supabase, user.orgId, payload.ruleId as string, payload.active as boolean);
        break;

      case "adjust-score":
        requirePermission(user, PERMISSIONS.ADJUST);
        result = await adjustScore(supabase, user, payload);
        await auditAction(supabase, user, "update", payload.entityType as string, payload.entityId as string, {
          metadata: { action: "score_adjustment", points: payload.points },
        });
        break;

      case "get-entity-scores":
        requirePermission(user, PERMISSIONS.VIEW);
        result = await getEntityScores(supabase, user.orgId, payload.entityType as string, payload.entityId as string);
        break;

      case "get-score-history":
        requirePermission(user, PERMISSIONS.VIEW);
        result = await getScoreHistory(supabase, user.orgId, payload);
        break;

      case "get-decay-config":
        requirePermission(user, PERMISSIONS.VIEW);
        result = await getDecayConfig(supabase, user.orgId, payload.modelId as string);
        break;

      case "update-decay-config":
        requirePermission(user, PERMISSIONS.MANAGE);
        result = await updateDecayConfig(supabase, user.orgId, payload.modelId as string, payload);
        await auditAction(supabase, user, "update", "scoring_decay_config", payload.modelId as string);
        break;

      case "get-adjustment-limits":
        requirePermission(user, PERMISSIONS.VIEW);
        result = await getAdjustmentLimits(supabase, user.orgId);
        break;

      case "update-adjustment-limits":
        requirePermission(user, PERMISSIONS.MANAGE);
        result = await updateAdjustmentLimits(supabase, user.orgId, payload);
        await auditAction(supabase, user, "update", "scoring_adjustment_limits", user.orgId);
        break;

      default:
        return new Response(
          JSON.stringify({ success: false, error: { code: "BAD_REQUEST", message: "Unknown action" } }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return successResponse(result);
  } catch (error) {
    return handleError(error);
  }
});

async function listModels(supabase: SupabaseClient, orgId: string) {
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

async function getModel(supabase: SupabaseClient, orgId: string, modelId: string) {
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

async function createModel(supabase: SupabaseClient, orgId: string, payload: RequestPayload) {
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

async function updateModel(supabase: SupabaseClient, orgId: string, modelId: string, payload: RequestPayload) {
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

async function deleteModel(supabase: SupabaseClient, orgId: string, modelId: string) {
  const { error } = await supabase
    .from("scoring_models")
    .delete()
    .eq("id", modelId)
    .eq("org_id", orgId);

  if (error) throw new Error(error.message);
  return { success: true };
}

async function toggleModel(supabase: SupabaseClient, orgId: string, modelId: string, active: boolean) {
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

async function setPrimaryModel(supabase: SupabaseClient, orgId: string, modelId: string) {
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

async function listRules(supabase: SupabaseClient, orgId: string, modelId: string) {
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

async function createRule(supabase: SupabaseClient, orgId: string, payload: RequestPayload) {
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

async function updateRule(supabase: SupabaseClient, orgId: string, ruleId: string, payload: RequestPayload) {
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

async function deleteRule(supabase: SupabaseClient, orgId: string, ruleId: string) {
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

async function toggleRule(supabase: SupabaseClient, orgId: string, ruleId: string, active: boolean) {
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

async function adjustScore(supabase: SupabaseClient, user: UserContext, payload: RequestPayload) {
  const { modelId, entityType, entityId, points, reason } = payload;
  const orgId = user.orgId;

  const { data: limits } = await supabase
    .from("scoring_adjustment_limits")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  if (limits) {
    if ((points as number) > 0 && (points as number) > limits.max_positive_adjustment) {
      throw new Error(`Adjustment exceeds maximum positive limit of ${limits.max_positive_adjustment}`);
    }
    if ((points as number) < 0 && Math.abs(points as number) > limits.max_negative_adjustment) {
      throw new Error(`Adjustment exceeds maximum negative limit of ${limits.max_negative_adjustment}`);
    }
    if (limits.require_reason && (!reason || (reason as string).trim() === "")) {
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
      created_by: user.id,
    });

  return { previousScore: currentScore, newScore, pointsDelta: points };
}

async function getEntityScores(supabase: SupabaseClient, orgId: string, entityType: string, entityId: string) {
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

async function getScoreHistory(supabase: SupabaseClient, orgId: string, payload: RequestPayload) {
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

async function getDecayConfig(supabase: SupabaseClient, orgId: string, modelId: string) {
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

async function updateDecayConfig(supabase: SupabaseClient, orgId: string, modelId: string, payload: RequestPayload) {
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

async function getAdjustmentLimits(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase
    .from("scoring_adjustment_limits")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return { limits: data || { max_positive_adjustment: 100, max_negative_adjustment: 100, require_reason: true } };
}

async function updateAdjustmentLimits(supabase: SupabaseClient, orgId: string, payload: RequestPayload) {
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
