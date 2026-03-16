import type { TriggerNodeData, WorkflowTriggerType } from '../types';

interface MatchContext {
  triggerType: WorkflowTriggerType;
  payload: Record<string, unknown>;
  triggerConfig: Record<string, unknown>;
}

type MatcherFn = (ctx: MatchContext) => boolean;

function matchContactChanged(ctx: MatchContext): boolean {
  const { payload, triggerConfig } = ctx;
  const watchedFields = (triggerConfig.watchedFields as string[]) ?? [];
  const matchMode = (triggerConfig.matchMode as string) ?? 'any';
  const changedFields = (payload.changed_fields as string[]) ?? [];

  if (watchedFields.length === 0) return true;

  const hits = watchedFields.filter(f => changedFields.includes(f));
  if (matchMode === 'all') return hits.length === watchedFields.length;
  return hits.length > 0;
}

function matchContactCreated(ctx: MatchContext): boolean {
  const { payload, triggerConfig } = ctx;
  const sourceFilter = (triggerConfig.sourceFilter as string) ?? '';
  const tagFilter = (triggerConfig.tagFilter as string) ?? '';
  const ownerFilter = (triggerConfig.ownerFilter as string) ?? '';

  if (sourceFilter && payload.source !== sourceFilter) return false;
  if (ownerFilter && payload.owner_id !== ownerFilter) return false;
  if (tagFilter) {
    const tags = (payload.tags as string[]) ?? [];
    if (!tags.includes(tagFilter)) return false;
  }
  return true;
}

function matchContactTag(ctx: MatchContext): boolean {
  const { payload, triggerConfig } = ctx;
  const tagName = (triggerConfig.tagName as string) ?? '';
  const action = (triggerConfig.action as string) ?? 'added';

  if (tagName && payload.tag !== tagName) return false;
  if (action !== 'either' && payload.action !== action) return false;
  return true;
}

function matchContactDnd(ctx: MatchContext): boolean {
  const { payload, triggerConfig } = ctx;
  const channel = (triggerConfig.channel as string) ?? 'all';
  const state = (triggerConfig.state as string) ?? 'any';

  if (channel !== 'all' && payload.channel !== channel) return false;
  if (state === 'turned_on' && payload.new_state !== true) return false;
  if (state === 'turned_off' && payload.new_state !== false) return false;
  return true;
}

function matchEngagementScore(ctx: MatchContext): boolean {
  const { payload, triggerConfig } = ctx;
  const operator = (triggerConfig.operator as string) ?? 'greater_than';
  const scoreValue = (triggerConfig.scoreValue as number) ?? 0;
  const newScore = (payload.new_score as number) ?? 0;
  const oldScore = (payload.old_score as number) ?? 0;

  switch (operator) {
    case 'equals': return newScore === scoreValue;
    case 'greater_than': return newScore > scoreValue;
    case 'less_than': return newScore < scoreValue;
    case 'crosses_above': return oldScore < scoreValue && newScore >= scoreValue;
    case 'crosses_below': return oldScore >= scoreValue && newScore < scoreValue;
    default: return false;
  }
}

function matchCallDetails(ctx: MatchContext): boolean {
  const { payload, triggerConfig } = ctx;
  const direction = (triggerConfig.direction as string) ?? 'any';
  const answeredStatus = (triggerConfig.answeredStatus as string) ?? 'any';
  const minDuration = (triggerConfig.minDuration as number) ?? 0;
  const maxDuration = (triggerConfig.maxDuration as number) ?? 0;
  const outcome = (triggerConfig.outcome as string[]) ?? [];

  if (direction !== 'any' && payload.direction !== direction) return false;
  if (answeredStatus !== 'any' && payload.answered_status !== answeredStatus) return false;
  const dur = (payload.duration as number) ?? 0;
  if (minDuration > 0 && dur < minDuration) return false;
  if (maxDuration > 0 && dur > maxDuration) return false;
  if (outcome.length > 0 && !outcome.includes(payload.outcome as string)) return false;
  return true;
}

function matchEmailEvents(ctx: MatchContext): boolean {
  const { payload, triggerConfig } = ctx;
  const eventTypes = (triggerConfig.eventTypes as string[]) ?? [];
  const templateFilter = (triggerConfig.templateFilter as string) ?? '';

  if (eventTypes.length > 0 && !eventTypes.includes(payload.event_type as string)) return false;
  if (templateFilter && payload.template_id !== templateFilter) return false;
  return true;
}

function matchCustomerReplied(ctx: MatchContext): boolean {
  const { payload, triggerConfig } = ctx;
  const channels = (triggerConfig.channels as string[]) ?? [];
  const replyContains = (triggerConfig.replyContains as string) ?? '';

  if (channels.length > 0 && !channels.includes(payload.channel as string)) return false;
  if (replyContains) {
    const content = ((payload.content as string) ?? '').toLowerCase();
    if (!content.includes(replyContains.toLowerCase())) return false;
  }
  return true;
}

