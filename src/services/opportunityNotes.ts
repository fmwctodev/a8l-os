import { supabase } from '../lib/supabase';
import type { OpportunityNote } from '../types';
import { createTimelineEvent } from './opportunityTimeline';

export async function getNotesByOpportunity(opportunityId: string): Promise<OpportunityNote[]> {
  const { data, error } = await supabase
    .from('opportunity_notes')
    .select(`
      *,
      created_by_user:users(*)
    `)
    .eq('opportunity_id', opportunityId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createNote(note: {
  org_id: string;
  opportunity_id: string;
  contact_id: string;
  body: string;
  created_by: string;
}): Promise<OpportunityNote> {
  const { data, error } = await supabase
    .from('opportunity_notes')
    .insert({
      org_id: note.org_id,
      opportunity_id: note.opportunity_id,
      body: note.body,
      created_by: note.created_by
    })
    .select(`
      *,
      created_by_user:users(*)
    `)
    .single();

  if (error) throw error;

  await createTimelineEvent({
    org_id: note.org_id,
    opportunity_id: note.opportunity_id,
    contact_id: note.contact_id,
    event_type: 'note_added',
    summary: note.body.length > 100 ? `${note.body.substring(0, 100)}...` : note.body,
    payload: {
      note_id: data.id,
      body: note.body
    },
    actor_user_id: note.created_by
  });

  return data;
}

export async function updateNote(id: string, body: string): Promise<OpportunityNote> {
  const { data, error } = await supabase
    .from('opportunity_notes')
    .update({ body })
    .eq('id', id)
    .select(`
      *,
      created_by_user:users(*)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase
    .from('opportunity_notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}
