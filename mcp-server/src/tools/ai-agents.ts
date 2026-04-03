import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { restGet, restPost, restPatch, restDelete } from '../helpers/rest-client.js';
import { callEdgeFunction } from '../helpers/edge-client.js';
import { toolResult, toolError } from '../helpers/tool-utils.js';

export function registerAIAgentsTools(server: McpServer): void {
  server.tool(
    'ai_agents_list',
    'List AI agents',
    { limit: z.number().optional() },
    async ({ limit }) => {
      try {
        const data = await restGet('ai_agents', {
          select: '*,model:llm_models(id,name,provider)',
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
    'ai_agents_get',
    'Get AI agent detail with model, guardrails, collections',
    { id: z.string() },
    async ({ id }) => {
      try {
        const data = await restGet('ai_agents', {
          select: '*,model:llm_models(*),guardrails:ai_guardrails(*),collections:knowledge_collections(*)',
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
    'ai_agents_create',
    'Create an AI agent',
    {
      name: z.string(),
      description: z.string().optional(),
      system_prompt: z.string().optional(),
      model_id: z.string().optional(),
      temperature: z.number().optional(),
      is_active: z.boolean().optional(),
      organization_id: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('ai_agents', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ai_agents_update',
    'Update an AI agent',
    {
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      system_prompt: z.string().optional(),
      model_id: z.string().optional(),
      temperature: z.number().optional(),
      is_active: z.boolean().optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('ai_agents', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ai_agents_delete',
    'Delete an AI agent',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('ai_agents', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'knowledge_collections_list',
    'List knowledge collections',
    { agent_id: z.string().optional(), limit: z.number().optional() },
    async ({ agent_id, limit }) => {
      try {
        const filters: Record<string, string> = {};
        if (agent_id) filters['agent_id'] = `eq.${agent_id}`;
        const data = await restGet('knowledge_collections', {
          filters,
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
    'knowledge_collections_create',
    'Create a knowledge collection',
    {
      name: z.string(),
      description: z.string().optional(),
      source_type: z.string().optional(),
      agent_id: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('knowledge_collections', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'knowledge_collections_update',
    'Update a knowledge collection',
    {
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('knowledge_collections', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'knowledge_collections_delete',
    'Delete a knowledge collection',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('knowledge_collections', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ai_agent_execute',
    'Execute an AI agent against a contact/conversation',
    {
      agent_id: z.string(),
      contact_id: z.string(),
      conversation_id: z.string().optional(),
      instructions: z.string().optional(),
      triggered_by: z.enum(['user', 'automation']).optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('ai-agent-executor', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ai_knowledge_embed',
    'Generate embeddings for knowledge content',
    {
      collection_id: z.string(),
      content: z.string().optional(),
      source_id: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('ai-knowledge-embeddings', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ai_settings_providers',
    'Manage AI provider settings. Actions: list, get, update, test',
    {
      action: z.string(),
      payload: z.record(z.unknown()).optional(),
    },
    async ({ action, payload }) => {
      try {
        const data = await callEdgeFunction('ai-settings-providers', { action, ...payload });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ai_settings_elevenlabs',
    'Manage ElevenLabs voice settings. Actions: listVoices, getVoice, testVoice',
    {
      action: z.string(),
      voiceId: z.string().optional(),
      text: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('ai-settings-elevenlabs', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'fetch_provider_models',
    'Fetch available models from an AI provider',
    { provider: z.string() },
    async (params) => {
      try {
        const data = await callEdgeFunction('fetch-provider-models', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
