import { supabase } from '../lib/supabase';
import type { AvailabilityRule, DaySchedule, DateOverride, TimeRange } from '../types';

export interface CreateAvailabilityRuleData {
  calendar_id: string;
  user_id?: string | null;
  timezone: string;
  rules: DaySchedule;
  overrides?: DateOverride[];
}

export interface UpdateAvailabilityRuleData {
  timezone?: string;
  rules?: DaySchedule;
  overrides?: DateOverride[];
}

export async function getAvailabilityRule(
  calendarId: string,
  userId?: string | null
): Promise<AvailabilityRule | null> {
  let query = supabase
    .from('availability_rules')
    .select('*')
    .eq('calendar_id', calendarId);

  if (userId) {
    query = query.eq('user_id', userId);
  } else {
    query = query.is('user_id', null);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

export async function getCalendarAvailabilityRules(
  calendarId: string
): Promise<AvailabilityRule[]> {
  const { data, error } = await supabase
    .from('availability_rules')
    .select('*')
    .eq('calendar_id', calendarId);

  if (error) throw error;
  return data || [];
}

export async function createAvailabilityRule(
  organizationId: string,
  ruleData: CreateAvailabilityRuleData
): Promise<AvailabilityRule> {
  const { data, error } = await supabase
    .from('availability_rules')
    .insert({
      org_id: organizationId,
      calendar_id: ruleData.calendar_id,
      user_id: ruleData.user_id || null,
      timezone: ruleData.timezone,
      rules: ruleData.rules,
      overrides: ruleData.overrides || [],
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateAvailabilityRule(
  id: string,
  updates: UpdateAvailabilityRuleData
): Promise<AvailabilityRule> {
  const { data, error } = await supabase
    .from('availability_rules')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function upsertAvailabilityRule(
  organizationId: string,
  ruleData: CreateAvailabilityRuleData
): Promise<AvailabilityRule> {
  const existing = await getAvailabilityRule(ruleData.calendar_id, ruleData.user_id);

  if (existing) {
    return updateAvailabilityRule(existing.id, {
      timezone: ruleData.timezone,
      rules: ruleData.rules,
      overrides: ruleData.overrides,
    });
  }

  return createAvailabilityRule(organizationId, ruleData);
}

export async function addDateOverride(
  ruleId: string,
  override: DateOverride
): Promise<AvailabilityRule> {
  const { data: current } = await supabase
    .from('availability_rules')
    .select('overrides')
    .eq('id', ruleId)
    .single();

  const overrides = (current?.overrides as DateOverride[]) || [];
  const existingIndex = overrides.findIndex((o) => o.date === override.date);

  if (existingIndex >= 0) {
    overrides[existingIndex] = override;
  } else {
    overrides.push(override);
  }

  const { data, error } = await supabase
    .from('availability_rules')
    .update({ overrides })
    .eq('id', ruleId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeDateOverride(
  ruleId: string,
  date: string
): Promise<AvailabilityRule> {
  const { data: current } = await supabase
    .from('availability_rules')
    .select('overrides')
    .eq('id', ruleId)
    .single();

  const overrides = ((current?.overrides as DateOverride[]) || []).filter(
    (o) => o.date !== date
  );

  const { data, error } = await supabase
    .from('availability_rules')
    .update({ overrides })
    .eq('id', ruleId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function getDefaultSchedule(): DaySchedule {
  const defaultRange: TimeRange[] = [{ start: '09:00', end: '17:00' }];
  return {
    monday: defaultRange,
    tuesday: defaultRange,
    wednesday: defaultRange,
    thursday: defaultRange,
    friday: defaultRange,
    saturday: [],
    sunday: [],
  };
}

export function getCommonTimezones(): { value: string; label: string }[] {
  return [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Phoenix', label: 'Arizona (MST)' },
    { value: 'America/Anchorage', label: 'Alaska (AKT)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii (HST)' },
    { value: 'UTC', label: 'UTC' },
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  ];
}
