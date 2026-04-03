import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { restGet, restPost, restPatch, restDelete } from '../helpers/rest-client.js';
import { callEdgeFunction } from '../helpers/edge-client.js';
import { toolResult, toolError } from '../helpers/tool-utils.js';

export function registerCalendarsTools(server: McpServer): void {
  server.tool(
    'calendars_list',
    'List calendars',
    {},
    async () => {
      try {
        const data = await restGet('calendars', { order: 'name.asc' });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'appointments_list',
    'List appointments in a date range. Filter by calendar_id, status, contact_id.',
    {
      calendar_id: z.string().optional(),
      contact_id: z.string().optional(),
      status: z.string().optional(),
      start_date: z.string().optional().describe('ISO date, gte filter'),
      end_date: z.string().optional().describe('ISO date, lte filter'),
      order: z.string().optional(),
      limit: z.number().optional(),
    },
    async (params) => {
      try {
        const filters: Record<string, string> = {};
        if (params.calendar_id) filters['calendar_id'] = `eq.${params.calendar_id}`;
        if (params.contact_id) filters['contact_id'] = `eq.${params.contact_id}`;
        if (params.status) filters['status'] = params.status;
        if (params.start_date) filters['start_time'] = `gte.${params.start_date}`;
        if (params.end_date) filters['end_time'] = `lte.${params.end_date}`;
        const data = await restGet('appointments', {
          select: '*,contact:contacts(id,first_name,last_name,email),calendar:calendars(id,name)',
          filters,
          order: params.order || 'start_time.asc',
          limit: params.limit || 50,
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'appointments_get',
    'Get appointment detail',
    { id: z.string() },
    async ({ id }) => {
      try {
        const data = await restGet('appointments', {
          select: '*,contact:contacts(*),calendar:calendars(*)',
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
    'appointments_create',
    'Create an appointment',
    {
      calendar_id: z.string(),
      title: z.string(),
      start_time: z.string(),
      end_time: z.string(),
      contact_id: z.string().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
      appointment_type_id: z.string().optional(),
      organization_id: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('appointments', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'appointments_update',
    'Update an appointment',
    {
      id: z.string(),
      title: z.string().optional(),
      start_time: z.string().optional(),
      end_time: z.string().optional(),
      status: z.string().optional(),
      description: z.string().optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('appointments', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'appointments_delete',
    'Delete/cancel an appointment',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('appointments', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'availability_rules_list',
    'List availability rules for a calendar',
    { calendar_id: z.string() },
    async ({ calendar_id }) => {
      try {
        const data = await restGet('availability_rules', {
          filters: { calendar_id: `eq.${calendar_id}` },
          order: 'day_of_week.asc',
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'availability_rules_create',
    'Create an availability rule',
    {
      calendar_id: z.string(),
      day_of_week: z.number().describe('0=Sunday, 6=Saturday'),
      start_time: z.string().describe('HH:MM format'),
      end_time: z.string().describe('HH:MM format'),
      is_available: z.boolean().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('availability_rules', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'availability_rules_update',
    'Update an availability rule',
    {
      id: z.string(),
      start_time: z.string().optional(),
      end_time: z.string().optional(),
      is_available: z.boolean().optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('availability_rules', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'availability_rules_delete',
    'Delete an availability rule',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('availability_rules', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'booking_api',
    'Public booking API. Actions: getAvailability, createBooking. Pass action and action-specific params.',
    {
      action: z.string(),
      payload: z.record(z.unknown()).optional(),
    },
    async ({ action, payload }) => {
      try {
        const data = await callEdgeFunction('booking-api', { action, ...payload });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'google_calendar_sync',
    'Sync Google Calendar events',
    {
      connection_id: z.string().optional(),
      direction: z.string().optional().describe('both, inbound, or outbound'),
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
    'google_calendar_oauth',
    'Initiate Google Calendar OAuth connection',
    {
      action: z.string().describe('start'),
      redirect_uri: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await callEdgeFunction('google-calendar-oauth', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
