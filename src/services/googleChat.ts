import { supabase } from '../lib/supabase';

export interface GoogleChatConnectionStatus {
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
  scopes: string[] | null;
}

export interface GoogleChatSpace {
  name: string;
  displayName: string;
  spaceType: 'ROOM' | 'DM' | 'SPACE';
  singleUserBotDm?: boolean;
  threaded?: boolean;
}

export interface GoogleChatSpaceCache {
  id: string;
  user_id: string;
  space_id: string;
  space_name: string;
  space_type: string;
  display_name: string;
  single_user_bot_dm: boolean;
  threaded: boolean;
  member_count: number;
  last_synced_at: string;
  unread_count?: number;
}

export interface GoogleChatMessage {
  name: string;
  sender: {
    name: string;
    displayName: string;
    email?: string;
    avatarUri?: string;
    type: 'HUMAN' | 'BOT';
  };
  createTime: string;
  text?: string;
  formattedText?: string;
  thread?: {
    name: string;
  };
  attachment?: unknown[];
}

export interface GoogleChatMessageCache {
  id: string;
  user_id: string;
  space_cache_id: string;
  message_id: string;
  thread_id: string | null;
  sender_name: string;
  sender_email: string | null;
  sender_avatar_url: string | null;
  sender_type: string;
  content: string;
  formatted_text: string;
  attachment_urls: unknown[];
  sent_at: string;
  is_read: boolean;
  created_at: string;
}

export interface GoogleChatMember {
  name: string;
  member: {
    name: string;
    displayName?: string;
    email?: string;
    avatarUri?: string;
    type: 'HUMAN' | 'BOT';
  };
  role: 'ROLE_MEMBER' | 'ROLE_MANAGER';
  state: 'MEMBER_JOINED' | 'MEMBER_INVITED' | 'MEMBER_NOT_A_MEMBER';
}

async function getApiUrl(): Promise<string> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/google-chat-api`;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

export async function checkConnectionStatus(): Promise<GoogleChatConnectionStatus> {
  const apiUrl = await getApiUrl();
  const headers = await getAuthHeaders();

  const response = await fetch(`${apiUrl}/status`, { headers });

  if (!response.ok) {
    if (response.status === 404) {
      return { connected: false, email: null, connectedAt: null, scopes: null };
    }
    throw new Error('Failed to check connection status');
  }

  return response.json();
}

export async function getAuthUrl(redirectUrl?: string): Promise<string> {
  const apiUrl = await getApiUrl();
  const headers = await getAuthHeaders();

  const params = new URLSearchParams();
  if (redirectUrl) {
    params.set('redirectUrl', redirectUrl);
  }

  const response = await fetch(`${apiUrl}/auth-url?${params}`, { headers });

  if (!response.ok) {
    throw new Error('Failed to get auth URL');
  }

  const data = await response.json();
  return data.authUrl;
}

export async function initiateConnection(redirectUrl?: string): Promise<void> {
  const authUrl = await getAuthUrl(redirectUrl);
  window.location.href = authUrl;
}

export async function disconnectAccount(): Promise<void> {
  const apiUrl = await getApiUrl();
  const headers = await getAuthHeaders();

  const response = await fetch(`${apiUrl}/disconnect`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to disconnect account');
  }
}

export async function getSpaces(): Promise<GoogleChatSpace[]> {
  const apiUrl = await getApiUrl();
  const headers = await getAuthHeaders();

  const response = await fetch(`${apiUrl}/spaces`, { headers });

  if (!response.ok) {
    const error = await response.json();
    if (error.code === 'NOT_CONNECTED') {
      throw new Error('NOT_CONNECTED');
    }
    throw new Error('Failed to fetch spaces');
  }

  const data = await response.json();
  return data.spaces || [];
}

export async function getCachedSpaces(): Promise<GoogleChatSpaceCache[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: spaces, error } = await supabase
    .from('google_chat_spaces_cache')
    .select('*')
    .eq('user_id', user.id)
    .order('display_name');

  if (error) throw error;

  const { data: unreadCounts } = await supabase
    .from('google_chat_messages_cache')
    .select('space_cache_id')
    .eq('user_id', user.id)
    .eq('is_read', false);

  const unreadBySpace = new Map<string, number>();
  unreadCounts?.forEach(msg => {
    const current = unreadBySpace.get(msg.space_cache_id) || 0;
    unreadBySpace.set(msg.space_cache_id, current + 1);
  });

  return (spaces || []).map(space => ({
    ...space,
    unread_count: unreadBySpace.get(space.id) || 0,
  }));
}

export async function syncSpaces(): Promise<{ synced: number; removed: number }> {
  const apiUrl = await getApiUrl();
  const headers = await getAuthHeaders();

  const response = await fetch(`${apiUrl}/sync-spaces`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to sync spaces');
  }

  return response.json();
}

export async function getMessages(
  spaceId: string,
  pageToken?: string,
  pageSize = 50
): Promise<{ messages: GoogleChatMessage[]; nextPageToken?: string }> {
  const apiUrl = await getApiUrl();
  const headers = await getAuthHeaders();

  const params = new URLSearchParams({
    spaceId,
    pageSize: pageSize.toString(),
  });
  if (pageToken) {
    params.set('pageToken', pageToken);
  }

  const response = await fetch(`${apiUrl}/messages?${params}`, { headers });

  if (!response.ok) {
    throw new Error('Failed to fetch messages');
  }

  return response.json();
}

export async function getCachedMessages(
  spaceCacheId: string,
  limit = 100
): Promise<GoogleChatMessageCache[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('google_chat_messages_cache')
    .select('*')
    .eq('user_id', user.id)
    .eq('space_cache_id', spaceCacheId)
    .order('sent_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function sendMessage(
  spaceId: string,
  text: string,
  threadId?: string
): Promise<GoogleChatMessage> {
  const apiUrl = await getApiUrl();
  const headers = await getAuthHeaders();

  const response = await fetch(`${apiUrl}/send`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ spaceId, text, threadId }),
  });

  if (!response.ok) {
    throw new Error('Failed to send message');
  }

  const data = await response.json();
  return data.message;
}

export async function markAsRead(spaceId: string, messageIds?: string[]): Promise<void> {
  const apiUrl = await getApiUrl();
  const headers = await getAuthHeaders();

  const response = await fetch(`${apiUrl}/mark-read`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ spaceId, messageIds }),
  });

  if (!response.ok) {
    throw new Error('Failed to mark as read');
  }
}

export async function markCachedMessagesAsRead(spaceCacheId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('google_chat_messages_cache')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('space_cache_id', spaceCacheId);

  if (error) throw error;
}

export async function getMembers(spaceId: string): Promise<GoogleChatMember[]> {
  const apiUrl = await getApiUrl();
  const headers = await getAuthHeaders();

  const response = await fetch(`${apiUrl}/members?spaceId=${encodeURIComponent(spaceId)}`, {
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch members');
  }

  const data = await response.json();
  return data.members || [];
}

export function subscribeToMessages(
  userId: string,
  callback: (message: GoogleChatMessageCache) => void
): () => void {
  const channel = supabase
    .channel(`google-chat-messages-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'google_chat_messages_cache',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        callback(payload.new as GoogleChatMessageCache);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToSpaces(
  userId: string,
  callback: (space: GoogleChatSpaceCache) => void
): () => void {
  const channel = supabase
    .channel(`google-chat-spaces-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'google_chat_spaces_cache',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          callback(payload.new as GoogleChatSpaceCache);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function getTotalUnreadCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from('google_chat_messages_cache')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) return 0;
  return count || 0;
}
