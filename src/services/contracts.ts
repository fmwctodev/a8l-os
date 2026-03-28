import { supabase } from '../lib/supabase';
import type {
  Contract,
  ContractSection,
  ContractComment,
  ContractActivity,
  ContractStatus,
  ContractType,
} from '../types';
import { extractValueFromSections } from '../utils/extractProposalValue';

const FROZEN_STATUSES = ['pending_signature', 'viewed', 'signed'] as const;

async function assertNotFrozen(contractId: string): Promise<void> {
  const { data } = await supabase
    .from('contracts')
    .select('signature_status')
    .eq('id', contractId)
    .maybeSingle();

  if (data?.signature_status && FROZEN_STATUSES.includes(data.signature_status)) {
    throw new Error('This contract is locked for signing and cannot be edited. Void the signature request first.');
  }
}

const CONTRACT_SELECT = `
  *,
  contact:contacts(*),
  opportunity:opportunities(*),
  created_by_user:users!contracts_created_by_fkey(*),
  assigned_user:users!contracts_assigned_user_id_fkey(*),
  source_proposal:proposals!contracts_proposal_id_fkey(id, title, status, public_token),
  sections:contract_sections(*),
  comments:contract_comments(*, user:users(*)),
  activities:contract_activities(*, actor:users(*))
`;

const CONTRACT_LIST_SELECT = `
  *,
  contact:contacts(id, first_name, last_name, email, company),
  source_proposal:proposals!contracts_proposal_id_fkey(id, title)
`;

export interface ContractListFilters {
  status?: ContractStatus[];
  search?: string;
  includeArchived?: boolean;
}

export interface ContractListResult {
  data: Contract[];
  total: number;
}

export interface ContractStats {
  total: number;
  draft: number;
  sent: number;
  signed: number;
  totalValue: number;
}

