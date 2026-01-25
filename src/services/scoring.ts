import { supabase } from '../lib/supabase';

export interface ScoringModel {
  id: string;
  org_id: string;
  name: string;
  scope: 'contact' | 'opportunity';
  starting_score: number;
  max_score: number | null;
  is_primary: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
  scoring_model_decay_config?: DecayConfig;
  scoring_rules?: ScoringRule[];
}

export interface DecayConfig {
  id: string;
  model_id: string;
  enabled: boolean;
  decay_type: 'linear' | 'step';
  decay_amount: number;
  interval_days: number;
  min_score_floor: number;
  notification_threshold: number | null;
  notify_in_app: boolean;
  notify_email: boolean;
  notify_sms: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScoringRule {
  id: string;
  model_id: string;
  name: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  points: number;
  frequency_type: 'once' | 'interval' | 'unlimited';
  cooldown_interval: number | null;
  cooldown_unit: 'minutes' | 'hours' | 'days' | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EntityScore {
  id: string;
  org_id: string;
  model_id: string;
  entity_type: 'contact' | 'opportunity';
  entity_id: string;
  current_score: number;
  last_decay_at: string | null;
  last_updated_at: string;
  scoring_models?: Pick<ScoringModel, 'id' | 'name' | 'scope' | 'max_score' | 'is_primary'>;
}

export interface ScoreEvent {
  id: string;
  org_id: string;
  model_id: string;
  entity_type: string;
  entity_id: string;
  rule_id: string | null;
  points_delta: number;
  previous_score: number;
  new_score: number;
  reason: string;
  source: 'rule' | 'manual' | 'decay';
  created_by: string | null;
  created_at: string;
  scoring_rules?: { name: string } | null;
  users?: { id: string; first_name: string; last_name: string; email: string } | null;
}

export interface AdjustmentLimits {
  id?: string;
  org_id?: string;
  max_positive_adjustment: number;
  max_negative_adjustment: number;
  require_reason: boolean;
}

export const TRIGGER_TYPES = [
  { value: 'contact_created', label: 'Contact Created', category: 'Contact' },
  { value: 'contact_status_changed', label: 'Contact Status Changed', category: 'Contact' },
  { value: 'tag_added', label: 'Tag Added', category: 'Contact' },
  { value: 'tag_removed', label: 'Tag Removed', category: 'Contact' },
  { value: 'form_submitted', label: 'Form Submitted', category: 'Engagement' },
  { value: 'survey_completed', label: 'Survey Completed', category: 'Engagement' },
  { value: 'email_opened', label: 'Email Opened', category: 'Email' },
  { value: 'email_clicked', label: 'Email Link Clicked', category: 'Email' },
  { value: 'email_replied', label: 'Email Replied', category: 'Email' },
  { value: 'sms_replied', label: 'SMS Replied', category: 'Messaging' },
  { value: 'webchat_started', label: 'Webchat Started', category: 'Messaging' },
  { value: 'appointment_booked', label: 'Appointment Booked', category: 'Calendar' },
  { value: 'appointment_completed', label: 'Appointment Completed', category: 'Calendar' },
  { value: 'appointment_noshow', label: 'Appointment No-Show', category: 'Calendar' },
  { value: 'appointment_cancelled', label: 'Appointment Cancelled', category: 'Calendar' },
  { value: 'payment_completed', label: 'Payment Completed', category: 'Payments' },
  { value: 'invoice_paid', label: 'Invoice Paid', category: 'Payments' },
  { value: 'opportunity_created', label: 'Opportunity Created', category: 'Opportunities' },
  { value: 'opportunity_stage_changed', label: 'Opportunity Stage Changed', category: 'Opportunities' },
  { value: 'opportunity_won', label: 'Opportunity Won', category: 'Opportunities' },
  { value: 'opportunity_lost', label: 'Opportunity Lost', category: 'Opportunities' },
  { value: 'ai_detected_intent', label: 'AI Detected Intent', category: 'AI' },
  { value: 'ai_conversation_positive', label: 'AI Positive Sentiment', category: 'AI' },
  { value: 'ai_conversation_negative', label: 'AI Negative Sentiment', category: 'AI' },
];

async function callScoringApi<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scoring-api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ action, ...params }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'API request failed');
  }
  return result;
}

export async function getModels(): Promise<ScoringModel[]> {
  const result = await callScoringApi<{ models: ScoringModel[] }>('list-models');
  return result.models;
}

export async function getModelById(modelId: string): Promise<ScoringModel> {
  const result = await callScoringApi<{ model: ScoringModel }>('get-model', { modelId });
  return result.model;
}

export async function createModel(data: {
  name: string;
  scope: 'contact' | 'opportunity';
  startingScore?: number;
  maxScore?: number | null;
  isPrimary?: boolean;
}): Promise<ScoringModel> {
  const result = await callScoringApi<{ model: ScoringModel }>('create-model', data);
  return result.model;
}

