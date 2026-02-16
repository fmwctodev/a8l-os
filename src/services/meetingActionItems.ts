import { supabase } from '../lib/supabase';

export interface MeetingActionItem {
  id: string;
  org_id: string;
  meeting_transcription_id: string;
  contact_id: string;
  contact_task_id: string | null;
  description: string;
  assignee_name: string | null;
  assignee_user_id: string | null;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'task_created' | 'dismissed';
  source: 'gemini_notes' | 'transcript_ai';
  raw_text: string | null;
  created_at: string;
  updated_at: string;
  contact?: { id: string; first_name: string; last_name: string; email: string };
  assignee_user?: { id: string; name: string; email: string } | null;
  contact_task?: { id: string; title: string; status: string } | null;
}

const ACTION_ITEM_SELECT = `
  *,
  contact:contacts(id, first_name, last_name, email),
  assignee_user:users!assignee_user_id(id, name, email),
  contact_task:contact_tasks!contact_task_id(id, title, status)
`;

export async function getActionItemsByMeeting(
  meetingTranscriptionId: string
): Promise<MeetingActionItem[]> {
  const { data, error } = await supabase
    .from('meeting_action_items')
    .select(ACTION_ITEM_SELECT)
    .eq('meeting_transcription_id', meetingTranscriptionId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getActionItemsByContact(
  contactId: string
): Promise<MeetingActionItem[]> {
  const { data, error } = await supabase
    .from('meeting_action_items')
    .select(ACTION_ITEM_SELECT)
    .eq('contact_id', contactId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getPendingActionItemCount(
  meetingTranscriptionId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('meeting_action_items')
    .select('id', { count: 'exact', head: true })
    .eq('meeting_transcription_id', meetingTranscriptionId)
    .eq('status', 'pending');

  if (error) throw error;
  return count || 0;
}

export async function updateActionItem(
  id: string,
  updates: Partial<{
    assignee_user_id: string | null;
    due_date: string | null;
    priority: 'low' | 'medium' | 'high';
    status: 'pending' | 'task_created' | 'dismissed';
  }>
): Promise<MeetingActionItem> {
  const { data, error } = await supabase
    .from('meeting_action_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(ACTION_ITEM_SELECT)
    .single();

  if (error) throw error;
  return data;
}

export async function createTaskFromActionItem(
  actionItemId: string,
  userId: string
): Promise<MeetingActionItem> {
  const { data: item, error: fetchError } = await supabase
    .from('meeting_action_items')
    .select('*')
    .eq('id', actionItemId)
    .single();

  if (fetchError || !item) throw fetchError || new Error('Action item not found');

  const title = item.description.length > 100
    ? item.description.substring(0, 97) + '...'
    : item.description;

  const { data: task, error: taskError } = await supabase
    .from('contact_tasks')
    .insert({
      contact_id: item.contact_id,
      created_by_user_id: userId,
      assigned_to_user_id: item.assignee_user_id || userId,
      title,
      description: item.description,
      due_date: item.due_date,
      priority: item.priority,
      status: 'pending',
      source_meeting_id: item.meeting_transcription_id,
    })
    .select('id')
    .single();

  if (taskError) throw taskError;

  const { data: updated, error: updateError } = await supabase
    .from('meeting_action_items')
    .update({
      status: 'task_created',
      contact_task_id: task.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', actionItemId)
    .select(ACTION_ITEM_SELECT)
    .single();

  if (updateError) throw updateError;

  await supabase.from('contact_timeline').insert({
    contact_id: item.contact_id,
    user_id: userId,
    event_type: 'task_created',
    metadata: {
      task_id: task.id,
      task_title: title,
      source: 'meeting_action_item',
      meeting_transcription_id: item.meeting_transcription_id,
    },
  });

  return updated;
}

export async function bulkCreateTasksFromActionItems(
  meetingTranscriptionId: string,
  userId: string
): Promise<number> {
  const { data: items, error } = await supabase
    .from('meeting_action_items')
    .select('id')
    .eq('meeting_transcription_id', meetingTranscriptionId)
    .eq('status', 'pending');

  if (error) throw error;
  if (!items || items.length === 0) return 0;

  let created = 0;
  for (const item of items) {
    try {
      await createTaskFromActionItem(item.id, userId);
      created++;
    } catch (err) {
      console.error(`Failed to create task for action item ${item.id}:`, err);
    }
  }

  return created;
}

export async function dismissActionItem(id: string): Promise<MeetingActionItem> {
  return updateActionItem(id, { status: 'dismissed' });
}

export async function restoreActionItem(id: string): Promise<MeetingActionItem> {
  return updateActionItem(id, { status: 'pending' });
}
