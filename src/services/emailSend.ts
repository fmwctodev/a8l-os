import { supabase } from '../lib/supabase';
import type { EmailSetupStatus, EmailTestLog } from '../types';

export async function getEmailSetupStatus(): Promise<EmailSetupStatus> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-send`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'check-status' }),
    }
  );

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error);
  }
  return result.status;
}

export async function sendTestEmail(
  toEmail: string,
  fromAddressId: string,
  subject?: string,
  body?: string
): Promise<{ success: boolean; messageId?: string; error?: string; blockingReasons?: string[] }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-send`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'test',
        toEmail,
        fromAddressId,
        subject,
        body,
      }),
    }
  );

  const result = await response.json();
  if (!response.ok) {
    return {
      success: false,
      error: result.error,
      blockingReasons: result.blockingReasons,
    };
  }
  return { success: true, messageId: result.messageId };
}

export async function getTestEmailLogs(orgId: string, limit = 10): Promise<EmailTestLog[]> {
  const { data, error } = await supabase
    .from('email_test_logs')
    .select(`
      *,
      from_address:email_from_addresses(email, display_name),
      sent_by_user:users(full_name, email)
    `)
    .eq('org_id', orgId)
    .order('sent_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export interface SendEmailOptions {
  toEmail: string;
  toName?: string;
  fromAddressId?: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
  replyTo?: string;
  unsubscribeGroupId?: string;
  trackOpens?: boolean;
  trackClicks?: boolean;
}

export async function sendEmail(
  options: SendEmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string; blockingReasons?: string[] }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-send`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'send',
        ...options,
      }),
    }
  );

  const result = await response.json();
  if (!response.ok) {
    return {
      success: false,
      error: result.error,
      blockingReasons: result.blockingReasons,
    };
  }
  return { success: true, messageId: result.messageId };
}
