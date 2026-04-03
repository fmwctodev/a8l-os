import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { restGet, restPost, restPatch, restDelete } from '../helpers/rest-client.js';
import { toolResult, toolError } from '../helpers/tool-utils.js';

export function registerOpportunitiesTools(server: McpServer): void {
  server.tool(
    'pipelines_list',
    'List sales pipelines with their stages',
    {},
    async () => {
      try {
        const data = await restGet('pipelines', {
          select: '*,stages:pipeline_stages(*)',
          order: 'sort_order.asc',
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'pipelines_create',
    'Create a sales pipeline',
    { name: z.string(), type: z.string().optional(), sort_order: z.number().optional() },
    async (params) => {
      try {
        const data = await restPost('pipelines', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'pipelines_update',
    'Update a pipeline',
    { id: z.string(), name: z.string().optional(), sort_order: z.number().optional() },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('pipelines', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'pipelines_delete',
    'Delete a pipeline',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('pipelines', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'pipeline_stages_list',
    'List stages for a pipeline',
    { pipeline_id: z.string() },
    async ({ pipeline_id }) => {
      try {
        const data = await restGet('pipeline_stages', {
          filters: { pipeline_id: `eq.${pipeline_id}` },
          order: 'sort_order.asc',
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'pipeline_stages_create',
    'Create a pipeline stage',
    {
      pipeline_id: z.string(),
      name: z.string(),
      sort_order: z.number().optional(),
      probability: z.number().optional(),
      color: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('pipeline_stages', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'pipeline_stages_update',
    'Update a pipeline stage',
    {
      id: z.string(),
      name: z.string().optional(),
      sort_order: z.number().optional(),
      probability: z.number().optional(),
      color: z.string().optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('pipeline_stages', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'pipeline_stages_delete',
    'Delete a pipeline stage',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('pipeline_stages', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'opportunities_list',
    'List opportunities. Filter by pipeline, stage, status, owner.',
    {
      pipeline_id: z.string().optional(),
      stage_id: z.string().optional(),
      status: z.string().optional().describe('eq.open, eq.won, eq.lost'),
      owner_id: z.string().optional(),
      order: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    },
    async (params) => {
      try {
        const filters: Record<string, string> = {};
        if (params.pipeline_id) filters['pipeline_id'] = `eq.${params.pipeline_id}`;
        if (params.stage_id) filters['stage_id'] = `eq.${params.stage_id}`;
        if (params.status) filters['status'] = params.status;
        if (params.owner_id) filters['owner_id'] = `eq.${params.owner_id}`;
        const data = await restGet('opportunities', {
          select: '*,contact:contacts(id,first_name,last_name,email,company),stage:pipeline_stages(id,name,color),owner:users(id,full_name)',
          filters,
          order: params.order || 'created_at.desc',
          limit: params.limit || 50,
          offset: params.offset,
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'opportunities_get',
    'Get opportunity detail with contact, stage, notes',
    { id: z.string() },
    async ({ id }) => {
      try {
        const data = await restGet('opportunities', {
          select: '*,contact:contacts(*),stage:pipeline_stages(*),owner:users(id,full_name),notes:opportunity_notes(*)',
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
    'opportunities_create',
    'Create a new opportunity/deal',
    {
      name: z.string(),
      pipeline_id: z.string(),
      stage_id: z.string(),
      contact_id: z.string().optional(),
      value: z.number().optional(),
      status: z.string().optional(),
      owner_id: z.string().optional(),
      expected_close_date: z.string().optional(),
      organization_id: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('opportunities', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'opportunities_update',
    'Update an opportunity (including stage move for kanban drag)',
    {
      id: z.string(),
      name: z.string().optional(),
      stage_id: z.string().optional(),
      value: z.number().optional(),
      status: z.string().optional(),
      owner_id: z.string().optional(),
      expected_close_date: z.string().optional(),
      lost_reason: z.string().optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('opportunities', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'opportunities_delete',
    'Delete an opportunity',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('opportunities', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'opportunities_bulk_update_stage',
    'Bulk move opportunities to a new stage',
    {
      opportunity_ids: z.array(z.string()),
      stage_id: z.string(),
    },
    async ({ opportunity_ids, stage_id }) => {
      try {
        const data = await restPatch(
          'opportunities',
          { id: `in.(${opportunity_ids.join(',')})` },
          { stage_id },
          'return=representation',
        );
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'opportunity_notes_list',
    'List notes for an opportunity',
    { opportunity_id: z.string(), limit: z.number().optional() },
    async ({ opportunity_id, limit }) => {
      try {
        const data = await restGet('opportunity_notes', {
          filters: { opportunity_id: `eq.${opportunity_id}` },
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
    'opportunity_notes_create',
    'Create a note on an opportunity',
    { opportunity_id: z.string(), content: z.string() },
    async (params) => {
      try {
        const data = await restPost('opportunity_notes', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'lost_reasons_list',
    'List predefined reasons for lost deals',
    {},
    async () => {
      try {
        const data = await restGet('lost_reasons', { order: 'name.asc' });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
