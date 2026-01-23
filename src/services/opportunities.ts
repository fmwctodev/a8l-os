import { supabase } from '../lib/supabase';
import type {
  Opportunity,
  OpportunityFilters,
  OpportunityStats,
  StageStats,
  OpportunityBoardData,
  OpportunityStatus,
  OpportunityCustomFieldValue
} from '../types';
import { createTimelineEvent } from './opportunityTimeline';

function normalizeOpportunityTags(opportunity: Opportunity): Opportunity {
  if (opportunity.contact && (opportunity.contact as any).tags) {
    (opportunity.contact as any).tags = ((opportunity.contact as any).tags as Array<{ tag: unknown }>)
      .map((ct) => ct.tag)
      .filter(Boolean);
  }
  return opportunity;
}

function normalizeOpportunitiesArray(opportunities: Opportunity[]): Opportunity[] {
  return opportunities.map(normalizeOpportunityTags);
}

const OPPORTUNITY_SELECT = `
  *,
  contact:contacts(
    *,
    tags:contact_tags(tag:tags(*))
  ),
  pipeline:pipelines(*),
  stage:pipeline_stages(*),
  assigned_user:users!opportunities_assigned_user_id_fkey(*),
  department:departments(*),
  lost_reason_ref:lost_reasons(*),
  custom_field_values:opportunity_custom_field_values(
    *,
    custom_field:pipeline_custom_fields(*)
  )
`;

