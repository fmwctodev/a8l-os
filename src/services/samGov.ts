import { callEdgeFunction } from '../lib/edgeFunction';
import { supabase } from '../lib/supabase';

export interface SamGovOpportunity {
  title: string;
  solicitationNumber: string;
  noticeId: string;
  department: string;
  subTier: string;
  office: string;
  postedDate: string;
  type: string;
  baseType: string;
  archiveType: string;
  archiveDate: string;
  typeOfSetAsideDescription: string;
  typeOfSetAside: string;
  responseDeadLine: string;
  naicsCode: string;
  classificationCode: string;
  active: string;
  description: string;
  organizationType: string;
  uiLink: string;
  award?: {
    date: string;
    number: string;
    amount: string;
    awardee?: { name: string; ueiSAM: string; location?: { city: string; state: string } };
  };
  pointOfContact?: Array<{
    fullName: string;
    email: string;
    phone: string;
    title: string;
    type: string;
  }>;
  placeOfPerformance?: {
    city?: { name: string };
    state?: { code: string; name: string };
    zip: string;
    country?: { code: string };
  };
  officeAddress?: { city: string; state: string; zipcode: string };
  resourceLinks?: string[];
}

export interface SamSearchFilters {
  keywords?: string;
  naicsCode?: string;
  pscCode?: string;
  setAsideType?: string;
  state?: string;
  agencyName?: string;
  procurementType?: string;
  postedFrom?: string;
  postedTo?: string;
  limit?: number;
  offset?: number;
}

export interface PSCCode {
  pscCode: string;
  pscName: string;
  pscFullName: string;
  pscInclude: string;
  pscExclude: string;
  activeInd: string;
  level1Category: string;
  level2Category: string;
}

export async function searchOpportunities(
  filters: SamSearchFilters
): Promise<{ opportunities: SamGovOpportunity[]; totalRecords: number }> {
  const res = await callEdgeFunction('sam-gov-api', { action: 'search-opportunities', ...filters });
  const data = await res.json();
  if (data.error) throw new Error(typeof data.error === 'string' ? data.error : data.error?.message || JSON.stringify(data.error));
  return data.data || { opportunities: [], totalRecords: 0 };
}

export async function getOpportunityDetail(noticeId: string): Promise<SamGovOpportunity | null> {
  const res = await callEdgeFunction('sam-gov-api', { action: 'get-opportunity', noticeId });
  const data = await res.json();
  if (data.error) throw new Error(typeof data.error === 'string' ? data.error : data.error?.message || JSON.stringify(data.error));
  return data.data || null;
}

export async function searchPSC(query: string): Promise<PSCCode[]> {
  const res = await callEdgeFunction('sam-gov-api', { action: 'search-psc', query });
  const data = await res.json();
  if (data.error) throw new Error(typeof data.error === 'string' ? data.error : data.error?.message || JSON.stringify(data.error));
  return data.data || [];
}

export async function importToOpportunity(
  samData: SamGovOpportunity,
  contactId?: string
): Promise<{ opportunityId: string }> {
  const res = await callEdgeFunction('sam-gov-api', { action: 'import-opportunity', samData, contactId });
  const data = await res.json();
  if (data.error) throw new Error(typeof data.error === 'string' ? data.error : data.error?.message || JSON.stringify(data.error));
  return data.data;
}

// --- Saved searches CRUD (direct Supabase) ---

export interface GovSavedSearch {
  id: string;
  name: string;
  search_criteria: SamSearchFilters;
  alert_enabled: boolean;
  alert_frequency: 'daily' | 'weekly';
  last_checked_at: string | null;
  results_count: number;
  created_at: string;
}

export async function getSavedSearches(): Promise<GovSavedSearch[]> {
  const { data, error } = await supabase
    .from('gov_saved_searches')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createSavedSearch(
  name: string,
  criteria: SamSearchFilters,
  frequency: 'daily' | 'weekly' = 'daily'
): Promise<GovSavedSearch> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  const { data, error } = await supabase
    .from('gov_saved_searches')
    .insert({
      org_id: userData?.organization_id,
      user_id: user.id,
      name,
      search_criteria: criteria,
      alert_frequency: frequency,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSavedSearch(id: string): Promise<void> {
  const { error } = await supabase.from('gov_saved_searches').delete().eq('id', id);
  if (error) throw error;
}

export async function toggleSavedSearchAlert(id: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('gov_saved_searches')
    .update({ alert_enabled: enabled })
    .eq('id', id);
  if (error) throw error;
}
