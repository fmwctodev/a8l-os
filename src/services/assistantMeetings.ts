import { supabase } from '../lib/supabase';
import { callEdgeFunction } from '../lib/edgeFunction';
import type { AssistantMeetingSummary } from '../types/assistant';

export async function processMeetingTranscript(
  transcriptionId: string
): Promise<AssistantMeetingSummary> {
  const response = await callEdgeFunction('assistant-meeting-processor', {
    transcription_id: transcriptionId,
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Meeting processing failed');
  }

  return response.json();
}

export async function getMeetingSummaries(
  userId: string,
  limit: number = 20
): Promise<AssistantMeetingSummary[]> {
  const { data, error } = await supabase
    .from('assistant_meeting_summaries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as AssistantMeetingSummary[];
}

export async function getMeetingSummary(
  summaryId: string
): Promise<AssistantMeetingSummary | null> {
  const { data, error } = await supabase
    .from('assistant_meeting_summaries')
    .select('*')
    .eq('id', summaryId)
    .maybeSingle();

  if (error) throw error;
  return data as AssistantMeetingSummary | null;
}
