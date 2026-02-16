import { supabase } from '../lib/supabase';
import type { GoogleMeetSession, GoogleMeetSessionStatus } from '../types';

export interface MeetSessionFilters {
  status?: GoogleMeetSessionStatus[];
  search?: string;
  hasRecording?: boolean;
}

export async function getMeetSessionsByOrg(
  orgId: string,
  filters?: MeetSessionFilters,
  page = 1,
  pageSize = 20
): Promise<{ sessions: GoogleMeetSession[]; total: number }> {
  let query = supabase
    .from('google_meet_sessions')
    .select('*', { count: 'exact' })
    .eq('org_id', orgId)
    .order('event_start_time', { ascending: false });

  if (filters?.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  if (filters?.search) {
    query = query.ilike('calendar_event_summary', `%${filters.search}%`);
  }

  if (filters?.hasRecording) {
    query = query.not('recording_url', 'is', null);
  }

  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return { sessions: data || [], total: count || 0 };
}

export async function getMeetSessionById(id: string): Promise<GoogleMeetSession | null> {
  const { data, error } = await supabase
    .from('google_meet_sessions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function retriggerProcessing(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('google_meet_sessions')
    .update({
      status: 'queued',
      retry_count: 0,
      processed: false,
      processing_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) throw error;
}

export async function getMeetProcessingStats(orgId: string): Promise<{
  total: number;
  completed: number;
  failed: number;
  pending: number;
  noArtifacts: number;
}> {
  const { data, error } = await supabase
    .from('google_meet_sessions')
    .select('status')
    .eq('org_id', orgId);

  if (error) throw error;

  const sessions = data || [];
  return {
    total: sessions.length,
    completed: sessions.filter((s: { status: string }) => s.status === 'completed').length,
    failed: sessions.filter((s: { status: string }) => s.status === 'failed').length,
    pending: sessions.filter((s: { status: string }) =>
      ['detected', 'queued', 'processing'].includes(s.status)
    ).length,
    noArtifacts: sessions.filter((s: { status: string }) => s.status === 'no_artifacts').length,
  };
}
