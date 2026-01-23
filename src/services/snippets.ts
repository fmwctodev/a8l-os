import { supabase } from '../lib/supabase';
import type { Snippet, SnippetFilters, SnippetScope, MessageChannel, Contact, CustomField } from '../types';

export async function getSnippets(
  orgId: string,
  filters: SnippetFilters = {}
): Promise<Snippet[]> {
  let query = supabase
    .from('snippets')
    .select(`
      *,
      created_by_user:users!created_by_user_id (
        id, name, email, avatar_url
      ),
      department:departments!department_id (
        id, name
      )
    `)
    .eq('organization_id', orgId)
    .order('name');

  if (filters.scope) {
    query = query.eq('scope', filters.scope);
  }

  if (filters.departmentId) {
    query = query.eq('department_id', filters.departmentId);
  }

  const { data, error } = await query;
  if (error) throw error;

  let snippets = data as Snippet[];

  if (filters.channel) {
    snippets = snippets.filter(s =>
      s.channel_support.includes(filters.channel as MessageChannel)
    );
  }

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    snippets = snippets.filter(s =>
      s.name.toLowerCase().includes(searchLower) ||
      s.content.toLowerCase().includes(searchLower)
    );
  }

  return snippets;
}

export async function getAvailableSnippets(
  orgId: string,
  userId: string,
  departmentId: string | null,
  channel?: MessageChannel
): Promise<Snippet[]> {
  const { data, error } = await supabase
    .from('snippets')
    .select(`
      *,
      created_by_user:users!created_by_user_id (
        id, name, email, avatar_url
      )
    `)
    .eq('organization_id', orgId)
    .eq('is_enabled', true)
    .order('name');

  if (error) throw error;

  let snippets = (data as Snippet[]).filter(s => {
    if (s.scope === 'system') return true;
    if (s.scope === 'personal' && s.created_by_user_id === userId) return true;
    if (s.scope === 'team' && departmentId && s.department_id === departmentId) return true;
    return false;
  });

  if (channel) {
    snippets = snippets.filter(s => s.channel_support.includes(channel));
  }

  return snippets;
}

export async function getSnippetById(id: string): Promise<Snippet | null> {
  const { data, error } = await supabase
    .from('snippets')
    .select(`
      *,
      created_by_user:users!created_by_user_id (
        id, name, email, avatar_url
      ),
      department:departments!department_id (
        id, name
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as Snippet | null;
}

export interface CreateSnippetInput {
  organization_id: string;
  created_by_user_id: string;
  name: string;
  content: string;
  channel_support: MessageChannel[];
  scope: SnippetScope;
  department_id?: string | null;
}

export async function createSnippet(input: CreateSnippetInput): Promise<Snippet> {
  const { data, error } = await supabase
    .from('snippets')
    .insert({
      organization_id: input.organization_id,
      created_by_user_id: input.created_by_user_id,
      name: input.name,
      content: input.content,
      channel_support: input.channel_support,
      scope: input.scope,
      department_id: input.scope === 'team' ? input.department_id : null,
    })
    .select(`
      *,
      created_by_user:users!created_by_user_id (
        id, name, email, avatar_url
      )
    `)
    .single();

  if (error) throw error;
  return data as Snippet;
}

export interface UpdateSnippetInput {
  name?: string;
  content?: string;
  channel_support?: MessageChannel[];
  scope?: SnippetScope;
  department_id?: string | null;
  is_enabled?: boolean;
}

export async function updateSnippet(
  id: string,
  input: UpdateSnippetInput
): Promise<Snippet> {
  const updateData: Record<string, unknown> = { ...input, updated_at: new Date().toISOString() };

  if (input.scope && input.scope !== 'team') {
    updateData.department_id = null;
  }

  const { data, error } = await supabase
    .from('snippets')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      created_by_user:users!created_by_user_id (
        id, name, email, avatar_url
      ),
      department:departments!department_id (
        id, name
      )
    `)
    .single();

  if (error) throw error;
  return data as Snippet;
}

export async function deleteSnippet(id: string): Promise<void> {
  const { error } = await supabase
    .from('snippets')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function toggleSnippetStatus(
  id: string,
  isEnabled: boolean
): Promise<Snippet> {
  return updateSnippet(id, { is_enabled: isEnabled });
}

interface VariableContext {
  contact?: Contact | null;
  customFields?: Record<string, unknown>;
}

export function resolveSnippetVariables(
  content: string,
  context: VariableContext
): string {
  let resolved = content;

  if (context.contact) {
    const contact = context.contact;
    resolved = resolved.replace(/\{\{contact\.first_name\}\}/gi, contact.first_name || '');
    resolved = resolved.replace(/\{\{contact\.last_name\}\}/gi, contact.last_name || '');
    resolved = resolved.replace(/\{\{contact\.email\}\}/gi, contact.email || '');
    resolved = resolved.replace(/\{\{contact\.phone\}\}/gi, contact.phone || '');
    resolved = resolved.replace(/\{\{contact\.company\}\}/gi, contact.company || '');
    resolved = resolved.replace(/\{\{contact\.job_title\}\}/gi, contact.job_title || '');
  }

  if (context.customFields) {
    const customFieldRegex = /\{\{custom\.([a-zA-Z0-9_]+)\}\}/gi;
    resolved = resolved.replace(customFieldRegex, (_, key) => {
      const value = context.customFields?.[key];
      return value != null ? String(value) : '';
    });
  }

  resolved = resolved.replace(/\{\{[^}]+\}\}/g, '');

  return resolved;
}

export function getSnippetVariables(): { contact: string[]; custom: string[] } {
  return {
    contact: ['first_name', 'last_name', 'email', 'phone', 'company', 'job_title'],
    custom: [],
  };
}

export async function getAvailableVariables(
  orgId: string
): Promise<{ contact: string[]; custom: CustomField[] }> {
  const { data: customFields } = await supabase
    .from('custom_fields')
    .select('*')
    .eq('organization_id', orgId)
    .eq('scope', 'contact')
    .eq('active', true)
    .order('display_order');

  return {
    contact: ['first_name', 'last_name', 'email', 'phone', 'company', 'job_title'],
    custom: (customFields as CustomField[]) || [],
  };
}
