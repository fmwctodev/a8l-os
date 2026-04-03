import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { restGet, restPost, restPatch, restDelete } from '../helpers/rest-client.js';
import { callEdgeFunction } from '../helpers/edge-client.js';
import { toolResult, toolError } from '../helpers/tool-utils.js';

export function registerSystemTools(server: McpServer): void {
  server.tool(
    'notifications_list',
    'List in-app notifications for a user',
    {
      user_id: z.string(),
      is_read: z.boolean().optional(),
      limit: z.number().optional(),
    },
    async ({ user_id, is_read, limit }) => {
      try {
        const filters: Record<string, string> = { user_id: `eq.${user_id}` };
        if (is_read !== undefined) filters['is_read'] = `eq.${is_read}`;
        const data = await restGet('notifications', {
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
    'notifications_mark_read',
    'Mark a notification as read',
    { id: z.string() },
    async ({ id }) => {
      try {
        const data = await restPatch(
          'notifications',
          { id: `eq.${id}` },
          { is_read: true },
          'return=representation',
        );
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'notifications_mark_all_read',
    'Mark all unread notifications as read for a user',
    { user_id: z.string() },
    async ({ user_id }) => {
      try {
        const data = await restPatch(
          'notifications',
          { user_id: `eq.${user_id}`, is_read: 'eq.false' },
          { is_read: true },
        );
        return toolResult(data ?? { success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'notifications_delete',
    'Delete a notification',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('notifications', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'user_preferences_get',
    'Get user preferences',
    { user_id: z.string() },
    async ({ user_id }) => {
      try {
        const data = await restGet('user_preferences', {
          filters: { user_id: `eq.${user_id}` },
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'user_preferences_update',
    'Update user preferences',
    {
      user_id: z.string(),
      theme: z.string().optional(),
      timezone: z.string().optional(),
      locale: z.string().optional(),
      preferences: z.record(z.unknown()).optional(),
    },
    async ({ user_id, ...body }) => {
      try {
        const data = await restPatch(
          'user_preferences',
          { user_id: `eq.${user_id}` },
          body,
          'return=representation',
        );
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'user_notification_preferences_get',
    'Get per-user notification channel preferences',
    { user_id: z.string() },
    async ({ user_id }) => {
      try {
        const data = await restGet('user_notification_preferences', {
          filters: { user_id: `eq.${user_id}` },
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'user_connected_accounts_list',
    'List external accounts connected by a user',
    { user_id: z.string() },
    async ({ user_id }) => {
      try {
        const data = await restGet('user_connected_accounts', {
          filters: { user_id: `eq.${user_id}` },
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'custom_values_list',
    'List organization-wide custom values with categories',
    { limit: z.number().optional() },
    async ({ limit }) => {
      try {
        const data = await restGet('custom_values', {
          select: '*,category:custom_value_categories(id,name)',
          order: 'sort_order.asc',
          limit: limit || 200,
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'custom_values_create',
    'Create a custom value',
    {
      key: z.string(),
      value: z.string(),
      category_id: z.string().optional(),
      sort_order: z.number().optional(),
      organization_id: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('custom_values', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'custom_values_update',
    'Update a custom value',
    {
      id: z.string(),
      key: z.string().optional(),
      value: z.string().optional(),
      sort_order: z.number().optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('custom_values', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'custom_values_delete',
    'Delete a custom value',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('custom_values', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'custom_value_categories_list',
    'List custom value categories',
    {},
    async () => {
      try {
        const data = await restGet('custom_value_categories', { order: 'name.asc' });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'assistant_threads_list',
    'List Clara AI assistant conversation threads',
    { user_id: z.string(), limit: z.number().optional() },
    async ({ user_id, limit }) => {
      try {
        const data = await restGet('assistant_threads', {
          filters: { user_id: `eq.${user_id}` },
          order: 'updated_at.desc',
          limit: limit || 50,
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'assistant_threads_get',
    'Get assistant thread with messages',
    { id: z.string() },
    async ({ id }) => {
      try {
        const data = await restGet('assistant_threads', {
          select: '*,messages:assistant_messages(*)',
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
    'assistant_threads_create',
    'Create a new assistant thread',
    {
      title: z.string().optional(),
      user_id: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('assistant_threads', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'assistant_threads_delete',
    'Delete an assistant thread',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('assistant_threads', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'clara_memories_list',
    'List Clara AI memory entries',
    { user_id: z.string().optional(), limit: z.number().optional() },
    async ({ user_id, limit }) => {
      try {
        const filters: Record<string, string> = {};
        if (user_id) filters['user_id'] = `eq.${user_id}`;
        const data = await restGet('clara_memories', {
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
    'meeting_transcriptions_list',
    'List meeting transcription records',
    { limit: z.number().optional() },
    async ({ limit }) => {
      try {
        const data = await restGet('meeting_transcriptions', {
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
    'assistant_chat',
    'Send a message to the Clara AI assistant',
    {
      thread_id: z.string().optional(),
      message: z.string(),
      context: z.record(z.unknown()).optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('assistant-chat', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'assistant_voice',
    'Voice interaction with Clara (speech-to-text input)',
    {
      thread_id: z.string().optional(),
      audio_base64: z.string(),
      format: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('assistant-voice', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'assistant_tts',
    'Text-to-speech conversion for Clara responses',
    {
      text: z.string(),
      voice: z.string().optional(),
      speed: z.number().optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('assistant-tts', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'assistant_stt_wake',
    'Wake word detection for hands-free voice activation',
    {
      audio_base64: z.string(),
      format: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('assistant-stt-wake', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'assistant_stt_final',
    'Final speech-to-text processing for complete utterances',
    {
      audio_base64: z.string(),
      format: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('assistant-stt-final', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'clara_memory_decay',
    'Run Clara memory decay to manage context relevance',
    {},
    async () => {
      try {
        const data = await callEdgeFunction('clara-memory-decay', {});
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'assistant_meeting_processor',
    'Process meeting recordings to generate transcriptions and summaries',
    {
      meeting_id: z.string(),
      audio_url: z.string().optional(),
      generate_summary: z.boolean().optional(),
      extract_action_items: z.boolean().optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('assistant-meeting-processor', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'google_calendar_sync',
    'Full synchronization of Google Calendar events',
    {
      connection_id: z.string().optional(),
      direction: z.string().optional().describe('both, push, pull'),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('google-calendar-sync', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'google_calendar_sync_runner',
    'Background runner for scheduled Google Calendar sync jobs',
    {},
    async () => {
      try {
        const data = await callEdgeFunction('google-calendar-sync-runner', {});
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
