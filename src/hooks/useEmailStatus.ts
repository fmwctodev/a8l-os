import { useState, useEffect, useCallback } from 'react';
import { getEmailSetupStatus } from '../services/emailSend';
import type { EmailSetupStatus } from '../types';

interface UseEmailStatusResult {
  status: EmailSetupStatus | null;
  loading: boolean;
  error: string | null;
  isConfigured: boolean;
  refresh: () => Promise<void>;
}

export function useEmailStatus(): UseEmailStatusResult {
  const [status, setStatus] = useState<EmailSetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      const data = await getEmailSetupStatus();
      setStatus(data);
    } catch (err) {
      setError('Failed to load email status');
      console.error('Failed to load email status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    const handleFocus = () => {
      fetchStatus();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchStatus]);

  return {
    status,
    loading,
    error,
    isConfigured: status?.isConfigured ?? false,
    refresh: fetchStatus,
  };
}
