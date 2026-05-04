import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { restGet } from '../helpers/rest-client.js';
import { callEdgeFunction } from '../helpers/edge-client.js';
import { toolResult, toolError } from '../helpers/tool-utils.js';

export function registerCommunicationsTools(server: McpServer): void {
  server.tool(
    'call_logs_list',
    'List phone call log records',
    {
      contact_id: z.string().optional(),
      direction: z.string().optional().describe('eq.inbound or eq.outbound'),
      limit: z.number().optional(),
    },
    async ({ contact_id, direction, limit }) => {
      try {
        const filters: Record<string, string> = {};
        if (contact_id) filters['contact_id'] = `eq.${contact_id}`;
        if (direction) filters['direction'] = direction;
        const data = await restGet('call_logs', {
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
    'email_domains_list',
    'List configured email sending domains',
    {},
    async () => {
      try {
        const data = await restGet('email_domains', { order: 'domain.asc' });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'email_from_addresses_list',
    'List verified sender email addresses',
    {},
    async () => {
      try {
        const data = await restGet('email_from_addresses', { order: 'email.asc' });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'gmail_api',
    'Gmail operations. Actions: list, get, send, reply, getThread, trash',
    {
      action: z.string().describe('list, get, send, reply, getThread, trash'),
      payload: z.record(z.unknown()).optional(),
    },
    async ({ action, payload }) => {
      try {
        const data = await callEdgeFunction('gmail-api', { action, ...payload });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'gmail_oauth_start',
    'Initiate Gmail OAuth connection',
    { redirect_uri: z.string().optional() },
    async (params) => {
      try {
        const data = await callEdgeFunction('gmail-oauth-start', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'gmail_sync',
    'Full synchronization of Gmail inbox',
    {},
    async () => {
      try {
        const data = await callEdgeFunction('gmail-sync', {});
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'gmail_sync_incremental',
    'Incremental Gmail sync (new/changed messages only)',
    {},
    async () => {
      try {
        const data = await callEdgeFunction('gmail-sync-incremental', {});
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'email_send',
    'Send an email via SendGrid',
    {
      to: z.string(),
      from: z.string().optional(),
      subject: z.string(),
      html: z.string(),
      cc: z.string().optional(),
      bcc: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('email-send', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'email_sendgrid_domains',
    'Manage SendGrid authenticated domains. Actions: list, verify, add, delete',
    {
      action: z.string(),
      payload: z.record(z.unknown()).optional(),
    },
    async ({ action, payload }) => {
      try {
        const data = await callEdgeFunction('email-sendgrid-domains', { action, ...payload });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'email_sendgrid_provider',
    'Manage SendGrid provider configuration',
    { action: z.string(), payload: z.record(z.unknown()).optional() },
    async ({ action, payload }) => {
      try {
        const data = await callEdgeFunction('email-sendgrid-provider', { action, ...payload });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'email_sendgrid_senders',
    'Manage verified SendGrid sender identities',
    { action: z.string(), payload: z.record(z.unknown()).optional() },
    async ({ action, payload }) => {
      try {
        const data = await callEdgeFunction('email-sendgrid-senders', { action, ...payload });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'email_sendgrid_unsubscribe',
    'Manage SendGrid unsubscribe groups and suppressions',
    { action: z.string(), payload: z.record(z.unknown()).optional() },
    async ({ action, payload }) => {
      try {
        const data = await callEdgeFunction('email-sendgrid-unsubscribe', { action, ...payload });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'email_campaign_domains',
    'Manage email campaign domain configurations',
    { action: z.string(), payload: z.record(z.unknown()).optional() },
    async ({ action, payload }) => {
      try {
        const data = await callEdgeFunction('email-campaign-domains', { action, ...payload });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'email_warmup_sync',
    'Synchronize email warmup status and progression',
    {},
    async () => {
      try {
        const data = await callEdgeFunction('email-warmup-sync', {});
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'send_sms',
    'Send an SMS message via Twilio',
    {
      to: z.string(),
      body: z.string(),
      from: z.string().optional(),
      contact_id: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('send-sms', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'plivo_numbers',
    'List, sync, assign, or disable Plivo phone numbers. Actions: list, sync, update_assignment, delete',
    {
      action: z.string(),
      payload: z.record(z.unknown()).optional(),
    },
    async ({ action, payload }) => {
      try {
        const data = await callEdgeFunction('plivo-numbers', { action, ...payload });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'phone_settings',
    'Manage phone system settings. Actions: get, update, get-status',
    {
      action: z.string(),
      payload: z.record(z.unknown()).optional(),
    },
    async ({ action, payload }) => {
      try {
        const data = await callEdgeFunction('phone-settings', { action, ...payload });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'plivo_connection',
    'Manage Plivo account connection. Actions: connect, test, disconnect, get, set_vapi_sip',
    { action: z.string(), payload: z.record(z.unknown()).optional() },
    async ({ action, payload }) => {
      try {
        const data = await callEdgeFunction('plivo-connection', { action, ...payload });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'plivo_sms_send',
    'Send an outbound SMS or MMS via Plivo',
    {
      orgId: z.string(),
      toNumber: z.string(),
      body: z.string(),
      fromNumber: z.string().optional(),
      contactId: z.string().optional(),
      conversationId: z.string().optional(),
      mediaUrls: z.array(z.string()).optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('plivo-sms-send', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'phone_voice_routing',
    'Configure voice call routing rules and IVR',
    { action: z.string(), payload: z.record(z.unknown()).optional() },
    async ({ action, payload }) => {
      try {
        const data = await callEdgeFunction('phone-voice-routing', { action, ...payload });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'phone_dnc',
    'Manage Do Not Call (DNC) list. Actions: list, add, remove, check',
    {
      action: z.string(),
      payload: z.record(z.unknown()).optional(),
    },
    async ({ action, payload }) => {
      try {
        const data = await callEdgeFunction('phone-dnc', { action, ...payload });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'phone_test',
    'Test phone connectivity and configuration',
    { test_type: z.string().optional(), phone_number: z.string().optional() },
    async (params) => {
      try {
        const data = await callEdgeFunction('phone-test', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );


  server.tool(
    'google_chat_api',
    'Google Chat workspace integration. Actions: listSpaces, listMessages, sendMessage',
    {
      action: z.string().describe('listSpaces, listMessages, sendMessage'),
      payload: z.record(z.unknown()).optional(),
    },
    async ({ action, payload }) => {
      try {
        const data = await callEdgeFunction('google-chat-api', { action, ...payload });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
