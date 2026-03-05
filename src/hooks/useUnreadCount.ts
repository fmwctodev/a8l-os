import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function useUnreadCount() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const debouncedFetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchUnreadCount();
    }, 400);
  }, [fetchUnreadCount]);

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
          debouncedFetch();
        }
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      channel.unsubscribe();
    };
  }, [user?.organization_id, debouncedFetch]);

  return { unreadCount, loading, refresh: fetchUnreadCount };
}
