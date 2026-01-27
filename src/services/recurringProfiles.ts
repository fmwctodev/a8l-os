import { supabase } from '../lib/supabase';
import { publishEvent } from './eventOutbox';
import type { User } from '../types';

export interface RecurringProfile {
  id: string;
  org_id: string;
  contact_id: string;
  qbo_recurring_template_id?: string;
  name: string;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annually';
  status: 'active' | 'paused' | 'cancelled';
  next_invoice_date?: string;
  end_date?: string;
  auto_send: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  contact?: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
    company?: string;
  };
  items?: RecurringProfileItem[];
  created_by_user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface RecurringProfileItem {
  id: string;
  org_id: string;
  recurring_profile_id: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  sort_order: number;
  created_at: string;
  product?: {
    id: string;
    name: string;
    price_amount: number;
  };
}

export interface RecurringProfileFilters {
  status?: ('active' | 'paused' | 'cancelled')[];
  contactId?: string;
  frequency?: string;
  search?: string;
}

export interface CreateRecurringProfileInput {
  contact_id: string;
  name: string;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annually';
  next_invoice_date: string;
  end_date?: string;
  auto_send?: boolean;
  line_items: {
    product_id?: string;
    description: string;
    quantity: number;
    unit_price: number;
  }[];
}

export interface UpdateRecurringProfileInput {
  name?: string;
  frequency?: 'weekly' | 'monthly' | 'quarterly' | 'annually';
  next_invoice_date?: string;
  end_date?: string | null;
  auto_send?: boolean;
}

export interface RecurringProfileStats {
  totalProfiles: number;
  activeProfiles: number;
  pausedProfiles: number;
  cancelledProfiles: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
}

export async function getRecurringProfiles(filters?: RecurringProfileFilters): Promise<RecurringProfile[]> {
  let query = supabase
    .from('recurring_profiles')
    .select(`
      *,
      contact:contacts!recurring_profiles_contact_id_fkey(id, first_name, last_name, email, company),
      created_by_user:users!recurring_profiles_created_by_fkey(id, name, email)
    `)
    .order('created_at', { ascending: false });

  if (filters?.status?.length) {
    query = query.in('status', filters.status);
  }

  if (filters?.contactId) {
    query = query.eq('contact_id', filters.contactId);
  }

  if (filters?.frequency) {
    query = query.eq('frequency', filters.frequency);
  }

  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching recurring profiles:', error);
    throw error;
  }

  return data || [];
}

