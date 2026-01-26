import { supabase } from '../lib/supabase';

export interface TeamChannel {
  id: string;
  organization_id: string;
  name: string | null;
  type: 'direct' | 'group';
  description: string | null;
  created_by: string;
  department_id: string | null;
  avatar_url: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamChannelMember {
  id: string;
  channel_id: string;
  user_id: string;
  organization_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  last_read_at: string;
  is_muted: boolean;
}

export interface TeamMessage {
  id: string;
  channel_id: string;
  organization_id: string;
  sender_id: string;
  content: string;
  reply_to_id: string | null;
  attachments: any[];
  mentions: any[];
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  sender?: {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
  };
  reactions?: TeamMessageReaction[];
}

export interface TeamMessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  organization_id: string;
  emoji: string;
  created_at: string;
}

export interface ChannelWithDetails extends TeamChannel {
  unread_count: number;
  last_message?: TeamMessage;
  members?: Array<{
    user_id: string;
    role: string;
    name: string;
    email: string;
    avatar_url: string | null;
  }>;
  member_count: number;
}

export async function getUserChannels(): Promise<ChannelWithDetails[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: members, error: membersError } = await supabase
    .from('team_channel_members')
    .select(`
      channel_id,
      last_read_at,
      is_muted,
      team_channels (
        id,
        organization_id,
        name,
        type,
        description,
        created_by,
        department_id,
        avatar_url,
        is_archived,
        created_at,
        updated_at
      )
    `)
    .eq('user_id', user.id)
    .order('last_read_at', { ascending: false });

  if (membersError) throw membersError;

  const channelsWithDetails: ChannelWithDetails[] = [];

  for (const member of members || []) {
    const channel = member.team_channels as any;
    if (!channel) continue;

    const { data: lastMessage } = await supabase
      .from('team_messages')
      .select('id, content, sender_id, created_at, is_deleted')
      .eq('channel_id', channel.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const { data: memberCount } = await supabase
      .from('team_channel_members')
      .select('id', { count: 'exact', head: true })
      .eq('channel_id', channel.id);

    const { data: channelMembers } = await supabase
      .from('team_channel_members')
      .select(`
        user_id,
        role,
        users (
          id,
          name,
          email,
          avatar_url
        )
      `)
      .eq('channel_id', channel.id);

    const unreadCount = await getUnreadCount(channel.id);

    channelsWithDetails.push({
      ...channel,
      unread_count: unreadCount,
      last_message: lastMessage || undefined,
      members: (channelMembers || []).map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
        name: m.users?.name || 'Unknown User',
        email: m.users?.email || '',
        avatar_url: m.users?.avatar_url || null,
      })),
      member_count: memberCount?.length || 0,
    });
  }

  return channelsWithDetails.sort((a, b) => {
    if (a.last_message && b.last_message) {
      return new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime();
    }
    if (a.last_message) return -1;
    if (b.last_message) return 1;
    return 0;
  });
}

export async function getUnreadCount(channelId: string): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data, error } = await supabase.rpc('get_channel_unread_count', {
    p_channel_id: channelId,
    p_user_id: user.id,
  });

  if (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }

  return data || 0;
}

export async function findOrCreateDirectChannel(otherUserId: string): Promise<TeamChannel> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!userData) throw new Error('User data not found');

  const { data: existingChannels } = await supabase
    .from('team_channel_members')
    .select('channel_id, team_channels!inner(id, type)')
    .eq('user_id', user.id);

  if (existingChannels) {
    for (const channelMember of existingChannels) {
      const channel = channelMember.team_channels as any;
      if (channel?.type === 'direct') {
        const { data: members } = await supabase
          .from('team_channel_members')
          .select('user_id')
          .eq('channel_id', channel.id);

        if (members && members.length === 2) {
          const userIds = members.map(m => m.user_id);
          if (userIds.includes(user.id) && userIds.includes(otherUserId)) {
            const { data: fullChannel } = await supabase
              .from('team_channels')
              .select('*')
              .eq('id', channel.id)
              .single();
            if (fullChannel) return fullChannel;
          }
        }
      }
    }
  }

  const { data: newChannel, error: channelError } = await supabase
    .from('team_channels')
    .insert({
      organization_id: userData.organization_id,
      type: 'direct',
      created_by: user.id,
    })
    .select()
    .single();

  if (channelError) throw channelError;

  const { error: member1Error } = await supabase
    .from('team_channel_members')
    .insert({
      channel_id: newChannel.id,
      user_id: user.id,
      organization_id: userData.organization_id,
      role: 'member',
    });

  if (member1Error) throw member1Error;

  const { error: member2Error } = await supabase
    .from('team_channel_members')
    .insert({
      channel_id: newChannel.id,
      user_id: otherUserId,
      organization_id: userData.organization_id,
      role: 'member',
    });

  if (member2Error) throw member2Error;

  return newChannel;
}

export async function createGroupChannel(
  name: string,
  description: string | null,
  memberUserIds: string[]
): Promise<TeamChannel> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!userData) throw new Error('User data not found');

  const { data: newChannel, error: channelError } = await supabase
    .from('team_channels')
    .insert({
      organization_id: userData.organization_id,
      name,
      description,
      type: 'group',
      created_by: user.id,
    })
    .select()
    .single();

  if (channelError) throw channelError;

  const { error: creatorError } = await supabase
    .from('team_channel_members')
    .insert({
      channel_id: newChannel.id,
      user_id: user.id,
      organization_id: userData.organization_id,
      role: 'admin',
    });

  if (creatorError) throw creatorError;

  if (memberUserIds.length > 0) {
    const memberInserts = memberUserIds
      .filter(id => id !== user.id)
      .map(userId => ({
        channel_id: newChannel.id,
        user_id: userId,
        organization_id: userData.organization_id,
        role: 'member' as const,
      }));

    if (memberInserts.length > 0) {
      const { error: membersError } = await supabase
        .from('team_channel_members')
        .insert(memberInserts);

      if (membersError) throw membersError;
    }
  }

  return newChannel;
}

