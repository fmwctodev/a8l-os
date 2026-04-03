import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { restGet, restPost, restPatch, restDelete } from '../helpers/rest-client.js';
import { callEdgeFunction } from '../helpers/edge-client.js';
import { toolResult, toolError } from '../helpers/tool-utils.js';

export function registerProjectsTools(server: McpServer): void {
  server.tool(
    'projects_list',
    'List projects with contact and manager. Filter by status, pipeline_stage_id.',
    {
      status: z.string().optional(),
      pipeline_stage_id: z.string().optional(),
      contact_id: z.string().optional(),
      order: z.string().optional(),
      limit: z.number().optional(),
    },
    async (params) => {
      try {
        const filters: Record<string, string> = {};
        if (params.status) filters['status'] = params.status;
        if (params.pipeline_stage_id) filters['pipeline_stage_id'] = `eq.${params.pipeline_stage_id}`;
        if (params.contact_id) filters['contact_id'] = `eq.${params.contact_id}`;
        const data = await restGet('projects', {
          select: '*,contact:contacts(id,first_name,last_name,email,company),manager:users(id,full_name)',
          filters,
          order: params.order || 'created_at.desc',
          limit: params.limit || 50,
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'projects_get',
    'Get project detail with tasks, notes, costs, change requests',
    { id: z.string() },
    async ({ id }) => {
      try {
        const data = await restGet('projects', {
          select: '*,contact:contacts(*),manager:users(id,full_name),tasks:project_tasks(*),notes:project_notes(*)',
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
    'projects_create',
    'Create a project',
    {
      name: z.string(),
      contact_id: z.string().optional(),
      manager_id: z.string().optional(),
      status: z.string().optional(),
      start_date: z.string().optional(),
      due_date: z.string().optional(),
      budget: z.number().optional(),
      organization_id: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('projects', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'projects_update',
    'Update a project',
    {
      id: z.string(),
      name: z.string().optional(),
      status: z.string().optional(),
      start_date: z.string().optional(),
      due_date: z.string().optional(),
      budget: z.number().optional(),
      manager_id: z.string().optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('projects', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'projects_delete',
    'Delete a project',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('projects', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'project_tasks_list',
    'List tasks for a project',
    { project_id: z.string(), status: z.string().optional(), limit: z.number().optional() },
    async ({ project_id, status, limit }) => {
      try {
        const filters: Record<string, string> = { project_id: `eq.${project_id}` };
        if (status) filters['status'] = status;
        const data = await restGet('project_tasks', {
          filters,
          order: 'sort_order.asc',
          limit: limit || 100,
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'project_tasks_create',
    'Create a project task',
    {
      project_id: z.string(),
      title: z.string(),
      description: z.string().optional(),
      assigned_to: z.string().optional(),
      due_date: z.string().optional(),
      status: z.string().optional(),
      sort_order: z.number().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('project_tasks', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'project_tasks_update',
    'Update a project task',
    {
      id: z.string(),
      title: z.string().optional(),
      status: z.string().optional(),
      assigned_to: z.string().optional(),
      due_date: z.string().optional(),
      sort_order: z.number().optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('project_tasks', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'project_tasks_delete',
    'Delete a project task',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('project_tasks', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'project_change_requests_list',
    'List change requests for a project',
    { project_id: z.string(), status: z.string().optional() },
    async ({ project_id, status }) => {
      try {
        const filters: Record<string, string> = { project_id: `eq.${project_id}` };
        if (status) filters['status'] = status;
        const data = await restGet('project_change_requests', {
          filters,
          order: 'created_at.desc',
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'project_change_requests_create',
    'Submit a change request for a project',
    {
      project_id: z.string(),
      title: z.string(),
      description: z.string(),
      impact_summary: z.string().optional(),
      cost_impact: z.number().optional(),
      schedule_impact_days: z.number().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('project_change_requests', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'project_change_requests_update',
    'Approve or reject a change request',
    {
      id: z.string(),
      status: z.string().describe('approved, rejected, pending'),
      reviewer_notes: z.string().optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('project_change_requests', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'support_tickets_list',
    'List support tickets for a project',
    { project_id: z.string(), status: z.string().optional(), limit: z.number().optional() },
    async ({ project_id, status, limit }) => {
      try {
        const filters: Record<string, string> = { project_id: `eq.${project_id}` };
        if (status) filters['status'] = status;
        const data = await restGet('support_tickets', {
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
    'support_tickets_create',
    'Create a support ticket for a project',
    {
      project_id: z.string(),
      title: z.string(),
      description: z.string(),
      priority: z.string().optional(),
      category: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('support_tickets', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'support_tickets_update',
    'Update a support ticket',
    {
      id: z.string(),
      status: z.string().optional(),
      priority: z.string().optional(),
      assigned_to: z.string().optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('support_tickets', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'change_request_notify',
    'Send notification about a change request',
    { change_request_id: z.string() },
    async (params) => {
      try {
        const data = await callEdgeFunction('change-request-notify', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'support_ticket_notify',
    'Send notification about a support ticket',
    { ticket_id: z.string() },
    async (params) => {
      try {
        const data = await callEdgeFunction('support-ticket-notify', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