export async function getContracts(
  filters: ContractListFilters = {},
  page = 1,
  pageSize = 25
): Promise<ContractListResult> {
  let query = supabase
    .from('contracts')
    .select(CONTRACT_LIST_SELECT, { count: 'exact' });

  if (!filters.includeArchived) {
    query = query.is('archived_at', null);
  }

  if (filters.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,party_b_name.ilike.%${filters.search}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { data: data || [], total: count || 0 };
}

export async function getContractStats(): Promise<ContractStats> {
  const { data, error } = await supabase
    .from('contracts')
    .select('status, total_value')
    .is('archived_at', null);

  if (error) throw error;

  const contracts = data || [];
  return {
    total: contracts.length,
    draft: contracts.filter(c => c.status === 'draft').length,
    sent: contracts.filter(c => c.status === 'sent').length,
    signed: contracts.filter(c => c.status === 'signed').length,
    totalValue: contracts.reduce((sum, c) => sum + (c.total_value || 0), 0),
  };
}

export async function getContractsByProposalId(proposalId: string): Promise<Contract[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select(CONTRACT_SELECT)
    .eq('proposal_id', proposalId)
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getContractById(contractId: string): Promise<Contract | null> {
  const { data, error } = await supabase
    .from('contracts')
    .select(CONTRACT_SELECT)
    .eq('id', contractId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getContractByPublicToken(token: string): Promise<Contract | null> {
  const { data, error } = await supabase
    .from('contracts')
    .select(`
      *,
      contact:contacts(first_name, last_name, email, company),
      sections:contract_sections(*)
    `)
    .eq('public_token', token)
    .maybeSingle();

  if (error) throw error;
  return data;
}

function generatePublicToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function createContractFromProposal(
  proposalId: string,
  orgId: string,
  userId: string,
  options: {
    contract_type: ContractType;
    effective_date?: string;
    governing_law_state?: string;
    custom_instructions?: string;
  }
): Promise<Contract> {
  const [proposalRes, orgRes, userRes] = await Promise.all([
    supabase
      .from('proposals')
      .select('*, contact:contacts(*), opportunity:opportunities(*), sections:proposal_sections(*)')
      .eq('id', proposalId)
      .single(),
    supabase.from('organizations').select('name').eq('id', orgId).maybeSingle(),
    supabase.from('users').select('name, email').eq('id', userId).maybeSingle(),
  ]);

  if (proposalRes.error || !proposalRes.data) throw new Error('Proposal not found');
  const proposal = proposalRes.data;
  const partyAName = orgRes.data?.name || userRes.data?.name || 'Company';
  const partyAEmail = userRes.data?.email || '';

  const title = `Contract — ${proposal.title}`;

  let resolvedValue = proposal.total_value || 0;
  let resolvedCurrency = proposal.currency || 'USD';

  if (resolvedValue === 0 && proposal.sections?.length) {
    const extracted = extractValueFromSections(proposal.sections, resolvedCurrency);
    if (extracted && extracted.value > 0) {
      resolvedValue = extracted.value;
      resolvedCurrency = extracted.currency;
    }
  }

  const { data: contract, error } = await supabase
    .from('contracts')
    .insert({
      org_id: orgId,
      proposal_id: proposalId,
      contact_id: proposal.contact_id,
      opportunity_id: proposal.opportunity_id,
      title,
      contract_type: options.contract_type,
      status: 'draft',
      total_value: resolvedValue,
      currency: resolvedCurrency,
      effective_date: options.effective_date || null,
      governing_law_state: options.governing_law_state || null,
      public_token: generatePublicToken(),
      custom_instructions: options.custom_instructions || null,
      party_a_name: partyAName,
      party_a_email: partyAEmail,
      party_b_name: proposal.contact
        ? `${proposal.contact.first_name} ${proposal.contact.last_name}`.trim()
        : null,
      party_b_email: proposal.contact?.email || null,
      ai_context: {},
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;

  await supabase.from('contract_activities').insert({
    org_id: orgId,
    contract_id: contract.id,
    activity_type: 'created',
    description: `Contract created from proposal "${proposal.title}"`,
    metadata: { proposal_id: proposalId, contract_type: options.contract_type },
    actor_user_id: userId,
  });

  return contract;
}

export async function updateContract(
  id: string,
  updates: Partial<Pick<Contract, 'title' | 'content' | 'total_value' | 'currency' | 'effective_date' | 'governing_law_state' | 'party_a_name' | 'party_a_email' | 'party_b_name' | 'party_b_email' | 'assigned_user_id'>>
): Promise<Contract> {
  await assertNotFrozen(id);

  const { data, error } = await supabase
    .from('contracts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateContractStatus(id: string, status: ContractStatus): Promise<void> {
  const { error } = await supabase
    .from('contracts')
    .update({ status })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteContract(id: string): Promise<void> {
  const { error } = await supabase
    .from('contracts')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function archiveContract(id: string): Promise<void> {
  const { error } = await supabase
    .from('contracts')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function unarchiveContract(id: string): Promise<void> {
  const { error } = await supabase
    .from('contracts')
    .update({ archived_at: null })
    .eq('id', id);

  if (error) throw error;
}

export async function addContractSection(
  orgId: string,
  contractId: string,
  section: {
    title: string;
    content: string;
    section_type: string;
    sort_order: number;
    annotation?: string;
    ai_generated?: boolean;
  }
): Promise<ContractSection> {
  await assertNotFrozen(contractId);

  const { data, error } = await supabase
    .from('contract_sections')
    .insert({
      org_id: orgId,
      contract_id: contractId,
      ...section,
      ai_generated: section.ai_generated || false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateContractSection(
  id: string,
  contractId: string,
  updates: Partial<Pick<ContractSection, 'title' | 'content' | 'annotation' | 'sort_order'>>
): Promise<ContractSection> {
  await assertNotFrozen(contractId);

  const { data, error } = await supabase
    .from('contract_sections')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteContractSection(id: string, contractId: string): Promise<void> {
  await assertNotFrozen(contractId);

  const { error } = await supabase
    .from('contract_sections')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function reorderContractSections(sections: { id: string; sort_order: number }[]): Promise<void> {
  for (const s of sections) {
    await supabase
      .from('contract_sections')
      .update({ sort_order: s.sort_order })
      .eq('id', s.id);
  }
}

export async function getContractComments(contractId: string): Promise<ContractComment[]> {
  const { data, error } = await supabase
    .from('contract_comments')
    .select('*, user:users(*)')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function addContractComment(
  orgId: string,
  contractId: string,
  userId: string,
  content: string,
  isClientComment = false,
  clientName?: string
): Promise<ContractComment> {
  const { data, error } = await supabase
    .from('contract_comments')
    .insert({
      org_id: orgId,
      contract_id: contractId,
      user_id: isClientComment ? null : userId,
      is_client_comment: isClientComment,
      client_name: clientName || null,
      content,
    })
    .select('*, user:users(*)')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteContractComment(id: string): Promise<void> {
  const { error } = await supabase
    .from('contract_comments')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getContractActivities(contractId: string): Promise<ContractActivity[]> {
  const { data, error } = await supabase
    .from('contract_activities')
    .select('*, actor:users(*)')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createContractActivity(
  orgId: string,
  contractId: string,
  activityType: string,
  description: string,
  userId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await supabase.from('contract_activities').insert({
    org_id: orgId,
    contract_id: contractId,
    activity_type: activityType,
    description,
    metadata: metadata || {},
    actor_user_id: userId || null,
  });
}
