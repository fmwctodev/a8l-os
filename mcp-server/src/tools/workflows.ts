import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { restGet, restPost, restPatch, restDelete } from '../helpers/rest-client.js';
import { callEdgeFunction } from '../helpers/edge-client.js';
import { toolResult, toolError } from '../helpers/tool-utils.js';

export function registerWorkflowsTools(server: McpServer): void {
  server.tool(
    'workflows_list',
    'List automation workflows. Filter by status, is_active.',
    {
      status: z.string().optional(),
      is_active: z.boolean().optional(),
      order: z.string().optional(),
      limit: z.number().optional(),
    },
    async (params) => {
      try {
        const filters: Record<string, string> = {};
        if (params.status) filters['status'] = params.status;
        if (params.is_active !== undefined) filters['is_active'] = `eq.${params.is_active}`;
        const data = await restGet('workflows', {
          filters,
          order: params.order || 'updated_at.desc',
          limit: params.limit || 50,
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'workflows_get',
    'Get workflow detail with steps and trigger config',
    { id: z.string() },
    async ({ id }) => {
      try {
        const data = await restGet('workflows', {
          select: '*,steps:workflow_steps(*),enrollments:workflow_enrollments(count)',
          filters: { id: `eq.${id}` },
          accept: 'application/vnd.pgrst.object+json',
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'workflows_create',
    'Create a workflow',
    {
      name: z.string(),
      description: z.string().optional(),
      trigger_type: z.string().optional(),
      trigger_config: z.record(z.unknown()).optional(),
      is_active: z.boolean().optional(),
      organization_id: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('workflows', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'workflows_update',
    'Update a workflow',
    {
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      is_active: z.boolean().optional(),
      trigger_type: z.string().optional(),
      trigger_config: z.record(z.unknown()).optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('workflows', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'workflows_delete',
    'Delete a workflow',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('workflows', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'workflow_enrollments_list',
    'List enrollments for a workflow',
    {
      workflow_id: z.string(),
      status: z.string().optional(),
      limit: z.number().optional(),
    },
    async ({ workflow_id, status, limit }) => {
      try {
        const filters: Record<string, string> = { workflow_id: `eq.${workflow_id}` };
        if (status) filters['status'] = status;
        const data = await restGet('workflow_enrollments', {
          filters,
          order: 'enrolled_at.desc',
          limit: limit || 50,
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'workflow_enrollments_create',
    'Manually enroll an entity into a workflow',
    {
      workflow_id: z.string(),
      entity_type: z.string(),
      entity_id: z.string(),
    },
    async (params) => {
      try {
        const data = await restPost('workflow_enrollments', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'workflow_enrollments_update',
    'Update enrollment status (pause, resume, complete, cancel)',
    {
      id: z.string(),
      status: z.string(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('workflow_enrollments', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'workflow_approval_queue_list',
    'List pending workflow approval items',
    { status: z.string().optional(), limit: z.number().optional() },
    async ({ status, limit }) => {
      try {
        const filters: Record<string, string> = {};
        if (status) filters['status'] = status;
        const data = await restGet('workflow_approval_queue', {
          filters,
          order: 'created_at.desc',
          limit: limit || 50,
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'workflow_approval_queue_update',
    'Approve or reject a workflow approval item',
    {
      id: z.string(),
      status: z.string().describe('approved or rejected'),
      notes: z.string().optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('workflow_approval_queue', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'workflow_processor',
    'Trigger workflow processing engine',
    { enrollment_id: z.string().optional(), workflow_id: z.string().optional() },
    async (params) => {
      try {
        const data = await callEdgeFunction('workflow-processor', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'evaluate_condition',
    'Evaluate a workflow condition against entity data',
    {
      condition: z.record(z.unknown()).describe('Condition definition'),
      entity_type: z.string().optional(),
      entity_id: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('evaluate-condition', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'automation_custom_trigger',
    'Fire a custom automation trigger',
    {
      trigger_name: z.string(),
      payload: z.record(z.unknown()).optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('automation-custom-trigger', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'workflow_webhook_receiver',
    'Process an inbound webhook trigger for workflows',
    { payload: z.record(z.unknown()) },
    async (params) => {
      try {
        const data = await callEdgeFunction('workflow-webhook-receiver', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'workflow_ai_action_executor',
    'Execute an AI-powered workflow action',
    {
      action_id: z.string(),
      enrollment_id: z.string().optional(),
      payload: z.record(z.unknown()).optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('workflow-ai-action-executor', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'workflow_scheduled_processor',
    'Process scheduled workflow triggers',
    { schedule_id: z.string().optional() },
    async (params) => {
      try {
        const data = await callEdgeFunction('workflow-scheduled-processor', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
