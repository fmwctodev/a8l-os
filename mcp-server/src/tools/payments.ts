import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { restGet, restPost, restPatch, restDelete } from '../helpers/rest-client.js';
import { callEdgeFunction } from '../helpers/edge-client.js';
import { toolResult, toolError } from '../helpers/tool-utils.js';

export function registerPaymentsTools(server: McpServer): void {
  server.tool(
    'products_list',
    'List products/services',
    { limit: z.number().optional() },
    async ({ limit }) => {
      try {
        const data = await restGet('products', { order: 'name.asc', limit: limit || 100 });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'products_create',
    'Create a product or service',
    {
      name: z.string(),
      description: z.string().optional(),
      price: z.number().optional(),
      type: z.string().optional(),
      is_active: z.boolean().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('products', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'products_update',
    'Update a product',
    {
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      price: z.number().optional(),
      is_active: z.boolean().optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('products', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'products_delete',
    'Delete a product',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('products', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'invoices_list',
    'List invoices with contact and line items. Filter by status, contact_id.',
    {
      status: z.string().optional().describe('eq.draft, eq.sent, eq.paid, eq.overdue'),
      contact_id: z.string().optional(),
      order: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    },
    async (params) => {
      try {
        const filters: Record<string, string> = {};
        if (params.status) filters['status'] = params.status;
        if (params.contact_id) filters['contact_id'] = `eq.${params.contact_id}`;
        const data = await restGet('invoices', {
          select: '*,contact:contacts(id,first_name,last_name,email,company),line_items:invoice_line_items(*)',
          filters,
          order: params.order || 'created_at.desc',
          limit: params.limit || 50,
          offset: params.offset,
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'invoices_get',
    'Get invoice detail with line items and payments',
    { id: z.string() },
    async ({ id }) => {
      try {
        const data = await restGet('invoices', {
          select: '*,contact:contacts(*),line_items:invoice_line_items(*),payments:payments(*)',
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
    'invoices_create',
    'Create an invoice',
    {
      contact_id: z.string(),
      invoice_number: z.string().optional(),
      due_date: z.string().optional(),
      status: z.string().optional(),
      notes: z.string().optional(),
      organization_id: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('invoices', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'invoices_update',
    'Update an invoice',
    {
      id: z.string(),
      status: z.string().optional(),
      due_date: z.string().optional(),
      notes: z.string().optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('invoices', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'invoices_delete',
    'Delete an invoice',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('invoices', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'payments_list',
    'List payments. Filter by invoice_id.',
    { invoice_id: z.string().optional(), limit: z.number().optional() },
    async ({ invoice_id, limit }) => {
      try {
        const filters: Record<string, string> = {};
        if (invoice_id) filters['invoice_id'] = `eq.${invoice_id}`;
        const data = await restGet('payments', {
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
    'payments_record',
    'Record a payment against an invoice',
    {
      invoice_id: z.string(),
      amount: z.number(),
      payment_method: z.string().optional(),
      payment_date: z.string().optional(),
      reference: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('payments', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'qbo_api',
    'QuickBooks Online API operations. Actions: find_or_create_customer, create_item, create_invoice, send_invoice, get_invoice, void_invoice, list_items, sync_invoices, getPayment',
    {
      action: z.string().describe('API action name'),
      payload: z.record(z.unknown()).optional().describe('Action-specific parameters'),
    },
    async ({ action, payload }) => {
      try {
        const data = await callEdgeFunction('qbo-api', { action, ...payload });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'recurring_invoice_generate',
    'Generate invoices from recurring profiles',
    { profile_id: z.string().optional() },
    async (params) => {
      try {
        const data = await callEdgeFunction('recurring-invoice-generator', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'payment_reminder_send',
    'Send payment reminders for overdue invoices',
    { invoice_id: z.string().optional() },
    async (params) => {
      try {
        const data = await callEdgeFunction('payment-reminder-scheduler', params);
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
