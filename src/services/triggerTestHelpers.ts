import type { TriggerNodeData } from '../types';
import { matchesTrigger, evaluateTriggerWithDetails } from './triggerMatcher';

interface TestCase {
  name: string;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  payload: Record<string, unknown>;
  expectedMatch: boolean;
}

interface TestResult {
  name: string;
  passed: boolean;
  expected: boolean;
  actual: boolean;
  triggerType: string;
}

const BUILT_IN_TEST_CASES: TestCase[] = [
  {
    name: 'contact_changed: matches when watched field is in changed_fields',
    triggerType: 'contact_changed',
    triggerConfig: { watchedFields: ['email', 'phone'], matchMode: 'any' },
    payload: { changed_fields: ['email', 'first_name'] },
    expectedMatch: true,
  },
  {
    name: 'contact_changed: no match when watched field missing from changed_fields',
    triggerType: 'contact_changed',
    triggerConfig: { watchedFields: ['company'], matchMode: 'any' },
    payload: { changed_fields: ['email', 'first_name'] },
    expectedMatch: false,
  },
  {
    name: 'contact_changed: match all requires every watched field',
    triggerType: 'contact_changed',
    triggerConfig: { watchedFields: ['email', 'phone'], matchMode: 'all' },
    payload: { changed_fields: ['email'] },
    expectedMatch: false,
  },
  {
    name: 'contact_created: matches with source filter',
    triggerType: 'contact_created',
    triggerConfig: { sourceFilter: 'web' },
    payload: { source: 'web' },
    expectedMatch: true,
  },
  {
    name: 'contact_created: no match when source differs',
    triggerType: 'contact_created',
    triggerConfig: { sourceFilter: 'api' },
    payload: { source: 'web' },
    expectedMatch: false,
  },
  {
    name: 'contact_tag_changed: matches tag name and action',
    triggerType: 'contact_tag_changed',
    triggerConfig: { tagName: 'VIP', action: 'added' },
    payload: { tag: 'VIP', action: 'added' },
    expectedMatch: true,
  },
  {
    name: 'contact_tag_changed: either action matches both',
    triggerType: 'contact_tag_changed',
    triggerConfig: { tagName: 'VIP', action: 'either' },
    payload: { tag: 'VIP', action: 'removed' },
    expectedMatch: true,
  },
  {
    name: 'contact_engagement_score: crosses above threshold',
    triggerType: 'contact_engagement_score',
    triggerConfig: { operator: 'crosses_above', scoreValue: 80 },
    payload: { old_score: 75, new_score: 85 },
    expectedMatch: true,
  },
  {
    name: 'contact_engagement_score: does not cross above when already above',
    triggerType: 'contact_engagement_score',
    triggerConfig: { operator: 'crosses_above', scoreValue: 80 },
    payload: { old_score: 82, new_score: 90 },
    expectedMatch: false,
  },
  {
    name: 'event_custom: matches event name',
    triggerType: 'event_custom',
    triggerConfig: { eventName: 'user.signup' },
    payload: { event_name: 'user.signup', plan: 'pro' },
    expectedMatch: true,
  },
  {
    name: 'event_custom: payload key filter equals',
    triggerType: 'event_custom',
    triggerConfig: {
      eventName: 'purchase',
      payloadKeyFilters: [{ key: 'amount', operator: 'equals', value: '100' }],
    },
    payload: { event_name: 'purchase', amount: '100' },
    expectedMatch: true,
  },
  {
    name: 'event_form_submitted: matches specific form',
    triggerType: 'event_form_submitted',
    triggerConfig: { formId: 'form-123' },
    payload: { form_id: 'form-123' },
    expectedMatch: true,
  },
  {
    name: 'event_form_submitted: no match for wrong form',
    triggerType: 'event_form_submitted',
    triggerConfig: { formId: 'form-123' },
    payload: { form_id: 'form-456' },
    expectedMatch: false,
  },
  {
    name: 'opportunity_stage_changed: matches any stage move',
    triggerType: 'opportunity_stage_changed',
    triggerConfig: { anyStageMove: true },
    payload: { old_stage_id: 'a', new_stage_id: 'b' },
    expectedMatch: true,
  },
  {
    name: 'opportunity_stage_changed: matches specific from/to',
    triggerType: 'opportunity_stage_changed',
    triggerConfig: { anyStageMove: false, fromStage: 'stage-a', toStage: 'stage-b' },
    payload: { old_stage_id: 'stage-a', new_stage_id: 'stage-b' },
    expectedMatch: true,
  },
  {
    name: 'appointment_status_changed: matches status',
    triggerType: 'appointment_status_changed',
    triggerConfig: { statuses: ['confirmed', 'cancelled'] },
    payload: { new_status: 'confirmed' },
    expectedMatch: true,
  },
  {
    name: 'event_review_received: matches platform and rating',
    triggerType: 'event_review_received',
    triggerConfig: { platforms: ['google'], minRating: 1, maxRating: 3 },
    payload: { platform: 'google', rating: 2 },
    expectedMatch: true,
  },
  {
    name: 'event_review_received: rating above max fails',
    triggerType: 'event_review_received',
    triggerConfig: { platforms: ['google'], minRating: 1, maxRating: 3 },
    payload: { platform: 'google', rating: 5 },
    expectedMatch: false,
  },
  {
    name: 'contact_dnd_changed: matches channel and turned_on',
    triggerType: 'contact_dnd_changed',
    triggerConfig: { channel: 'email', state: 'turned_on' },
    payload: { channel: 'email', new_state: true },
    expectedMatch: true,
  },
  {
    name: 'event_customer_replied: matches channel and keyword',
    triggerType: 'event_customer_replied',
    triggerConfig: { channels: ['sms'], replyContains: 'yes' },
    payload: { channel: 'sms', content: 'Yes I am interested' },
    expectedMatch: true,
  },
];