export async function getChannelMessages(channelId: string, limit = 100): Promise<TeamMessage[]> {
  const { data, error } = await supabase
    .from('team_messages')
    .select(`
      *,
      sender:users!team_messages_sender_id_fkey (
        id,
        name,
        email,
        avatar_url
      )
    `)
    .eq('channel_id', channelId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;

  const messagesWithReactions = await Promise.all(
    (data || []).map(async (message) => {
      const { data: reactions } = await supabase
        .from('team_message_reactions')
        .select('*')
        .eq('message_id', message.id);

      return {
        ...message,
        reactions: reactions || [],
      };
    })
  );

  return messagesWithReactions;
}

export async function sendMessage(
  channelId: string,
  content: string,
  replyToId?: string,
  attachments?: any[]
): Promise<TeamMessage> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!userData) throw new Error('User data not found');

  const mentions = extractMentions(content);

  const { data, error } = await supabase
    .from('team_messages')
    .insert({
      channel_id: channelId,
      organization_id: userData.organization_id,
      sender_id: user.id,
      content,
      reply_to_id: replyToId || null,
      attachments: attachments || [],
      mentions,
    })
    .select(`
      *,
      sender:users!team_messages_sender_id_fkey (
        id,
        name,
        email,
        avatar_url
      )
    `)
    .single();

  if (error) throw error;

  return data;
}

export async function markChannelAsRead(channelId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('team_channel_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('channel_id', channelId)
    .eq('user_id', user.id);

  if (error) throw error;
}

export async function updateMessage(
  messageId: string,
  content: string
): Promise<void> {
  const { error } = await supabase
    .from('team_messages')
    .update({
      content,
      is_edited: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', messageId);

  if (error) throw error;
}

export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('team_messages')
    .update({
      is_deleted: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', messageId);

  if (error) throw error;
}

export async function addReaction(
  messageId: string,
  emoji: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!userData) throw new Error('User data not found');

  const { error } = await supabase
    .from('team_message_reactions')
    .insert({
      message_id: messageId,
      user_id: user.id,
      organization_id: userData.organization_id,
      emoji,
    });

  if (error && !error.message.includes('duplicate')) throw error;
}

export async function removeReaction(
  messageId: string,
  emoji: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('team_message_reactions')
    .delete()
    .eq('message_id', messageId)
    .eq('user_id', user.id)
    .eq('emoji', emoji);

  if (error) throw error;
}

export async function addMembersToChannel(
  channelId: string,
  userIds: string[]
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!userData) throw new Error('User data not found');

  const memberInserts = userIds.map(userId => ({
    channel_id: channelId,
    user_id: userId,
    organization_id: userData.organization_id,
    role: 'member' as const,
  }));

  const { error } = await supabase
    .from('team_channel_members')
    .insert(memberInserts);

  if (error) throw error;
}

export async function removeMemberFromChannel(
  channelId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('team_channel_members')
    .delete()
    .eq('channel_id', channelId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function updateChannelSettings(
  channelId: string,
  updates: Partial<Pick<TeamChannel, 'name' | 'description' | 'avatar_url'>>
): Promise<void> {
  const { error } = await supabase
    .from('team_channels')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', channelId);

  if (error) throw error;
}

export async function archiveChannel(channelId: string): Promise<void> {
  const { error } = await supabase
    .from('team_channels')
    .update({
      is_archived: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', channelId);

  if (error) throw error;
}

export async function getOrganizationUsers(excludeUserId?: string): Promise<Array<{
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  department_id: string | null;
  status: string;
}>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!userData) throw new Error('User data not found');

  let query = supabase
    .from('users')
    .select('id, name, email, avatar_url, department_id, status')
    .eq('organization_id', userData.organization_id)
    .eq('status', 'active');

  if (excludeUserId) {
    query = query.neq('id', excludeUserId);
  }

  const { data, error } = await query.order('name');

  if (error) throw error;

  return data || [];
}

export function subscribeToChannelMessages(
  channelId: string,
  callback: (message: TeamMessage) => void
) {
  const channel = supabase
    .channel(`team-messages-${channelId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'team_messages',
        filter: `channel_id=eq.${channelId}`,
      },
      async (payload) => {
        const { data: messageWithSender } = await supabase
          .from('team_messages')
          .select(`
            *,
            sender:users!team_messages_sender_id_fkey (
              id,
              name,
              email,
              avatar_url
            )
          `)
          .eq('id', payload.new.id)
          .single();

        if (messageWithSender) {
          callback(messageWithSender as TeamMessage);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToChannels(
  userId: string,
  callback: (event: 'new' | 'update' | 'delete', channelId: string) => void
) {
  const channel = supabase
    .channel(`team-channels-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'team_channel_members',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          callback('new', (payload.new as any).channel_id);
        } else if (payload.eventType === 'UPDATE') {
          callback('update', (payload.new as any).channel_id);
        } else if (payload.eventType === 'DELETE') {
          callback('delete', (payload.old as any).channel_id);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

function extractMentions(content: string): string[] {
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[2]);
  }

  return mentions;
}
