import { supabase } from '../lib/supabase';
import type {
  Proposal,
  ProposalFilters,
  ProposalStats,
  ProposalTemplate,
  ProposalLineItem,
  ProposalSection,
  ProposalComment,
  ProposalActivity,
  ProposalStatus,
  ProposalSectionType,
} from '../types';
import { emitEvent } from './eventDispatcher';
import { createOpportunity } from './opportunities';

const FROZEN_STATUSES = ['pending_signature', 'viewed', 'signed'] as const;

async function assertNotFrozen(proposalId: string): Promise<void> {
  const { data } = await supabase
    .from('proposals')
    .select('signature_status')
    .eq('id', proposalId)
    .maybeSingle();

  if (data?.signature_status && FROZEN_STATUSES.includes(data.signature_status)) {
    throw new Error('This proposal is locked for signing and cannot be edited. Void the signature request first to make changes.');
  }
}

const PROPOSAL_SELECT = `
  *,
  contact:contacts(*),
  opportunity:opportunities(*),
  created_by_user:users!proposals_created_by_fkey(*),
  assigned_user:users!proposals_assigned_user_id_fkey(*),
  template:proposal_templates(*),
  line_items:proposal_line_items(*, product:products(*)),
  sections:proposal_sections(*),
  meeting_contexts:proposal_meeting_contexts(*, meeting_transcription:meeting_transcriptions(*))
`;

const TEMPLATE_SELECT = `
  *,
  created_by_user:users(*)
`;

