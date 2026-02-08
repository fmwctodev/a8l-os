import { supabase } from '../lib/supabase';

async function callGmailApi(action: string, body?: Record<string, unknown>) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No active session');

  const response = await fetch(`${supabaseUrl}/functions/v1/gmail-api`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ action, ...body }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Gmail API ${action} failed`);
  }

  return response.json();
}

export async function initiateGmailOAuth(redirectUri?: string): Promise<string> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No active session');

  const response = await fetch(`${supabaseUrl}/functions/v1/gmail-oauth-start`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      redirect_uri: redirectUri || `${window.location.origin}/settings/profile?tab=connected-accounts`,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to start Gmail OAuth');
  }

  const data = await response.json();
  return data.authUrl;
}

export async function getGmailProfile() {
  return callGmailApi('get-profile');
}

export async function listGmailMessages(query = '', maxResults = 20, pageToken?: string) {
  return callGmailApi('list-messages', { query, maxResults, pageToken });
}

export async function getGmailMessage(messageId: string, format = 'full') {
  return callGmailApi('get-message', { messageId, format });
}

export async function getGmailThread(threadId: string) {
  return callGmailApi('get-thread', { threadId });
}

export async function sendGmailEmail(params: {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  htmlBody: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  conversationId?: string;
  contactId?: string;
}) {
  return callGmailApi('send', params);
}

export async function replyToGmailThread(params: {
  to: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  htmlBody: string;
  threadId: string;
  inReplyTo?: string;
  references?: string;
  conversationId?: string;
  contactId?: string;
}) {
  return callGmailApi('reply', params);
}

export async function createGmailDraft(params: {
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  htmlBody?: string;
  threadId?: string;
}) {
  return callGmailApi('create-draft', params);
}

export async function updateGmailDraft(params: {
  draftId: string;
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  htmlBody?: string;
  threadId?: string;
}) {
  return callGmailApi('update-draft', params);
}

export async function deleteGmailDraft(draftId: string) {
  return callGmailApi('delete-draft', { draftId });
}

export async function listGmailDrafts(maxResults = 20, pageToken?: string) {
  return callGmailApi('list-drafts', { maxResults, pageToken });
}

export async function trashGmailMessage(messageId: string) {
  return callGmailApi('trash', { messageId });
}

export async function archiveGmailMessage(messageId: string) {
  return callGmailApi('archive', { messageId });
}

export async function modifyGmailLabels(
  messageId: string,
  addLabelIds?: string[],
  removeLabelIds?: string[]
) {
  return callGmailApi('modify-labels', { messageId, addLabelIds, removeLabelIds });
}

export async function disconnectGmail(userId: string): Promise<void> {
  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', userId)
    .maybeSingle();

  if (userData) {
    await supabase
      .from('gmail_oauth_tokens')
      .delete()
      .eq('organization_id', userData.organization_id)
      .eq('user_id', userId);

    await supabase
      .from('gmail_sync_state')
      .delete()
      .eq('organization_id', userData.organization_id)
      .eq('user_id', userId);
  }

  await supabase
    .from('user_connected_accounts')
    .delete()
    .eq('user_id', userId)
    .eq('provider', 'google_gmail');

  await supabase
    .from('users')
    .update({ gmail_connected: false, updated_at: new Date().toISOString() })
    .eq('id', userId);
}

export async function getGmailConnectionStatus(userId: string): Promise<{
  connected: boolean;
  email: string | null;
  lastSyncAt: string | null;
  syncStatus: string | null;
}> {
  const { data: userData } = await supabase
    .from('users')
    .select('gmail_connected, organization_id')
    .eq('id', userId)
    .maybeSingle();

  if (!userData?.gmail_connected) {
    return { connected: false, email: null, lastSyncAt: null, syncStatus: null };
  }

  const { data: tokenData } = await supabase
    .from('gmail_oauth_tokens')
    .select('email')
    .eq('organization_id', userData.organization_id)
    .eq('user_id', userId)
    .maybeSingle();

  const { data: syncData } = await supabase
    .from('gmail_sync_state')
    .select('last_incremental_sync_at, last_full_sync_at, sync_status')
    .eq('organization_id', userData.organization_id)
    .eq('user_id', userId)
    .maybeSingle();

  return {
    connected: true,
    email: tokenData?.email || null,
    lastSyncAt: syncData?.last_incremental_sync_at || syncData?.last_full_sync_at || null,
    syncStatus: syncData?.sync_status || null,
  };
}
