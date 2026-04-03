import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { restGet, restPost, restPatch, restDelete } from '../helpers/rest-client.js';
import { callEdgeFunction } from '../helpers/edge-client.js';
import { toolResult, toolError } from '../helpers/tool-utils.js';

export function registerProposalsTools(server: McpServer): void {
  server.tool(
    'proposals_list',
    'List proposals with contact info. Filter by status.',
    {
      status: z.string().optional().describe('eq.draft, eq.sent, eq.accepted, eq.declined'),
      contact_id: z.string().optional(),
      order: z.string().optional(),
      limit: z.number().optional(),
    },
    async (params) => {
      try {
        const filters: Record<string, string> = {};
        if (params.status) filters['status'] = params.status;
        if (params.contact_id) filters['contact_id'] = `eq.${params.contact_id}`;
        const data = await restGet('proposals', {
          select: '*,contact:contacts(id,first_name,last_name,email,company)',
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
    'proposals_get',
    'Get proposal detail with sections, line items, activities',
    { id: z.string() },
    async ({ id }) => {
      try {
        const data = await restGet('proposals', {
          select: '*,contact:contacts(*),sections:proposal_sections(*),line_items:proposal_line_items(*),activities:proposal_activities(*)',
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
    'proposals_create',
    'Create a proposal',
    {
      title: z.string(),
      contact_id: z.string(),
      status: z.string().optional(),
      valid_until: z.string().optional(),
      organization_id: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('proposals', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'proposals_update',
    'Update a proposal',
    {
      id: z.string(),
      title: z.string().optional(),
      status: z.string().optional(),
      valid_until: z.string().optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('proposals', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'proposals_delete',
    'Delete a proposal',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('proposals', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'contracts_list',
    'List contracts. Filter by status.',
    {
      status: z.string().optional(),
      contact_id: z.string().optional(),
      limit: z.number().optional(),
    },
    async (params) => {
      try {
        const filters: Record<string, string> = {};
        if (params.status) filters['status'] = params.status;
        if (params.contact_id) filters['contact_id'] = `eq.${params.contact_id}`;
        const data = await restGet('contracts', {
          select: '*,contact:contacts(id,first_name,last_name,email,company)',
          filters,
          order: 'created_at.desc',
          limit: params.limit || 50,
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'contracts_get',
    'Get contract detail',
    { id: z.string() },
    async ({ id }) => {
      try {
        const data = await restGet('contracts', {
          select: '*,contact:contacts(*),sections:contract_sections(*)',
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
    'contracts_create',
    'Create a contract',
    {
      title: z.string(),
      contact_id: z.string(),
      proposal_id: z.string().optional(),
      status: z.string().optional(),
      organization_id: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('contracts', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'contracts_update',
    'Update a contract',
    {
      id: z.string(),
      title: z.string().optional(),
      status: z.string().optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('contracts', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'contracts_delete',
    'Delete a contract',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('contracts', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'proposal_ai_generate',
    'Generate AI-powered proposal content',
    {
      proposal_id: z.string().optional(),
      contact_id: z.string().optional(),
      instructions: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('proposal-ai-generate', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'contract_ai_generate',
    'Generate AI-powered contract content',
    {
      contract_id: z.string().optional(),
      proposal_id: z.string().optional(),
      instructions: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('contract-ai-generate', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'proposal_signed_pdf',
    'Generate a signed PDF for a proposal',
    { proposal_id: z.string() },
    async (params) => {
      try {
        const data = await callEdgeFunction('proposal-signed-pdf', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