export async function getOpportunities(
  filters: OpportunityFilters = {},
  page = 1,
  pageSize = 25
): Promise<{ data: Opportunity[]; total: number }> {
  let query = supabase
    .from('opportunities')
    .select(OPPORTUNITY_SELECT, { count: 'exact' });

  if (filters.pipelineId) {
    query = query.eq('pipeline_id', filters.pipelineId);
  }

  if (filters.stageId) {
    query = query.eq('stage_id', filters.stageId);
  }

  if (filters.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  if (filters.assignedUserId !== undefined) {
    if (filters.assignedUserId === null) {
      query = query.is('assigned_user_id', null);
    } else {
      query = query.eq('assigned_user_id', filters.assignedUserId);
    }
  }

  if (filters.departmentId) {
    query = query.eq('department_id', filters.departmentId);
  }

  if (filters.createdAfter) {
    query = query.gte('created_at', filters.createdAfter);
  }

  if (filters.createdBefore) {
    query = query.lte('created_at', filters.createdBefore);
  }

  if (filters.updatedAfter) {
    query = query.gte('updated_at', filters.updatedAfter);
  }

  if (filters.updatedBefore) {
    query = query.lte('updated_at', filters.updatedBefore);
  }

  if (filters.minValue !== undefined) {
    query = query.gte('value_amount', filters.minValue);
  }

  if (filters.maxValue !== undefined) {
    query = query.lte('value_amount', filters.maxValue);
  }

  const offset = (page - 1) * pageSize;
  query = query
    .order('updated_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  let opportunities = data || [];

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    opportunities = opportunities.filter((opp: Opportunity) => {
      const contact = opp.contact;
      if (!contact) return false;
      const fullName = `${contact.first_name} ${contact.last_name}`.toLowerCase();
      const email = (contact.email || '').toLowerCase();
      const phone = (contact.phone || '').toLowerCase();
      return fullName.includes(searchLower) ||
        email.includes(searchLower) ||
        phone.includes(searchLower);
    });
  }

  if (filters.tagIds && filters.tagIds.length > 0) {
    opportunities = opportunities.filter((opp: Opportunity) => {
      const contactTags = (opp.contact as any)?.tags?.map((t: any) => t.tag?.id) || [];
      return filters.tagIds!.some(tagId => contactTags.includes(tagId));
    });
  }

  if (filters.excludeTagIds && filters.excludeTagIds.length > 0) {
    opportunities = opportunities.filter((opp: Opportunity) => {
      const contactTags = (opp.contact as any)?.tags?.map((t: any) => t.tag?.id) || [];
      return !filters.excludeTagIds!.some(tagId => contactTags.includes(tagId));
    });
  }

  return {
    data: normalizeOpportunitiesArray(opportunities),
    total: count || 0
  };
}

export async function getOpportunityById(id: string): Promise<Opportunity | null> {
  const { data, error } = await supabase
    .from('opportunities')
    .select(OPPORTUNITY_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeOpportunityTags(data) : null;
}

export async function getOpportunitiesByContact(contactId: string): Promise<Opportunity[]> {
  const { data, error } = await supabase
    .from('opportunities')
    .select(OPPORTUNITY_SELECT)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return normalizeOpportunitiesArray(data || []);
}

export async function getBoardData(pipelineId: string, filters: OpportunityFilters = {}): Promise<OpportunityBoardData> {
  const { data: pipeline, error: pipelineError } = await supabase
    .from('pipelines')
    .select(`
      *,
      stages:pipeline_stages(*)
    `)
    .eq('id', pipelineId)
    .single();

  if (pipelineError) throw pipelineError;

  const sortedStages = (pipeline.stages || []).sort((a: any, b: any) => a.sort_order - b.sort_order);

  const { data: opportunities, error: oppError } = await supabase
    .from('opportunities')
    .select(OPPORTUNITY_SELECT)
    .eq('pipeline_id', pipelineId);

  if (oppError) throw oppError;

  let filteredOpps = opportunities || [];

  if (filters.status && filters.status.length > 0) {
    filteredOpps = filteredOpps.filter((o: Opportunity) => filters.status!.includes(o.status));
  }

  if (filters.assignedUserId !== undefined) {
    if (filters.assignedUserId === null) {
      filteredOpps = filteredOpps.filter((o: Opportunity) => !o.assigned_user_id);
    } else {
      filteredOpps = filteredOpps.filter((o: Opportunity) => o.assigned_user_id === filters.assignedUserId);
    }
  }

  if (filters.departmentId) {
    filteredOpps = filteredOpps.filter((o: Opportunity) => o.department_id === filters.departmentId);
  }

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filteredOpps = filteredOpps.filter((opp: Opportunity) => {
      const contact = opp.contact;
      if (!contact) return false;
      const fullName = `${contact.first_name} ${contact.last_name}`.toLowerCase();
      const email = (contact.email || '').toLowerCase();
      const phone = (contact.phone || '').toLowerCase();
      return fullName.includes(searchLower) ||
        email.includes(searchLower) ||
        phone.includes(searchLower);
    });
  }

  const normalizedOpps = normalizeOpportunitiesArray(filteredOpps);

  const stagesWithOpportunities = sortedStages.map((stage: any) => ({
    ...stage,
    opportunities: normalizedOpps
      .filter((o: Opportunity) => o.stage_id === stage.id)
      .sort((a: Opportunity, b: Opportunity) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }));

  return {
    pipeline,
    stages: stagesWithOpportunities
  };
}

export async function createOpportunity(
  opportunity: {
    org_id: string;
    contact_id: string;
    pipeline_id: string;
    stage_id: string;
    assigned_user_id?: string | null;
    department_id?: string | null;
    value_amount?: number;
    currency?: string;
    source?: string | null;
    close_date?: string | null;
    created_by: string;
  },
  customFieldValues?: Record<string, unknown>
): Promise<Opportunity> {
  const { data, error } = await supabase
    .from('opportunities')
    .insert({
      org_id: opportunity.org_id,
      contact_id: opportunity.contact_id,
      pipeline_id: opportunity.pipeline_id,
      stage_id: opportunity.stage_id,
      assigned_user_id: opportunity.assigned_user_id || null,
      department_id: opportunity.department_id || null,
      value_amount: opportunity.value_amount ?? 0,
      currency: opportunity.currency || 'USD',
      source: opportunity.source || null,
      close_date: opportunity.close_date || null,
      created_by: opportunity.created_by,
      status: 'open'
    })
    .select(OPPORTUNITY_SELECT)
    .single();

  if (error) throw error;

  if (customFieldValues && Object.keys(customFieldValues).length > 0) {
    await saveCustomFieldValues(data.id, opportunity.org_id, customFieldValues);
  }

  await createTimelineEvent({
    org_id: opportunity.org_id,
    opportunity_id: data.id,
    contact_id: opportunity.contact_id,
    event_type: 'opportunity_created',
    summary: 'Opportunity created',
    payload: {
      pipeline_id: opportunity.pipeline_id,
      stage_id: opportunity.stage_id,
      value_amount: opportunity.value_amount ?? 0
    },
    actor_user_id: opportunity.created_by
  });

  return normalizeOpportunityTags(data);
}

export async function updateOpportunity(
  id: string,
  updates: Partial<{
    pipeline_id: string;
    stage_id: string;
    assigned_user_id: string | null;
    department_id: string | null;
    value_amount: number;
    currency: string;
    source: string | null;
    close_date: string | null;
  }>,
  actorUserId: string,
  customFieldValues?: Record<string, unknown>
): Promise<Opportunity> {
  const existing = await getOpportunityById(id);
  if (!existing) throw new Error('Opportunity not found');

  const { data, error } = await supabase
    .from('opportunities')
    .update(updates)
    .eq('id', id)
    .select(OPPORTUNITY_SELECT)
    .single();

  if (error) throw error;

  if (updates.pipeline_id && updates.pipeline_id !== existing.pipeline_id) {
    await createTimelineEvent({
      org_id: existing.org_id,
      opportunity_id: id,
      contact_id: existing.contact_id,
      event_type: 'pipeline_changed',
      summary: `Pipeline changed from "${existing.pipeline?.name}" to "${data.pipeline?.name}"`,
      payload: {
        from_pipeline_id: existing.pipeline_id,
        to_pipeline_id: updates.pipeline_id,
        from_pipeline_name: existing.pipeline?.name,
        to_pipeline_name: data.pipeline?.name
      },
      actor_user_id: actorUserId
    });
  }

  if (updates.stage_id && updates.stage_id !== existing.stage_id) {
    await createTimelineEvent({
      org_id: existing.org_id,
      opportunity_id: id,
      contact_id: existing.contact_id,
      event_type: 'stage_changed',
      summary: `Stage changed from "${existing.stage?.name}" to "${data.stage?.name}"`,
      payload: {
        from_stage_id: existing.stage_id,
        to_stage_id: updates.stage_id,
        from_stage_name: existing.stage?.name,
        to_stage_name: data.stage?.name
      },
      actor_user_id: actorUserId
    });
  }

  if (updates.assigned_user_id !== undefined && updates.assigned_user_id !== existing.assigned_user_id) {
    await createTimelineEvent({
      org_id: existing.org_id,
      opportunity_id: id,
      contact_id: existing.contact_id,
      event_type: 'assigned_changed',
      summary: `Assignment changed`,
      payload: {
        from_user_id: existing.assigned_user_id,
        to_user_id: updates.assigned_user_id,
        from_user_name: existing.assigned_user?.name,
        to_user_name: data.assigned_user?.name
      },
      actor_user_id: actorUserId
    });
  }

  if (updates.value_amount !== undefined && updates.value_amount !== existing.value_amount) {
    await createTimelineEvent({
      org_id: existing.org_id,
      opportunity_id: id,
      contact_id: existing.contact_id,
      event_type: 'value_changed',
      summary: `Value changed from $${existing.value_amount.toLocaleString()} to $${updates.value_amount.toLocaleString()}`,
      payload: {
        from_value: existing.value_amount,
        to_value: updates.value_amount
      },
      actor_user_id: actorUserId
    });
  }

  if (customFieldValues && Object.keys(customFieldValues).length > 0) {
    await saveCustomFieldValues(id, existing.org_id, customFieldValues);
  }

  return normalizeOpportunityTags(data);
}

export async function moveOpportunityToStage(
  id: string,
  stageId: string,
  actorUserId: string
): Promise<Opportunity> {
  return updateOpportunity(id, { stage_id: stageId }, actorUserId);
}

export async function closeOpportunity(
  id: string,
  status: 'won' | 'lost',
  actorUserId: string,
  lostReasonId?: string,
  lostReasonText?: string
): Promise<Opportunity> {
  const existing = await getOpportunityById(id);
  if (!existing) throw new Error('Opportunity not found');

  const updateData: Record<string, unknown> = {
    status,
    closed_at: new Date().toISOString()
  };

  if (status === 'lost') {
    if (lostReasonId) {
      updateData.lost_reason_id = lostReasonId;
    }
    if (lostReasonText) {
      updateData.lost_reason = lostReasonText;
    }
  }

  const { data, error } = await supabase
    .from('opportunities')
    .update(updateData)
    .eq('id', id)
    .select(OPPORTUNITY_SELECT)
    .single();

  if (error) throw error;

  await createTimelineEvent({
    org_id: existing.org_id,
    opportunity_id: id,
    contact_id: existing.contact_id,
    event_type: 'status_changed',
    summary: `Opportunity marked as ${status}${lostReasonText ? `: ${lostReasonText}` : ''}`,
    payload: {
      from_status: existing.status,
      to_status: status,
      lost_reason_id: lostReasonId,
      lost_reason: lostReasonText
    },
    actor_user_id: actorUserId
  });

  return normalizeOpportunityTags(data);
}

export async function reopenOpportunity(
  id: string,
  actorUserId: string
): Promise<Opportunity> {
  const existing = await getOpportunityById(id);
  if (!existing) throw new Error('Opportunity not found');

  const { data, error } = await supabase
    .from('opportunities')
    .update({
      status: 'open',
      closed_at: null,
      lost_reason: null
    })
    .eq('id', id)
    .select(OPPORTUNITY_SELECT)
    .single();

  if (error) throw error;

  await createTimelineEvent({
    org_id: existing.org_id,
    opportunity_id: id,
    contact_id: existing.contact_id,
    event_type: 'status_changed',
    summary: 'Opportunity reopened',
    payload: {
      from_status: existing.status,
      to_status: 'open'
    },
    actor_user_id: actorUserId
  });

  return normalizeOpportunityTags(data);
}

export async function deleteOpportunity(id: string): Promise<void> {
  const { error } = await supabase
    .from('opportunities')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getOpportunityStats(pipelineId?: string): Promise<OpportunityStats> {
  let query = supabase.from('opportunities').select('status, value_amount');

  if (pipelineId) {
    query = query.eq('pipeline_id', pipelineId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const opportunities = data || [];
  const total = opportunities.length;
  const open = opportunities.filter(o => o.status === 'open').length;
  const won = opportunities.filter(o => o.status === 'won').length;
  const lost = opportunities.filter(o => o.status === 'lost').length;
  const totalValue = opportunities.reduce((sum, o) => sum + Number(o.value_amount), 0);
  const wonValue = opportunities.filter(o => o.status === 'won').reduce((sum, o) => sum + Number(o.value_amount), 0);
  const closed = won + lost;
  const conversionRate = closed > 0 ? (won / closed) * 100 : 0;

  return {
    totalOpportunities: total,
    openOpportunities: open,
    wonOpportunities: won,
    lostOpportunities: lost,
    totalValue,
    wonValue,
    conversionRate
  };
}

export async function getStageStats(pipelineId: string): Promise<StageStats[]> {
  const { data: stages, error: stagesError } = await supabase
    .from('pipeline_stages')
    .select('id, name')
    .eq('pipeline_id', pipelineId)
    .order('sort_order');

  if (stagesError) throw stagesError;

  const { data: opportunities, error: oppError } = await supabase
    .from('opportunities')
    .select('stage_id, value_amount')
    .eq('pipeline_id', pipelineId);

  if (oppError) throw oppError;

  return (stages || []).map(stage => {
    const stageOpps = (opportunities || []).filter(o => o.stage_id === stage.id);
    return {
      stageId: stage.id,
      stageName: stage.name,
      count: stageOpps.length,
      value: stageOpps.reduce((sum, o) => sum + Number(o.value_amount), 0)
    };
  });
}

async function saveCustomFieldValues(
  opportunityId: string,
  orgId: string,
  values: Record<string, unknown>
): Promise<void> {
  const { data: fields, error: fieldsError } = await supabase
    .from('pipeline_custom_fields')
    .select('id, field_key, field_type')
    .in('field_key', Object.keys(values));

  if (fieldsError) throw fieldsError;

  for (const field of fields || []) {
    const value = values[field.field_key];
    if (value === undefined) continue;

    const valueRecord: Record<string, unknown> = {
      org_id: orgId,
      opportunity_id: opportunityId,
      pipeline_custom_field_id: field.id,
      value_text: null,
      value_number: null,
      value_date: null,
      value_boolean: null,
      value_json: null
    };

    switch (field.field_type) {
      case 'text':
      case 'dropdown':
        valueRecord.value_text = String(value);
        break;
      case 'number':
        valueRecord.value_number = Number(value);
        break;
      case 'date':
        valueRecord.value_date = String(value);
        break;
      case 'boolean':
        valueRecord.value_boolean = Boolean(value);
        break;
      case 'multi_select':
        valueRecord.value_json = value;
        break;
    }

    const { error } = await supabase
      .from('opportunity_custom_field_values')
      .upsert(valueRecord, {
        onConflict: 'opportunity_id,pipeline_custom_field_id'
      });

    if (error) throw error;
  }
}

export async function getCustomFieldValues(opportunityId: string): Promise<OpportunityCustomFieldValue[]> {
  const { data, error } = await supabase
    .from('opportunity_custom_field_values')
    .select(`
      *,
      custom_field:pipeline_custom_fields(*)
    `)
    .eq('opportunity_id', opportunityId);

  if (error) throw error;
  return data || [];
}

export async function bulkAssignOwner(
  ids: string[],
  assignedUserId: string | null,
  actorUserId: string
): Promise<void> {
  for (const id of ids) {
    await updateOpportunity(id, { assigned_user_id: assignedUserId }, actorUserId);
  }
}

export async function bulkChangeStage(
  ids: string[],
  stageId: string,
  actorUserId: string
): Promise<void> {
  for (const id of ids) {
    await moveOpportunityToStage(id, stageId, actorUserId);
  }
}

export async function bulkClose(
  ids: string[],
  status: 'won' | 'lost',
  actorUserId: string,
  lostReasonId?: string,
  lostReasonText?: string
): Promise<void> {
  for (const id of ids) {
    await closeOpportunity(id, status, actorUserId, lostReasonId, lostReasonText);
  }
}

export async function exportOpportunitiesToCSV(
  filters: OpportunityFilters = {}
): Promise<string> {
  const { data } = await getOpportunities(filters, 1, 10000);

  const headers = [
    'Contact Name',
    'Email',
    'Phone',
    'Pipeline',
    'Stage',
    'Status',
    'Value',
    'Currency',
    'Owner',
    'Source',
    'Close Date',
    'Created At',
    'Lost Reason'
  ];

  const rows = data.map(opp => [
    opp.contact ? `${opp.contact.first_name} ${opp.contact.last_name}` : '',
    opp.contact?.email || '',
    opp.contact?.phone || '',
    opp.pipeline?.name || '',
    opp.stage?.name || '',
    opp.status,
    opp.value_amount.toString(),
    opp.currency,
    opp.assigned_user?.name || 'Unassigned',
    opp.source || '',
    opp.close_date || '',
    opp.created_at,
    opp.lost_reason || ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  return csvContent;
}
