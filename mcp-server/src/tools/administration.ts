import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { restGet, restPost, restPatch, restDelete } from '../helpers/rest-client.js';
import { toolResult, toolError } from '../helpers/tool-utils.js';

export function registerAdministrationTools(server: McpServer): void {
  server.tool(
    'users_list',
    'List users with role and department',
    { limit: z.number().optional() },
    async ({ limit }) => {
      try {
        const data = await restGet('users', {
          select: '*,role:roles(id,name),department:departments(id,name)',
          order: 'full_name.asc',
          limit: limit || 100,
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'users_get',
    'Get user detail with role, department, and permission overrides',
    { id: z.string() },
    async ({ id }) => {
      try {
        const data = await restGet('users', {
          select: '*,role:roles(*),department:departments(*),overrides:user_permission_overrides(*)',
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
    'users_update',
    'Update a user profile',
    {
      id: z.string(),
      full_name: z.string().optional(),
      role_id: z.string().optional(),
      department_id: z.string().optional(),
      is_active: z.boolean().optional(),
      job_title: z.string().optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('users', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'organizations_get',
    'Get organization detail',
    { id: z.string() },
    async ({ id }) => {
      try {
        const data = await restGet('organizations', {
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
    'organizations_update',
    'Update organization settings',
    {
      id: z.string(),
      name: z.string().optional(),
      settings: z.record(z.unknown()).optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('organizations', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'roles_list',
    'List roles with permissions',
    {},
    async () => {
      try {
        const data = await restGet('roles', {
          select: '*,permissions:role_permissions(permission:permissions(*))',
          order: 'name.asc',
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'roles_create',
    'Create a role',
    {
      name: z.string(),
      description: z.string().optional(),
      organization_id: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('roles', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'roles_update',
    'Update a role',
    {
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('roles', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'roles_delete',
    'Delete a role',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('roles', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'departments_list',
    'List departments',
    {},
    async () => {
      try {
        const data = await restGet('departments', { order: 'name.asc' });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'departments_create',
    'Create a department',
    {
      name: z.string(),
      description: z.string().optional(),
      organization_id: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('departments', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'departments_update',
    'Update a department',
    {
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('departments', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'departments_delete',
    'Delete a department',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('departments', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'feature_flags_list',
    'List feature flags',
    {},
    async () => {
      try {
        const data = await restGet('feature_flags', { order: 'name.asc' });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'feature_flags_toggle',
    'Toggle a feature flag on or off',
    {
      id: z.string(),
      is_enabled: z.boolean(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('feature_flags', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'audit_logs_list',
    'List audit log entries',
    {
      user_id: z.string().optional(),
      limit: z.number().optional(),
    },
    async ({ user_id, limit }) => {
      try {
        const filters: Record<string, string> = {};
        if (user_id) filters['user_id'] = `eq.${user_id}`;
        const data = await restGet('audit_logs', {
          filters,
          order: 'created_at.desc',
          limit: limit || 100,
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'activity_log_list',
    'List user activity log entries',
    {
      user_id: z.string().optional(),
      limit: z.number().optional(),
    },
    async ({ user_id, limit }) => {
      try {
        const filters: Record<string, string> = {};
        if (user_id) filters['user_id'] = `eq.${user_id}`;
        const data = await restGet('activity_log', {
          filters,
          order: 'created_at.desc',
          limit: limit || 100,
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'permissions_list',
    'List all permission definitions',
    {},
    async () => {
      try {
        const data = await restGet('permissions', { order: 'key.asc' });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'user_permission_overrides_list',
    'List per-user permission overrides',
    { user_id: z.string() },
    async ({ user_id }) => {
      try {
        const data = await restGet('user_permission_overrides', {
          select: '*,permission:permissions(id,key,name)',
          filters: { user_id: `eq.${user_id}` },
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'user_permission_overrides_set',
    'Set a per-user permission override',
    {
      user_id: z.string(),
      permission_id: z.string(),
      granted: z.boolean(),
    },
    async (params) => {
      try {
        const data = await restPost('user_permission_overrides', params, 'return=representation,resolution=merge-duplicates');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'user_permission_overrides_delete',
    'Remove a per-user permission override',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('user_permission_overrides', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
