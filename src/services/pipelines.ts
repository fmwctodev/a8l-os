import { supabase } from '../lib/supabase';
import type { Pipeline, PipelineStage, PipelineCustomField, PipelineFilters } from '../types';

export async function getPipelines(filters: PipelineFilters = {}): Promise<Pipeline[]> {
  let query = supabase
    .from('pipelines')
    .select(`
      *,
      department:departments(*),
      stages:pipeline_stages(*)
    `)
    .order('sort_order', { ascending: true });

  if (filters.departmentId) {
    query = query.or(`department_id.eq.${filters.departmentId},department_id.is.null`);
  }

  if (filters.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(p => ({
    ...p,
    stages: (p.stages || []).sort((a: PipelineStage, b: PipelineStage) => a.sort_order - b.sort_order)
  }));
}

export async function getPipelineById(id: string): Promise<Pipeline | null> {
  const { data, error } = await supabase
    .from('pipelines')
    .select(`
      *,
      department:departments(*),
      stages:pipeline_stages(*),
      custom_fields:pipeline_custom_fields(*)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...data,
    stages: (data.stages || []).sort((a: PipelineStage, b: PipelineStage) => a.sort_order - b.sort_order),
    custom_fields: (data.custom_fields || []).sort((a: PipelineCustomField, b: PipelineCustomField) => a.sort_order - b.sort_order)
  };
}

export async function createPipeline(pipeline: {
  org_id: string;
  name: string;
  department_id?: string | null;
}): Promise<Pipeline> {
  const { data: maxSort } = await supabase
    .from('pipelines')
    .select('sort_order')
    .eq('org_id', pipeline.org_id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from('pipelines')
    .insert({
      org_id: pipeline.org_id,
      name: pipeline.name,
      department_id: pipeline.department_id || null,
      sort_order: (maxSort?.sort_order ?? -1) + 1
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePipeline(id: string, updates: {
  name?: string;
  department_id?: string | null;
  sort_order?: number;
}): Promise<Pipeline> {
  const { data, error } = await supabase
    .from('pipelines')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePipeline(id: string): Promise<void> {
  const { error } = await supabase
    .from('pipelines')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function reorderPipelines(pipelineIds: string[]): Promise<void> {
  const updates = pipelineIds.map((id, index) => ({
    id,
    sort_order: index
  }));

  for (const update of updates) {
    const { error } = await supabase
      .from('pipelines')
      .update({ sort_order: update.sort_order })
      .eq('id', update.id);
    if (error) throw error;
  }
}

export async function getStagesByPipeline(pipelineId: string): Promise<PipelineStage[]> {
  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('*')
    .eq('pipeline_id', pipelineId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createStage(stage: {
  org_id: string;
  pipeline_id: string;
  name: string;
}): Promise<PipelineStage> {
  const { data: maxSort } = await supabase
    .from('pipeline_stages')
    .select('sort_order')
    .eq('pipeline_id', stage.pipeline_id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from('pipeline_stages')
    .insert({
      org_id: stage.org_id,
      pipeline_id: stage.pipeline_id,
      name: stage.name,
      sort_order: (maxSort?.sort_order ?? -1) + 1
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateStage(id: string, updates: {
  name?: string;
  sort_order?: number;
}): Promise<PipelineStage> {
  const { data, error } = await supabase
    .from('pipeline_stages')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteStage(id: string): Promise<void> {
  const { error } = await supabase
    .from('pipeline_stages')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function reorderStages(pipelineId: string, stageIds: string[]): Promise<void> {
  const updates = stageIds.map((id, index) => ({
    id,
    sort_order: index
  }));

  for (const update of updates) {
    const { error } = await supabase
      .from('pipeline_stages')
      .update({ sort_order: update.sort_order })
      .eq('id', update.id)
      .eq('pipeline_id', pipelineId);
    if (error) throw error;
  }
}

export async function getCustomFields(pipelineId: string): Promise<PipelineCustomField[]> {
  const { data, error } = await supabase
    .from('pipeline_custom_fields')
    .select('*')
    .eq('pipeline_id', pipelineId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createCustomField(field: {
  org_id: string;
  pipeline_id: string;
  field_key: string;
  label: string;
  field_type: string;
  options?: string[];
  required?: boolean;
  filterable?: boolean;
}): Promise<PipelineCustomField> {
  const { data: maxSort } = await supabase
    .from('pipeline_custom_fields')
    .select('sort_order')
    .eq('pipeline_id', field.pipeline_id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from('pipeline_custom_fields')
    .insert({
      org_id: field.org_id,
      pipeline_id: field.pipeline_id,
      field_key: field.field_key,
      label: field.label,
      field_type: field.field_type,
      options: field.options || [],
      required: field.required ?? false,
      filterable: field.filterable ?? true,
      sort_order: (maxSort?.sort_order ?? -1) + 1
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCustomField(id: string, updates: {
  label?: string;
  options?: string[];
  required?: boolean;
  filterable?: boolean;
  sort_order?: number;
}): Promise<PipelineCustomField> {
  const { data, error } = await supabase
    .from('pipeline_custom_fields')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCustomField(id: string): Promise<void> {
  const { error } = await supabase
    .from('pipeline_custom_fields')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function reorderCustomFields(pipelineId: string, fieldIds: string[]): Promise<void> {
  const updates = fieldIds.map((id, index) => ({
    id,
    sort_order: index
  }));

  for (const update of updates) {
    const { error } = await supabase
      .from('pipeline_custom_fields')
      .update({ sort_order: update.sort_order })
      .eq('id', update.id)
      .eq('pipeline_id', pipelineId);
    if (error) throw error;
  }
}
