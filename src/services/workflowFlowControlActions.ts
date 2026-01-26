import { supabase } from '../lib/supabase';
import type {
  ConditionGroup,
  Condition,
  WaitForConditionConfig,
  GoToStepConfig,
  RepeatUntilConfig,
  TriggerWorkflowConfig,
  WorkflowEnrollmentConfig,
  SetVariableConfig,
  StopWorkflowConfig,
} from '../types/workflowActions';

export interface FlowControlContext {
  orgId: string;
  contactId: string;
  enrollmentId: string;
  workflowId: string;
  nodeId: string;
  actorUserId?: string;
  contextData?: Record<string, unknown>;
}

export interface FlowControlResult {
  success: boolean;
  error?: string;
  nextNodeId?: string;
  shouldStop?: boolean;
  shouldWait?: boolean;
  waitConfig?: {
    conditionWaitId: string;
    timeoutAt: string;
  };
  data?: Record<string, unknown>;
}

export interface ConditionEvaluationResult {
  met: boolean;
  details?: Record<string, unknown>;
}

async function getContactData(contactId: string): Promise<Record<string, unknown>> {
  const { data: contact } = await supabase
    .from('contacts')
    .select('*, tags:contact_tags(tag:tags(name))')
    .eq('id', contactId)
    .maybeSingle();

  if (!contact) return {};

  return {
    ...contact,
    tags: contact.tags?.map((t: { tag: { name: string } }) => t.tag.name) || [],
  };
}

async function getOpportunityData(contactId: string, orgId: string): Promise<Record<string, unknown> | null> {
  const { data: opportunity } = await supabase
    .from('opportunities')
    .select('*, stage:pipeline_stages(id, name), pipeline:pipelines(id, name)')
    .eq('org_id', orgId)
    .eq('contact_id', contactId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return opportunity;
}

async function getAppointmentData(contactId: string, orgId: string): Promise<Record<string, unknown> | null> {
  const { data: appointment } = await supabase
    .from('appointments')
    .select('*, appointment_type:appointment_types(name)')
    .eq('org_id', orgId)
    .eq('contact_id', contactId)
    .eq('status', 'scheduled')
    .gte('start_at_utc', new Date().toISOString())
    .order('start_at_utc', { ascending: true })
    .limit(1)
    .maybeSingle();

  return appointment;
}

async function getInvoiceData(contactId: string, orgId: string): Promise<Record<string, unknown> | null> {
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('org_id', orgId)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return invoice;
}

function evaluateSingleCondition(
  condition: Condition,
  data: Record<string, unknown>
): boolean {
  const fieldValue = getNestedValue(data, condition.field);

  switch (condition.operator) {
    case 'equals':
      return fieldValue === condition.value;

    case 'not_equals':
      return fieldValue !== condition.value;

    case 'contains':
      if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
        return fieldValue.toLowerCase().includes(condition.value.toLowerCase());
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(condition.value);
      }
      return false;

    case 'not_contains':
      if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
        return !fieldValue.toLowerCase().includes(condition.value.toLowerCase());
      }
      if (Array.isArray(fieldValue)) {
        return !fieldValue.includes(condition.value);
      }
      return true;

    case 'starts_with':
      if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
        return fieldValue.toLowerCase().startsWith(condition.value.toLowerCase());
      }
      return false;

    case 'ends_with':
      if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
        return fieldValue.toLowerCase().endsWith(condition.value.toLowerCase());
      }
      return false;

    case 'regex_matches':
      if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
        try {
          const regex = new RegExp(condition.value);
          return regex.test(fieldValue);
        } catch {
          return false;
        }
      }
      return false;

    case 'is_empty':
      return fieldValue === null || fieldValue === undefined || fieldValue === '' ||
        (Array.isArray(fieldValue) && fieldValue.length === 0);

    case 'is_not_empty':
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== '' &&
        !(Array.isArray(fieldValue) && fieldValue.length === 0);

    case 'greater_than':
      return typeof fieldValue === 'number' && typeof condition.value === 'number' &&
        fieldValue > condition.value;

    case 'less_than':
      return typeof fieldValue === 'number' && typeof condition.value === 'number' &&
        fieldValue < condition.value;

    case 'greater_than_or_equal':
      return typeof fieldValue === 'number' && typeof condition.value === 'number' &&
        fieldValue >= condition.value;

    case 'less_than_or_equal':
      return typeof fieldValue === 'number' && typeof condition.value === 'number' &&
        fieldValue <= condition.value;

    case 'date_before':
      if (fieldValue && condition.value) {
        return new Date(fieldValue as string) < new Date(condition.value as string);
      }
      return false;

    case 'date_after':
      if (fieldValue && condition.value) {
        return new Date(fieldValue as string) > new Date(condition.value as string);
      }
      return false;

    case 'date_between':
      if (fieldValue && condition.value && condition.secondaryValue) {
        const date = new Date(fieldValue as string);
        return date >= new Date(condition.value as string) &&
          date <= new Date(condition.secondaryValue as string);
      }
      return false;

    case 'date_within_last':
      if (fieldValue && typeof condition.value === 'number') {
        const date = new Date(fieldValue as string);
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - condition.value);
        return date >= daysAgo;
      }
      return false;

    case 'date_within_next':
      if (fieldValue && typeof condition.value === 'number') {
        const date = new Date(fieldValue as string);
        const daysAhead = new Date();
        daysAhead.setDate(daysAhead.getDate() + condition.value);
        return date <= daysAhead && date >= new Date();
      }
      return false;

    case 'has_tag':
      if (Array.isArray(data.tags) && typeof condition.value === 'string') {
        return data.tags.includes(condition.value);
      }
      return false;

    case 'not_has_tag':
      if (Array.isArray(data.tags) && typeof condition.value === 'string') {
        return !data.tags.includes(condition.value);
      }
      return true;

    case 'opportunity_in_stage':
      if (data.opportunity && typeof condition.value === 'string') {
        const opp = data.opportunity as { stage_id?: string; stage?: { id?: string } };
        return opp.stage_id === condition.value || opp.stage?.id === condition.value;
      }
      return false;

    case 'invoice_status_is':
      if (data.invoice && typeof condition.value === 'string') {
        return (data.invoice as { status?: string }).status === condition.value;
      }
      return false;

    default:
      return false;
  }
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let value: unknown = obj;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = (value as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }

  return value;
}

