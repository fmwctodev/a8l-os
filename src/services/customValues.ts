import { supabase } from '../lib/supabase';

export interface CustomValue {
  id: string;
  org_id: string;
  category_id: string | null;
  name: string;
  key: string;
  value: string;
  available_in_emails: boolean;
  available_in_sms: boolean;
  available_in_automations: boolean;
  available_in_ai_prompts: boolean;
  available_in_proposals: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  custom_value_categories?: CustomValueCategory | null;
}

export interface CustomValueCategory {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  value_count?: number;
}

export interface CustomValueFilters {
  category_id?: string;
  search?: string;
  context?: 'emails' | 'sms' | 'automations' | 'ai_prompts' | 'proposals';
}

export interface CreateCustomValueInput {
  name: string;
  key?: string;
  value: string;
  category_id?: string | null;
  available_in_emails?: boolean;
  available_in_sms?: boolean;
  available_in_automations?: boolean;
  available_in_ai_prompts?: boolean;
  available_in_proposals?: boolean;
}

export interface UpdateCustomValueInput {
  name?: string;
  value?: string;
  category_id?: string | null;
  available_in_emails?: boolean;
  available_in_sms?: boolean;
  available_in_automations?: boolean;
  available_in_ai_prompts?: boolean;
  available_in_proposals?: boolean;
}

export interface CreateCategoryInput {
  name: string;
  description?: string;
  sort_order?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string | null;
  sort_order?: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export function nameToKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 50);
}

export function formatTokenKey(key: string): string {
  return `{{custom.${key}}}`;
}

