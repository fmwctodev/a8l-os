import { supabase } from '../lib/supabase';
import type { ConditionTemplate, ConditionGroup, EntityType } from '../types/conditions';

export async function getConditionTemplates(orgId: string, options?: { category?: string; entityType?: EntityType; includeSystem?: boolean }): Promise<ConditionTemplate[]> {
  let query = supabase.from('condition_templates').select('*').eq('org_id', orgId).order('usage_count', { ascending: false });
  if (options?.category) query = query.eq('category', options.category);
  if (options?.entityType) query = query.contains('entity_types', [options.entityType]);
  if (options?.includeSystem === false) query = query.eq('is_system', false);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getConditionTemplateById(templateId: string): Promise<ConditionTemplate | null> {
  const { data, error } = await supabase.from('condition_templates').select('*').eq('id', templateId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createConditionTemplate(orgId: string, template: { name: string; description?: string; category: string; conditions: ConditionGroup; entityTypes: EntityType[] }, createdBy?: string): Promise<ConditionTemplate> {
  const { data, error } = await supabase.from('condition_templates').insert({
    org_id: orgId, name: template.name, description: template.description, category: template.category,
    conditions: template.conditions, entity_types: template.entityTypes, is_system: false, created_by: createdBy,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateConditionTemplate(templateId: string, updates: { name?: string; description?: string; category?: string; conditions?: ConditionGroup; entityTypes?: EntityType[] }): Promise<ConditionTemplate> {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.category !== undefined) updateData.category = updates.category;
  if (updates.conditions !== undefined) updateData.conditions = updates.conditions;
  if (updates.entityTypes !== undefined) updateData.entity_types = updates.entityTypes;
  const { data, error } = await supabase.from('condition_templates').update(updateData).eq('id', templateId).eq('is_system', false).select().single();
  if (error) throw error;
  return data;
}

export async function deleteConditionTemplate(templateId: string): Promise<void> {
  const { error } = await supabase.from('condition_templates').delete().eq('id', templateId).eq('is_system', false);
  if (error) throw error;
}

export async function incrementTemplateUsage(templateId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_condition_template_usage', { template_id: templateId });
  if (error) console.error('Failed to increment template usage:', error);
}

export async function duplicateConditionTemplate(templateId: string, newName: string, createdBy?: string): Promise<ConditionTemplate> {
  const original = await getConditionTemplateById(templateId);
  if (!original) throw new Error('Template not found');
  return createConditionTemplate(original.org_id, { name: newName, description: original.description, category: original.category, conditions: original.conditions as ConditionGroup, entityTypes: original.entity_types as EntityType[] }, createdBy);
}

export async function getTemplateCategories(orgId: string): Promise<string[]> {
  const { data, error } = await supabase.from('condition_templates').select('category').eq('org_id', orgId);
  if (error) throw error;
  const categories = new Set<string>();
  data?.forEach(item => categories.add(item.category));
  return Array.from(categories).sort();
}
