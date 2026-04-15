import type { UserContext } from "./types.ts";

interface ITSAction {
  action_id: string;
  type: string;
  module: string;
  payload: Record<string, unknown>;
  depends_on: string | null;
}

interface PermissionResult {
  allowed: ITSAction[];
  denied: { action_id: string; action_type: string; reason: string }[];
}

const ACTION_PERMISSION_MAP: Record<string, string[]> = {
  create_contact: ['contacts.create'],
  update_contact: ['contacts.edit'],
  create_opportunity: ['opportunities.create'],
  move_opportunity: ['opportunities.move_stage'],
  create_project: ['projects.create'],
  create_task: ['projects.tasks.manage'],
  draft_email: ['personal_assistant.run'],
  send_email: ['personal_assistant.run'],
  send_sms: ['personal_assistant.run'],
  create_event: ['meetings.edit'],
  update_event: ['meetings.edit'],
  cancel_event: ['meetings.edit'],
  create_proposal_draft: ['proposals.create'],
  query_analytics: ['reporting.view'],
  query_schedule: ['personal_assistant.run'],
  query_contacts: ['personal_assistant.run'],
  query_opportunities: ['personal_assistant.run'],
  query_tasks: ['personal_assistant.run'],
  query_projects: ['personal_assistant.run'],
  query_proposals: ['personal_assistant.run'],
  query_contracts: ['personal_assistant.run'],
  query_files: ['personal_assistant.run'],
  remember: ['personal_assistant.run'],
  store_memory: ['personal_assistant.run'],
};

export function validatePermissions(
  actions: ITSAction[],
  user: UserContext
): PermissionResult {
  if (user.isSuperAdmin) {
    return { allowed: actions, denied: [] };
  }

  const allowed: ITSAction[] = [];
  const denied: { action_id: string; action_type: string; reason: string }[] = [];

  for (const action of actions) {
    const requiredPerms = ACTION_PERMISSION_MAP[action.type];

    if (!requiredPerms) {
      denied.push({
        action_id: action.action_id,
        action_type: action.type,
        reason: `Unknown action type: ${action.type}`,
      });
      continue;
    }

    const hasAny = requiredPerms.some((p) => user.permissions.includes(p));

    if (hasAny) {
      allowed.push(action);
    } else {
      denied.push({
        action_id: action.action_id,
        action_type: action.type,
        reason: `Missing permission: ${requiredPerms.join(' or ')}`,
      });
    }
  }

  return { allowed, denied };
}