export async function updateModel(modelId: string, data: {
  name?: string;
  startingScore?: number;
  maxScore?: number | null;
  isPrimary?: boolean;
}): Promise<ScoringModel> {
  const result = await callScoringApi<{ model: ScoringModel }>('update-model', { modelId, ...data });
  return result.model;
}

export async function deleteModel(modelId: string): Promise<void> {
  await callScoringApi('delete-model', { modelId });
}

export async function toggleModel(modelId: string, active: boolean): Promise<ScoringModel> {
  const result = await callScoringApi<{ model: ScoringModel }>('toggle-model', { modelId, active });
  return result.model;
}

export async function setPrimaryModel(modelId: string): Promise<ScoringModel> {
  const result = await callScoringApi<{ model: ScoringModel }>('set-primary', { modelId });
  return result.model;
}

export async function getRules(modelId: string): Promise<ScoringRule[]> {
  const result = await callScoringApi<{ rules: ScoringRule[] }>('list-rules', { modelId });
  return result.rules;
}

export async function createRule(data: {
  modelId: string;
  name: string;
  triggerType: string;
  triggerConfig?: Record<string, unknown>;
  points: number;
  frequencyType?: 'once' | 'interval' | 'unlimited';
  cooldownInterval?: number | null;
  cooldownUnit?: 'minutes' | 'hours' | 'days' | null;
}): Promise<ScoringRule> {
  const result = await callScoringApi<{ rule: ScoringRule }>('create-rule', data);
  return result.rule;
}

export async function updateRule(ruleId: string, data: {
  name?: string;
  triggerType?: string;
  triggerConfig?: Record<string, unknown>;
  points?: number;
  frequencyType?: 'once' | 'interval' | 'unlimited';
  cooldownInterval?: number | null;
  cooldownUnit?: 'minutes' | 'hours' | 'days' | null;
  active?: boolean;
}): Promise<ScoringRule> {
  const result = await callScoringApi<{ rule: ScoringRule }>('update-rule', { ruleId, ...data });
  return result.rule;
}

export async function deleteRule(ruleId: string): Promise<void> {
  await callScoringApi('delete-rule', { ruleId });
}

export async function toggleRule(ruleId: string, active: boolean): Promise<ScoringRule> {
  const result = await callScoringApi<{ rule: ScoringRule }>('toggle-rule', { ruleId, active });
  return result.rule;
}

export async function adjustScore(data: {
  modelId: string;
  entityType: 'contact' | 'opportunity';
  entityId: string;
  points: number;
  reason?: string;
}): Promise<{ previousScore: number; newScore: number; pointsDelta: number }> {
  return await callScoringApi('adjust-score', data);
}

export async function getEntityScores(entityType: 'contact' | 'opportunity', entityId: string): Promise<EntityScore[]> {
  const result = await callScoringApi<{ scores: EntityScore[] }>('get-entity-scores', { entityType, entityId });
  return result.scores;
}

export async function getScoreHistory(
  entityType: 'contact' | 'opportunity',
  entityId: string,
  options?: { modelId?: string; limit?: number; offset?: number }
): Promise<{ events: ScoreEvent[]; total: number }> {
  return await callScoringApi('get-score-history', { entityType, entityId, ...options });
}

export async function getDecayConfig(modelId: string): Promise<DecayConfig | null> {
  const result = await callScoringApi<{ config: DecayConfig | null }>('get-decay-config', { modelId });
  return result.config;
}

export async function updateDecayConfig(modelId: string, data: {
  enabled: boolean;
  decayType: 'linear' | 'step';
  decayAmount: number;
  intervalDays: number;
  minScoreFloor: number;
  notificationThreshold?: number | null;
  notifyInApp?: boolean;
  notifyEmail?: boolean;
  notifySms?: boolean;
}): Promise<DecayConfig> {
  const result = await callScoringApi<{ config: DecayConfig }>('update-decay-config', { modelId, ...data });
  return result.config;
}

export async function getAdjustmentLimits(): Promise<AdjustmentLimits> {
  const result = await callScoringApi<{ limits: AdjustmentLimits }>('get-adjustment-limits');
  return result.limits;
}

export async function updateAdjustmentLimits(data: {
  maxPositiveAdjustment: number;
  maxNegativeAdjustment: number;
  requireReason: boolean;
}): Promise<AdjustmentLimits> {
  const result = await callScoringApi<{ limits: AdjustmentLimits }>('update-adjustment-limits', data);
  return result.limits;
}

export function getTriggerTypeLabel(triggerType: string): string {
  const trigger = TRIGGER_TYPES.find(t => t.value === triggerType);
  return trigger?.label || triggerType;
}

export function getScoreChangeColor(delta: number): string {
  if (delta > 0) return 'text-green-600';
  if (delta < 0) return 'text-red-600';
  return 'text-gray-500';
}

export function formatScoreChange(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}