export async function getProposals(
  filters: ProposalFilters = {},
  page = 1,
  pageSize = 25
): Promise<{ data: Proposal[]; total: number }> {
  let query = supabase
    .from('proposals')
    .select(PROPOSAL_SELECT, { count: 'exact' });

  if (filters.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  if (filters.contactId) {
    query = query.eq('contact_id', filters.contactId);
  }

  if (filters.opportunityId) {
    query = query.eq('opportunity_id', filters.opportunityId);
  }

  if (filters.assignedUserId) {
    query = query.eq('assigned_user_id', filters.assignedUserId);
  }

  if (filters.createdAfter) {
    query = query.gte('created_at', filters.createdAfter);
  }

  if (filters.createdBefore) {
    query = query.lte('created_at', filters.createdBefore);
  }

  if (filters.search) {
    query = query.ilike('title', `%${filters.search}%`);
  }

  if (!filters.includeArchived) {
    query = query.is('archived_at', null);
  }

  const offset = (page - 1) * pageSize;
  query = query
    .order('updated_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    data: data || [],
    total: count || 0
  };
}

export async function getProposalById(id: string): Promise<Proposal | null> {
  const { data, error } = await supabase
    .from('proposals')
    .select(PROPOSAL_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getProposalByToken(token: string): Promise<Proposal | null> {
  const { data, error } = await supabase
    .from('proposals')
    .select(PROPOSAL_SELECT)
    .eq('public_token', token)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getProposalsByContact(contactId: string): Promise<Proposal[]> {
  const { data, error } = await supabase
    .from('proposals')
    .select(PROPOSAL_SELECT)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getProposalsByOpportunity(opportunityId: string): Promise<Proposal[]> {
  const { data, error } = await supabase
    .from('proposals')
    .select(PROPOSAL_SELECT)
    .eq('opportunity_id', opportunityId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createProposal(
  proposal: {
    org_id: string;
    contact_id: string;
    opportunity_id?: string | null;
    title: string;
    content?: string;
    summary?: string;
    total_value?: number;
    currency?: string;
    valid_until?: string | null;
    created_by: string;
    assigned_user_id?: string | null;
    template_id?: string | null;
    ai_context?: Record<string, unknown>;
  }
): Promise<Proposal> {
  let opportunityId = proposal.opportunity_id || null;

  if (!opportunityId) {
    try {
      opportunityId = await autoCreateOpportunity(proposal);
    } catch (err) {
      console.error('Auto-create opportunity failed, proceeding without:', err);
    }
  }

  const { data, error } = await supabase
    .from('proposals')
    .insert({
      org_id: proposal.org_id,
      contact_id: proposal.contact_id,
      opportunity_id: opportunityId,
      title: proposal.title,
      content: proposal.content || '',
      summary: proposal.summary || null,
      total_value: proposal.total_value ?? 0,
      currency: proposal.currency || 'USD',
      valid_until: proposal.valid_until || null,
      created_by: proposal.created_by,
      assigned_user_id: proposal.assigned_user_id || null,
      template_id: proposal.template_id || null,
      ai_context: proposal.ai_context || {},
      status: 'draft'
    })
    .select(PROPOSAL_SELECT)
    .single();

  if (error) throw error;

  await createProposalActivity(data.id, data.org_id, 'created', 'Proposal created', {}, proposal.created_by);

  return data;
}

async function autoCreateOpportunity(proposal: {
  org_id: string;
  contact_id: string;
  title: string;
  total_value?: number;
  currency?: string;
  created_by: string;
}): Promise<string | null> {
  const { data: pipeline } = await supabase
    .from('pipelines')
    .select('id, stages:pipeline_stages(id, name, sort_order)')
    .eq('org_id', proposal.org_id)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!pipeline || !pipeline.stages?.length) return null;

  const stages = (pipeline.stages as Array<{ id: string; name: string; sort_order: number }>)
    .sort((a, b) => a.sort_order - b.sort_order);

  const proposalStage = stages.find(s =>
    s.name.toLowerCase().includes('proposal')
  );
  const stageId = proposalStage?.id || stages[0].id;

  const opp = await createOpportunity({
    org_id: proposal.org_id,
    contact_id: proposal.contact_id,
    pipeline_id: pipeline.id,
    stage_id: stageId,
    value_amount: proposal.total_value ?? 0,
    currency: proposal.currency || 'USD',
    source: 'proposal',
    created_by: proposal.created_by,
  });

  return opp.id;
}

export async function updateProposal(
  id: string,
  updates: Partial<{
    title: string;
    content: string;
    summary: string;
    total_value: number;
    currency: string;
    valid_until: string | null;
    assigned_user_id: string | null;
    ai_context: Record<string, unknown>;
  }>,
  actorUserId: string
): Promise<Proposal> {
  await assertNotFrozen(id);
  const { data, error } = await supabase
    .from('proposals')
    .update(updates)
    .eq('id', id)
    .select(PROPOSAL_SELECT)
    .single();

  if (error) throw error;

  await createProposalActivity(data.id, data.org_id, 'updated', 'Proposal updated', updates, actorUserId);

  return data;
}

export async function updateProposalStatus(
  id: string,
  status: ProposalStatus,
  actorUserId: string
): Promise<Proposal> {
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { status };

  if (status === 'sent' && !updates.sent_at) {
    updates.sent_at = now;
  } else if (status === 'viewed' && !updates.viewed_at) {
    updates.viewed_at = now;
  } else if ((status === 'accepted' || status === 'rejected') && !updates.responded_at) {
    updates.responded_at = now;
  }

  const { data, error } = await supabase
    .from('proposals')
    .update(updates)
    .eq('id', id)
    .select(PROPOSAL_SELECT)
    .single();

  if (error) throw error;

  await createProposalActivity(
    data.id,
    data.org_id,
    'status_changed',
    `Proposal ${status}`,
    { new_status: status },
    actorUserId
  );

  const statusEventMap: Record<string, string> = {
    sent: 'proposal.sent',
    viewed: 'proposal.viewed',
    accepted: 'proposal.accepted',
    rejected: 'proposal.declined',
    signed: 'proposal.accepted',
  };

  const eventKey = statusEventMap[status];
  if (eventKey) {
    emitEvent(eventKey, {
      entityType: 'proposal',
      entityId: data.id,
      orgId: data.org_id,
      data: {
        contact_id: data.contact_id,
        opportunity_id: data.opportunity_id,
        total_value: data.total_value,
        status,
      },
    }, { userId: actorUserId }).catch(() => {});
  }

  return data;
}

export async function sendProposal(id: string, actorUserId: string): Promise<Proposal> {
  return updateProposalStatus(id, 'sent', actorUserId);
}

export async function deleteProposal(id: string): Promise<void> {
  const { error } = await supabase
    .from('proposals')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getProposalStats(filters: ProposalFilters = {}): Promise<ProposalStats> {
  let query = supabase.from('proposals').select('status, total_value, signature_status');

  if (filters.contactId) {
    query = query.eq('contact_id', filters.contactId);
  }

  if (filters.opportunityId) {
    query = query.eq('opportunity_id', filters.opportunityId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const proposals = data || [];
  const total = proposals.length;
  const draft = proposals.filter(p => p.status === 'draft').length;
  const sent = proposals.filter(p => p.status === 'sent').length;
  const viewed = proposals.filter(p => p.status === 'viewed').length;
  const accepted = proposals.filter(p => p.status === 'accepted').length;
  const rejected = proposals.filter(p => p.status === 'rejected').length;
  const signed = proposals.filter(p => p.status === 'signed').length;
  const totalValue = proposals.reduce((sum, p) => sum + Number(p.total_value), 0);
  const acceptedValue = proposals.filter(p => p.status === 'accepted').reduce((sum, p) => sum + Number(p.total_value), 0);
  const signedValue = proposals.filter(p => p.status === 'signed').reduce((sum, p) => sum + Number(p.total_value), 0);
  const responded = accepted + rejected;
  const conversionRate = responded > 0 ? (accepted / responded) * 100 : 0;

  return {
    totalProposals: total,
    draftCount: draft,
    sentCount: sent,
    viewedCount: viewed,
    acceptedCount: accepted,
    rejectedCount: rejected,
    totalValue,
    acceptedValue,
    conversionRate,
    signedCount: signed,
    signedValue,
  };
}

export async function getProposalTemplates(category?: string): Promise<ProposalTemplate[]> {
  let query = supabase
    .from('proposal_templates')
    .select(TEMPLATE_SELECT)
    .order('is_default', { ascending: false })
    .order('name');

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getProposalTemplateById(id: string): Promise<ProposalTemplate | null> {
  const { data, error } = await supabase
    .from('proposal_templates')
    .select(TEMPLATE_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createProposalTemplate(
  template: {
    org_id: string;
    name: string;
    description?: string;
    content: string;
    category?: string;
    is_default?: boolean;
    variables?: unknown[];
    created_by: string;
  }
): Promise<ProposalTemplate> {
  const { data, error } = await supabase
    .from('proposal_templates')
    .insert({
      org_id: template.org_id,
      name: template.name,
      description: template.description || null,
      content: template.content,
      category: template.category || null,
      is_default: template.is_default ?? false,
      variables: template.variables || [],
      created_by: template.created_by
    })
    .select(TEMPLATE_SELECT)
    .single();

  if (error) throw error;
  return data;
}

export async function updateProposalTemplate(
  id: string,
  updates: Partial<{
    name: string;
    description: string | null;
    content: string;
    category: string | null;
    is_default: boolean;
    variables: unknown[];
  }>
): Promise<ProposalTemplate> {
  const { data, error } = await supabase
    .from('proposal_templates')
    .update(updates)
    .eq('id', id)
    .select(TEMPLATE_SELECT)
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProposalTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('proposal_templates')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function addProposalLineItem(
  item: {
    org_id: string;
    proposal_id: string;
    product_id?: string | null;
    name: string;
    description?: string;
    quantity?: number;
    unit_price: number;
    discount_percent?: number;
    sort_order?: number;
  }
): Promise<ProposalLineItem> {
  await assertNotFrozen(item.proposal_id);
  const { data, error } = await supabase
    .from('proposal_line_items')
    .insert({
      org_id: item.org_id,
      proposal_id: item.proposal_id,
      product_id: item.product_id || null,
      name: item.name,
      description: item.description || null,
      quantity: item.quantity ?? 1,
      unit_price: item.unit_price,
      discount_percent: item.discount_percent ?? 0,
      sort_order: item.sort_order ?? 0
    })
    .select('*, product:products(*)')
    .single();

  if (error) throw error;
  return data;
}

export async function updateProposalLineItem(
  id: string,
  updates: Partial<{
    name: string;
    description: string | null;
    quantity: number;
    unit_price: number;
    discount_percent: number;
    sort_order: number;
  }>
): Promise<ProposalLineItem> {
  const { data: item } = await supabase
    .from('proposal_line_items')
    .select('proposal_id')
    .eq('id', id)
    .maybeSingle();
  if (item) await assertNotFrozen(item.proposal_id);

  const { data, error } = await supabase
    .from('proposal_line_items')
    .update(updates)
    .eq('id', id)
    .select('*, product:products(*)')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProposalLineItem(id: string): Promise<void> {
  const { data: item } = await supabase
    .from('proposal_line_items')
    .select('proposal_id')
    .eq('id', id)
    .maybeSingle();
  if (item) await assertNotFrozen(item.proposal_id);

  const { error } = await supabase
    .from('proposal_line_items')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function addProposalSection(
  section: {
    org_id: string;
    proposal_id: string;
    title: string;
    content: string;
    section_type?: ProposalSectionType;
    sort_order?: number;
    ai_generated?: boolean;
  }
): Promise<ProposalSection> {
  await assertNotFrozen(section.proposal_id);
  const { data, error } = await supabase
    .from('proposal_sections')
    .insert({
      org_id: section.org_id,
      proposal_id: section.proposal_id,
      title: section.title,
      content: section.content,
      section_type: section.section_type || 'custom',
      sort_order: section.sort_order ?? 0,
      ai_generated: section.ai_generated ?? false
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProposalSection(
  id: string,
  updates: Partial<{
    title: string;
    content: string;
    section_type: ProposalSectionType;
    sort_order: number;
  }>
): Promise<ProposalSection> {
  const { data: sec } = await supabase
    .from('proposal_sections')
    .select('proposal_id')
    .eq('id', id)
    .maybeSingle();
  if (sec) await assertNotFrozen(sec.proposal_id);

  const { data, error } = await supabase
    .from('proposal_sections')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProposalSection(id: string): Promise<void> {
  const { data: sec } = await supabase
    .from('proposal_sections')
    .select('proposal_id')
    .eq('id', id)
    .maybeSingle();
  if (sec) await assertNotFrozen(sec.proposal_id);

  const { error } = await supabase
    .from('proposal_sections')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function reorderProposalSections(proposalId: string, sectionIds: string[]): Promise<void> {
  await assertNotFrozen(proposalId);
  for (let i = 0; i < sectionIds.length; i++) {
    await supabase
      .from('proposal_sections')
      .update({ sort_order: i })
      .eq('id', sectionIds[i]);
  }
}

export async function getProposalComments(proposalId: string): Promise<ProposalComment[]> {
  const { data, error } = await supabase
    .from('proposal_comments')
    .select('*, user:users(*)')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function addProposalComment(
  comment: {
    org_id: string;
    proposal_id: string;
    user_id?: string;
    is_client_comment?: boolean;
    client_name?: string;
    content: string;
  }
): Promise<ProposalComment> {
  const { data, error } = await supabase
    .from('proposal_comments')
    .insert({
      org_id: comment.org_id,
      proposal_id: comment.proposal_id,
      user_id: comment.user_id || null,
      is_client_comment: comment.is_client_comment ?? false,
      client_name: comment.client_name || null,
      content: comment.content
    })
    .select('*, user:users(*)')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProposalComment(id: string): Promise<void> {
  const { error } = await supabase
    .from('proposal_comments')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getProposalActivities(proposalId: string): Promise<ProposalActivity[]> {
  const { data, error } = await supabase
    .from('proposal_activities')
    .select('*, actor:users(*)')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createProposalActivity(
  proposalId: string,
  orgId: string,
  activityType: string,
  description: string,
  metadata: Record<string, unknown>,
  actorUserId?: string
): Promise<ProposalActivity> {
  const { data, error } = await supabase
    .from('proposal_activities')
    .insert({
      org_id: orgId,
      proposal_id: proposalId,
      activity_type: activityType,
      description,
      metadata,
      actor_user_id: actorUserId || null
    })
    .select('*, actor:users(*)')
    .single();

  if (error) throw error;
  return data;
}

export async function linkMeetingToProposal(
  proposalId: string,
  meetingTranscriptionId: string,
  orgId: string,
  includedInGeneration = true
): Promise<void> {
  const { error } = await supabase
    .from('proposal_meeting_contexts')
    .insert({
      org_id: orgId,
      proposal_id: proposalId,
      meeting_transcription_id: meetingTranscriptionId,
      included_in_generation: includedInGeneration
    });

  if (error) throw error;
}

export async function unlinkMeetingFromProposal(proposalId: string, meetingTranscriptionId: string): Promise<void> {
  const { error } = await supabase
    .from('proposal_meeting_contexts')
    .delete()
    .eq('proposal_id', proposalId)
    .eq('meeting_transcription_id', meetingTranscriptionId);

  if (error) throw error;
}

export async function calculateProposalTotal(proposalId: string): Promise<number> {
  const { data, error } = await supabase
    .from('proposal_line_items')
    .select('quantity, unit_price, discount_percent')
    .eq('proposal_id', proposalId);

  if (error) throw error;

  const total = (data || []).reduce((sum, item) => {
    const lineTotal = item.quantity * item.unit_price;
    const discount = lineTotal * (item.discount_percent / 100);
    return sum + (lineTotal - discount);
  }, 0);

  return total;
}

export async function recalculateAndUpdateProposalTotal(proposalId: string): Promise<Proposal> {
  const total = await calculateProposalTotal(proposalId);

  const { data, error } = await supabase
    .from('proposals')
    .update({ total_value: total })
    .eq('id', proposalId)
    .select(PROPOSAL_SELECT)
    .single();

  if (error) throw error;
  return data;
}

export async function duplicateProposal(proposalId: string, actorUserId: string): Promise<Proposal> {
  const original = await getProposalById(proposalId);
  if (!original) throw new Error('Proposal not found');

  const { data: newProposal, error: proposalError } = await supabase
    .from('proposals')
    .insert({
      org_id: original.org_id,
      contact_id: original.contact_id,
      opportunity_id: original.opportunity_id,
      title: `Copy of ${original.title}`,
      content: original.content,
      summary: original.summary,
      total_value: original.total_value,
      currency: original.currency,
      valid_until: null,
      created_by: actorUserId,
      assigned_user_id: original.assigned_user_id,
      template_id: original.template_id,
      ai_context: original.ai_context,
      status: 'draft',
    })
    .select(PROPOSAL_SELECT)
    .single();

  if (proposalError) throw proposalError;

  if (original.sections && original.sections.length > 0) {
    const sectionsToInsert = original.sections.map(section => ({
      org_id: original.org_id,
      proposal_id: newProposal.id,
      title: section.title,
      content: section.content,
      section_type: section.section_type,
      sort_order: section.sort_order,
      ai_generated: section.ai_generated,
    }));

    await supabase.from('proposal_sections').insert(sectionsToInsert);
  }

  if (original.line_items && original.line_items.length > 0) {
    const lineItemsToInsert = original.line_items.map(item => ({
      org_id: original.org_id,
      proposal_id: newProposal.id,
      product_id: item.product_id,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_percent: item.discount_percent,
      sort_order: item.sort_order,
    }));

    await supabase.from('proposal_line_items').insert(lineItemsToInsert);
  }

  if (original.meeting_contexts && original.meeting_contexts.length > 0) {
    const meetingContextsToInsert = original.meeting_contexts.map(context => ({
      org_id: original.org_id,
      proposal_id: newProposal.id,
      meeting_transcription_id: context.meeting_transcription_id,
      included_in_generation: context.included_in_generation,
    }));

    await supabase.from('proposal_meeting_contexts').insert(meetingContextsToInsert);
  }

  await createProposalActivity(
    newProposal.id,
    newProposal.org_id,
    'created',
    `Proposal duplicated from ${original.title}`,
    { original_proposal_id: proposalId },
    actorUserId
  );

  return newProposal;
}

export async function archiveProposal(proposalId: string, actorUserId: string): Promise<Proposal> {
  const { data, error } = await supabase
    .from('proposals')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', proposalId)
    .select(PROPOSAL_SELECT)
    .single();

  if (error) throw error;

  await createProposalActivity(
    data.id,
    data.org_id,
    'updated',
    'Proposal archived',
    {},
    actorUserId
  );

  return data;
}

export async function unarchiveProposal(proposalId: string, actorUserId: string): Promise<Proposal> {
  const { data, error } = await supabase
    .from('proposals')
    .update({ archived_at: null })
    .eq('id', proposalId)
    .select(PROPOSAL_SELECT)
    .single();

  if (error) throw error;

  await createProposalActivity(
    data.id,
    data.org_id,
    'updated',
    'Proposal unarchived',
    {},
    actorUserId
  );

  return data;
}
