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
          if (td.triggerType === 'event_scheduler' && !cfg.cronExpression && !cfg.scheduleDate) {
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
        }
        break;
      }
      case 'action': {
        const ad = nodeData as ActionNodeData;
        if (!ad.actionType) {
          issues.push({ nodeId: node.id, nodeLabel: label, severity: 'error', message: 'Action type not configured' });
        }
        if (ad.actionType === 'send_email') {
          const cfg = ad.config as { subject?: string; body?: string };
          if (!cfg?.subject) issues.push({ nodeId: node.id, nodeLabel: label, severity: 'error', message: 'Email subject is required' });
          if (!cfg?.body) issues.push({ nodeId: node.id, nodeLabel: label, severity: 'error', message: 'Email body is required' });
        }
        if (ad.actionType === 'send_sms') {
          const cfg = ad.config as { body?: string };
          if (!cfg?.body) issues.push({ nodeId: node.id, nodeLabel: label, severity: 'error', message: 'SMS body is required' });
        }
        if ((ad.actionType as string) === 'webhook') {
          const cfg = ad.config as { url?: string };
          if (!cfg?.url) issues.push({ nodeId: node.id, nodeLabel: label, severity: 'error', message: 'Webhook URL is required' });
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

  return issues;
}

export function hasBlockingErrors(issues: ValidationIssue[]): boolean {
  return issues.some(i => i.severity === 'error');
}