function matchFormSubmitted(ctx: MatchContext): boolean {
  const { payload, triggerConfig } = ctx;
  const formId = (triggerConfig.formId as string) ?? '';
  if (formId && payload.form_id !== formId) return false;
  return true;
}

function matchSurveySubmitted(ctx: MatchContext): boolean {
  const { payload, triggerConfig } = ctx;
  const surveyId = (triggerConfig.surveyId as string) ?? '';
  const minScore = (triggerConfig.minScore as number) ?? 0;
  const maxScore = (triggerConfig.maxScore as number) ?? 0;

  if (surveyId && payload.survey_id !== surveyId) return false;
  const score = (payload.score as number) ?? 0;
  if (minScore > 0 && score < minScore) return false;
  if (maxScore > 0 && score > maxScore) return false;
  return true;
}

function matchReviewReceived(ctx: MatchContext): boolean {
  const { payload, triggerConfig } = ctx;
  const platforms = (triggerConfig.platforms as string[]) ?? [];
  const minRating = (triggerConfig.minRating as number) ?? 0;
  const maxRating = (triggerConfig.maxRating as number) ?? 0;

  if (platforms.length > 0 && !platforms.includes(payload.platform as string)) return false;
  const rating = (payload.rating as number) ?? 0;
  if (minRating > 0 && rating < minRating) return false;
  if (maxRating > 0 && rating > maxRating) return false;
  return true;
}

function matchAppointmentStatus(ctx: MatchContext): boolean {
  const { payload, triggerConfig } = ctx;
  const statuses = (triggerConfig.statuses as string[]) ?? [];
  const calendarFilter = (triggerConfig.calendarFilter as string) ?? '';
  const appointmentTypeFilter = (triggerConfig.appointmentTypeFilter as string) ?? '';

  if (statuses.length > 0 && !statuses.includes(payload.new_status as string)) return false;
  if (calendarFilter && payload.calendar_id !== calendarFilter) return false;
  if (appointmentTypeFilter && payload.appointment_type_id !== appointmentTypeFilter) return false;
  return true;
}

function matchCustomerBooked(ctx: MatchContext): boolean {
  const { payload, triggerConfig } = ctx;
  const calendarFilter = (triggerConfig.calendarFilter as string) ?? '';
  const appointmentTypeFilter = (triggerConfig.appointmentTypeFilter as string) ?? '';

  if (calendarFilter && payload.calendar_id !== calendarFilter) return false;
  if (appointmentTypeFilter && payload.appointment_type_id !== appointmentTypeFilter) return false;
  return true;
}

function matchOpportunityStatusChanged(ctx: MatchContext): boolean {
  const { payload, triggerConfig } = ctx;
  const statuses = (triggerConfig.statuses as string[]) ?? [];
  const pipelineFilter = (triggerConfig.pipelineFilter as string) ?? '';

  if (statuses.length > 0 && !statuses.includes(payload.new_status as string)) return false;
  if (pipelineFilter && payload.pipeline_id !== pipelineFilter) return false;
  return true;
}

function matchOpportunityCreated(ctx: MatchContext): boolean {
  const { payload, triggerConfig } = ctx;
  const pipelineFilter = (triggerConfig.pipelineFilter as string) ?? '';
  const stageFilter = (triggerConfig.stageFilter as string) ?? '';
  const ownerFilter = (triggerConfig.ownerFilter as string) ?? '';

  if (pipelineFilter && payload.pipeline_id !== pipelineFilter) return false;
  if (stageFilter && payload.stage_id !== stageFilter) return false;
  if (ownerFilter && payload.owner_id !== ownerFilter) return false;
  return true;
}

function matchOpportunityChanged(ctx: MatchContext): boolean {
  const { payload, triggerConfig } = ctx;
  const watchedFields = (triggerConfig.watchedFields as string[]) ?? [];
  const matchMode = (triggerConfig.matchMode as string) ?? 'any';
  const pipelineFilter = (triggerConfig.pipelineFilter as string) ?? '';
  const changedFields = (payload.changed_fields as string[]) ?? [];

  if (pipelineFilter && payload.pipeline_id !== pipelineFilter) return false;
  if (watchedFields.length === 0) return true;

  const hits = watchedFields.filter(f => changedFields.includes(f));
  if (matchMode === 'all') return hits.length === watchedFields.length;
  return hits.length > 0;
}

