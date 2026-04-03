import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { restGet, restPost, restPatch, restDelete } from '../helpers/rest-client.js';
import { toolResult, toolError } from '../helpers/tool-utils.js';

export function registerContactsTools(server: McpServer): void {
  server.tool(
    'contacts_list',
    'List contacts with owner and tags. Supports filtering by status, source, type, owner_id and searching by name/email/company.',
    {
      search: z.string().optional().describe('Search across name, email, company'),
      status: z.string().optional().describe('Filter: eq.active, eq.inactive, etc.'),
      type: z.string().optional().describe('Filter: eq.person or eq.company'),
      source: z.string().optional(),
      owner_id: z.string().optional(),
      order: z.string().optional().describe('e.g. created_at.desc'),
      limit: z.number().optional().describe('Max rows, default 50'),
      offset: z.number().optional(),
    },
    async (params) => {
      try {
        const filters: Record<string, string> = {};
        if (params.search) {
          filters['or'] = `(first_name.ilike.*${params.search}*,last_name.ilike.*${params.search}*,email.ilike.*${params.search}*,company.ilike.*${params.search}*)`;
        }
        if (params.status) filters['status'] = params.status;
        if (params.type) filters['type'] = params.type;
        if (params.source) filters['source'] = params.source;
        if (params.owner_id) filters['owner_id'] = `eq.${params.owner_id}`;
        const data = await restGet('contacts', {
          select: '*,owner:users(id,full_name),tags:contact_tags(tag:tags(id,name,color))',
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
    'contacts_get',
    'Get a single contact by ID with all relations (owner, tags, notes, tasks)',
    { id: z.string().describe('Contact UUID') },
    async ({ id }) => {
      try {
        const data = await restGet('contacts', {
          select: '*,owner:users(id,full_name),tags:contact_tags(tag:tags(id,name,color)),notes:contact_notes(*),tasks:contact_tasks(*)',
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
    'contacts_create',
    'Create a new contact record',
    {
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      company: z.string().optional(),
      type: z.enum(['person', 'company']).optional(),
      status: z.string().optional(),
      source: z.string().optional(),
      owner_id: z.string().optional(),
      organization_id: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('contacts', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'contacts_update',
    'Update an existing contact by ID',
    {
      id: z.string(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      company: z.string().optional(),
      type: z.string().optional(),
      status: z.string().optional(),
      source: z.string().optional(),
      owner_id: z.string().optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('contacts', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'contacts_delete',
    'Delete a contact by ID',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('contacts', { id: `eq.${id}` });
        return toolResult({ success: true, message: 'Contact deleted' });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'contacts_bulk_assign_owner',
    'Bulk assign owner to multiple contacts',
    {
      contact_ids: z.array(z.string()).describe('Array of contact UUIDs'),
      owner_id: z.string().describe('New owner UUID'),
    },
    async ({ contact_ids, owner_id }) => {
      try {
        const data = await restPatch(
          'contacts',
          { id: `in.(${contact_ids.join(',')})` },
          { owner_id },
          'return=representation',
        );
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'contact_notes_list',
    'List notes for a specific contact',
    {
      contact_id: z.string(),
      order: z.string().optional(),
      limit: z.number().optional(),
    },
    async ({ contact_id, order, limit }) => {
      try {
        const data = await restGet('contact_notes', {
          filters: { contact_id: `eq.${contact_id}` },
          order: order || 'created_at.desc',
          limit: limit || 50,
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'contact_notes_create',
    'Create a note on a contact',
    {
      contact_id: z.string(),
      content: z.string(),
      note_type: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('contact_notes', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'contact_notes_update',
    'Update a contact note',
    { id: z.string(), content: z.string().optional() },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('contact_notes', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'contact_notes_delete',
    'Delete a contact note',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('contact_notes', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'contact_tasks_list',
    'List tasks for a specific contact',
    {
      contact_id: z.string(),
      order: z.string().optional(),
      limit: z.number().optional(),
    },
    async ({ contact_id, order, limit }) => {
      try {
        const data = await restGet('contact_tasks', {
          filters: { contact_id: `eq.${contact_id}` },
          order: order || 'due_date.asc',
          limit: limit || 50,
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'contact_tasks_create',
    'Create a task on a contact',
    {
      contact_id: z.string(),
      title: z.string(),
      description: z.string().optional(),
      due_date: z.string().optional(),
      status: z.string().optional(),
      assigned_to: z.string().optional(),
    },
    async (params) => {
      try {
        const data = await restPost('contact_tasks', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'contact_tasks_update',
    'Update a contact task',
    {
      id: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      due_date: z.string().optional(),
      status: z.string().optional(),
      assigned_to: z.string().optional(),
    },
    async ({ id, ...body }) => {
      try {
        const data = await restPatch('contact_tasks', { id: `eq.${id}` }, body, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'contact_tasks_delete',
    'Delete a contact task',
    { id: z.string() },
    async ({ id }) => {
      try {
        await restDelete('contact_tasks', { id: `eq.${id}` });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'tags_list',
    'List all available tags',
    { limit: z.number().optional() },
    async ({ limit }) => {
      try {
        const data = await restGet('tags', { order: 'name.asc', limit: limit || 100 });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'tags_create',
    'Create a new tag',
    { name: z.string(), color: z.string().optional() },
    async (params) => {
      try {
        const data = await restPost('tags', params, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'contact_tags_add',
    'Add tags to contacts (supports bulk)',
    {
      items: z.array(z.object({ contact_id: z.string(), tag_id: z.string() })),
    },
    async ({ items }) => {
      try {
        const data = await restPost('contact_tags', items, 'return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'contact_tags_remove',
    'Remove a tag from a contact',
    { contact_id: z.string(), tag_id: z.string() },
    async ({ contact_id, tag_id }) => {
      try {
        await restDelete('contact_tags', {
          contact_id: `eq.${contact_id}`,
          tag_id: `eq.${tag_id}`,
        });
        return toolResult({ success: true });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'custom_fields_list',
    'List custom field definitions for an entity type',
    { entity_type: z.string().optional().describe('e.g. contact, opportunity') },
    async ({ entity_type }) => {
      try {
        const filters: Record<string, string> = {};
        if (entity_type) filters['entity_type'] = `eq.${entity_type}`;
        const data = await restGet('custom_fields', {
          filters,
          order: 'sort_order.asc',
        });
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'custom_field_values_set',
    'Set a custom field value on an entity (upsert)',
    {
      custom_field_id: z.string(),
      entity_id: z.string(),
      value: z.string(),
    },
    async (params) => {
      try {
        const data = await restPost('custom_field_values', params, 'resolution=merge-duplicates,return=representation');
        return toolResult(data);
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
