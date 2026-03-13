import { supabase } from '../lib/supabase';
import type {
  Project,
  ProjectFilters,
  ProjectStats,
  ProjectBoardData,
  ProjectStatus,
} from '../types';
import { logProjectActivity } from './projectActivityLog';
import { emitEvent } from './eventDispatcher';

const PROJECT_SELECT = `
  *,
  contact:contacts(*),
  pipeline:project_pipelines(*),
  stage:project_stages(*),
  assigned_user:users!projects_assigned_user_id_fkey(*),
  department:departments(*),
  opportunity:opportunities(*),
  proposal:proposals(*),
  invoice:invoices(*)
`;

export async function getProjects(
  orgId: string,
  filters: ProjectFilters = {},
  page = 1,
  perPage = 50
): Promise<{ data: Project[]; count: number }> {
  let query = supabase
    .from('projects')
    .select(PROJECT_SELECT, { count: 'exact' })
    .eq('org_id', orgId);

  if (filters.pipelineId) query = query.eq('pipeline_id', filters.pipelineId);
  if (filters.stageId) query = query.eq('stage_id', filters.stageId);
  if (filters.status && filters.status.length > 0) query = query.in('status', filters.status);
  if (filters.assignedUserId) query = query.eq('assigned_user_id', filters.assignedUserId);
  if (filters.departmentId) query = query.eq('department_id', filters.departmentId);
  if (filters.riskLevel && filters.riskLevel.length > 0) query = query.in('risk_level', filters.riskLevel);
  if (filters.priority && filters.priority.length > 0) query = query.in('priority', filters.priority);
  if (filters.createdAfter) query = query.gte('created_at', filters.createdAfter);
  if (filters.createdBefore) query = query.lte('created_at', filters.createdBefore);
  if (filters.targetEndAfter) query = query.gte('target_end_date', filters.targetEndAfter);
  if (filters.targetEndBefore) query = query.lte('target_end_date', filters.targetEndBefore);
  if (filters.minBudget !== undefined) query = query.gte('budget_amount', filters.minBudget);
  if (filters.maxBudget !== undefined) query = query.lte('budget_amount', filters.maxBudget);
  if (filters.search) query = query.ilike('name', `%${filters.search}%`);

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { data: (data ?? []) as Project[], count: count ?? 0 };
}

export async function getProjectById(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as Project | null;
}

export interface CreateProjectInput {
  org_id: string;
  contact_id: string;
  opportunity_id?: string | null;
  proposal_id?: string | null;
  invoice_id?: string | null;
  pipeline_id: string;
  stage_id: string;
  assigned_user_id?: string | null;
  department_id?: string | null;
  name: string;
  description?: string | null;
  priority?: string;
  start_date?: string | null;
  target_end_date?: string | null;
  budget_amount?: number;
  currency?: string;
  risk_level?: string;
  created_by: string;
}

export async function createProject(
  input: CreateProjectInput,
  actorUserId: string
): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      org_id: input.org_id,
      contact_id: input.contact_id,
      opportunity_id: input.opportunity_id ?? null,
      proposal_id: input.proposal_id ?? null,
      invoice_id: input.invoice_id ?? null,
      pipeline_id: input.pipeline_id,
      stage_id: input.stage_id,
      assigned_user_id: input.assigned_user_id ?? null,
      department_id: input.department_id ?? null,
      name: input.name,
      description: input.description ?? null,
      priority: input.priority ?? 'medium',
      start_date: input.start_date ?? null,
      target_end_date: input.target_end_date ?? null,
      budget_amount: input.budget_amount ?? 0,
      currency: input.currency ?? 'USD',
      risk_level: input.risk_level ?? 'low',
      created_by: input.created_by,
      stage_changed_at: new Date().toISOString(),
    })
    .select(PROJECT_SELECT)
    .single();

  if (error) throw error;

  await logProjectActivity({
    org_id: input.org_id,
    project_id: data.id,
    event_type: 'project_created',
    summary: `Project "${input.name}" created`,
    payload: { pipeline_id: input.pipeline_id, stage_id: input.stage_id },
    actor_user_id: actorUserId,
  });

  emitEvent('project.created', {
    entityType: 'project',
    entityId: data.id,
    orgId: input.org_id,
    data: {
      contact_id: input.contact_id,
      pipeline_id: input.pipeline_id,
      stage_id: input.stage_id,
      name: input.name,
    },
  }, { userId: actorUserId }).catch(() => {});

  return data as Project;
}

