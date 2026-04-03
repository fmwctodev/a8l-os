import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { restGet, restPost, restPatch, restDelete } from '../helpers/rest-client.js';
import { callEdgeFunction } from '../helpers/edge-client.js';
import { toolResult, toolError } from '../helpers/tool-utils.js';

export function registerReportingTools(server: McpServer): void {
  server.tool(
    'ai_reports_list',
    'List AI-generated reports',
    { limit: z.number().optional() },
    async ({ limit }) => {
      try {
        const data = await restGet('ai_reports', {
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
    'ai_reports_get',
    'Get AI report detail',
    { id: z.string() },
    async ({ id }) => {
      try {
        const data = await restGet('ai_reports', {
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
    'ai_reports_create',
    'Create an AI report record',
    {
      title: z.string(),
      report_type: z.string().optional(),
      config: z.record(z.unknown()).optional(),
    },
    async (params) => {
      try {
        const data = await restPost('ai_reports', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ai_reports_delete',
    'Delete an AI report',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('ai_reports', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'reports_list',
    'List custom reports',
    { limit: z.number().optional() },
    async ({ limit }) => {
      try {
        const data = await restGet('reports', { order: 'name.asc', limit: limit || 50 });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'reports_create',
    'Create a custom report',
    {
      name: z.string(),
      description: z.string().optional(),
      query_config: z.record(z.unknown()).optional(),
    },
    async (params) => {
      try {
        const data = await restPost('reports', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'reports_update',
    'Update a report',
    { id: z.string(), name: z.string().optional(), description: z.string().optional() },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('reports', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'reports_delete',
    'Delete a report',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('reports', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ai_report_generate',
    'Generate an AI-powered analytical report',
    {
      report_type: z.string(),
      title: z.string().optional(),
      date_range: z.object({ start: z.string(), end: z.string() }).optional(),
      include_charts: z.boolean().optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('ai-report-generate', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ai_report_query',
    'Natural language query interface for business data',
    { query: z.string() },
    async (params) => {
      try {
        const data = await callEdgeFunction('ai-report-query', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ai_report_cleanup',
    'Remove stale and expired report cache entries',
    {},
    async () => {
      try {
        const data = await callEdgeFunction('ai-report-cleanup', {});
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ai_report_schedule_run',
    'Execute a scheduled report',
    { schedule_id: z.string() },
    async (params) => {
      try {
        const data = await callEdgeFunction('ai-report-schedule-runner', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'analytics_dashboard',
    'Get aggregated dashboard analytics data',
    {
      widgets: z.array(z.string()).optional().describe('e.g. revenue_summary, pipeline_overview, activity_feed, contact_growth'),
      date_range: z.object({ start: z.string(), end: z.string() }).optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('analytics-dashboard', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'analytics_content_ai',
    'AI-driven content performance analytics',
    {
      content_type: z.string().optional(),
      date_range: z.object({ start: z.string(), end: z.string() }).optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('analytics-content-ai', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'report_export',
    'Export a report to PDF, CSV, or Excel',
    { report_id: z.string(), format: z.enum(['pdf', 'csv', 'xlsx']) },
    async (params) => {
      try {
        const data = await callEdgeFunction('report-export-worker', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'report_email_send',
    'Send a report to recipients via email',
    {
      report_id: z.string(),
      recipients: z.array(z.string()),
      format: z.string().optional(),
      subject: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('report-email-sender', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
