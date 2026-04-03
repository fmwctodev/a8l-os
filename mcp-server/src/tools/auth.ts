import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { config } from '../config.js';
import { callEdgeFunction } from '../helpers/edge-client.js';
import { toolResult, toolError } from '../helpers/tool-utils.js';

export function registerAuthTools(server: McpServer): void {
  server.tool(
    'auth_sign_in',
    'Sign in with email and password, returns access and refresh tokens',
    { email: z.string(), password: z.string() },
    async ({ email, password }) => {
      try {
        const res = await fetch(
          `${config.supabaseUrl}/auth/v1/token?grant_type=password`,
          {
            method: 'POST',
            headers: {
              'apikey': config.supabaseAnonKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error_description || data.msg || 'Sign in failed');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'auth_sign_up',
    'Register a new user account',
    { email: z.string(), password: z.string(), full_name: z.string().optional() },
    async ({ email, password, full_name }) => {
      try {
        const body: Record<string, unknown> = { email, password };
        if (full_name) body.data = { full_name };
        const res = await fetch(`${config.supabaseUrl}/auth/v1/signup`, {
          method: 'POST',
          headers: {
            'apikey': config.supabaseAnonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error_description || data.msg || 'Sign up failed');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'auth_refresh_token',
    'Refresh an expired access token using a refresh token',
    { refresh_token: z.string() },
    async ({ refresh_token }) => {
      try {
        const res = await fetch(
          `${config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
          {
            method: 'POST',
            headers: {
              'apikey': config.supabaseAnonKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refresh_token }),
          },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error_description || 'Token refresh failed');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'auth_get_current_user',
    'Get the currently authenticated user profile',
    {},
    async () => {
      try {
        const res = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
          headers: {
            'apikey': config.supabaseAnonKey,
            'Authorization': `Bearer ${config.accessToken}`,
          },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error_description || 'Failed to get user');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'auth_sign_out',
    'Sign out and invalidate the current session',
    {},
    async () => {
      try {
        const res = await fetch(`${config.supabaseUrl}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            'apikey': config.supabaseAnonKey,
            'Authorization': `Bearer ${config.accessToken}`,
          },
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error_description || 'Sign out failed');
        }
        return toolResult({ success: true, message: 'Signed out' });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'auth_bootstrap_admin',
    'Initialize the first admin user and organization for a new instance',
    {
      email: z.string(),
      password: z.string(),
      full_name: z.string(),
      organization_name: z.string(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('bootstrap-admin', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'auth_create_user',
    'Create a new user within an existing organization (admin-only)',
    {
      email: z.string(),
      password: z.string(),
      full_name: z.string(),
      role_id: z.string().optional(),
      department_id: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('create-user', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
