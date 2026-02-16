import { supabase } from '../lib/supabase';
import type { ContactNote, ContactNoteMetadata, User } from '../types';
import { addTimelineEvent } from './contactTimeline';

const NOTE_SELECT = `
  *,
  user:users(id, name, avatar_url)
`;

export async function getContactNotes(contactId: string): Promise<ContactNote[]> {
  const { data, error } = await supabase
    .from('contact_notes')
    .select(NOTE_SELECT)
    .eq('contact_id', contactId)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getMeetNoteBySourceId(
  contactId: string,
  googleEventId: string
): Promise<ContactNote | null> {
  const { data, error } = await supabase
    .from('contact_notes')
    .select(NOTE_SELECT)
    .eq('contact_id', contactId)
    .eq('source_type', 'google_meet')
    .eq('source_id', googleEventId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getNoteById(id: string): Promise<ContactNote | null> {
  const { data, error } = await supabase
    .from('contact_notes')
    .select(NOTE_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export interface CreateNoteOptions {
  title?: string;
  source_type?: string;
  source_id?: string;
  metadata?: ContactNoteMetadata;
}

export async function createNote(
  contactId: string,
  content: string,
  currentUser: User,
  options?: CreateNoteOptions
): Promise<ContactNote> {
  const { data, error } = await supabase
    .from('contact_notes')
    .insert({
      contact_id: contactId,
      user_id: currentUser.id,
      content,
      title: options?.title || null,
      source_type: options?.source_type || null,
      source_id: options?.source_id || null,
      metadata: options?.metadata || null,
    })
    .select(NOTE_SELECT)
    .single();

  if (error) throw error;

  await addTimelineEvent(contactId, currentUser.id, 'note_added', {
    note_id: data.id,
    preview: options?.title || content.substring(0, 100),
  });

  return data;
}

export async function updateNote(
  id: string,
  content: string,
  currentUser: User
): Promise<ContactNote> {
  const { data: note } = await supabase
    .from('contact_notes')
    .select('contact_id')
    .eq('id', id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('contact_notes')
    .update({
      content,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(NOTE_SELECT)
    .single();

  if (error) throw error;

  if (note) {
    await addTimelineEvent(note.contact_id, currentUser.id, 'note_updated', {
      note_id: id,
    });
  }

  return data;
}

export async function deleteNote(id: string, currentUser: User): Promise<void> {
  const { data: note } = await supabase
    .from('contact_notes')
    .select('contact_id')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('contact_notes').delete().eq('id', id);

  if (error) throw error;

  if (note) {
    await addTimelineEvent(note.contact_id, currentUser.id, 'note_deleted', {
      note_id: id,
    });
  }
}

export async function toggleNotePin(id: string, isPinned: boolean): Promise<ContactNote> {
  const { data, error } = await supabase
    .from('contact_notes')
    .update({ is_pinned: isPinned })
    .eq('id', id)
    .select(NOTE_SELECT)
    .single();

  if (error) throw error;
  return data;
}
