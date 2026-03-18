import { WORKFLOW_ACTION_DEFINITIONS } from '../types/workflowActions';
import { ACTION_CONFIG_MAP } from '../components/automation/builder/actionConfigs';
import { ACTION_OPTIONS } from '../types/workflowBuilder';

export interface ActionVerificationResult {
  actionType: string;
  hasDefinition: boolean;
  hasConfigUI: boolean;
  hasActionOption: boolean;
  issues: string[];
}

export function verifyAllActionsHaveDefinitions(): ActionVerificationResult[] {
  const results: ActionVerificationResult[] = [];
  const definedTypes = new Set(WORKFLOW_ACTION_DEFINITIONS.map(d => d.type));
  const uiTypes = new Set(Object.keys(ACTION_CONFIG_MAP));
  const optionTypes = new Set(ACTION_OPTIONS.map(o => o.type));

  for (const type of definedTypes) {
    const issues: string[] = [];
    if (!uiTypes.has(type) && !isLegacyInlineType(type)) {
      issues.push('Missing config UI component in ACTION_CONFIG_MAP');
    }
    if (!optionTypes.has(type)) {
      issues.push('Missing entry in ACTION_OPTIONS');
    }
    results.push({
      actionType: type,
      hasDefinition: true,
      hasConfigUI: uiTypes.has(type) || isLegacyInlineType(type),
      hasActionOption: optionTypes.has(type),
      issues,
    });
  }

  for (const type of uiTypes) {
    if (!definedTypes.has(type)) {
      results.push({
        actionType: type,
        hasDefinition: false,
        hasConfigUI: true,
        hasActionOption: optionTypes.has(type),
        issues: ['Has config UI but no definition in WORKFLOW_ACTION_DEFINITIONS'],
      });
    }
  }

  return results;
}

export function verifyAllActionsHaveConfigUI(): string[] {
  const missing: string[] = [];
  const uiTypes = new Set(Object.keys(ACTION_CONFIG_MAP));

  for (const def of WORKFLOW_ACTION_DEFINITIONS) {
    if (!uiTypes.has(def.type) && !isLegacyInlineType(def.type)) {
      missing.push(def.type);
    }
  }

  return missing;
}

export function runAllActionVerifications(): { passed: number; failed: number; results: ActionVerificationResult[] } {
  const results = verifyAllActionsHaveDefinitions();
  const failed = results.filter(r => r.issues.length > 0).length;
  return { passed: results.length - failed, failed, results };
}

export function getSampleActionConfig(actionType: string): Record<string, unknown> {
  const samples: Record<string, Record<string, unknown>> = {
    send_email: { subject: 'Hello {{contact.first_name}}', body: 'Hi there!' },
    send_sms: { body: 'Hi {{contact.first_name}}, thanks for reaching out!' },
    add_tag: { tagName: 'hot-lead', tagId: 'hot-lead' },
    remove_tag: { tagName: 'cold-lead', tagId: 'cold-lead' },
    webhook: { url: 'https://example.com/webhook', payload: {} },
    notify_user: { recipientType: 'contact_owner', message: 'New lead needs follow-up' },
    create_contact: { firstName: '{{contact.first_name}}', lastName: '{{contact.last_name}}', email: '{{contact.email}}', duplicateRule: 'skip' },
    find_contact: { lookupField: 'email', lookupValue: '{{contact.email}}', matchMode: 'first', fallbackBehavior: 'skip', storeResultAs: 'found_contact_id' },
    delete_contact: { mode: 'soft', reason: 'Duplicate contact' },
    modify_engagement_score: { operation: 'increase', value: 10, reason: 'Completed form' },
    modify_followers: { action: 'add', followerType: 'contact_owner' },
    add_note: { content: 'Contact engaged via workflow', visibility: 'internal' },
    edit_conversation: { operation: 'mark_read' },
    send_slack_message: { channelType: 'webhook', webhookUrl: 'https://hooks.slack.com/...', message: 'New lead: {{contact.first_name}}' },
    send_messenger: { channel: 'facebook', message: 'Hi {{contact.first_name}}!' },
    send_gmb_message: { message: 'Thank you for your inquiry!' },
    send_internal_notification: { recipientType: 'contact_owner', title: 'Action Required', body: 'Contact needs follow-up', urgency: 'normal' },
    conversation_ai_reply: { agentId: '', mode: 'draft', requireApproval: true },
    manual_action: { instructionText: 'Call the contact to confirm interest', assigneeType: 'contact_owner', dueHours: 24 },
    split_test: { splitType: 'percentage', variants: [{ id: '1', label: 'Variant A', percentage: 50 }, { id: '2', label: 'Variant B', percentage: 50 }] },
    go_to: { destinationType: 'node', targetNodeId: '' },
    remove_from_workflow_action: { target: 'current' },
    drip_mode: { batchSize: 10, intervalValue: 1, intervalUnit: 'hours', queueOrdering: 'fifo' },
    update_custom_value: { customValueKey: 'last_campaign', operation: 'set', value: 'summer-promo' },
    array_operation: { inputSource: 'variable', inputKey: 'tags', operation: 'dedupe', outputKey: 'unique_tags' },
    text_formatter: { inputValue: '{{contact.first_name}}', operation: 'capitalize', outputKey: 'formatted_name' },
    ai_prompt: { promptTemplate: 'Summarize the contact profile for {{contact.first_name}}.', outputMode: 'summary', saveOutputTo: 'variable', saveOutputKey: 'contact_summary' },
    update_appointment_status: { appointmentSource: 'most_recent', newStatus: 'confirmed', notifyContact: true },
    generate_booking_link: { calendarId: '', expirationHours: 48, saveToField: 'booking_link' },
    create_or_update_opportunity: { mode: 'create', pipelineId: '', stageId: '', titleTemplate: 'Opportunity for {{contact.first_name}}', value: 0, status: 'open' },
    remove_opportunity: { opportunitySource: 'most_recent', scope: 'current', mode: 'archive' },
    send_documents_and_contracts: { templateId: '', recipientType: 'contact', deliveryChannel: 'email', requireSignature: true, expirationDays: 30 },
  };

  return samples[actionType] ?? {};
}

function isLegacyInlineType(type: string): boolean {
  const legacyInline = new Set([
    'send_email', 'send_sms', 'add_tag', 'remove_tag', 'webhook', 'webhook_post',
    'notify_user', 'trigger_another_workflow',
  ]);
  return legacyInline.has(type);
}
