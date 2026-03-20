import { supabase } from '../lib/supabase';
import type {
  MeetingTranscription,
  MeetingTranscriptionFilters,
  MeetingTranscriptionContact,
  ContactMeetingNote,
  MeetingSource,
  MeetingParticipant,
  MeetingActionItem,
} from '../types';

const TRANSCRIPTION_SELECT = `
  *,
  contact:contacts(*),
  imported_by_user:users(*),
  linked_contacts:meeting_transcription_contacts(*, contact:contacts(*))
`;

export async function getMeetingTranscriptions(
  filters: MeetingTranscriptionFilters = {},
  page = 1,
  pageSize = 25
): Promise<{ data: MeetingTranscription[]; total: number }> {
  let query = supabase
    .from('meeting_transcriptions')
    .select(TRANSCRIPTION_SELECT, { count: 'exact' });

  if (filters.contactId) {
    query = query.eq('contact_id', filters.contactId);
  }

  if (filters.meetingSource) {
    query = query.eq('meeting_source', filters.meetingSource);
  }

  if (filters.startDate) {
    query = query.gte('meeting_date', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('meeting_date', filters.endDate);
  }

  if (filters.hasRecording === true) {
    query = query.not('recording_url', 'is', null);
  } else if (filters.hasRecording === false) {
    query = query.is('recording_url', null);
  }

  if (filters.search) {
    query = query.or(`meeting_title.ilike.%${filters.search}%,transcript_text.ilike.%${filters.search}%`);
  }

  const offset = (page - 1) * pageSize;
  query = query
    .order('meeting_date', { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    data: data || [],
    total: count || 0
  };
}

export async function getMeetingTranscriptionById(id: string): Promise<MeetingTranscription | null> {
  const { data, error } = await supabase
    .from('meeting_transcriptions')
    .select(TRANSCRIPTION_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getMeetingTranscriptionsByContact(contactId: string): Promise<MeetingTranscription[]> {
  const [directResult, linkedResult] = await Promise.all([
    supabase
      .from('meeting_transcriptions')
      .select('*')
      .eq('contact_id', contactId)
      .order('meeting_date', { ascending: false }),
    supabase
      .from('meeting_transcription_contacts')
      .select('meeting_transcription:meeting_transcriptions(*)')
      .eq('contact_id', contactId),
  ]);

  if (directResult.error) throw directResult.error;
  if (linkedResult.error) throw linkedResult.error;

  const linkedTranscriptions = (linkedResult.data || [])
    .map(m => m.meeting_transcription)
    .filter(Boolean);

  const allMeetings = [...(directResult.data || []), ...linkedTranscriptions];

  const uniqueMeetings = Array.from(
    new Map(allMeetings.map(m => [m.id, m])).values()
  ).sort((a, b) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime());

  return uniqueMeetings;
}

export async function getGoogleMeetRecordingsForOrg(
  orgId: string,
  search?: string,
  userId?: string
): Promise<MeetingTranscription[]> {
  let query = supabase
    .from('meeting_transcriptions')
    .select('*')
    .eq('org_id', orgId)
    .eq('meeting_source', 'google_meet')
    .order('meeting_date', { ascending: false })
    .limit(100);

  if (userId) {
    query = query.eq('imported_by', userId);
  }

  if (search) {
    query = query.ilike('meeting_title', `%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createMeetingTranscription(
  transcription: {
    org_id: string;
    contact_id?: string | null;
    meeting_source: MeetingSource;
    external_meeting_id?: string;
    meeting_title: string;
    meeting_date: string;
    duration_minutes?: number;
    participants: MeetingParticipant[];
    transcript_text: string;
    summary?: string;
    key_points?: string[];
    action_items?: MeetingActionItem[];
    recording_url?: string;
    recording_file_id?: string;
    recording_duration?: string;
    recording_size_bytes?: number;
    imported_by: string;
  }
): Promise<MeetingTranscription> {
  const { data, error } = await supabase
    .from('meeting_transcriptions')
    .insert({
      org_id: transcription.org_id,
      contact_id: transcription.contact_id || null,
      meeting_source: transcription.meeting_source,
      external_meeting_id: transcription.external_meeting_id || null,
      meeting_title: transcription.meeting_title,
      meeting_date: transcription.meeting_date,
      duration_minutes: transcription.duration_minutes || null,
      participants: transcription.participants,
      transcript_text: transcription.transcript_text,
      summary: transcription.summary || null,
      key_points: transcription.key_points || [],
      action_items: transcription.action_items || [],
      recording_url: transcription.recording_url || null,
      recording_file_id: transcription.recording_file_id || null,
      recording_duration: transcription.recording_duration || null,
      recording_size_bytes: transcription.recording_size_bytes || null,
      imported_by: transcription.imported_by
    })
    .select(TRANSCRIPTION_SELECT)
    .single();

  if (error) throw error;
  return data;
}

export async function updateMeetingTranscription(
  id: string,
  updates: Partial<{
    contact_id: string | null;
    meeting_title: string;
    summary: string;
    key_points: string[];
    action_items: MeetingActionItem[];
    recording_url: string;
    recording_file_id: string;
    recording_duration: string;
    recording_size_bytes: number;
    processed_at: string;
  }>
): Promise<MeetingTranscription> {
  const { data, error } = await supabase
    .from('meeting_transcriptions')
    .update(updates)
    .eq('id', id)
    .select(TRANSCRIPTION_SELECT)
    .single();

  if (error) throw error;
  return data;
}

export async function deleteMeetingTranscription(id: string): Promise<void> {
  const { error } = await supabase
    .from('meeting_transcriptions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function linkContactToMeeting(
  meetingId: string,
  contactId: string,
  orgId: string,
  participantEmail?: string
): Promise<MeetingTranscriptionContact> {
  const { data, error } = await supabase
    .from('meeting_transcription_contacts')
    .insert({
      org_id: orgId,
      meeting_transcription_id: meetingId,
      contact_id: contactId,
      participant_email: participantEmail || null
    })
    .select('*, contact:contacts(*)')
    .single();

  if (error) throw error;
  return data;
}

export async function unlinkContactFromMeeting(meetingId: string, contactId: string): Promise<void> {
  const { error } = await supabase
    .from('meeting_transcription_contacts')
    .delete()
    .eq('meeting_transcription_id', meetingId)
    .eq('contact_id', contactId);

  if (error) throw error;
}

export async function findContactsByParticipantEmails(
  orgId: string,
  emails: string[]
): Promise<{ email: string; contactId: string }[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('id, email')
    .eq('organization_id', orgId)
    .in('email', emails.map(e => e.toLowerCase()));

  if (error) throw error;

  return (data || [])
    .filter(c => c.email)
    .map(c => ({
      email: c.email!.toLowerCase(),
      contactId: c.id
    }));
}

export async function autoLinkContactsToMeeting(
  meetingId: string,
  orgId: string,
  participants: MeetingParticipant[]
): Promise<MeetingTranscriptionContact[]> {
  const emails = participants
    .map(p => p.email)
    .filter(Boolean);

  if (emails.length === 0) return [];

  const matches = await findContactsByParticipantEmails(orgId, emails);
  const linked: MeetingTranscriptionContact[] = [];

  for (const match of matches) {
    try {
      const link = await linkContactToMeeting(meetingId, match.contactId, orgId, match.email);
      linked.push(link);
    } catch {
    }
  }

  return linked;
}

export async function getMeetingNotesByContact(contactId: string): Promise<ContactMeetingNote[]> {
  const { data, error } = await supabase
    .from('contact_meeting_notes')
    .select('*, meeting_transcription:meeting_transcriptions(*), created_by_user:users(*)')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getMeetingNotesByMeeting(meetingId: string): Promise<ContactMeetingNote[]> {
  const { data, error } = await supabase
    .from('contact_meeting_notes')
    .select('*, meeting_transcription:meeting_transcriptions(*), created_by_user:users(*)')
    .eq('meeting_transcription_id', meetingId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createMeetingNote(
  note: {
    org_id: string;
    contact_id: string;
    meeting_transcription_id?: string;
    title: string;
    content: string;
    created_by: string;
  }
): Promise<ContactMeetingNote> {
  const { data, error } = await supabase
    .from('contact_meeting_notes')
    .insert({
      org_id: note.org_id,
      contact_id: note.contact_id,
      meeting_transcription_id: note.meeting_transcription_id || null,
      title: note.title,
      content: note.content,
      created_by: note.created_by
    })
    .select('*, meeting_transcription:meeting_transcriptions(*), created_by_user:users(*)')
    .single();

  if (error) throw error;
  return data;
}

export async function updateMeetingNote(
  id: string,
  updates: Partial<{
    title: string;
    content: string;
  }>
): Promise<ContactMeetingNote> {
  const { data, error } = await supabase
    .from('contact_meeting_notes')
    .update(updates)
    .eq('id', id)
    .select('*, meeting_transcription:meeting_transcriptions(*), created_by_user:users(*)')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteMeetingNote(id: string): Promise<void> {
  const { error } = await supabase
    .from('contact_meeting_notes')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function searchMeetingTranscripts(
  orgId: string,
  searchTerm: string,
  limit = 10
): Promise<MeetingTranscription[]> {
  const { data, error } = await supabase
    .from('meeting_transcriptions')
    .select(TRANSCRIPTION_SELECT)
    .textSearch('transcript_text', searchTerm)
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getMeetingsWithRecordings(
  filters: MeetingTranscriptionFilters = {},
  page = 1,
  pageSize = 25
): Promise<{ data: MeetingTranscription[]; total: number }> {
  return getMeetingTranscriptions(
    { ...filters, hasRecording: true },
    page,
    pageSize
  );
}

export async function checkMeetingExists(
  orgId: string,
  meetingSource: MeetingSource,
  externalMeetingId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('meeting_transcriptions')
    .select('id')
    .eq('org_id', orgId)
    .eq('meeting_source', meetingSource)
    .eq('external_meeting_id', externalMeetingId)
    .maybeSingle();

  if (error) throw error;
  return data !== null;
}