function matchOpportunityStageChanged(ctx: MatchContext): boolean {
  const { payload, triggerConfig } = ctx;
  const pipelineFilter = (triggerConfig.pipelineFilter as string) ?? '';
  const anyStageMove = (triggerConfig.anyStageMove as boolean) ?? true;
  const fromStage = (triggerConfig.fromStage as string) ?? '';
  const toStage = (triggerConfig.toStage as string) ?? '';

  if (pipelineFilter && payload.pipeline_id !== pipelineFilter) return false;
  if (anyStageMove) return true;
  if (fromStage && payload.old_stage_id !== fromStage) return false;
  if (toStage && payload.new_stage_id !== toStage) return false;
  return true;
}

function matchOpportunityStale(ctx: MatchContext): boolean {
  const { payload, triggerConfig } = ctx;
  const pipelineFilter = (triggerConfig.pipelineFilter as string) ?? '';
  const stageFilter = (triggerConfig.stageFilter as string) ?? '';

  if (pipelineFilter && payload.pipeline_id !== pipelineFilter) return false;
  if (stageFilter && payload.stage_id !== stageFilter) return false;
  return true;
}

function matchConversationAI(ctx: MatchContext): boolean {
  const { payload, triggerConfig } = ctx;
  const classificationFilter = (triggerConfig.classificationFilter as string) ?? '';
  const confidenceThreshold = (triggerConfig.confidenceThreshold as number) ?? 0;

  if (classificationFilter && payload.ai_classification !== classificationFilter) return false;
  if (confidenceThreshold > 0) {
    const confidence = (payload.confidence as number) ?? 0;
    if (confidence < confidenceThreshold / 100) return false;
  }
  return true;
}

function matchCustomTrigger(ctx: MatchContext): boolean {
  const { payload, triggerConfig } = ctx;
  const eventName = (triggerConfig.eventName as string) ?? '';
  const payloadKeyFilters = (triggerConfig.payloadKeyFilters as { key: string; operator: string; value: string }[]) ?? [];

  if (eventName && payload.event_name !== eventName) return false;

  for (const filter of payloadKeyFilters) {
    if (!filter.key) continue;
    const val = String(payload[filter.key] ?? '');
    switch (filter.operator) {
      case 'equals': if (val !== filter.value) return false; break;
      case 'contains': if (!val.includes(filter.value)) return false; break;
      case 'not_empty': if (!val) return false; break;
    }
  }
  return true;
}

function matchAlwaysTrue(): boolean {
  return true;
}

const MATCHERS: Record<string, MatcherFn> = {
  contact_changed: matchContactChanged,
  contact_created: matchContactCreated,
  contact_tag_changed: matchContactTag,
  contact_dnd_changed: matchContactDnd,
  contact_custom_date_reminder: matchAlwaysTrue,
  contact_note_added: matchAlwaysTrue,
  contact_note_changed: matchAlwaysTrue,
  contact_task_added: matchAlwaysTrue,
  contact_task_reminder: matchAlwaysTrue,
  contact_task_completed: matchAlwaysTrue,
  contact_engagement_score: matchEngagementScore,
  event_scheduler: matchAlwaysTrue,
  event_call_details: matchCallDetails,
  event_email: matchEmailEvents,
  event_customer_replied: matchCustomerReplied,
  event_conversation_ai: matchConversationAI,
  event_custom: matchCustomTrigger,
  event_form_submitted: matchFormSubmitted,
  event_survey_submitted: matchSurveySubmitted,
  event_review_received: matchReviewReceived,
  event_prospect_generated: matchAlwaysTrue,
  appointment_status_changed: matchAppointmentStatus,
  appointment_customer_booked: matchCustomerBooked,
  opportunity_status_changed: matchOpportunityStatusChanged,
  opportunity_created: matchOpportunityCreated,
  opportunity_changed: matchOpportunityChanged,
  opportunity_stage_changed: matchOpportunityStageChanged,
  opportunity_stale: matchOpportunityStale,
};

export function matchesTrigger(
  triggerData: TriggerNodeData,
  payload: Record<string, unknown>
): boolean {
  const triggerType = triggerData.triggerType;
  const triggerConfig = triggerData.triggerConfig ?? {};
  const matcher = MATCHERS[triggerType];

  if (!matcher) return true;

  return matcher({ triggerType, payload, triggerConfig });
}

export function getMatcherForType(triggerType: string): MatcherFn | null {
  return MATCHERS[triggerType] ?? null;
}

export function evaluateTriggerWithDetails(
  triggerData: TriggerNodeData,
  payload: Record<string, unknown>
): { matched: boolean; triggerType: string; evaluatedAt: string } {
  const matched = matchesTrigger(triggerData, payload);
  return {
    matched,
    triggerType: triggerData.triggerType,
    evaluatedAt: new Date().toISOString(),
  };
}