export async function updateProject(
  id: string,
  updates: Partial<Project>,
  actorUserId: string
): Promise<Project> {
  const existing = await getProjectById(id);
  if (!existing) throw new Error('Project not found');

  const updateData: Record<string, unknown> = {
    ...updates,
    updated_at: new Date().toISOString(),
  };
  delete updateData.id;
  delete updateData.org_id;
  delete updateData.created_by;
  delete updateData.created_at;
  delete updateData.contact;
  delete updateData.pipeline;
  delete updateData.stage;
  delete updateData.assigned_user;
  delete updateData.department;
  delete updateData.opportunity;
  delete updateData.proposal;
  delete updateData.invoice;

  if (updates.stage_id && updates.stage_id !== existing.stage_id) {
    updateData.stage_changed_at = new Date().toISOString();
  }

  if (updates.status === 'completed' && existing.status !== 'completed') {
    updateData.actual_end_date = new Date().toISOString().split('T')[0];
  }

  const { data, error } = await supabase
    .from('projects')
    .update(updateData)
    .eq('id', id)
    .select(PROJECT_SELECT)
    .single();

  if (error) throw error;

  if (updates.stage_id && updates.stage_id !== existing.stage_id) {
    await logProjectActivity({
      org_id: existing.org_id,
      project_id: id,
      event_type: 'stage_changed',
      summary: `Stage changed from "${existing.stage?.name}" to new stage`,
      payload: { from_stage_id: existing.stage_id, to_stage_id: updates.stage_id },
      actor_user_id: actorUserId,
    });

    emitEvent('project.stage_changed', {
      entityType: 'project',
      entityId: id,
      orgId: existing.org_id,
      data: {
        contact_id: existing.contact_id,
        from_stage_id: existing.stage_id,
        to_stage_id: updates.stage_id,
      },
    }, { userId: actorUserId }).catch(() => {});
  }

  if (updates.status && updates.status !== existing.status) {
    await logProjectActivity({
      org_id: existing.org_id,
      project_id: id,
      event_type: 'status_changed',
      summary: `Status changed from "${existing.status}" to "${updates.status}"`,
      payload: { from_status: existing.status, to_status: updates.status },
      actor_user_id: actorUserId,
    });

    if (updates.status === 'completed') {
      emitEvent('project.completed', {
        entityType: 'project',
        entityId: id,
        orgId: existing.org_id,
        data: { contact_id: existing.contact_id },
      }, { userId: actorUserId }).catch(() => {});
    }
  }

  if (updates.assigned_user_id && updates.assigned_user_id !== existing.assigned_user_id) {
    await logProjectActivity({
      org_id: existing.org_id,
      project_id: id,
      event_type: 'owner_changed',
      summary: 'Project owner changed',
      payload: { from_user_id: existing.assigned_user_id, to_user_id: updates.assigned_user_id },
      actor_user_id: actorUserId,
    });
  }

  return data as Project;
}

export async function moveProjectToStage(
  id: string,
  newStageId: string,
  actorUserId: string
): Promise<Project> {
  return updateProject(id, { stage_id: newStageId } as Partial<Project>, actorUserId);
}

export async function closeProject(
  id: string,
  status: 'completed' | 'cancelled',
  actorUserId: string
): Promise<Project> {
  return updateProject(
    id,
    {
      status,
      actual_end_date: new Date().toISOString().split('T')[0],
    } as Partial<Project>,
    actorUserId
  );
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

export async function getProjectStats(
  orgId: string,
  filters: ProjectFilters = {}
): Promise<ProjectStats> {
  let query = supabase
    .from('projects')
    .select('status, budget_amount, actual_cost, target_end_date')
    .eq('org_id', orgId);

  if (filters.pipelineId) query = query.eq('pipeline_id', filters.pipelineId);
  if (filters.assignedUserId) query = query.eq('assigned_user_id', filters.assignedUserId);
  if (filters.departmentId) query = query.eq('department_id', filters.departmentId);

  const { data, error } = await query;
  if (error) throw error;

  const projects = data ?? [];
  const today = new Date().toISOString().split('T')[0];

  return {
    totalProjects: projects.length,
    activeProjects: projects.filter((p) => p.status === 'active').length,
    completedProjects: projects.filter((p) => p.status === 'completed').length,
    onHoldProjects: projects.filter((p) => p.status === 'on_hold').length,
    cancelledProjects: projects.filter((p) => p.status === 'cancelled').length,
    overdueProjects: projects.filter(
      (p) => p.status === 'active' && p.target_end_date && p.target_end_date < today
    ).length,
    totalBudget: projects.reduce((sum, p) => sum + Number(p.budget_amount || 0), 0),
    totalActualCost: projects.reduce((sum, p) => sum + Number(p.actual_cost || 0), 0),
  };
}

export async function getBoardData(
  orgId: string,
  pipelineId: string,
  filters: ProjectFilters = {}
): Promise<ProjectBoardData | null> {
  const pipeline = await (await import('./projectPipelines')).getProjectPipelineById(pipelineId);
  if (!pipeline) return null;

  const mergedFilters: ProjectFilters = { ...filters, pipelineId };
  if (!mergedFilters.status || mergedFilters.status.length === 0) {
    mergedFilters.status = ['active', 'on_hold'];
  }

  const { data: projects } = await getProjects(orgId, mergedFilters, 1, 500);

  const stages = (pipeline.stages ?? []).map((stage) => ({
    ...stage,
    projects: projects.filter((p) => p.stage_id === stage.id),
  }));

  return { pipeline, stages };
}

export async function convertOpportunityToProject(
  opportunityId: string,
  projectData: Omit<CreateProjectInput, 'opportunity_id'>,
  actorUserId: string
): Promise<Project> {
  const project = await createProject(
    { ...projectData, opportunity_id: opportunityId },
    actorUserId
  );

  const { error } = await supabase
    .from('opportunities')
    .update({ financial_locked: true })
    .eq('id', opportunityId);

  if (error) throw error;

  return project;
}

export async function getProjectByOpportunityId(opportunityId: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_SELECT)
    .eq('opportunity_id', opportunityId)
    .maybeSingle();

  if (error) throw error;
  return data as Project | null;
}

export function formatProjectStatus(status: ProjectStatus): string {
  const map: Record<ProjectStatus, string> = {
    active: 'Active',
    on_hold: 'On Hold',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return map[status] || status;
}
