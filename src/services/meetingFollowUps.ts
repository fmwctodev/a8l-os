import { supabase } from '../lib/supabase';
import { callEdgeFunction } from '../lib/edgeFunction';

export interface MeetingFollowUp {
  id: string;
  org_id: string;
  meeting_transcription_id: string;
  contact_id: string;
  conversation_id: string | null;
  message_id: string | null;
  channel: 'sms' | 'email';
  scheduled_for: string | null;
  sent_at: string | null;
  ai_draft_content: string;
  ai_draft_subject: string | null;
  status: 'draft' | 'approved' | 'scheduled' | 'sent' | 'cancelled' | 'failed';
  generation_context: Record<string, unknown>;
  error_message: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  contact?: { id: string; first_name: string; last_name: string; email: string; phone: string };
  meeting?: { meeting_title: string; meeting_date: string } | null;
}

export interface MeetingFollowUpSettings {
  id: string;
  org_id: string;
  enabled: boolean;
  default_delay_minutes: number;
  default_channel: 'sms' | 'email' | 'both';
  auto_send: boolean;
  respect_quiet_hours: boolean;
  exclude_internal: boolean;
  internal_domains: string[];
  ai_instructions: string | null;
  created_at: string;
  updated_at: string;
}

const FOLLOW_UP_SELECT = `
  *,
  contact:contacts(id, first_name, last_name, email, phone),
  meeting:meeting_transcriptions(meeting_title, meeting_date)
`;

export async function getFollowUpsByMeeting(
  meetingTranscriptionId: string
): Promise<MeetingFollowUp[]> {
  const { data, error } = await supabase
    .from('meeting_follow_ups')
    .select(FOLLOW_UP_SELECT)
    .eq('meeting_transcription_id', meetingTranscriptionId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getFollowUpsByContact(
  contactId: string
): Promise<MeetingFollowUp[]> {
  const { data, error } = await supabase
    .from('meeting_follow_ups')
    .select(FOLLOW_UP_SELECT)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getPendingFollowUps(
  orgId: string
): Promise<MeetingFollowUp[]> {
  const { data, error } = await supabase
    .from('meeting_follow_ups')
    .select(FOLLOW_UP_SELECT)
    .eq('org_id', orgId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getPendingFollowUpCount(
  orgId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('meeting_follow_ups')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'draft');

  if (error) throw error;
  return count || 0;
}

export async function updateFollowUp(
  id: string,
  updates: Partial<{
    ai_draft_content: string;
    ai_draft_subject: string | null;
    scheduled_for: string | null;
    status: MeetingFollowUp['status'];
  }>
): Promise<MeetingFollowUp> {
  const { data, error } = await supabase
    .from('meeting_follow_ups')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(FOLLOW_UP_SELECT)
    .single();

  if (error) throw error;
  return data;
}

export async function approveAndScheduleFollowUp(
  id: string,
  userId: string,
  scheduledFor: string
): Promise<MeetingFollowUp> {
  const { data, error } = await supabase
    .from('meeting_follow_ups')
    .update({
      status: 'scheduled',
      scheduled_for: scheduledFor,
      approved_by: userId,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(FOLLOW_UP_SELECT)
    .single();

  if (error) throw error;
  return data;
}

export async function cancelFollowUp(id: string): Promise<MeetingFollowUp> {
  return updateFollowUp(id, { status: 'cancelled' });
}

export async function sendFollowUpNow(
  id: string,
  userId: string
): Promise<MeetingFollowUp> {
  const { data, error } = await supabase
    .from('meeting_follow_ups')
    .update({
      status: 'scheduled',
      scheduled_for: new Date().toISOString(),
      approved_by: userId,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(FOLLOW_UP_SELECT)
    .single();

  if (error) throw error;
  return data;
}

export async function regenerateFollowUp(
  id: string,
  orgId: string
): Promise<MeetingFollowUp> {
  const { data: existing, error: fetchError } = await supabase
    .from('meeting_follow_ups')
    .select('meeting_transcription_id, contact_id, channel')
    .eq('id', id)
    .single();

  if (fetchError || !existing) throw fetchError || new Error('Follow-up not found');

  await callEdgeFunction('meet-follow-up-generator', {
    meeting_transcription_id: existing.meeting_transcription_id,
    contact_id: existing.contact_id,
    channel: existing.channel,
    org_id: orgId,
  });

  const { data: updated, error } = await supabase
    .from('meeting_follow_ups')
    .select(FOLLOW_UP_SELECT)
    .eq('id', id)
    .single();

  if (error) throw error;
  return updated;
}

export async function getFollowUpSettings(
  orgId: string
): Promise<MeetingFollowUpSettings | null> {
  const { data, error } = await supabase
    .from('meeting_follow_up_settings')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertFollowUpSettings(
  orgId: string,
  settings: Partial<Omit<MeetingFollowUpSettings, 'id' | 'org_id' | 'created_at' | 'updated_at'>>
): Promise<MeetingFollowUpSettings> {
  const { data: existing } = await supabase
    .from('meeting_follow_up_settings')
    .select('id')
    .eq('org_id', orgId)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('meeting_follow_up_settings')
      .update({ ...settings, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('meeting_follow_up_settings')
    .insert({ org_id: orgId, ...settings })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
