import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { restGet, restPost, restPatch, restDelete } from '../helpers/rest-client.js';
import { callEdgeFunction } from '../helpers/edge-client.js';
import { toolResult, toolError } from '../helpers/tool-utils.js';

export function registerSocialMediaTools(server: McpServer): void {
  server.tool(
    'social_accounts_list',
    'List connected social media accounts',
    { limit: z.number().optional() },
    async ({ limit }) => {
      try {
        const data = await restGet('social_accounts', { order: 'platform.asc', limit: limit || 50 });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'social_posts_list',
    'List social posts. Filter by status, platform, campaign_id.',
    {
      status: z.string().optional(),
      platform: z.string().optional(),
      campaign_id: z.string().optional(),
      order: z.string().optional(),
      limit: z.number().optional(),
    },
    async (params) => {
      try {
        const filters: Record<string, string> = {};
        if (params.status) filters['status'] = params.status;
        if (params.platform) filters['platform'] = `eq.${params.platform}`;
        if (params.campaign_id) filters['campaign_id'] = `eq.${params.campaign_id}`;
        const data = await restGet('social_posts', {
          filters,
          order: params.order || 'scheduled_at.desc.nullslast',
          limit: params.limit || 50,
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'social_posts_create',
    'Create a social post',
    {
      content: z.string(),
      platform: z.string().optional(),
      account_id: z.string().optional(),
      scheduled_at: z.string().optional(),
      campaign_id: z.string().optional(),
      status: z.string().optional(),
      organization_id: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('social_posts', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'social_posts_update',
    'Update a social post',
    {
      id: z.string(),
      content: z.string().optional(),
      scheduled_at: z.string().optional(),
      status: z.string().optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('social_posts', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'social_posts_delete',
    'Delete a social post',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('social_posts', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'social_campaigns_list',
    'List social campaigns',
    { status: z.string().optional(), limit: z.number().optional() },
    async ({ status, limit }) => {
      try {
        const filters: Record<string, string> = {};
        if (status) filters['status'] = status;
        const data = await restGet('social_campaigns', {
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
    'social_campaigns_create',
    'Create a social campaign',
    {
      name: z.string(),
      description: z.string().optional(),
      start_date: z.string().optional(),
      end_date: z.string().optional(),
      status: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('social_campaigns', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'social_campaigns_update',
    'Update a social campaign',
    { id: z.string(), name: z.string().optional(), status: z.string().optional() },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('social_campaigns', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'social_campaigns_delete',
    'Delete a social campaign',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('social_campaigns', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'brand_kits_list',
    'List brand kits',
    {},
    async () => {
      try {
        const data = await restGet('brand_kits', { order: 'name.asc' });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'brand_kits_create',
    'Create a brand kit',
    { name: z.string(), description: z.string().optional() },
    async (params) => {
      try {
        const data = await restPost('brand_kits', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'late_connect',
    'Initiate Late.dev social account OAuth connection',
    { platform: z.string(), redirect_uri: z.string().optional() },
    async (params) => {
      try {
        const data = await callEdgeFunction('late-connect', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'social_worker_publish',
    'Publish scheduled social posts via the social worker',
    { post_id: z.string().optional() },
    async (params) => {
      try {
        const data = await callEdgeFunction('social-worker', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'late_metrics_fetch',
    'Fetch social engagement metrics from Late.dev',
    { account_id: z.string().optional(), date_range: z.record(z.string()).optional() },
    async (params) => {
      try {
        const data = await callEdgeFunction('late-metrics', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ai_social_campaign_generate',
    'Generate AI-powered social campaign content',
    {
      campaign_id: z.string().optional(),
      topic: z.string().optional(),
      platforms: z.array(z.string()).optional(),
      tone: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('ai-social-campaign-generator', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ai_social_content_generate',
    'Generate AI social post content',
    {
      topic: z.string().optional(),
      platform: z.string().optional(),
      tone: z.string().optional(),
      instructions: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('ai-social-content', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ai_social_chat',
    'AI social content assistant chat',
    { message: z.string(), context: z.record(z.unknown()).optional() },
    async (params) => {
      try {
        const data = await callEdgeFunction('ai-social-chat', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ai_caption_generate',
    'Generate AI captions for media',
    {
      media_url: z.string().optional(),
      context: z.string().optional(),
      platform: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('ai-caption-generator', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'media_kie_process',
    'Submit a media generation job (image/video)',
    {
      model_key: z.string(),
      prompt: z.string(),
      params: z.record(z.unknown()).optional(),
    },
    async (body) => {
      try {
        const data = await callEdgeFunction('media-kie-jobs', body);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'media_job_status',
    'Check status of a media generation job',
    { job_id: z.string() },
    async (params) => {
      try {
        const data = await callEdgeFunction('media-job-status', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
