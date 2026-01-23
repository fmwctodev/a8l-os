import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function useUnreadCount() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchUnreadCount = useCallback(async () => {
    if (!user?.organization_id) return;

    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('unread_count')
        .eq('organization_id', user.organization_id)
        .gt('unread_count', 0);

      if (error) throw error;

      const total = data?.reduce((sum, conv) => sum + (conv.unread_count || 0), 0) || 0;
      setUnreadCount(total);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.organization_id]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (!user?.organization_id) return;

    const channel = supabase
      .channel(`unread:${user.organization_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `organization_id=eq.${user.organization_id}`,
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user?.organization_id, fetchUnreadCount]);

  return { unreadCount, loading, refresh: fetchUnreadCount };
}
