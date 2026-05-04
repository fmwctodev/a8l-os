import type { BuilderNode, BuilderEdge, ValidationIssue } from '../../../../types/workflowBuilder';
import type { TriggerNodeData, ActionNodeData, ConditionNodeData, DelayNodeData } from '../../../../types';

export function validateWorkflow(nodes: BuilderNode[], edges: BuilderEdge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const triggers = nodes.filter(n => n.data.nodeType === 'trigger');

  if (triggers.length === 0) {
    issues.push({ nodeId: '', nodeLabel: 'Workflow', severity: 'error', message: 'Workflow must have at least one trigger' });
  }

  for (const node of nodes) {
    const label = node.data.label || node.id;
    const nodeData = node.data.nodeData;

    switch (node.data.nodeType) {
      case 'trigger': {
        const td = nodeData as TriggerNodeData;
        if (!td.triggerType) {
          issues.push({ nodeId: node.id, nodeLabel: label, severity: 'error', message: 'Trigger type not configured' });
        } else {
          const cfg = td.triggerConfig ?? {};
          if (td.triggerType === 'event_custom' && !cfg.eventName) {
            issues.push({ nodeId: node.id, nodeLabel: label, severity: 'error', message: 'Custom trigger requires an event name' });
          }
          if ((td.triggerType === 'event_scheduler' || td.triggerType === 'scheduled')
              && !cfg.cronExpression && !cfg.scheduleDate && !cfg.cadence) {
            issues.push({ nodeId: node.id, nodeLabel: label, severity: 'warning', message: 'Scheduler trigger has no schedule configured' });
          }
          if (td.triggerType === 'opportunity_stale') {
            const basedOn = (cfg.basedOn as string[]) ?? [];
            if (basedOn.length === 0) {
              issues.push({ nodeId: node.id, nodeLabel: label, severity: 'warning', message: 'Stale opportunity trigger should specify at least one inactivity type' });
            }
          }
          if (td.triggerType === 'contact_engagement_score' && !cfg.scoreValue && cfg.scoreValue !== 0) {
            issues.push({ nodeId: node.id, nodeLabel: label, severity: 'warning', message: 'Engagement score trigger has no score threshold set' });
          }
          if (td.triggerType === 'webhook_received' && !((td as unknown as { webhookConfig?: { token?: string } }).webhookConfig?.token)) {
            issues.push({ nodeId: node.id, nodeLabel: label, severity: 'error', message: 'Webhook trigger has no token (open the trigger to generate a URL)' });
          }
          if ((td.triggerType === 'custom_date_reminder' || td.triggerType === 'contact_custom_date_reminder')
              && !cfg.customDateField) {
            issues.push({ nodeId: node.id, nodeLabel: label, severity: 'error', message: 'Custom date reminder needs a field to watch' });
          }
        }
        break;
      }
      case 'action': {
        const ad = nodeData as ActionNodeData;
        if (!ad.actionType) {
          issues.push({ nodeId: node.id, nodeLabel: label, severity: 'error', message: 'Action type not configured' });
        } else {
          const actionIssues = validateActionConfig(ad.actionType as string, (ad.config as Record<string, unknown>) ?? {});
          for (const msg of actionIssues) {
            issues.push({ nodeId: node.id, nodeLabel: label, severity: 'error', message: msg });
          }
        }
        break;
      }
      case 'condition': {
        const cd = nodeData as ConditionNodeData;
        if (!cd.conditions?.rules?.length) {
          issues.push({ nodeId: node.id, nodeLabel: label, severity: 'error', message: 'Condition has no rules defined' });
        }
        const yesEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'yes');
        const noEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'no');
        if (!yesEdge) issues.push({ nodeId: node.id, nodeLabel: label, severity: 'warning', message: 'Yes branch has no connected node' });
        if (!noEdge) issues.push({ nodeId: node.id, nodeLabel: label, severity: 'warning', message: 'No branch has no connected node' });
        break;
      }
      case 'delay': {
        const dd = nodeData as DelayNodeData;
        if (dd.delayType === 'wait_duration' && (!dd.duration?.value || dd.duration.value <= 0)) {
          issues.push({ nodeId: node.id, nodeLabel: label, severity: 'error', message: 'Wait duration must be greater than 0' });
        }
        break;
      }
    }

    if (node.data.nodeType !== 'trigger' && node.data.nodeType !== 'end') {
      const hasOutgoing = edges.some(e => e.source === node.id);
      if (!hasOutgoing) {
        issues.push({ nodeId: node.id, nodeLabel: label, severity: 'warning', message: 'Node has no outgoing connection' });
      }
    }
  }

  if (nodes.length > 50) {
    issues.push({ nodeId: '', nodeLabel: 'Workflow', severity: 'warning', message: 'Workflow has more than 50 nodes and may be difficult to manage' });
  }

  // Reachability: BFS from each trigger
  const reachable = new Set<string>();
  const queue: string[] = triggers.map(t => t.id);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (reachable.has(cur)) continue;
    reachable.add(cur);
    for (const e of edges) {
      if (e.source === cur && !reachable.has(e.target)) queue.push(e.target);
    }
  }
  for (const node of nodes) {
    if (node.data.nodeType === 'trigger') continue;
    if (!reachable.has(node.id)) {
      const label = node.data.label || node.id;
      issues.push({
        nodeId: node.id,
        nodeLabel: label,
        severity: 'error',
        message: 'Node is unreachable from any trigger',
      });
    }
  }

  // Cycle detection — flag cycles that don't pass through a goal/go_to node
  // (which intentionally jump back). DFS with a stack tracks back-edges.
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.source) || [];
    list.push(e.target);
    adj.set(e.source, list);
  }
  const isJumpBreaker = (nodeId: string): boolean => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return false;
    if (node.data.nodeType === 'goal') return true;
    if (node.data.nodeType === 'action') {
      const at = (node.data.nodeData as { actionType?: string })?.actionType;
      if (at === 'go_to' || at === 'goal_check') return true;
    }
    return false;
  };

  const visited = new Set<string>();
  const onStack = new Set<string>();
  const path: string[] = [];
  const flaggedCycles = new Set<string>();

  function dfs(nodeId: string): void {
    if (onStack.has(nodeId)) {
      const startIdx = path.indexOf(nodeId);
      const cycle = path.slice(startIdx).concat(nodeId);
      const cycleKey = [...cycle].sort().join('|');
      if (flaggedCycles.has(cycleKey)) return;
      flaggedCycles.add(cycleKey);
      const hasBreaker = cycle.some(isJumpBreaker);
      if (!hasBreaker) {
        for (const id of cycle) {
          const n = nodes.find(x => x.id === id);
          const label = n?.data.label || id;
          issues.push({
            nodeId: id,
            nodeLabel: label,
            severity: 'error',
            message: 'Node is part of an infinite loop (no goal or Go To breaks it)',
          });
        }
      }
      return;
    }
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    onStack.add(nodeId);
    path.push(nodeId);
    for (const next of adj.get(nodeId) || []) dfs(next);
    onStack.delete(nodeId);
    path.pop();
  }
  for (const t of triggers) dfs(t.id);

  return issues;
}

