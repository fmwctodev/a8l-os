import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { restGet, restPost, restPatch, restDelete } from '../helpers/rest-client.js';
import { callEdgeFunction } from '../helpers/edge-client.js';
import { toolResult, toolError } from '../helpers/tool-utils.js';

export function registerFormsTools(server: McpServer): void {
  server.tool(
    'forms_list',
    'List forms',
    { limit: z.number().optional() },
    async ({ limit }) => {
      try {
        const data = await restGet('forms', { order: 'name.asc', limit: limit || 50 });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'forms_get',
    'Get form detail with submission count',
    { id: z.string() },
    async ({ id }) => {
      try {
        const data = await restGet('forms', {
          select: '*,submissions:form_submissions(count)',
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
    'forms_create',
    'Create a form with field definitions',
    {
      name: z.string(),
      description: z.string().optional(),
      fields: z.array(z.record(z.unknown())).optional(),
      settings: z.record(z.unknown()).optional(),
      is_active: z.boolean().optional(),
      organization_id: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('forms', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'forms_update',
    'Update a form',
    {
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      fields: z.array(z.record(z.unknown())).optional(),
      settings: z.record(z.unknown()).optional(),
      is_active: z.boolean().optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('forms', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'forms_delete',
    'Delete a form',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('forms', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'form_submissions_list',
    'List submissions for a form',
    { form_id: z.string(), limit: z.number().optional() },
    async ({ form_id, limit }) => {
      try {
        const data = await restGet('form_submissions', {
          filters: { form_id: `eq.${form_id}` },
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
    'form_submissions_get',
    'Get a specific form submission',
    { id: z.string() },
    async ({ id }) => {
      try {
        const data = await restGet('form_submissions', {
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
    'form_submissions_delete',
    'Delete a form submission',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('form_submissions', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'surveys_list',
    'List surveys',
    { limit: z.number().optional() },
    async ({ limit }) => {
      try {
        const data = await restGet('surveys', { order: 'name.asc', limit: limit || 50 });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'surveys_create',
    'Create a survey',
    {
      name: z.string(),
      description: z.string().optional(),
      questions: z.array(z.record(z.unknown())).optional(),
      settings: z.record(z.unknown()).optional(),
      is_active: z.boolean().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('surveys', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'surveys_update',
    'Update a survey',
    { id: z.string(), name: z.string().optional(), is_active: z.boolean().optional() },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('surveys', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'surveys_delete',
    'Delete a survey',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('surveys', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'form_submit_public',
    'Public form submission endpoint (no auth required)',
    {
      form_id: z.string(),
      data: z.record(z.unknown()),
      metadata: z.record(z.unknown()).optional(),
    },
    async (params) => {
      try {
        const result = await callEdgeFunction('form-submit', params);
        return toolResult(result);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'survey_submit_public',
    'Public survey submission endpoint',
    {
      survey_id: z.string(),
      responses: z.array(z.record(z.unknown())),
      respondent: z.record(z.unknown()).optional(),
    },
    async (params) => {
      try {
        const result = await callEdgeFunction('survey-submit', params);
        return toolResult(result);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'scoring_api',
    'Lead/entity scoring. Actions: list-models, create-model, list-rules, adjust-score, get-entity-scores',
    {
      action: z.string(),
      payload: z.record(z.unknown()).optional(),
    },
    async ({ action, payload }) => {
      try {
        const data = await callEdgeFunction('scoring-api', { action, ...payload });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
