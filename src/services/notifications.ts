import { supabase } from '../lib/supabase';

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  icon: string | null;
  link: string | null;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

const NOTIFICATION_LIMIT = 30;

export async function getNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(NOTIFICATION_LIMIT);

  if (error) throw error;
  return data || [];
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;
  return count || 0;
}

export async function markAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) throw error;
}

export async function markAllAsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;
}

export async function deleteNotification(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) throw error;
}

export async function createNotification(params: {
  user_id: string;
  type: string;
  title: string;
  body?: string;
  icon?: string;
  link?: string;
  metadata?: Record<string, unknown>;
}): Promise<Notification> {
  const { data, error } = await supabase
    .from('notifications')
    .insert(params)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function notifyOrgUsers(
  orgId: string,
  params: Omit<Parameters<typeof createNotification>[0], 'user_id'>,
  excludeUserId?: string
): Promise<void> {
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('organization_id', orgId);

  if (!users?.length) return;

  const rows = users
    .filter((u) => u.id !== excludeUserId)
    .map((u) => ({ ...params, user_id: u.id }));

  if (rows.length === 0) return;

  await supabase.from('notifications').insert(rows);
}

export async function notifySupportTicketCreated(
  orgId: string,
  ticketTitle: string,
  projectId: string,
  clientName: string
): Promise<void> {
  await notifyOrgUsers(orgId, {
    type: 'support_ticket',
    title: 'New Support Ticket',
    body: `${clientName} submitted: "${ticketTitle}"`,
    link: `/projects/${projectId}?tab=support`,
    metadata: { project_id: projectId },
  });
}

export async function notifyChangeRequestCreated(
  orgId: string,
  requestTitle: string,
  projectId: string,
  clientName: string
): Promise<void> {
  await notifyOrgUsers(orgId, {
    type: 'change_request',
    title: 'New Change Request',
    body: `${clientName} submitted: "${requestTitle}"`,
    link: `/projects/${projectId}?tab=changes`,
    metadata: { project_id: projectId },
  });
}

export async function notifyConversationAssigned(
  userId: string,
  conversationId: string,
  assignerName: string
): Promise<void> {
  await createNotification({
    user_id: userId,
    type: 'conversation_assigned',
    title: 'Conversation Assigned to You',
    body: `${assignerName} assigned you a conversation`,
    link: `/conversations?id=${conversationId}`,
    metadata: { conversation_id: conversationId },
  });
}

export async function notifyTaskAssigned(
  userId: string,
  taskTitle: string,
  contactId: string,
  assignerName: string
): Promise<void> {
  await createNotification({
    user_id: userId,
    type: 'task_assigned',
    title: 'Task Assigned to You',
    body: `${assignerName} assigned you: "${taskTitle}"`,
    link: `/contacts/${contactId}?tab=tasks`,
    metadata: { contact_id: contactId },
  });
}

export async function notifyAppointmentBooked(
  userId: string,
  startTime: string,
  contactName?: string
): Promise<void> {
  const who = contactName || 'A guest';
  await createNotification({
    user_id: userId,
    type: 'appointment_booked',
    title: 'Appointment Booked',
    body: `${who} booked an appointment for ${new Date(startTime).toLocaleString()}`,
    link: '/calendars',
    metadata: { start_time: startTime },
  });
}

export async function notifyAIDraftReady(
  orgId: string,
  draftType: 'proposal' | 'contract',
  entityName: string,
  link: string
): Promise<void> {
  await notifyOrgUsers(orgId, {
    type: 'ai_draft_ready',
    title: `AI ${draftType === 'proposal' ? 'Proposal' : 'Contract'} Draft Ready`,
    body: `An AI-generated ${draftType} draft is ready for "${entityName}"`,
    link,
  });
}

export async function notifyNewEmail(
  userId: string,
  senderName: string,
  subject: string,
  conversationId?: string
): Promise<void> {
  await createNotification({
    user_id: userId,
    type: 'email',
    title: 'New Email Received',
    body: `From ${senderName}: ${subject}`,
    link: conversationId ? `/conversations?id=${conversationId}` : '/conversations',
    metadata: { sender: senderName, subject },
  });
}

export async function notifySystem(
  userId: string,
  title: string,
  body: string,
  link?: string
): Promise<void> {
  await createNotification({
    user_id: userId,
    type: 'system',
    title,
    body,
    link,
  });
}

export function subscribeToNotifications(
  userId: string,
  onInsert: (notification: Notification) => void
) {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        onInsert(payload.new as Notification);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
