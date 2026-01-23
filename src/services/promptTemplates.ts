import { supabase } from '../lib/supabase';
import type {
  PromptTemplate,
  PromptTemplateVersion,
  PromptTemplateFilters,
  CreatePromptTemplateInput,
  UpdatePromptTemplateInput,
  CreatePromptVersionInput,
} from '../types';

export async function getTemplates(
  orgId: string,
  filters?: PromptTemplateFilters
): Promise<PromptTemplate[]> {
  let query = supabase
    .from('prompt_templates')
    .select(`
      *,
      created_by_user:users!prompt_templates_created_by_fkey(id, name, email)
    `)
    .eq('org_id', orgId)
    .order('name');

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.category) {
    query = query.eq('category', filters.category);
  }
  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) throw error;

  const templatesWithVersions = await Promise.all(
    (data || []).map(async (template) => {
      const latestVersion = await getLatestVersion(template.id);
      const agentCount = await getAgentCount(template.id);
      return {
        ...template,
        latest_version: latestVersion,
        agent_count: agentCount,
      };
    })
  );

  return templatesWithVersions;
}

export async function getTemplateById(id: string): Promise<PromptTemplate | null> {
  const { data, error } = await supabase
    .from('prompt_templates')
    .select(`
      *,
      created_by_user:users!prompt_templates_created_by_fkey(id, name, email)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;

  if (data) {
    const latestVersion = await getLatestVersion(id);
    const agentCount = await getAgentCount(id);
    return {
      ...data,
      latest_version: latestVersion,
      agent_count: agentCount,
    };
  }

  return null;
}

export async function createTemplate(
  orgId: string,
  input: CreatePromptTemplateInput,
  userId: string
): Promise<PromptTemplate> {
  const { data, error } = await supabase
    .from('prompt_templates')
    .insert({
      org_id: orgId,
      name: input.name,
      category: input.category,
      status: input.status || 'active',
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;

  await createVersion(data.id, { body: input.body }, userId);

  return getTemplateById(data.id) as Promise<PromptTemplate>;
}

export async function updateTemplate(
  id: string,
  input: UpdatePromptTemplateInput
): Promise<PromptTemplate> {
  const updates: Record<string, unknown> = {};

  if (input.name !== undefined) {
    updates.name = input.name;
  }
  if (input.category !== undefined) {
    updates.category = input.category;
  }
  if (input.status !== undefined) {
    updates.status = input.status;
  }

  const { error } = await supabase
    .from('prompt_templates')
    .update(updates)
    .eq('id', id);

  if (error) throw error;

  return getTemplateById(id) as Promise<PromptTemplate>;
}

export async function toggleTemplateStatus(
  id: string,
  status: 'active' | 'inactive'
): Promise<PromptTemplate> {
  return updateTemplate(id, { status });
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('prompt_templates')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getVersions(templateId: string): Promise<PromptTemplateVersion[]> {
  const { data, error } = await supabase
    .from('prompt_template_versions')
    .select(`
      *,
      created_by_user:users!prompt_template_versions_created_by_fkey(id, name, email)
    `)
    .eq('template_id', templateId)
    .order('version_number', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getLatestVersion(templateId: string): Promise<PromptTemplateVersion | null> {
  const { data, error } = await supabase
    .from('prompt_template_versions')
    .select(`
      *,
      created_by_user:users!prompt_template_versions_created_by_fkey(id, name, email)
    `)
    .eq('template_id', templateId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getVersionById(id: string): Promise<PromptTemplateVersion | null> {
  const { data, error } = await supabase
    .from('prompt_template_versions')
    .select(`
      *,
      created_by_user:users!prompt_template_versions_created_by_fkey(id, name, email)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createVersion(
  templateId: string,
  input: CreatePromptVersionInput,
  userId: string
): Promise<PromptTemplateVersion> {
  const { data: nextVersion } = await supabase
    .rpc('get_next_prompt_version', { p_template_id: templateId });

  const { data, error } = await supabase
    .from('prompt_template_versions')
    .insert({
      template_id: templateId,
      version_number: nextVersion || 1,
      body: input.body,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getAgentCount(templateId: string): Promise<number> {
  const { count, error } = await supabase
    .from('agent_prompt_links')
    .select('*', { count: 'exact', head: true })
    .eq('template_id', templateId);

  if (error) return 0;
  return count || 0;
}

export async function getAgentTemplates(agentId: string): Promise<PromptTemplate[]> {
  const { data, error } = await supabase
    .from('agent_prompt_links')
    .select(`
      sort_order,
      template:prompt_templates(
        *,
        created_by_user:users!prompt_templates_created_by_fkey(id, name, email)
      )
    `)
    .eq('agent_id', agentId)
    .order('sort_order');

  if (error) throw error;

  return (data || [])
    .map(link => link.template)
    .filter((t): t is PromptTemplate => t !== null);
}

export async function linkTemplateToAgent(
  agentId: string,
  templateId: string,
  sortOrder: number
): Promise<void> {
  const { error } = await supabase
    .from('agent_prompt_links')
    .insert({
      agent_id: agentId,
      template_id: templateId,
      sort_order: sortOrder,
    })
    .select();

  if (error && !error.message.includes('duplicate')) throw error;
}

export async function unlinkTemplateFromAgent(
  agentId: string,
  templateId: string
): Promise<void> {
  const { error } = await supabase
    .from('agent_prompt_links')
    .delete()
    .eq('agent_id', agentId)
    .eq('template_id', templateId);

  if (error) throw error;
}

export async function setAgentTemplates(
  agentId: string,
  templateIds: string[]
): Promise<void> {
  await supabase
    .from('agent_prompt_links')
    .delete()
    .eq('agent_id', agentId);

  if (templateIds.length > 0) {
    const links = templateIds.map((templateId, index) => ({
      agent_id: agentId,
      template_id: templateId,
      sort_order: index,
    }));

    const { error } = await supabase
      .from('agent_prompt_links')
      .insert(links);

    if (error) throw error;
  }
}

export async function reorderAgentTemplates(
  agentId: string,
  templateIds: string[]
): Promise<void> {
  await setAgentTemplates(agentId, templateIds);
}

export function parseVariables(body: string): string[] {
  const regex = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
  const variables: string[] = [];
  let match;

  while ((match = regex.exec(body)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }

  return variables;
}

export function renderTemplate(
  body: string,
  variables: Record<string, string>
): string {
  let rendered = body;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    rendered = rendered.replace(regex, value);
  }

  return rendered;
}
