import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { restGet, restPost, restPatch, restDelete } from '../helpers/rest-client.js';
import { callEdgeFunction } from '../helpers/edge-client.js';
import { toolResult, toolError } from '../helpers/tool-utils.js';

export function registerConversationsTools(server: McpServer): void {
  server.tool(
    'conversations_list',
    'List conversations with contact and assigned user. Filter by status, channel, assigned_to.',
    {
      status: z.string().optional().describe('e.g. eq.open, eq.closed'),
      channel: z.string().optional().describe('e.g. eq.email, eq.sms, eq.phone'),
      assigned_to: z.string().optional(),
      order: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    },
    async (params) => {
      try {
        const filters: Record<string, string> = {};
        if (params.status) filters['status'] = params.status;
        if (params.channel) filters['channel'] = params.channel;
        if (params.assigned_to) filters['assigned_to'] = `eq.${params.assigned_to}`;
        const data = await restGet('conversations', {
          select: '*,contact:contacts(id,first_name,last_name,email),assigned_to:users(id,full_name)',
          filters,
          order: params.order || 'last_message_at.desc.nullslast',
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
    'conversations_get',
    'Get a conversation by ID with messages',
    { id: z.string() },
    async ({ id }) => {
      try {
        const data = await restGet('conversations', {
          select: '*,contact:contacts(*),messages(*)',
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
    'conversations_create',
    'Create a new conversation',
    {
      contact_id: z.string().optional(),
      channel: z.enum(['email', 'sms', 'phone', 'internal', 'google_chat']),
      subject: z.string().optional(),
      status: z.string().optional(),
      assigned_to: z.string().optional(),
      organization_id: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('conversations', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'conversations_update',
    'Update conversation status, assignment, or subject',
    {
      id: z.string(),
      status: z.string().optional(),
      assigned_to: z.string().optional(),
      subject: z.string().optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('conversations', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'conversations_delete',
    'Delete a conversation',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('conversations', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'messages_list',
    'List messages in a conversation',
    {
      conversation_id: z.string(),
      order: z.string().optional(),
      limit: z.number().optional(),
    },
    async ({ conversation_id, order, limit }) => {
      try {
        const data = await restGet('messages', {
          filters: { conversation_id: `eq.${conversation_id}` },
          order: order || 'created_at.asc',
          limit: limit || 100,
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'messages_create',
    'Create a message in a conversation',
    {
      conversation_id: z.string(),
      body: z.string(),
      sender_type: z.string().optional().describe('user or contact'),
      sender_id: z.string().optional(),
      channel: z.string().optional(),
      direction: z.string().optional().describe('inbound or outbound'),
    },
    async (params) => {
      try {
        const data = await restPost('messages', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'snippets_list',
    'List reusable message snippets',
    { limit: z.number().optional() },
    async ({ limit }) => {
      try {
        const data = await restGet('snippets', { order: 'name.asc', limit: limit || 100 });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'snippets_create',
    'Create a reusable message snippet',
    { name: z.string(), content: z.string(), category: z.string().optional() },
    async (params) => {
      try {
        const data = await restPost('snippets', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'snippets_update',
    'Update a snippet',
    { id: z.string(), name: z.string().optional(), content: z.string().optional() },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('snippets', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'snippets_delete',
    'Delete a snippet',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('snippets', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'conversation_rule_execute',
    'Execute conversation routing rules for a new message',
    { conversation_id: z.string(), message_id: z.string() },
    async (params) => {
      try {
        const data = await callEdgeFunction('conversation-rule-executor', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ai_draft_generate',
    'Generate or refresh an AI-drafted reply for a conversation',
    {
      conversation_id: z.string(),
      instructions: z.string().optional().describe('Tone or content instructions'),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('ai-draft-updater', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