function buildTriggerData(triggerType: string, triggerConfig: Record<string, unknown>): TriggerNodeData {
  return {
    triggerType: triggerType as TriggerNodeData['triggerType'],
    triggerConfig,
  };
}

export function runBuiltInTests(): TestResult[] {
  return BUILT_IN_TEST_CASES.map(tc => {
    const triggerData = buildTriggerData(tc.triggerType, tc.triggerConfig);
    const actual = matchesTrigger(triggerData, tc.payload);
    return {
      name: tc.name,
      passed: actual === tc.expectedMatch,
      expected: tc.expectedMatch,
      actual,
      triggerType: tc.triggerType,
    };
  });
}

export function runCustomTest(
  triggerType: string,
  triggerConfig: Record<string, unknown>,
  payload: Record<string, unknown>
): { matched: boolean; triggerType: string; evaluatedAt: string } {
  const triggerData = buildTriggerData(triggerType, triggerConfig);
  return evaluateTriggerWithDetails(triggerData, payload);
}

export function getSamplePayload(triggerType: string): Record<string, unknown> {
  const samples: Record<string, Record<string, unknown>> = {
    contact_changed: { changed_fields: ['email', 'phone'] },
    contact_created: { source: 'web', tags: ['lead'] },
    contact_tag_changed: { tag: 'VIP', action: 'added' },
    contact_dnd_changed: { channel: 'email', new_state: true },
    contact_engagement_score: { old_score: 50, new_score: 85 },
    event_call_details: { direction: 'inbound', answered_status: 'answered', duration: 120, outcome: 'qualified' },
    event_email: { event_type: 'opened', template_id: '' },
    event_customer_replied: { channel: 'sms', content: 'Yes, interested' },
    event_form_submitted: { form_id: '' },
    event_survey_submitted: { survey_id: '', score: 8 },
    event_review_received: { platform: 'google', rating: 5 },
    event_custom: { event_name: 'my.custom.event' },
    event_conversation_ai: { ai_classification: 'hot_lead', confidence: 0.92 },
    appointment_status_changed: { new_status: 'confirmed', calendar_id: '', appointment_type_id: '' },
    appointment_customer_booked: { calendar_id: '', appointment_type_id: '' },
    opportunity_status_changed: { new_status: 'won', pipeline_id: '' },
    opportunity_created: { pipeline_id: '', stage_id: '' },
    opportunity_changed: { changed_fields: ['value', 'close_date'], pipeline_id: '' },
    opportunity_stage_changed: { old_stage_id: 'stage-a', new_stage_id: 'stage-b', pipeline_id: '' },
    opportunity_stale: { pipeline_id: '', stage_id: '' },
  };
  return samples[triggerType] ?? {};
}

export function getAllTestCases(): TestCase[] {
  return [...BUILT_IN_TEST_CASES];
}
