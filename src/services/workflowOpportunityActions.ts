import { supabase } from '../lib/supabase';
import type {
  CreateOpportunityConfig,
  UpdateOpportunityConfig,
  MoveStageConfig,
  AssignOpportunityOwnerConfig,
  MarkWonConfig,
  MarkLostConfig,
  OpportunitySource,
} from '../types/workflowActions';

export interface OpportunityActionContext {
  orgId: string;
  contactId: string;
  enrollmentId: string;
  actorUserId?: string;
  contextData?: Record<string, unknown>;
}

export interface OpportunityActionResult {
  success: boolean;
  opportunityId?: string;
  error?: string;
  data?: Record<string, unknown>;
}

async function resolveOpportunityId(
  source: OpportunitySource,
  context: OpportunityActionContext,
  specificId?: string
): Promise<string | null> {
  if (source === 'specific_id' && specificId) {
    return specificId;
  }

  if (source === 'context' && context.contextData?.opportunityId) {
    return context.contextData.opportunityId as string;
  }

  if (source === 'most_recent') {
    const { data } = await supabase
      .from('opportunities')
      .select('id')
      .eq('org_id', context.orgId)
      .eq('contact_id', context.contactId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return data?.id || null;
  }

  return null;
}

async function createTimelineEvent(
  orgId: string,
  opportunityId: string,
  contactId: string,
  eventType: string,
  summary: string,
  payload: Record<string, unknown>,
  actorUserId?: string
): Promise<void> {
  await supabase.from('opportunity_timeline_events').insert({
    org_id: orgId,
    opportunity_id: opportunityId,
    contact_id: contactId,
    event_type: eventType,
    summary,
    payload,
    actor_user_id: actorUserId,
  });
}

async function resolveAssignee(
  orgId: string,
  config: { assigneeType: string; assigneeId?: string; teamId?: string },
  contactId: string
): Promise<string | null> {
  if (config.assigneeType === 'specific_user' && config.assigneeId) {
    return config.assigneeId;
  }

  if (config.assigneeType === 'contact_owner') {
    const { data: contact } = await supabase
      .from('contacts')
      .select('assigned_user_id')
      .eq('id', contactId)
      .maybeSingle();

    return contact?.assigned_user_id || null;
  }

  if (config.assigneeType === 'round_robin') {
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .order('last_assigned_at', { ascending: true, nullsFirst: true })
      .limit(1);

    if (users && users.length > 0) {
      await supabase
        .from('users')
        .update({ last_assigned_at: new Date().toISOString() })
        .eq('id', users[0].id);

      return users[0].id;
    }
  }

  if (config.assigneeType === 'least_busy') {
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('org_id', orgId)
      .eq('status', 'active');

    if (users && users.length > 0) {
      const { data: counts } = await supabase
        .from('opportunities')
        .select('assigned_user_id')
        .eq('org_id', orgId)
        .eq('status', 'open')
        .in('assigned_user_id', users.map(u => u.id));

      const countMap = new Map<string, number>();
      users.forEach(u => countMap.set(u.id, 0));
      counts?.forEach(o => {
        if (o.assigned_user_id) {
          countMap.set(o.assigned_user_id, (countMap.get(o.assigned_user_id) || 0) + 1);
        }
      });

      let leastBusyUser = users[0].id;
      let minCount = countMap.get(users[0].id) || 0;

      for (const user of users) {
        const count = countMap.get(user.id) || 0;
        if (count < minCount) {
          minCount = count;
          leastBusyUser = user.id;
        }
      }

      return leastBusyUser;
    }
  }

  return null;
}

export async function createOpportunity(
  config: CreateOpportunityConfig,
  context: OpportunityActionContext
): Promise<OpportunityActionResult> {
  try {
    const assignedUserId = await resolveAssignee(
      context.orgId,
      {
        assigneeType: config.assigneeType,
        assigneeId: config.assigneeId,
      },
      context.contactId
    );

    let value = config.value || 0;
    if (config.valueFromField && context.contextData) {
      const fieldValue = context.contextData[config.valueFromField];
      if (typeof fieldValue === 'number') {
        value = fieldValue;
      } else if (typeof fieldValue === 'string') {
        value = parseFloat(fieldValue) || 0;
      }
    }

    let closeDate: string | null = null;
    if (config.closeDate) {
      closeDate = config.closeDate;
    } else if (config.closeDateDays) {
      const date = new Date();
      date.setDate(date.getDate() + config.closeDateDays);
      closeDate = date.toISOString().split('T')[0];
    }

    const opportunityName = config.nameTemplate
      ? resolveMergeFields(config.nameTemplate, context.contextData || {})
      : config.name || 'New Opportunity';

    const { data: opportunity, error } = await supabase
      .from('opportunities')
      .insert({
        org_id: context.orgId,
        contact_id: context.contactId,
        pipeline_id: config.pipelineId,
        stage_id: config.stageId,
        name: opportunityName,
        value_amount: value,
        currency: config.currency || 'USD',
        source: config.source,
        close_date: closeDate,
        assigned_user_id: assignedUserId,
        created_by: context.actorUserId || assignedUserId,
        status: 'open',
      })
      .select()
      .single();

    if (error) throw error;

    if (config.customFields && Object.keys(config.customFields).length > 0) {
      const { data: customFieldDefs } = await supabase
        .from('pipeline_custom_fields')
        .select('id, field_key')
        .eq('pipeline_id', config.pipelineId);

      const fieldMap = new Map(customFieldDefs?.map(f => [f.field_key, f.id]) || []);

      const customFieldValues = Object.entries(config.customFields)
        .filter(([key]) => fieldMap.has(key))
        .map(([key, value]) => ({
          org_id: context.orgId,
          opportunity_id: opportunity.id,
          pipeline_custom_field_id: fieldMap.get(key),
          ...getTypedFieldValue(value),
        }));

      if (customFieldValues.length > 0) {
        await supabase.from('opportunity_custom_field_values').insert(customFieldValues);
      }
    }

    await createTimelineEvent(
      context.orgId,
      opportunity.id,
      context.contactId,
      'opportunity_created',
      'Opportunity created via workflow',
      {
        workflow_enrollment_id: context.enrollmentId,
        pipeline_id: config.pipelineId,
        stage_id: config.stageId,
        value: value,
      },
      context.actorUserId
    );

    return {
      success: true,
      opportunityId: opportunity.id,
      data: { opportunity },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create opportunity',
    };
  }
}

export async function updateOpportunity(
  config: UpdateOpportunityConfig,
  context: OpportunityActionContext
): Promise<OpportunityActionResult> {
  try {
    const opportunityId = await resolveOpportunityId(
      config.opportunitySource,
      context,
      config.opportunityId
    );

    if (!opportunityId) {
      return { success: false, error: 'Opportunity not found' };
    }

    const updates: Record<string, unknown> = {};

    if (config.updates.name !== undefined) {
      updates.name = config.updates.name;
    }
    if (config.updates.value !== undefined) {
      updates.value_amount = config.updates.value;
    }
    if (config.updates.source !== undefined) {
      updates.source = config.updates.source;
    }
    if (config.updates.closeDate !== undefined) {
      updates.close_date = config.updates.closeDate;
    }

    const { data: opportunity, error } = await supabase
      .from('opportunities')
      .update(updates)
      .eq('id', opportunityId)
      .select()
      .single();

    if (error) throw error;

    if (config.updates.customFields) {
      const { data: existingOpp } = await supabase
        .from('opportunities')
        .select('pipeline_id')
        .eq('id', opportunityId)
        .single();

      if (existingOpp) {
        const { data: customFieldDefs } = await supabase
          .from('pipeline_custom_fields')
          .select('id, field_key')
          .eq('pipeline_id', existingOpp.pipeline_id);

        const fieldMap = new Map(customFieldDefs?.map(f => [f.field_key, f.id]) || []);

        for (const [key, value] of Object.entries(config.updates.customFields)) {
          const fieldId = fieldMap.get(key);
          if (fieldId) {
            await supabase.from('opportunity_custom_field_values').upsert(
              {
                org_id: context.orgId,
                opportunity_id: opportunityId,
                pipeline_custom_field_id: fieldId,
                ...getTypedFieldValue(value),
              },
              { onConflict: 'opportunity_id,pipeline_custom_field_id' }
            );
          }
        }
      }
    }

    await createTimelineEvent(
      context.orgId,
      opportunityId,
      context.contactId,
      'opportunity_updated',
      'Opportunity updated via workflow',
      {
        workflow_enrollment_id: context.enrollmentId,
        updates: config.updates,
      },
      context.actorUserId
    );

    return {
      success: true,
      opportunityId,
      data: { opportunity },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update opportunity',
    };
  }
}

export async function moveOpportunityStage(
  config: MoveStageConfig,
  context: OpportunityActionContext
): Promise<OpportunityActionResult> {
  try {
    const opportunityId = await resolveOpportunityId(
      config.opportunitySource,
      context,
      config.opportunityId
    );

    if (!opportunityId) {
      return { success: false, error: 'Opportunity not found' };
    }

    const { data: currentOpp } = await supabase
      .from('opportunities')
      .select('stage_id, pipeline_id, stage:pipeline_stages!stage_id(name, sort_order)')
      .eq('id', opportunityId)
      .single();

    if (!currentOpp) {
      return { success: false, error: 'Opportunity not found' };
    }

    const { data: targetStage } = await supabase
      .from('pipeline_stages')
      .select('id, name, sort_order, pipeline_id')
      .eq('id', config.targetStageId)
      .single();

    if (!targetStage) {
      return { success: false, error: 'Target stage not found' };
    }

    if (targetStage.pipeline_id !== currentOpp.pipeline_id) {
      return { success: false, error: 'Target stage is not in the same pipeline' };
    }

    if (config.validateSequence) {
      const currentStage = currentOpp.stage as { sort_order: number } | null;
      if (currentStage && targetStage.sort_order < currentStage.sort_order) {
        return { success: false, error: 'Cannot move to a previous stage when sequence validation is enabled' };
      }
    }

    const { data: opportunity, error } = await supabase
      .from('opportunities')
      .update({ stage_id: config.targetStageId })
      .eq('id', opportunityId)
      .select()
      .single();

    if (error) throw error;

    if (config.createTimelineEvent !== false) {
      const currentStageName = (currentOpp.stage as { name: string } | null)?.name || 'Unknown';
      await createTimelineEvent(
        context.orgId,
        opportunityId,
        context.contactId,
        'stage_changed',
        `Stage changed from "${currentStageName}" to "${targetStage.name}"`,
        {
          workflow_enrollment_id: context.enrollmentId,
          from_stage_id: currentOpp.stage_id,
          to_stage_id: config.targetStageId,
          from_stage_name: currentStageName,
          to_stage_name: targetStage.name,
        },
        context.actorUserId
      );
    }

    return {
      success: true,
      opportunityId,
      data: { opportunity, newStage: targetStage },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to move opportunity stage',
    };
  }
}

export async function assignOpportunityOwner(
  config: AssignOpportunityOwnerConfig,
  context: OpportunityActionContext
): Promise<OpportunityActionResult> {
  try {
    const opportunityId = await resolveOpportunityId(
      config.opportunitySource,
      context,
      config.opportunityId
    );

    if (!opportunityId) {
      return { success: false, error: 'Opportunity not found' };
    }

    const newOwnerId = await resolveAssignee(
      context.orgId,
      {
        assigneeType: config.ownerType,
        assigneeId: config.ownerId,
        teamId: config.teamId,
      },
      context.contactId
    );

    if (!newOwnerId) {
      return { success: false, error: 'Could not resolve new owner' };
    }

    const { data: opportunity, error } = await supabase
      .from('opportunities')
      .update({ assigned_user_id: newOwnerId })
      .eq('id', opportunityId)
      .select('*, assigned_user:users!assigned_user_id(id, name, email)')
      .single();

    if (error) throw error;

    await createTimelineEvent(
      context.orgId,
      opportunityId,
      context.contactId,
      'owner_assigned',
      `Opportunity assigned to ${opportunity.assigned_user?.name || 'user'}`,
      {
        workflow_enrollment_id: context.enrollmentId,
        new_owner_id: newOwnerId,
      },
      context.actorUserId
    );

    if (config.notifyOwner) {
      await supabase.from('inbox_events').insert({
        org_id: context.orgId,
        user_id: newOwnerId,
        event_type: 'opportunity_assigned',
        title: 'Opportunity Assigned',
        body: `You have been assigned a new opportunity`,
        metadata: { opportunity_id: opportunityId },
        read: false,
      });
    }

    return {
      success: true,
      opportunityId,
      data: { opportunity },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assign opportunity owner',
    };
  }
}

export async function markOpportunityWon(
  config: MarkWonConfig,
  context: OpportunityActionContext
): Promise<OpportunityActionResult> {
  try {
    const opportunityId = await resolveOpportunityId(
      config.opportunitySource,
      context,
      config.opportunityId
    );

    if (!opportunityId) {
      return { success: false, error: 'Opportunity not found' };
    }

    const closeDate = config.closeDate || new Date().toISOString().split('T')[0];

    const { data: opportunity, error } = await supabase
      .from('opportunities')
      .update({
        status: 'won',
        close_date: closeDate,
        closed_at: new Date().toISOString(),
      })
      .eq('id', opportunityId)
      .select()
      .single();

    if (error) throw error;

    if (config.createTimelineEvent !== false) {
      await createTimelineEvent(
        context.orgId,
        opportunityId,
        context.contactId,
        'opportunity_won',
        'Opportunity marked as won',
        {
          workflow_enrollment_id: context.enrollmentId,
          close_date: closeDate,
          notes: config.notes,
        },
        context.actorUserId
      );
    }

    return {
      success: true,
      opportunityId,
      data: { opportunity },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark opportunity as won',
    };
  }
}

export async function markOpportunityLost(
  config: MarkLostConfig,
  context: OpportunityActionContext
): Promise<OpportunityActionResult> {
  try {
    const opportunityId = await resolveOpportunityId(
      config.opportunitySource,
      context,
      config.opportunityId
    );

    if (!opportunityId) {
      return { success: false, error: 'Opportunity not found' };
    }

    const closeDate = config.closeDate || new Date().toISOString().split('T')[0];
    let lostReason = config.lostReasonText;

    if (config.lostReasonId && !lostReason) {
      const { data: reason } = await supabase
        .from('lost_reasons')
        .select('name')
        .eq('id', config.lostReasonId)
        .maybeSingle();

      lostReason = reason?.name;
    }

    const { data: opportunity, error } = await supabase
      .from('opportunities')
      .update({
        status: 'lost',
        close_date: closeDate,
        closed_at: new Date().toISOString(),
        lost_reason: lostReason,
      })
      .eq('id', opportunityId)
      .select()
      .single();

    if (error) throw error;

    if (config.createTimelineEvent !== false) {
      await createTimelineEvent(
        context.orgId,
        opportunityId,
        context.contactId,
        'opportunity_lost',
        `Opportunity marked as lost${lostReason ? `: ${lostReason}` : ''}`,
        {
          workflow_enrollment_id: context.enrollmentId,
          close_date: closeDate,
          lost_reason: lostReason,
          notes: config.notes,
        },
        context.actorUserId
      );
    }

    return {
      success: true,
      opportunityId,
      data: { opportunity },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark opportunity as lost',
    };
  }
}

function resolveMergeFields(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = data[key];
    if (value === undefined || value === null) return '';
    return String(value);
  });
}

function getTypedFieldValue(value: unknown): {
  value_text?: string | null;
  value_number?: number | null;
  value_date?: string | null;
  value_boolean?: boolean | null;
  value_json?: unknown | null;
} {
  if (value === null || value === undefined) {
    return { value_text: null };
  }

  if (typeof value === 'string') {
    return { value_text: value };
  }

  if (typeof value === 'number') {
    return { value_number: value };
  }

  if (typeof value === 'boolean') {
    return { value_boolean: value };
  }

  if (value instanceof Date) {
    return { value_date: value.toISOString().split('T')[0] };
  }

  if (Array.isArray(value) || typeof value === 'object') {
    return { value_json: value };
  }

  return { value_text: String(value) };
}