function evaluateConditionGroup(
  group: ConditionGroup,
  data: Record<string, unknown>
): boolean {
  const results = group.conditions.map(item => {
    if ('logicalOperator' in item) {
      return evaluateConditionGroup(item as ConditionGroup, data);
    }
    return evaluateSingleCondition(item as Condition, data);
  });

  if (group.logicalOperator === 'and') {
    return results.every(r => r);
  }
  return results.some(r => r);
}

export async function evaluateConditions(
  conditions: ConditionGroup,
  context: FlowControlContext
): Promise<ConditionEvaluationResult> {
  try {
    const contactData = await getContactData(context.contactId);
    const opportunityData = await getOpportunityData(context.contactId, context.orgId);
    const appointmentData = await getAppointmentData(context.contactId, context.orgId);
    const invoiceData = await getInvoiceData(context.contactId, context.orgId);

    const data = {
      contact: contactData,
      opportunity: opportunityData,
      appointment: appointmentData,
      invoice: invoiceData,
      ...contactData,
      ...context.contextData,
    };

    const met = evaluateConditionGroup(conditions, data);

    return { met, details: { evaluatedAt: new Date().toISOString() } };
  } catch (error) {
    return { met: false, details: { error: (error as Error).message } };
  }
}

export async function waitForCondition(
  config: WaitForConditionConfig,
  context: FlowControlContext
): Promise<FlowControlResult> {
  try {
    const result = await evaluateConditions(config.conditions, context);

    if (result.met) {
      return {
        success: true,
        shouldWait: false,
        data: { conditionMet: true },
      };
    }

    const { data: workflow } = await supabase
      .from('workflows')
      .select('wait_timeout_days')
      .eq('id', context.workflowId)
      .single();

    const timeoutDays = config.timeoutDays || workflow?.wait_timeout_days || 30;
    const timeoutAt = new Date();
    timeoutAt.setDate(timeoutAt.getDate() + timeoutDays);

    const { data: conditionWait, error } = await supabase
      .from('workflow_condition_waits')
      .insert({
        org_id: context.orgId,
        enrollment_id: context.enrollmentId,
        node_id: context.nodeId,
        condition_config: config.conditions,
        check_interval_minutes: config.checkIntervalMinutes || 5,
        timeout_at: timeoutAt.toISOString(),
        status: 'waiting',
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      shouldWait: true,
      waitConfig: {
        conditionWaitId: conditionWait.id,
        timeoutAt: timeoutAt.toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set up wait condition',
    };
  }
}

export async function evaluateIfElse(
  conditions: ConditionGroup,
  context: FlowControlContext,
  trueBranch: string,
  falseBranch: string
): Promise<FlowControlResult> {
  try {
    const result = await evaluateConditions(conditions, context);

    return {
      success: true,
      nextNodeId: result.met ? trueBranch : falseBranch,
      data: { conditionMet: result.met },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to evaluate condition',
    };
  }
}

export async function goToStep(
  config: GoToStepConfig,
  context: FlowControlContext
): Promise<FlowControlResult> {
  try {
    const { data: loop } = await supabase
      .from('workflow_loops')
      .select('iteration_count')
      .eq('enrollment_id', context.enrollmentId)
      .eq('node_id', context.nodeId)
      .maybeSingle();

    const currentCount = loop?.iteration_count || 0;
    const maxJumps = config.maxJumps || 100;

    if (currentCount >= maxJumps) {
      return {
        success: false,
        error: `Maximum jump count (${maxJumps}) reached`,
        shouldStop: true,
      };
    }

    await supabase.from('workflow_loops').upsert(
      {
        org_id: context.orgId,
        enrollment_id: context.enrollmentId,
        node_id: context.nodeId,
        iteration_count: currentCount + 1,
        max_iterations: maxJumps,
        last_iteration_at: new Date().toISOString(),
      },
      { onConflict: 'enrollment_id,node_id' }
    );

    return {
      success: true,
      nextNodeId: config.targetNodeId,
      data: { jumpCount: currentCount + 1 },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to go to step',
    };
  }
}

export async function repeatUntil(
  config: RepeatUntilConfig,
  context: FlowControlContext
): Promise<FlowControlResult> {
  try {
    const result = await evaluateConditions(config.conditions, context);

    if (result.met) {
      return {
        success: true,
        shouldWait: false,
        data: { conditionMet: true, loopEnded: true },
      };
    }

    const { data: loop } = await supabase
      .from('workflow_loops')
      .select('iteration_count')
      .eq('enrollment_id', context.enrollmentId)
      .eq('node_id', context.nodeId)
      .maybeSingle();

    const currentCount = loop?.iteration_count || 0;

    if (currentCount >= config.maxIterations) {
      return {
        success: true,
        shouldWait: false,
        data: { maxIterationsReached: true, iterations: currentCount },
      };
    }

    await supabase.from('workflow_loops').upsert(
      {
        org_id: context.orgId,
        enrollment_id: context.enrollmentId,
        node_id: context.nodeId,
        iteration_count: currentCount + 1,
        max_iterations: config.maxIterations,
        last_iteration_at: new Date().toISOString(),
      },
      { onConflict: 'enrollment_id,node_id' }
    );

    return {
      success: true,
      nextNodeId: config.startNodeId || context.nodeId,
      data: { iteration: currentCount + 1 },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to evaluate repeat condition',
    };
  }
}

export async function triggerWorkflow(
  config: TriggerWorkflowConfig,
  context: FlowControlContext
): Promise<FlowControlResult> {
  try {
    const { data: workflow } = await supabase
      .from('workflows')
      .select('id, status, published_definition')
      .eq('id', config.workflowId)
      .eq('status', 'published')
      .maybeSingle();

    if (!workflow) {
      return { success: false, error: 'Target workflow not found or not published' };
    }

    const { data: existingEnrollment } = await supabase
      .from('workflow_enrollments')
      .select('id')
      .eq('workflow_id', config.workflowId)
      .eq('contact_id', context.contactId)
      .eq('status', 'active')
      .maybeSingle();

    if (existingEnrollment) {
      return {
        success: true,
        data: {
          alreadyEnrolled: true,
          existingEnrollmentId: existingEnrollment.id,
        },
      };
    }

    const { data: latestVersion } = await supabase
      .from('workflow_versions')
      .select('id')
      .eq('workflow_id', config.workflowId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    if (!latestVersion) {
      return { success: false, error: 'No published version found' };
    }

    const definition = workflow.published_definition as { nodes: Array<{ id: string; type: string }>; edges: Array<{ source: string; target: string }> };
    const triggerNode = definition.nodes.find(n => n.type === 'trigger');
    const firstEdge = triggerNode
      ? definition.edges.find(e => e.source === triggerNode.id)
      : null;
    const firstNodeId = firstEdge?.target || null;

    let enrollmentContext = {};
    if (config.passThroughContext) {
      enrollmentContext = { ...context.contextData };
    }
    if (config.contextMapping) {
      for (const [key, sourcePath] of Object.entries(config.contextMapping)) {
        enrollmentContext = {
          ...enrollmentContext,
          [key]: getNestedValue(context.contextData || {}, sourcePath),
        };
      }
    }

    const { data: enrollment, error: enrollError } = await supabase
      .from('workflow_enrollments')
      .insert({
        org_id: context.orgId,
        workflow_id: config.workflowId,
        version_id: latestVersion.id,
        contact_id: context.contactId,
        status: 'active',
        current_node_id: firstNodeId,
        context_data: {
          ...enrollmentContext,
          triggered_by_workflow: context.workflowId,
          triggered_by_enrollment: context.enrollmentId,
        },
      })
      .select()
      .single();

    if (enrollError) throw enrollError;

    if (firstNodeId) {
      await supabase.from('workflow_jobs').insert({
        org_id: context.orgId,
        enrollment_id: enrollment.id,
        node_id: firstNodeId,
        run_at: new Date().toISOString(),
        status: 'pending',
        execution_key: `${enrollment.id}-${firstNodeId}-${Date.now()}`,
      });
    }

    return {
      success: true,
      data: {
        enrollmentId: enrollment.id,
        workflowId: config.workflowId,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger workflow',
    };
  }
}

export async function manageWorkflowEnrollment(
  config: WorkflowEnrollmentConfig,
  context: FlowControlContext
): Promise<FlowControlResult> {
  try {
    if (config.action === 'add') {
      return triggerWorkflow(
        { workflowId: config.workflowId, workflowName: config.workflowName },
        context
      );
    }

    if (config.action === 'remove') {
      const { data: enrollment } = await supabase
        .from('workflow_enrollments')
        .select('id')
        .eq('workflow_id', config.workflowId)
        .eq('contact_id', context.contactId)
        .eq('status', 'active')
        .maybeSingle();

      if (!enrollment) {
        return {
          success: true,
          data: { notEnrolled: true },
        };
      }

      const { error } = await supabase
        .from('workflow_enrollments')
        .update({
          status: 'stopped',
          stopped_reason: 'Removed by another workflow',
          completed_at: new Date().toISOString(),
        })
        .eq('id', enrollment.id);

      if (error) throw error;

      await supabase
        .from('workflow_jobs')
        .update({ status: 'failed', last_error: 'Enrollment stopped' })
        .eq('enrollment_id', enrollment.id)
        .eq('status', 'pending');

      return {
        success: true,
        data: { removed: true, enrollmentId: enrollment.id },
      };
    }

    return { success: false, error: 'Invalid action' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to manage enrollment',
    };
  }
}

export async function setWorkflowVariable(
  config: SetVariableConfig,
  context: FlowControlContext
): Promise<FlowControlResult> {
  try {
    let value: unknown;

    if (config.valueType === 'static') {
      value = config.value;
    } else if (config.valueType === 'merge_field') {
      const contactData = await getContactData(context.contactId);
      value = getNestedValue({ ...contactData, ...context.contextData }, config.value);
    } else if (config.valueType === 'expression') {
      try {
        const contactData = await getContactData(context.contactId);
        const data = { ...contactData, ...context.contextData };
        value = config.value.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
          const val = getNestedValue(data, path);
          return val !== undefined ? String(val) : '';
        });
      } catch {
        value = config.value;
      }
    }

    const { data: enrollment, error } = await supabase
      .from('workflow_enrollments')
      .select('context_data')
      .eq('id', context.enrollmentId)
      .single();

    if (error) throw error;

    const newContextData = {
      ...(enrollment.context_data as Record<string, unknown> || {}),
      [config.variableName]: value,
    };

    await supabase
      .from('workflow_enrollments')
      .update({ context_data: newContextData })
      .eq('id', context.enrollmentId);

    return {
      success: true,
      data: { variableName: config.variableName, value },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set variable',
    };
  }
}

export async function stopWorkflow(
  config: StopWorkflowConfig,
  context: FlowControlContext
): Promise<FlowControlResult> {
  try {
    const { error } = await supabase
      .from('workflow_enrollments')
      .update({
        status: config.markAsCompleted ? 'completed' : 'stopped',
        stopped_reason: config.reason || 'Stopped by workflow action',
        completed_at: new Date().toISOString(),
      })
      .eq('id', context.enrollmentId);

    if (error) throw error;

    await supabase
      .from('workflow_jobs')
      .update({ status: 'failed', last_error: config.reason || 'Workflow stopped' })
      .eq('enrollment_id', context.enrollmentId)
      .eq('status', 'pending');

    return {
      success: true,
      shouldStop: true,
      data: { reason: config.reason },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to stop workflow',
    };
  }
}
