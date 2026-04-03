import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { restGet, restPost, restPatch, restDelete } from '../helpers/rest-client.js';
import { callEdgeFunction } from '../helpers/edge-client.js';
import { toolResult, toolError } from '../helpers/tool-utils.js';

export function registerIntegrationsTools(server: McpServer): void {
  server.tool(
    'integrations_list',
    'List available integration definitions',
    {},
    async () => {
      try {
        const data = await restGet('integrations', { order: 'name.asc' });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'integrations_get',
    'Get integration detail',
    { id: z.string() },
    async ({ id }) => {
      try {
        const data = await restGet('integrations', {
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
    'integration_connections_list',
    'List active integration connections',
    { limit: z.number().optional() },
    async ({ limit }) => {
      try {
        const data = await restGet('integration_connections', {
          select: '*,integration:integrations(id,name,icon)',
          order: 'connected_at.desc',
          limit: limit || 50,
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'integration_connections_create',
    'Create an integration connection',
    {
      integration_id: z.string(),
      config: z.record(z.unknown()).optional(),
      organization_id: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('integration_connections', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'integration_connections_update',
    'Update an integration connection',
    {
      id: z.string(),
      config: z.record(z.unknown()).optional(),
      is_active: z.boolean().optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('integration_connections', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'integration_connections_delete',
    'Disconnect an integration',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('integration_connections', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'outgoing_webhooks_list',
    'List outgoing webhook configurations',
    {},
    async () => {
      try {
        const data = await restGet('outgoing_webhooks', { order: 'name.asc' });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'outgoing_webhooks_create',
    'Create an outgoing webhook',
    {
      name: z.string(),
      url: z.string(),
      events: z.array(z.string()),
      headers: z.record(z.string()).optional(),
      is_active: z.boolean().optional(),
      organization_id: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('outgoing_webhooks', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'outgoing_webhooks_update',
    'Update an outgoing webhook',
    {
      id: z.string(),
      name: z.string().optional(),
      url: z.string().optional(),
      events: z.array(z.string()).optional(),
      headers: z.record(z.string()).optional(),
      is_active: z.boolean().optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('outgoing_webhooks', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'outgoing_webhooks_delete',
    'Delete an outgoing webhook',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('outgoing_webhooks', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'webhook_deliveries_list',
    'List webhook delivery attempts for a webhook',
    {
      webhook_id: z.string(),
      limit: z.number().optional(),
    },
    async ({ webhook_id, limit }) => {
      try {
        const data = await restGet('webhook_deliveries', {
          filters: { webhook_id: `eq.${webhook_id}` },
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
    'integrations_connect',
    'Initiate an integration connection flow via Edge Function',
    {
      integration_id: z.string(),
      config: z.record(z.unknown()).optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('integrations-connect', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'integrations_webhooks',
    'Process incoming webhook payloads from integrated services',
    {
      source: z.string(),
      event: z.string(),
      data: z.record(z.unknown()).optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('integrations-webhooks', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'google_oauth_unified',
    'Unified Google OAuth flow. Actions: start, callback, revoke, status',
    {
      action: z.string().describe('start, callback, revoke, status'),
      payload: z.record(z.unknown()).optional(),
    },
    async ({ action, payload }) => {
      try {
        const data = await callEdgeFunction('google-oauth-unified', { action, ...payload });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'google_token_refresh',
    'Refresh expiring Google OAuth tokens',
    {},
    async () => {
      try {
        const data = await callEdgeFunction('google-token-refresh-cron', {});
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'portal_auth',
    'Client portal authentication. Actions: requestCode, verifyCode, validateSession',
    {
      action: z.string().describe('requestCode, verifyCode, validateSession'),
      payload: z.record(z.unknown()).optional(),
    },
    async ({ action, payload }) => {
      try {
        const data = await callEdgeFunction('portal-auth', { action, ...payload });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'secrets_api',
    'Manage application secrets and API keys. Actions: list, create, delete',
    {
      action: z.string().describe('list, create, delete'),
      payload: z.record(z.unknown()).optional(),
    },
    async ({ action, payload }) => {
      try {
        const data = await callEdgeFunction('secrets-api', { action, ...payload });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'secrets_scanner',
    'Scan for exposed or misconfigured secrets',
    {},
    async () => {
      try {
        const data = await callEdgeFunction('secrets-scanner', {});
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
