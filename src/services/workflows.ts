import { supabase } from '../lib/supabase';
import type {
  Workflow,
  WorkflowVersion,
  WorkflowTrigger,
  WorkflowEnrollment,
  WorkflowExecutionLog,
  WorkflowDefinition,
  WorkflowStatus,
  WorkflowFilters,
  EnrollmentFilters,
  EnrollmentStatus,
  WorkflowTriggerType
} from '../types';

const DEFAULT_DEFINITION: WorkflowDefinition = {
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 }
};

export async function getWorkflows(
  orgId: string,
  filters: WorkflowFilters = {}
): Promise<Workflow[]> {
  let query = supabase
    .from('workflows')
    .select(`
      *,
      created_by:users!created_by_user_id(id, name, email),
      triggers:workflow_triggers(*)
    `)
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false });

  if (filters.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  } else {
    query = query.neq('status', 'archived');
  }

  if (filters.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const workflows = data as Workflow[];

  const workflowIds = workflows.map(w => w.id);
  if (workflowIds.length > 0) {
    const { data: counts } = await supabase
      .from('workflow_enrollments')
      .select('workflow_id, status')
      .in('workflow_id', workflowIds);

    const countMap = new Map<string, { total: number; active: number }>();
    counts?.forEach(e => {
      const current = countMap.get(e.workflow_id) || { total: 0, active: 0 };
      current.total++;
      if (e.status === 'active') current.active++;
      countMap.set(e.workflow_id, current);
    });

    workflows.forEach(w => {
      const c = countMap.get(w.id);
      w.enrollment_count = c?.total || 0;
      w.active_enrollment_count = c?.active || 0;
    });
  }

  return workflows;
}