export async function getCustomValues(
  orgId: string,
  filters?: CustomValueFilters,
  pagination?: PaginationParams
): Promise<PaginatedResponse<CustomValue>> {
  const page = pagination?.page || 1;
  const limit = pagination?.limit || 20;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('custom_values')
    .select('*, custom_value_categories(*)', { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (filters?.category_id) {
    query = query.eq('category_id', filters.category_id);
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,key.ilike.%${filters.search}%,value.ilike.%${filters.search}%`);
  }

  if (filters?.context) {
    const contextColumn = `available_in_${filters.context}`;
    query = query.eq(contextColumn, true);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    data: data || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / limit),
    },
  };
}

export async function getCustomValueById(
  orgId: string,
  valueId: string
): Promise<CustomValue | null> {
  const { data, error } = await supabase
    .from('custom_values')
    .select('*, custom_value_categories(*)')
    .eq('org_id', orgId)
    .eq('id', valueId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getCustomValueByKey(
  orgId: string,
  key: string
): Promise<CustomValue | null> {
  const { data, error } = await supabase
    .from('custom_values')
    .select('*, custom_value_categories(*)')
    .eq('org_id', orgId)
    .eq('key', key)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createCustomValue(
  orgId: string,
  userId: string,
  input: CreateCustomValueInput
): Promise<CustomValue> {
  const key = input.key || nameToKey(input.name);

  const { data: existing } = await supabase
    .from('custom_values')
    .select('id')
    .eq('org_id', orgId)
    .eq('key', key)
    .maybeSingle();

  if (existing) {
    throw new Error(`A custom value with key "${key}" already exists`);
  }

  const { data, error } = await supabase
    .from('custom_values')
    .insert({
      org_id: orgId,
      name: input.name,
      key,
      value: input.value,
      category_id: input.category_id || null,
      available_in_emails: input.available_in_emails ?? true,
      available_in_sms: input.available_in_sms ?? true,
      available_in_automations: input.available_in_automations ?? true,
      available_in_ai_prompts: input.available_in_ai_prompts ?? true,
      available_in_proposals: input.available_in_proposals ?? true,
      created_by: userId,
      updated_by: userId,
    })
    .select('*, custom_value_categories(*)')
    .single();

  if (error) throw error;
  return data;
}

export async function updateCustomValue(
  orgId: string,
  userId: string,
  valueId: string,
  input: UpdateCustomValueInput
): Promise<CustomValue> {
  const { data, error } = await supabase
    .from('custom_values')
    .update({
      ...input,
      updated_by: userId,
    })
    .eq('org_id', orgId)
    .eq('id', valueId)
    .select('*, custom_value_categories(*)')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCustomValue(
  orgId: string,
  valueId: string
): Promise<void> {
  const { error } = await supabase
    .from('custom_values')
    .delete()
    .eq('org_id', orgId)
    .eq('id', valueId);

  if (error) throw error;
}

export async function duplicateCustomValue(
  orgId: string,
  userId: string,
  valueId: string
): Promise<CustomValue> {
  const original = await getCustomValueById(orgId, valueId);
  if (!original) {
    throw new Error('Custom value not found');
  }

  let newKey = `${original.key}_copy`;
  let suffix = 1;

  while (true) {
    const { data: existing } = await supabase
      .from('custom_values')
      .select('id')
      .eq('org_id', orgId)
      .eq('key', newKey)
      .maybeSingle();

    if (!existing) break;
    suffix++;
    newKey = `${original.key}_copy_${suffix}`;
  }

  return createCustomValue(orgId, userId, {
    name: `${original.name} (Copy)`,
    key: newKey,
    value: original.value,
    category_id: original.category_id,
    available_in_emails: original.available_in_emails,
    available_in_sms: original.available_in_sms,
    available_in_automations: original.available_in_automations,
    available_in_ai_prompts: original.available_in_ai_prompts,
    available_in_proposals: original.available_in_proposals,
  });
}

export async function getCategories(orgId: string): Promise<CustomValueCategory[]> {
  const { data: categories, error: catError } = await supabase
    .from('custom_value_categories')
    .select('*')
    .eq('org_id', orgId)
    .order('sort_order', { ascending: true });

  if (catError) throw catError;

  const { data: counts, error: countError } = await supabase
    .from('custom_values')
    .select('category_id')
    .eq('org_id', orgId);

  if (countError) throw countError;

  const countMap: Record<string, number> = {};
  counts?.forEach(v => {
    if (v.category_id) {
      countMap[v.category_id] = (countMap[v.category_id] || 0) + 1;
    }
  });

  return (categories || []).map(cat => ({
    ...cat,
    value_count: countMap[cat.id] || 0,
  }));
}

export async function createCategory(
  orgId: string,
  input: CreateCategoryInput
): Promise<CustomValueCategory> {
  const { data: maxOrder } = await supabase
    .from('custom_value_categories')
    .select('sort_order')
    .eq('org_id', orgId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = input.sort_order ?? ((maxOrder?.sort_order || 0) + 1);

  const { data, error } = await supabase
    .from('custom_value_categories')
    .insert({
      org_id: orgId,
      name: input.name,
      description: input.description || null,
      sort_order: sortOrder,
    })
    .select()
    .single();

  if (error) throw error;
  return { ...data, value_count: 0 };
}

export async function updateCategory(
  orgId: string,
  categoryId: string,
  input: UpdateCategoryInput
): Promise<CustomValueCategory> {
  const { data, error } = await supabase
    .from('custom_value_categories')
    .update(input)
    .eq('org_id', orgId)
    .eq('id', categoryId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCategory(
  orgId: string,
  categoryId: string
): Promise<void> {
  const { data: values } = await supabase
    .from('custom_values')
    .select('id')
    .eq('org_id', orgId)
    .eq('category_id', categoryId)
    .limit(1);

  if (values && values.length > 0) {
    throw new Error('Cannot delete category that contains values. Move or delete the values first.');
  }

  const { error } = await supabase
    .from('custom_value_categories')
    .delete()
    .eq('org_id', orgId)
    .eq('id', categoryId);

  if (error) throw error;
}

export async function reorderCategories(
  orgId: string,
  orderedIds: string[]
): Promise<void> {
  const updates = orderedIds.map((id, index) => ({
    id,
    org_id: orgId,
    sort_order: index + 1,
  }));

  for (const update of updates) {
    const { error } = await supabase
      .from('custom_value_categories')
      .update({ sort_order: update.sort_order })
      .eq('org_id', orgId)
      .eq('id', update.id);

    if (error) throw error;
  }
}

const CUSTOM_VALUE_PATTERN = /\{\{custom\.([a-z0-9_]+)\}\}/gi;

export async function resolveCustomValuesInText(
  text: string,
  orgId: string
): Promise<string> {
  const matches = text.match(CUSTOM_VALUE_PATTERN);
  if (!matches || matches.length === 0) {
    return text;
  }

  const uniqueKeys = [...new Set(matches.map(m => {
    const match = /\{\{custom\.([a-z0-9_]+)\}\}/i.exec(m);
    return match ? match[1].toLowerCase() : null;
  }).filter(Boolean))] as string[];

  const { data: values, error } = await supabase
    .from('custom_values')
    .select('key, value')
    .eq('org_id', orgId)
    .in('key', uniqueKeys);

  if (error) {
    console.error('Error fetching custom values for resolution:', error);
    return text;
  }

  const valueMap: Record<string, string> = {};
  values?.forEach(v => {
    valueMap[v.key.toLowerCase()] = v.value;
  });

  return text.replace(CUSTOM_VALUE_PATTERN, (match, key) => {
    const lowerKey = key.toLowerCase();
    return valueMap[lowerKey] !== undefined ? valueMap[lowerKey] : match;
  });
}

export async function getAvailableCustomValues(
  orgId: string,
  context: 'emails' | 'sms' | 'automations' | 'ai_prompts' | 'proposals'
): Promise<CustomValue[]> {
  const contextColumn = `available_in_${context}`;

  const { data, error } = await supabase
    .from('custom_values')
    .select('*, custom_value_categories(*)')
    .eq('org_id', orgId)
    .eq(contextColumn, true)
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getCustomValueUsageCount(
  orgId: string,
  valueId: string
): Promise<{ total: number; details: { type: string; count: number }[] }> {
  const value = await getCustomValueById(orgId, valueId);
  if (!value) {
    return { total: 0, details: [] };
  }

  const token = formatTokenKey(value.key);
  const details: { type: string; count: number }[] = [];

  const { data: workflows, error: wfError } = await supabase
    .from('workflows')
    .select('id, nodes')
    .eq('org_id', orgId);

  if (!wfError && workflows) {
    let workflowCount = 0;
    workflows.forEach(wf => {
      const nodesStr = JSON.stringify(wf.nodes || {});
      if (nodesStr.includes(token) || nodesStr.includes(`custom.${value.key}`)) {
        workflowCount++;
      }
    });
    if (workflowCount > 0) {
      details.push({ type: 'automations', count: workflowCount });
    }
  }

  const { data: snippets, error: snipError } = await supabase
    .from('snippets')
    .select('id, content')
    .eq('org_id', orgId);

  if (!snipError && snippets) {
    let snippetCount = 0;
    snippets.forEach(s => {
      if (s.content?.includes(token) || s.content?.includes(`custom.${value.key}`)) {
        snippetCount++;
      }
    });
    if (snippetCount > 0) {
      details.push({ type: 'snippets', count: snippetCount });
    }
  }

  const { data: agents, error: agentError } = await supabase
    .from('ai_agents')
    .select('id, system_prompt, knowledge_context')
    .eq('org_id', orgId);

  if (!agentError && agents) {
    let agentCount = 0;
    agents.forEach(a => {
      const combined = (a.system_prompt || '') + (a.knowledge_context || '');
      if (combined.includes(token) || combined.includes(`custom.${value.key}`)) {
        agentCount++;
      }
    });
    if (agentCount > 0) {
      details.push({ type: 'ai_agents', count: agentCount });
    }
  }

  const total = details.reduce((sum, d) => sum + d.count, 0);

  return { total, details };
}
