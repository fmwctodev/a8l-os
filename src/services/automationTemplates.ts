import { supabase } from '../lib/supabase';
import type {
  AutomationTemplate,
  AutomationTemplateVersion,
  AutomationTemplateInstance,
  WorkflowDefinition,
  Workflow,
  TemplateFilters
} from '../types';

const DEFAULT_DEFINITION: WorkflowDefinition = {
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 }
};

export async function getAutomationTemplates(
  orgId: string,
  filters: TemplateFilters = {}
): Promise<AutomationTemplate[]> {
  let query = supabase
    .from('automation_templates')
    .select('*')
    .order('use_count', { ascending: false });

  if (filters.systemOnly) {
    query = query.eq('is_system', true);
  } else {
    query = query.or(`is_system.eq.true,org_id.eq.${orgId}`);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  } else {
    query = query.neq('status', 'archived');
  }

  if (filters.category) {
    query = query.eq('category', filters.category);
  }

  if (filters.complexity) {
    query = query.eq('complexity', filters.complexity);
  }

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  if (filters.channel) {
    query = query.contains('channel_tags', [filters.channel]);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as AutomationTemplate[];
}

export async function getAutomationTemplateById(
  id: string
): Promise<AutomationTemplate | null> {
  const { data, error } = await supabase
    .from('automation_templates')
    .select(`
      *,
      created_by:users!created_by_user_id(id, name, email)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const template = data as AutomationTemplate;

  const { data: latestVersion } = await supabase
    .from('automation_template_versions')
    .select('*')
    .eq('template_id', id)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestVersion) {
    template.latest_version = latestVersion as AutomationTemplateVersion;
  }

  const { count } = await supabase
    .from('automation_template_instances')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', id);

  template.instance_count = count || 0;

  return template;
}

export async function getAutomationTemplateVersions(
  templateId: string
): Promise<AutomationTemplateVersion[]> {
  const { data, error } = await supabase
    .from('automation_template_versions')
    .select(`
      *,
      created_by:users!created_by_user_id(id, name, email)
    `)
    .eq('template_id', templateId)
    .order('version_number', { ascending: false });

  if (error) throw error;
  return (data || []) as AutomationTemplateVersion[];
}

export async function createAutomationTemplate(
  orgId: string,
  name: string,
  description: string | null,
  category: string,
  userId: string
): Promise<AutomationTemplate> {
  const { data, error } = await supabase
    .from('automation_templates')
    .insert({
      org_id: orgId,
      name,
      description,
      category,
      is_system: false,
      status: 'draft',
      created_by_user_id: userId
    })
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from('automation_template_versions')
    .insert({
      template_id: data.id,
      version_number: 1,
      definition_snapshot: DEFAULT_DEFINITION,
      change_summary: 'Initial version',
      created_by_user_id: userId
    });

  return data as AutomationTemplate;
}

export async function updateAutomationTemplateDraft(
  templateId: string,
  definition: WorkflowDefinition,
  userId: string
): Promise<AutomationTemplateVersion> {
  const { data: latestVersion } = await supabase
    .from('automation_template_versions')
    .select('version_number')
    .eq('template_id', templateId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latestVersion?.version_number || 0) + 1;

  const { data, error } = await supabase
    .from('automation_template_versions')
    .insert({
      template_id: templateId,
      version_number: nextVersion,
      definition_snapshot: definition,
      change_summary: 'Draft update',
      created_by_user_id: userId
    })
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from('automation_templates')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', templateId);

  return data as AutomationTemplateVersion;
}

export async function publishAutomationTemplate(
  templateId: string,
  userId: string,
  changeSummary: string
): Promise<AutomationTemplate> {
  const { data: latestVersion } = await supabase
    .from('automation_template_versions')
    .select('*')
    .eq('template_id', templateId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestVersion) throw new Error('No version found for template');

  const nextVersion = latestVersion.version_number + 1;

  await supabase
    .from('automation_template_versions')
    .insert({
      template_id: templateId,
      version_number: nextVersion,
      definition_snapshot: latestVersion.definition_snapshot,
      change_summary: changeSummary,
      created_by_user_id: userId
    });

  const { data, error } = await supabase
    .from('automation_templates')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', templateId)
    .select()
    .single();

  if (error) throw error;
  return data as AutomationTemplate;
}

export async function archiveAutomationTemplate(
  templateId: string
): Promise<void> {
  const { error } = await supabase
    .from('automation_templates')
    .update({
      status: 'archived',
      updated_at: new Date().toISOString()
    })
    .eq('id', templateId);

  if (error) throw error;
}

export async function duplicateAutomationTemplate(
  templateId: string,
  orgId: string,
  userId: string
): Promise<AutomationTemplate> {
  const source = await getAutomationTemplateById(templateId);
  if (!source) throw new Error('Template not found');

  const { data, error } = await supabase
    .from('automation_templates')
    .insert({
      org_id: orgId,
      name: `${source.name} (Copy)`,
      description: source.description,
      category: source.category,
      icon_name: source.icon_name,
      channel_tags: source.channel_tags,
      estimated_time: source.estimated_time,
      complexity: source.complexity,
      is_system: false,
      status: 'draft',
      created_by_user_id: userId
    })
    .select()
    .single();

  if (error) throw error;

  if (source.latest_version) {
    await supabase
      .from('automation_template_versions')
      .insert({
        template_id: data.id,
        version_number: 1,
        definition_snapshot: source.latest_version.definition_snapshot,
        change_summary: `Duplicated from "${source.name}"`,
        created_by_user_id: userId
      });
  }

  return data as AutomationTemplate;
}

export async function instantiateTemplate(
  templateId: string,
  orgId: string,
  userId: string,
  workflowName: string,
  workflowDescription: string | null,
  customizations: Record<string, unknown> = {}
): Promise<Workflow> {
  const template = await getAutomationTemplateById(templateId);
  if (!template) throw new Error('Template not found');
  if (!template.latest_version) throw new Error('Template has no published version');

  const definition = template.latest_version.definition_snapshot;

  const { data: workflow, error: wfError } = await supabase
    .from('workflows')
    .insert({
      org_id: orgId,
      name: workflowName,
      description: workflowDescription,
      status: 'draft',
      draft_definition: definition,
      created_by_user_id: userId
    })
    .select()
    .single();

  if (wfError) throw wfError;

  await supabase
    .from('automation_template_instances')
    .insert({
      template_id: templateId,
      template_version_id: template.latest_version.id,
      workflow_id: workflow.id,
      org_id: orgId,
      created_by_user_id: userId,
      customizations
    });

  await supabase
    .from('automation_templates')
    .update({ use_count: (template.use_count || 0) + 1 })
    .eq('id', templateId);

  return workflow as Workflow;
}

export async function getTemplateInstances(
  templateId: string
): Promise<AutomationTemplateInstance[]> {
  const { data, error } = await supabase
    .from('automation_template_instances')
    .select(`
      *,
      workflow:workflows!workflow_id(id, name, status, published_at, created_at)
    `)
    .eq('template_id', templateId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as AutomationTemplateInstance[];
}

export async function getInstanceByWorkflowId(
  workflowId: string
): Promise<AutomationTemplateInstance | null> {
  const { data, error } = await supabase
    .from('automation_template_instances')
    .select(`
      *,
      template:automation_templates!template_id(id, name, icon_name, category)
    `)
    .eq('workflow_id', workflowId)
    .maybeSingle();

  if (error) throw error;
  return data as AutomationTemplateInstance | null;
}

export async function updateTemplateMetadata(
  templateId: string,
  updates: {
    name?: string;
    description?: string | null;
    category?: string;
    icon_name?: string;
    channel_tags?: string[];
    estimated_time?: string | null;
    complexity?: string;
  }
): Promise<AutomationTemplate> {
  const { data, error } = await supabase
    .from('automation_templates')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', templateId)
    .select()
    .single();

  if (error) throw error;
  return data as AutomationTemplate;
}