export function hasBlockingErrors(issues: ValidationIssue[]): boolean {
  return issues.some(i => i.severity === 'error');
}

export function validateActionConfig(actionType: string, cfg: Record<string, unknown>): string[] {
  const errors: string[] = [];

  switch (actionType) {
    case 'send_email':
      if (!cfg.subject) errors.push('Email subject is required');
      if (!cfg.body) errors.push('Email body is required');
      break;
    case 'send_sms':
      if (!cfg.body) errors.push('SMS message body is required');
      break;
    case 'webhook':
    case 'webhook_post':
      if (!cfg.url) errors.push('Webhook URL is required');
      break;
    case 'create_contact':
      if (!cfg.email && !cfg.phone) errors.push('Email or phone is required to create a contact');
      break;
    case 'find_contact':
      if (!cfg.lookupValue) errors.push('Lookup value is required');
      break;
    case 'add_note':
      if (!cfg.content) errors.push('Note content is required');
      break;
    case 'send_slack_message':
      if (!cfg.message) errors.push('Slack message content is required');
      if (!cfg.webhookUrl && !cfg.channelId && !cfg.userId) errors.push('Slack destination (webhook, channel, or user) is required');
      break;
    case 'send_messenger':
      if (!cfg.message) errors.push('Messenger message content is required');
      break;
    case 'send_gmb_message':
      if (!cfg.message) errors.push('GMB message content is required');
      break;
    case 'send_internal_notification':
      if (!cfg.title) errors.push('Notification title is required');
      if (!cfg.body) errors.push('Notification body is required');
      break;
    case 'conversation_ai_reply':
      if (!cfg.agentId) errors.push('AI agent must be selected');
      break;
    case 'ai_prompt':
      if (!cfg.promptTemplate) errors.push('Prompt template is required');
      break;
    case 'split_test': {
      const variants = (cfg.variants as Array<{ percentage: number }>) ?? [];
      if (variants.length < 2) errors.push('Split test requires at least 2 variants');
      const total = variants.reduce((sum, v) => sum + (v.percentage || 0), 0);
      if (Math.abs(total - 100) > 1) errors.push(`Variant percentages must total 100% (currently ${total}%)`);
      break;
    }
    case 'go_to':
      if (!cfg.targetNodeId && !cfg.targetWorkflowId) errors.push('Go To destination must be specified');
      break;
    case 'update_custom_value':
      if (!cfg.customValueKey) errors.push('Custom value key is required');
      if (!cfg.value) errors.push('Value is required');
      break;
    case 'text_formatter':
      if (!cfg.inputValue) errors.push('Input value is required');
      if (!cfg.outputKey) errors.push('Output variable key is required');
      break;
    case 'array_operation':
      if (!cfg.inputKey) errors.push('Input array source key is required');
      if (!cfg.outputKey) errors.push('Output key is required');
      break;
    case 'update_appointment_status':
      if (!cfg.newStatus) errors.push('New appointment status is required');
      break;
    case 'generate_booking_link':
      if (!cfg.calendarId) errors.push('Calendar ID is required');
      break;
    case 'create_or_update_opportunity':
      if (!cfg.pipelineId) errors.push('Pipeline ID is required');
      if (!cfg.stageId) errors.push('Stage ID is required');
      break;
    case 'send_documents_and_contracts':
      if (!cfg.templateId) errors.push('Document template ID is required');
      break;
    case 'manual_action':
      if (!cfg.instructionText) errors.push('Instruction text is required for manual actions');
      break;
    case 'drip_mode':
      if (!cfg.batchSize || (cfg.batchSize as number) < 1) errors.push('Batch size must be at least 1');
      if (!cfg.intervalValue || (cfg.intervalValue as number) < 1) errors.push('Interval value must be at least 1');
      break;
  }

  return errors;
}
