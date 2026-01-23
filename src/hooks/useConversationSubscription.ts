import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Message, Conversation } from '../types';

interface UseConversationSubscriptionOptions {
  conversationId: string;
  onNewMessage?: (message: Message) => void;
  onConversationUpdate?: (conversation: Partial<Conversation>) => void;
}

export function useConversationSubscription({
  conversationId,
  onNewMessage,
  onConversationUpdate,
}: UseConversationSubscriptionOptions) {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!conversationId) return;

    const messagesChannel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (onNewMessage) {
            onNewMessage(payload.new as Message);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (onNewMessage) {
            onNewMessage(payload.new as Message);
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    const conversationChannel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `id=eq.${conversationId}`,
        },
        (payload) => {
          if (onConversationUpdate) {
            onConversationUpdate(payload.new as Partial<Conversation>);
          }
        }
      )
      .subscribe();

    return () => {
      messagesChannel.unsubscribe();
      conversationChannel.unsubscribe();
    };
  }, [conversationId, onNewMessage, onConversationUpdate]);

  return { isConnected };
}

interface UseConversationListSubscriptionOptions {
  organizationId: string;
  onConversationUpdate?: (conversation: Conversation) => void;
  onNewConversation?: (conversation: Conversation) => void;
}

export function useConversationListSubscription({
  organizationId,
  onConversationUpdate,
  onNewConversation,
}: UseConversationListSubscriptionOptions) {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel(`conversations:${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
          filter: `organization_id=eq.${organizationId}`,
        },
        async (payload) => {
          if (onNewConversation) {
            const { data } = await supabase
              .from('conversations')
              .select(`
                *,
                contact:contacts!contact_id(id, first_name, last_name, email, phone),
                assigned_user:users!assigned_user_id(id, name, avatar_url)
              `)
              .eq('id', payload.new.id)
              .single();

            if (data) {
              onNewConversation(data as Conversation);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `organization_id=eq.${organizationId}`,
        },
        async (payload) => {
          if (onConversationUpdate) {
            const { data } = await supabase
              .from('conversations')
              .select(`
                *,
                contact:contacts!contact_id(id, first_name, last_name, email, phone),
                assigned_user:users!assigned_user_id(id, name, avatar_url)
              `)
              .eq('id', payload.new.id)
              .single();

            if (data) {
              onConversationUpdate(data as Conversation);
            }
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      channel.unsubscribe();
    };
  }, [organizationId, onConversationUpdate, onNewConversation]);

  return { isConnected };
}
