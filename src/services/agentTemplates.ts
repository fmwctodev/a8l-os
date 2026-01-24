import { supabase } from '../lib/supabase';
import type {
  AgentTemplate,
  CreateAgentTemplateInput,
  UpdateAgentTemplateInput,
  AgentTemplateFilters,
} from '../types';

export async function getTemplates(
  orgId: string,
  filters?: AgentTemplateFilters
): Promise<AgentTemplate[]> {
  let query = supabase
    .from('agent_templates')
    .select(`
      *,
      created_by_user:users!agent_templates_created_by_user_id_fkey(id, name, email)
    `)
    .eq('org_id', orgId)
    .order('times_used', { ascending: false });

  if (filters?.agentType) {
    query = query.eq('agent_type', filters.agentType);
  }
  if (filters?.useCase) {
    query = query.eq('use_case', filters.useCase);
  }
  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function getTemplateById(id: string): Promise<AgentTemplate | null> {
  const { data, error } = await supabase
    .from('agent_templates')
    .select(`
      *,
      created_by_user:users!agent_templates_created_by_user_id_fkey(id, name, email)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createTemplate(
  orgId: string,
  input: CreateAgentTemplateInput,
  userId: string
): Promise<AgentTemplate> {
  const { data, error } = await supabase
    .from('agent_templates')
    .insert({
      org_id: orgId,
      name: input.name,
      description: input.description || null,
      agent_type: input.agentType,
      use_case: input.useCase || null,
      template_config: input.templateConfig,
      is_public: input.isPublic ?? false,
      created_by_user_id: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createTemplateFromAgent(
  orgId: string,
  agentId: string,
  templateName: string,
  templateDescription: string,
  useCase: string,
  userId: string
): Promise<AgentTemplate> {
  const { data: agent, error: agentError } = await supabase
    .from('ai_agents')
    .select('*')
    .eq('id', agentId)
    .single();

  if (agentError) throw agentError;

  const templateConfig = {
    name: agent.name,
    description: agent.description,
    system_prompt: agent.system_prompt,
    allowed_tools: agent.allowed_tools,
    allowed_channels: agent.allowed_channels,
    temperature: agent.temperature,
    max_tokens: agent.max_tokens,
    agent_type: agent.agent_type,
    voice_provider: agent.voice_provider,
    speaking_speed: agent.speaking_speed,
    voice_tone: agent.voice_tone,
    requires_approval: agent.requires_approval,
    auto_reply_enabled: agent.auto_reply_enabled,
    cooldown_minutes: agent.cooldown_minutes,
    max_messages_per_day: agent.max_messages_per_day,
    per_channel_rules: agent.per_channel_rules,
  };

  return createTemplate(
    orgId,
    {
      name: templateName,
      description: templateDescription,
      agentType: agent.agent_type,
      useCase,
      templateConfig,
      isPublic: false,
    },
    userId
  );
}

export async function updateTemplate(
  id: string,
  input: UpdateAgentTemplateInput
): Promise<AgentTemplate> {
  const updates: Record<string, unknown> = {};

  if (input.name !== undefined) {
    updates.name = input.name;
  }
  if (input.description !== undefined) {
    updates.description = input.description || null;
  }
  if (input.useCase !== undefined) {
    updates.use_case = input.useCase || null;
  }
  if (input.templateConfig !== undefined) {
    updates.template_config = input.templateConfig;
  }
  if (input.isPublic !== undefined) {
    updates.is_public = input.isPublic;
  }

  const { data, error } = await supabase
    .from('agent_templates')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('agent_templates')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function incrementUsageCount(id: string): Promise<void> {
  const { error } = await supabase.rpc('increment_template_usage', {
    template_id: id,
  });

  if (error) {
    const { data: template } = await supabase
      .from('agent_templates')
      .select('times_used')
      .eq('id', id)
      .single();

    if (template) {
      await supabase
        .from('agent_templates')
        .update({ times_used: template.times_used + 1 })
        .eq('id', id);
    }
  }
}

export async function useTemplate(
  templateId: string
): Promise<Record<string, unknown>> {
  const template = await getTemplateById(templateId);

  if (!template) {
    throw new Error('Template not found');
  }

  await incrementUsageCount(templateId);

  return template.template_config as Record<string, unknown>;
}

export async function duplicateTemplate(
  templateId: string,
  newName: string,
  userId: string
): Promise<AgentTemplate> {
  const template = await getTemplateById(templateId);

  if (!template) {
    throw new Error('Template not found');
  }

  const { data, error } = await supabase
    .from('agent_templates')
    .insert({
      org_id: template.org_id,
      name: newName,
      description: template.description,
      agent_type: template.agent_type,
      use_case: template.use_case,
      template_config: template.template_config,
      is_public: false,
      created_by_user_id: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
