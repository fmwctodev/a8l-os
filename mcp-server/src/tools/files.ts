import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { restGet, restPost, restPatch, restDelete } from '../helpers/rest-client.js';
import { callEdgeFunction } from '../helpers/edge-client.js';
import { toolResult, toolError } from '../helpers/tool-utils.js';

export function registerFilesTools(server: McpServer): void {
  server.tool(
    'drive_files_list',
    'List files, optionally filtered by folder',
    {
      folder_id: z.string().optional(),
      order: z.string().optional(),
      limit: z.number().optional(),
    },
    async ({ folder_id, order, limit }) => {
      try {
        const filters: Record<string, string> = {};
        if (folder_id) filters['folder_id'] = `eq.${folder_id}`;
        const data = await restGet('drive_files', {
          filters,
          order: order || 'name.asc',
          limit: limit || 100,
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'drive_files_get',
    'Get file detail',
    { id: z.string() },
    async ({ id }) => {
      try {
        const data = await restGet('drive_files', {
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
    'drive_files_create',
    'Create a file record',
    {
      name: z.string(),
      folder_id: z.string().optional(),
      mime_type: z.string().optional(),
      size: z.number().optional(),
      google_file_id: z.string().optional(),
      organization_id: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('drive_files', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'drive_files_update',
    'Update file metadata',
    {
      id: z.string(),
      name: z.string().optional(),
      folder_id: z.string().optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('drive_files', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'drive_files_delete',
    'Delete a file record',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('drive_files', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'drive_folders_list',
    'List folders. Use parent_id to get subfolders, omit for root folders.',
    {
      parent_id: z.string().optional().describe('Omit for root folders, or set to folder id for subfolders'),
      limit: z.number().optional(),
    },
    async ({ parent_id, limit }) => {
      try {
        const filters: Record<string, string> = {};
        filters['parent_id'] = parent_id ? `eq.${parent_id}` : 'is.null';
        const data = await restGet('drive_folders', {
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
    'drive_folders_create',
    'Create a folder',
    {
      name: z.string(),
      parent_id: z.string().optional(),
      organization_id: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('drive_folders', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'drive_folders_update',
    'Update a folder',
    {
      id: z.string(),
      name: z.string().optional(),
      parent_id: z.string().optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('drive_folders', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'drive_folders_delete',
    'Delete a folder',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('drive_folders', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'file_attachments_list',
    'List file attachments linked to an entity',
    {
      entity_type: z.string().optional().describe('e.g. contact, opportunity, project'),
      entity_id: z.string().optional(),
      limit: z.number().optional(),
    },
    async ({ entity_type, entity_id, limit }) => {
      try {
        const filters: Record<string, string> = {};
        if (entity_type) filters['entity_type'] = `eq.${entity_type}`;
        if (entity_id) filters['entity_id'] = `eq.${entity_id}`;
        const data = await restGet('file_attachments', {
          select: '*,file:drive_files(id,name,mime_type,size)',
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
    'file_attachments_create',
    'Link a file to an entity',
    {
      file_id: z.string(),
      entity_type: z.string(),
      entity_id: z.string(),
    },
    async (params) => {
      try {
        const data = await restPost('file_attachments', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'file_attachments_delete',
    'Remove a file attachment link',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('file_attachments', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'drive_api',
    'Google Drive operations. Actions: list, get, createFolder, delete, share',
    {
      action: z.string().describe('list, get, createFolder, delete, share'),
      payload: z.record(z.unknown()).optional(),
    },
    async ({ action, payload }) => {
      try {
        const data = await callEdgeFunction('drive-api', { action, ...payload });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'drive_oauth_start',
    'Initiate Google Drive OAuth connection flow',
    { redirect_uri: z.string().optional() },
    async (params) => {
      try {
        const data = await callEdgeFunction('drive-oauth-start', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'drive_oauth_callback',
    'Handle Google Drive OAuth callback',
    { code: z.string(), state: z.string().optional() },
    async (params) => {
      try {
        const data = await callEdgeFunction('drive-oauth-callback', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'drive_auto_connect',
    'Auto-connect and configure Google Drive folder structure',
    { create_default_folders: z.boolean().optional() },
    async (params) => {
      try {
        const data = await callEdgeFunction('drive-auto-connect', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
