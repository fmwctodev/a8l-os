import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { restGet, restPost, restPatch, restDelete } from '../helpers/rest-client.js';
import { callEdgeFunction } from '../helpers/edge-client.js';
import { toolResult, toolError } from '../helpers/tool-utils.js';

export function registerReputationTools(server: McpServer): void {
  server.tool(
    'reviews_list',
    'List reviews with AI analysis. Filter by rating, platform, status.',
    {
      rating: z.string().optional().describe('e.g. gte.4'),
      platform: z.string().optional(),
      status: z.string().optional(),
      order: z.string().optional(),
      limit: z.number().optional(),
    },
    async (params) => {
      try {
        const filters: Record<string, string> = {};
        if (params.rating) filters['rating'] = params.rating;
        if (params.platform) filters['platform'] = `eq.${params.platform}`;
        if (params.status) filters['status'] = params.status;
        const data = await restGet('reviews', {
          select: '*,analysis:review_ai_analysis(*)',
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
    'reviews_get',
    'Get review detail with AI analysis',
    { id: z.string() },
    async ({ id }) => {
      try {
        const data = await restGet('reviews', {
          select: '*,analysis:review_ai_analysis(*)',
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
    'reviews_update',
    'Update a review (e.g. mark as responded)',
    { id: z.string(), status: z.string().optional(), response: z.string().optional() },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('reviews', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'review_requests_list',
    'List review requests',
    { limit: z.number().optional() },
    async ({ limit }) => {
      try {
        const data = await restGet('review_requests', {
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
    'review_requests_create',
    'Create a review request',
    {
      contact_id: z.string(),
      platform: z.string().optional(),
      template_id: z.string().optional(),
      send_via: z.string().optional().describe('email or sms'),
    },
    async (params) => {
      try {
        const data = await restPost('review_requests', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'review_requests_update',
    'Update a review request',
    { id: z.string(), status: z.string().optional() },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('review_requests', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'review_requests_delete',
    'Delete a review request',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('review_requests', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'review_ai_analyze',
    'Analyze a review using AI for sentiment, topics, key phrases',
    { review_id: z.string() },
    async (params) => {
      try {
        const data = await callEdgeFunction('review-ai-analyze', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'review_ai_reply',
    'Generate an AI-drafted reply to a review',
    {
      review_id: z.string(),
      tone: z.string().optional(),
      instructions: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('review-ai-reply', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'review_reply_post',
    'Post a reply to a review on the original platform',
    { review_id: z.string(), reply: z.string() },
    async (params) => {
      try {
        const data = await callEdgeFunction('review-reply-post', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'review_submit',
    'Submit a new review (internal collection)',
    {
      contact_id: z.string(),
      rating: z.number(),
      review_text: z.string().optional(),
      platform: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('review-submit', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'review_sync_worker',
    'Sync reviews from a connected review platform',
    { provider_id: z.string() },
    async (params) => {
      try {
        const data = await callEdgeFunction('review-sync-worker', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'reputation_review_sync',
    'Sync reputation data from monitoring sources',
    { source: z.string() },
    async (params) => {
      try {
        const data = await callEdgeFunction('reputation-review-sync', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'reputation_review_reply',
    'Post a reply to a reputation review on the monitored platform',
    { review_id: z.string(), reply: z.string() },
    async (params) => {
      try {
        const data = await callEdgeFunction('reputation-review-reply', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'reputation_ai_generate',
    'Generate AI-powered reputation improvement suggestions',
    {
      action: z.string().describe('e.g. improvement_plan'),
      date_range: z.object({ start: z.string(), end: z.string() }).optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('reputation-ai-generate', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
