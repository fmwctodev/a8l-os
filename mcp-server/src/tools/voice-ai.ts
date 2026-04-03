import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { restGet, restPost, restPatch, restDelete } from '../helpers/rest-client.js';
import { callEdgeFunction } from '../helpers/edge-client.js';
import { toolResult, toolError } from '../helpers/tool-utils.js';

export function registerVoiceAITools(server: McpServer): void {
  server.tool(
    'vapi_assistants_list',
    'List VAPI voice assistants',
    { limit: z.number().optional() },
    async ({ limit }) => {
      try {
        const data = await restGet('vapi_assistants', {
          order: 'name.asc',
          limit: limit || 50,
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'vapi_assistants_get',
    'Get VAPI assistant detail with bindings and call count',
    { id: z.string() },
    async ({ id }) => {
      try {
        const data = await restGet('vapi_assistants', {
          select: '*,bindings:vapi_bindings(*),calls:vapi_calls(count)',
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
    'vapi_assistants_create',
    'Create a VAPI assistant record',
    {
      name: z.string(),
      description: z.string().optional(),
      vapi_assistant_id: z.string().optional(),
      config: z.record(z.unknown()).optional(),
      organization_id: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('vapi_assistants', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'vapi_assistants_update',
    'Update a VAPI assistant record',
    {
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      config: z.record(z.unknown()).optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('vapi_assistants', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'vapi_assistants_delete',
    'Delete a VAPI assistant record',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('vapi_assistants', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'vapi_calls_list',
    'List VAPI call records',
    {
      assistant_id: z.string().optional(),
      limit: z.number().optional(),
    },
    async ({ assistant_id, limit }) => {
      try {
        const filters: Record<string, string> = {};
        if (assistant_id) filters['assistant_id'] = `eq.${assistant_id}`;
        const data = await restGet('vapi_calls', {
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
    'vapi_calls_get',
    'Get VAPI call detail with transcript',
    { id: z.string() },
    async ({ id }) => {
      try {
        const data = await restGet('vapi_calls', {
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
    'vapi_widgets_list',
    'List embeddable voice widget configurations',
    { limit: z.number().optional() },
    async ({ limit }) => {
      try {
        const data = await restGet('vapi_widgets', {
          order: 'name.asc',
          limit: limit || 50,
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'vapi_tool_registry_list',
    'List registered tools available to VAPI assistants',
    { limit: z.number().optional() },
    async ({ limit }) => {
      try {
        const data = await restGet('vapi_tool_registry', {
          order: 'name.asc',
          limit: limit || 100,
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'vapi_client',
    'VAPI API client. Actions: listAssistants, getAssistant, createAssistant, updateAssistant, deleteAssistant, listPhoneNumbers, listCalls, getCall, createCall',
    {
      action: z.string().describe('listAssistants, getAssistant, createAssistant, updateAssistant, deleteAssistant, listPhoneNumbers, listCalls, getCall, createCall'),
      payload: z.record(z.unknown()).optional(),
    },
    async ({ action, payload }) => {
      try {
        const data = await callEdgeFunction('vapi-client', { action, ...payload });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'vapi_webhook',
    'Process VAPI webhook events (call started, ended, transcript updates)',
    { event: z.string(), call: z.record(z.unknown()).optional() },
    async (params) => {
      try {
        const data = await callEdgeFunction('vapi-webhook', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'vapi_tool_gateway',
    'Gateway for VAPI assistant tool calls during active conversations',
    {
      tool_name: z.string(),
      parameters: z.record(z.unknown()).optional(),
      call_id: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('vapi-tool-gateway', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
