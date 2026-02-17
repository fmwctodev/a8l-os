import { supabase } from '../lib/supabase';
import type { ProjectPipeline, ProjectStage } from '../types';

export async function getProjectPipelines(orgId: string): Promise<ProjectPipeline[]> {
  const { data, error } = await supabase
    .from('project_pipelines')
    .select('*, stages:project_stages(*), department:departments(*)')
    .eq('org_id', orgId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  if (data) {
    data.forEach((p: ProjectPipeline & { stages?: ProjectStage[] }) => {
      if (p.stages) {
        p.stages.sort((a: ProjectStage, b: ProjectStage) => a.sort_order - b.sort_order);
      }
    });
  }
  return (data ?? []) as ProjectPipeline[];
}

export async function getProjectPipelineById(id: string): Promise<ProjectPipeline | null> {
  const { data, error } = await supabase
    .from('project_pipelines')
    .select('*, stages:project_stages(*), department:departments(*)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (data?.stages) {
    (data as ProjectPipeline & { stages: ProjectStage[] }).stages.sort(
      (a: ProjectStage, b: ProjectStage) => a.sort_order - b.sort_order
    );
  }
  return data as ProjectPipeline | null;
}

export async function createProjectPipeline(
  orgId: string,
  name: string,
  departmentId?: string | null
): Promise<ProjectPipeline> {
  const { data: existing } = await supabase
    .from('project_pipelines')
    .select('sort_order')
    .eq('org_id', orgId)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const { data, error } = await supabase
    .from('project_pipelines')
    .insert({
      org_id: orgId,
      name,
      department_id: departmentId || null,
      sort_order: nextOrder,
    })
    .select('*, stages:project_stages(*), department:departments(*)')
    .single();

  if (error) throw error;
  return data as ProjectPipeline;
}

export async function createProjectPipelineWithStages(
  orgId: string,
  name: string,
  stages: { name: string; sla_days?: number; color?: string }[],
  departmentId?: string | null
): Promise<ProjectPipeline> {
  const pipeline = await createProjectPipeline(orgId, name, departmentId);

  if (stages.length > 0) {
    const stageInserts = stages.map((s, i) => ({
      org_id: orgId,
      pipeline_id: pipeline.id,
      name: s.name,
      sort_order: i,
      sla_days: s.sla_days ?? 0,
      color: s.color ?? null,
    }));

    const { error } = await supabase.from('project_stages').insert(stageInserts);
    if (error) throw error;
  }

  return (await getProjectPipelineById(pipeline.id))!;
}

export async function updateProjectPipeline(
  id: string,
  updates: { name?: string; department_id?: string | null }
): Promise<ProjectPipeline> {
  const { data, error } = await supabase
    .from('project_pipelines')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, stages:project_stages(*), department:departments(*)')
    .single();

  if (error) throw error;
  return data as ProjectPipeline;
}

export async function deleteProjectPipeline(id: string): Promise<void> {
  const { error } = await supabase.from('project_pipelines').delete().eq('id', id);
  if (error) throw error;
}

export async function getProjectStages(pipelineId: string): Promise<ProjectStage[]> {
  const { data, error } = await supabase
    .from('project_stages')
    .select('*')
    .eq('pipeline_id', pipelineId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ProjectStage[];
}

export async function createProjectStage(
  orgId: string,
  pipelineId: string,
  name: string,
  slaDays = 0,
  color?: string
): Promise<ProjectStage> {
  const { data: existing } = await supabase
    .from('project_stages')
    .select('sort_order')
    .eq('pipeline_id', pipelineId)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const { data, error } = await supabase
    .from('project_stages')
    .insert({
      org_id: orgId,
      pipeline_id: pipelineId,
      name,
      sort_order: nextOrder,
      sla_days: slaDays,
      color: color ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ProjectStage;
}

export async function updateProjectStage(
  id: string,
  updates: { name?: string; sla_days?: number; color?: string | null }
): Promise<ProjectStage> {
  const { data, error } = await supabase
    .from('project_stages')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as ProjectStage;
}

export async function deleteProjectStage(id: string): Promise<void> {
  const { error } = await supabase.from('project_stages').delete().eq('id', id);
  if (error) throw error;
}

export async function reorderProjectStages(
  pipelineId: string,
  stageIds: string[]
): Promise<void> {
  for (let i = 0; i < stageIds.length; i++) {
    const { error } = await supabase
      .from('project_stages')
      .update({ sort_order: i, updated_at: new Date().toISOString() })
      .eq('id', stageIds[i])
      .eq('pipeline_id', pipelineId);

    if (error) throw error;
  }
}