export async function getWorkflowById(id: string): Promise<Workflow | null> {
  const { data, error } = await supabase
    .from('workflows')
    .select(`
      *,
      created_by:users!created_by_user_id(id, name, email),
      triggers:workflow_triggers(*)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as Workflow | null;
}

export async function createWorkflow(
  orgId: string,
  name: string,
  description: string | null,
  userId: string
): Promise<Workflow> {
  const { data, error } = await supabase
    .from('workflows')
    .insert({
      org_id: orgId,
      name,
      description,
      status: 'draft',
      draft_definition: DEFAULT_DEFINITION,
      created_by_user_id: userId
    })
    .select()
    .single();

  if (error) throw error;
  return data as Workflow;
}

export async function updateWorkflow(
  id: string,
  updates: {
    name?: string;
    description?: string | null;
  }
): Promise<Workflow> {
  const { data, error } = await supabase
    .from('workflows')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Workflow;
}

export async function updateWorkflowDraft(
  id: string,
  definition: WorkflowDefinition
): Promise<Workflow> {
  const { data, error } = await supabase
    .from('workflows')
    .update({ draft_definition: definition })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Workflow;
}

export async function publishWorkflow(
  id: string,
  userId: string
): Promise<{ workflow: Workflow; version: WorkflowVersion }> {
  const { data: workflow } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', id)
    .single();

  if (!workflow) throw new Error('Workflow not found');

  const { data: latestVersion } = await supabase
    .from('workflow_versions')
    .select('version_number')
    .eq('workflow_id', id)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latestVersion?.version_number || 0) + 1;

  const { data: version, error: versionError } = await supabase
    .from('workflow_versions')
    .insert({
      org_id: workflow.org_id,
      workflow_id: id,
      version_number: nextVersion,
      definition: workflow.draft_definition,
      created_by_user_id: userId
    })
    .select()
    .single();

  if (versionError) throw versionError;

  const { data: updatedWorkflow, error: updateError } = await supabase
    .from('workflows')
    .update({
      status: 'published',
      published_definition: workflow.draft_definition,
      published_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) throw updateError;

  const triggerNodes = (workflow.draft_definition as WorkflowDefinition).nodes.filter(
    n => n.type === 'trigger'
  );

  for (const node of triggerNodes) {
    const triggerData = node.data as { triggerType?: WorkflowTriggerType; filters?: unknown };
    if (triggerData.triggerType) {
      await supabase
        .from('workflow_triggers')
        .upsert({
          org_id: workflow.org_id,
          workflow_id: id,
          trigger_type: triggerData.triggerType,
          trigger_config: triggerData.filters || {},
          is_active: true
        }, {
          onConflict: 'workflow_id,trigger_type'
        });
    }
  }

  return {
    workflow: updatedWorkflow as Workflow,
    version: version as WorkflowVersion
  };
}

export async function archiveWorkflow(id: string): Promise<void> {
  const { error } = await supabase
    .from('workflows')
    .update({ status: 'archived' })
    .eq('id', id);

  if (error) throw error;

  await supabase
    .from('workflow_triggers')
    .update({ is_active: false })
    .eq('workflow_id', id);
}

export async function duplicateWorkflow(
  id: string,
  userId: string
): Promise<Workflow> {
  const { data: original } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', id)
    .single();

  if (!original) throw new Error('Workflow not found');

  const { data, error } = await supabase
    .from('workflows')
    .insert({
      org_id: original.org_id,
      name: `${original.name} (Copy)`,
      description: original.description,
      status: 'draft',
      draft_definition: original.draft_definition,
      created_by_user_id: userId
    })
    .select()
    .single();

  if (error) throw error;
  return data as Workflow;
}

export async function getWorkflowVersions(
  workflowId: string
): Promise<WorkflowVersion[]> {
  const { data, error } = await supabase
    .from('workflow_versions')
    .select(`
      *,
      created_by:users!created_by_user_id(id, name, email)
    `)
    .eq('workflow_id', workflowId)
    .order('version_number', { ascending: false });

  if (error) throw error;
  return data as WorkflowVersion[];
}

export async function rollbackWorkflow(
  workflowId: string,
  versionId: string,
  userId: string
): Promise<Workflow> {
  const { data: version } = await supabase
    .from('workflow_versions')
    .select('*')
    .eq('id', versionId)
    .single();

  if (!version) throw new Error('Version not found');

  const { data: latestVersion } = await supabase
    .from('workflow_versions')
    .select('version_number')
    .eq('workflow_id', workflowId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latestVersion?.version_number || 0) + 1;

  await supabase
    .from('workflow_versions')
    .insert({
      org_id: version.org_id,
      workflow_id: workflowId,
      version_number: nextVersion,
      definition: version.definition,
      created_by_user_id: userId
    });

  const { data: workflow, error } = await supabase
    .from('workflows')
    .update({
      draft_definition: version.definition,
      published_definition: version.definition,
      published_at: new Date().toISOString()
    })
    .eq('id', workflowId)
    .select()
    .single();

  if (error) throw error;
  return workflow as Workflow;
}

export async function getEnrollments(
  orgId: string,
  filters: EnrollmentFilters = {},
  page = 1,
  pageSize = 50
): Promise<{ data: WorkflowEnrollment[]; total: number }> {
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from('workflow_enrollments')
    .select(`
      *,
      contact:contacts!contact_id(id, first_name, last_name, email, phone),
      workflow:workflows!workflow_id(id, name)
    `, { count: 'exact' })
    .eq('org_id', orgId)
    .order('started_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (filters.workflowId) {
    query = query.eq('workflow_id', filters.workflowId);
  }

  if (filters.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    data: data as WorkflowEnrollment[],
    total: count || 0
  };
}

export async function getEnrollmentById(id: string): Promise<WorkflowEnrollment | null> {
  const { data, error } = await supabase
    .from('workflow_enrollments')
    .select(`
      *,
      contact:contacts!contact_id(id, first_name, last_name, email, phone),
      workflow:workflows!workflow_id(id, name, published_definition),
      version:workflow_versions!version_id(id, version_number, definition)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as WorkflowEnrollment | null;
}

export async function stopEnrollment(
  id: string,
  reason: string
): Promise<void> {
  const { error } = await supabase
    .from('workflow_enrollments')
    .update({
      status: 'stopped',
      stopped_reason: reason,
      completed_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) throw error;

  await supabase
    .from('workflow_jobs')
    .update({ status: 'failed', last_error: 'Enrollment stopped' })
    .eq('enrollment_id', id)
    .eq('status', 'pending');
}

export async function getExecutionLogs(
  enrollmentId: string
): Promise<WorkflowExecutionLog[]> {
  const { data, error } = await supabase
    .from('workflow_execution_logs')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as WorkflowExecutionLog[];
}

export async function getWorkflowStats(
  orgId: string
): Promise<{
  total: number;
  published: number;
  draft: number;
  activeEnrollments: number;
}> {
  const { data: workflows } = await supabase
    .from('workflows')
    .select('status')
    .eq('org_id', orgId)
    .neq('status', 'archived');

  const { count: activeEnrollments } = await supabase
    .from('workflow_enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'active');

  const total = workflows?.length || 0;
  const published = workflows?.filter(w => w.status === 'published').length || 0;
  const draft = workflows?.filter(w => w.status === 'draft').length || 0;

  return {
    total,
    published,
    draft,
    activeEnrollments: activeEnrollments || 0
  };
}

export async function getActiveTriggers(
  triggerType: WorkflowTriggerType
): Promise<WorkflowTrigger[]> {
  const { data, error } = await supabase
    .from('workflow_triggers')
    .select(`
      *,
      workflow:workflows!workflow_id(id, org_id, status, published_definition)
    `)
    .eq('trigger_type', triggerType)
    .eq('is_active', true);

  if (error) throw error;

  return (data || []).filter(
    t => t.workflow?.status === 'published'
  ) as WorkflowTrigger[];
}

export async function enrollContact(
  orgId: string,
  workflowId: string,
  contactId: string
): Promise<WorkflowEnrollment> {
  const { data: workflow } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', workflowId)
    .eq('status', 'published')
    .single();

  if (!workflow) throw new Error('Workflow not found or not published');

  const { data: existingEnrollment } = await supabase
    .from('workflow_enrollments')
    .select('id')
    .eq('workflow_id', workflowId)
    .eq('contact_id', contactId)
    .eq('status', 'active')
    .maybeSingle();

  if (existingEnrollment) {
    throw new Error('Contact is already enrolled in this workflow');
  }

  const { data: latestVersion } = await supabase
    .from('workflow_versions')
    .select('id')
    .eq('workflow_id', workflowId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single();

  if (!latestVersion) throw new Error('No published version found');

  const definition = workflow.published_definition as WorkflowDefinition;
  const triggerNode = definition.nodes.find(n => n.type === 'trigger');
  const firstEdge = triggerNode
    ? definition.edges.find(e => e.source === triggerNode.id)
    : null;
  const firstNodeId = firstEdge?.target || null;

  const { data: enrollment, error: enrollError } = await supabase
    .from('workflow_enrollments')
    .insert({
      org_id: orgId,
      workflow_id: workflowId,
      version_id: latestVersion.id,
      contact_id: contactId,
      status: 'active',
      current_node_id: firstNodeId,
      context_data: {}
    })
    .select()
    .single();

  if (enrollError) throw enrollError;

  if (firstNodeId) {
    await supabase.from('workflow_jobs').insert({
      org_id: orgId,
      enrollment_id: enrollment.id,
      node_id: firstNodeId,
      run_at: new Date().toISOString(),
      status: 'pending',
      execution_key: `${enrollment.id}-${firstNodeId}-${Date.now()}`
    });
  }

  return enrollment as WorkflowEnrollment;
}