export async function getRecurringProfile(id: string): Promise<RecurringProfile | null> {
  const { data, error } = await supabase
    .from('recurring_profiles')
    .select(`
      *,
      contact:contacts!recurring_profiles_contact_id_fkey(id, first_name, last_name, email, phone, company),
      created_by_user:users!recurring_profiles_created_by_fkey(id, name, email)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching recurring profile:', error);
    throw error;
  }

  if (data) {
    const { data: items } = await supabase
      .from('recurring_profile_items')
      .select(`
        *,
        product:products!recurring_profile_items_product_id_fkey(id, name, price_amount)
      `)
      .eq('recurring_profile_id', id)
      .order('sort_order');

    data.items = items || [];
  }

  return data;
}

export async function createRecurringProfile(
  input: CreateRecurringProfileInput,
  user: User
): Promise<RecurringProfile> {
  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!userData) {
    throw new Error('User not found');
  }

  const { data: profile, error: profileError } = await supabase
    .from('recurring_profiles')
    .insert({
      org_id: userData.organization_id,
      contact_id: input.contact_id,
      name: input.name,
      frequency: input.frequency,
      status: 'active',
      next_invoice_date: input.next_invoice_date,
      end_date: input.end_date || null,
      auto_send: input.auto_send ?? true,
      created_by: user.id,
    })
    .select()
    .single();

  if (profileError) {
    console.error('Error creating recurring profile:', profileError);
    throw profileError;
  }

  const itemInserts = input.line_items.map((item, index) => ({
    org_id: userData.organization_id,
    recurring_profile_id: profile.id,
    product_id: item.product_id || null,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    sort_order: index,
  }));

  const { error: itemError } = await supabase
    .from('recurring_profile_items')
    .insert(itemInserts);

  if (itemError) {
    console.error('Error creating recurring profile items:', itemError);
  }

  await publishEvent(
    userData.organization_id,
    'recurring_profile_created',
    input.contact_id,
    'recurring_profile',
    profile.id,
    {
      profile_id: profile.id,
      contact_id: input.contact_id,
      name: input.name,
      frequency: input.frequency,
    }
  );

  return getRecurringProfile(profile.id) as Promise<RecurringProfile>;
}

export async function updateRecurringProfile(
  id: string,
  input: UpdateRecurringProfileInput
): Promise<RecurringProfile> {
  const { error } = await supabase
    .from('recurring_profiles')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating recurring profile:', error);
    throw error;
  }

  return getRecurringProfile(id) as Promise<RecurringProfile>;
}

export async function updateRecurringProfileItems(
  profileId: string,
  items: CreateRecurringProfileInput['line_items']
): Promise<void> {
  const { data: profile } = await supabase
    .from('recurring_profiles')
    .select('org_id')
    .eq('id', profileId)
    .single();

  if (!profile) {
    throw new Error('Profile not found');
  }

  const { error: deleteError } = await supabase
    .from('recurring_profile_items')
    .delete()
    .eq('recurring_profile_id', profileId);

  if (deleteError) {
    console.error('Error deleting old items:', deleteError);
    throw deleteError;
  }

  const itemInserts = items.map((item, index) => ({
    org_id: profile.org_id,
    recurring_profile_id: profileId,
    product_id: item.product_id || null,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    sort_order: index,
  }));

  const { error: insertError } = await supabase
    .from('recurring_profile_items')
    .insert(itemInserts);

  if (insertError) {
    console.error('Error inserting new items:', insertError);
    throw insertError;
  }
}

export async function pauseRecurringProfile(id: string, user: User): Promise<RecurringProfile> {
  const profile = await getRecurringProfile(id);
  if (!profile) {
    throw new Error('Profile not found');
  }

  if (profile.status !== 'active') {
    throw new Error('Only active profiles can be paused');
  }

  const { error } = await supabase
    .from('recurring_profiles')
    .update({ status: 'paused' })
    .eq('id', id);

  if (error) {
    console.error('Error pausing profile:', error);
    throw error;
  }

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (userData) {
    await publishEvent(
      userData.organization_id,
      'recurring_profile_paused',
      profile.contact_id,
      'recurring_profile',
      id,
      { profile_id: id, name: profile.name }
    );
  }

  return getRecurringProfile(id) as Promise<RecurringProfile>;
}

export async function resumeRecurringProfile(id: string, user: User): Promise<RecurringProfile> {
  const profile = await getRecurringProfile(id);
  if (!profile) {
    throw new Error('Profile not found');
  }

  if (profile.status !== 'paused') {
    throw new Error('Only paused profiles can be resumed');
  }

  let nextDate = profile.next_invoice_date;
  if (nextDate && new Date(nextDate) < new Date()) {
    nextDate = new Date().toISOString().split('T')[0];
  }

  const { error } = await supabase
    .from('recurring_profiles')
    .update({
      status: 'active',
      next_invoice_date: nextDate,
    })
    .eq('id', id);

  if (error) {
    console.error('Error resuming profile:', error);
    throw error;
  }

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (userData) {
    await publishEvent(
      userData.organization_id,
      'recurring_profile_resumed',
      profile.contact_id,
      'recurring_profile',
      id,
      { profile_id: id, name: profile.name }
    );
  }

  return getRecurringProfile(id) as Promise<RecurringProfile>;
}

export async function cancelRecurringProfile(id: string, user: User): Promise<RecurringProfile> {
  const profile = await getRecurringProfile(id);
  if (!profile) {
    throw new Error('Profile not found');
  }

  if (profile.status === 'cancelled') {
    throw new Error('Profile is already cancelled');
  }

  const { error } = await supabase
    .from('recurring_profiles')
    .update({
      status: 'cancelled',
      next_invoice_date: null,
    })
    .eq('id', id);

  if (error) {
    console.error('Error cancelling profile:', error);
    throw error;
  }

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (userData) {
    await publishEvent(
      userData.organization_id,
      'recurring_profile_cancelled',
      profile.contact_id,
      'recurring_profile',
      id,
      { profile_id: id, name: profile.name }
    );
  }

  return getRecurringProfile(id) as Promise<RecurringProfile>;
}

export async function getRecurringProfileStats(): Promise<RecurringProfileStats> {
  const { data: profiles } = await supabase
    .from('recurring_profiles')
    .select('id, status, frequency')
    .neq('status', 'cancelled');

  if (!profiles?.length) {
    return {
      totalProfiles: 0,
      activeProfiles: 0,
      pausedProfiles: 0,
      cancelledProfiles: 0,
      monthlyRecurringRevenue: 0,
      annualRecurringRevenue: 0,
    };
  }

  const activeProfileIds = profiles.filter(p => p.status === 'active').map(p => p.id);

  let mrr = 0;
  if (activeProfileIds.length > 0) {
    const { data: items } = await supabase
      .from('recurring_profile_items')
      .select('recurring_profile_id, quantity, unit_price')
      .in('recurring_profile_id', activeProfileIds);

    const profileTotals = new Map<string, number>();
    for (const item of items || []) {
      const current = profileTotals.get(item.recurring_profile_id) || 0;
      profileTotals.set(item.recurring_profile_id, current + (item.quantity * item.unit_price));
    }

    for (const profile of profiles.filter(p => p.status === 'active')) {
      const total = profileTotals.get(profile.id) || 0;
      switch (profile.frequency) {
        case 'weekly':
          mrr += total * 4.33;
          break;
        case 'monthly':
          mrr += total;
          break;
        case 'quarterly':
          mrr += total / 3;
          break;
        case 'annually':
          mrr += total / 12;
          break;
      }
    }
  }

  const { count: totalCount } = await supabase
    .from('recurring_profiles')
    .select('*', { count: 'exact', head: true });

  const { count: cancelledCount } = await supabase
    .from('recurring_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'cancelled');

  return {
    totalProfiles: totalCount || 0,
    activeProfiles: profiles.filter(p => p.status === 'active').length,
    pausedProfiles: profiles.filter(p => p.status === 'paused').length,
    cancelledProfiles: cancelledCount || 0,
    monthlyRecurringRevenue: Math.round(mrr * 100) / 100,
    annualRecurringRevenue: Math.round(mrr * 12 * 100) / 100,
  };
}

export async function getContactRecurringProfiles(contactId: string): Promise<RecurringProfile[]> {
  return getRecurringProfiles({ contactId });
}

export function calculateNextInvoiceDate(
  currentDate: string,
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annually'
): string {
  const date = new Date(currentDate);

  switch (frequency) {
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'annually':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }

  return date.toISOString().split('T')[0];
}
