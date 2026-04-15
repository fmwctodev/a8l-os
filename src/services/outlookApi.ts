import { callEdgeFunction, parseEdgeFunctionError } from '../lib/edgeFunction';

async function callOutlookApi(action: string, body?: Record<string, unknown>) {
  const response = await callEdgeFunction('outlook-api', { action, ...body });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(parseEdgeFunctionError(err, `Outlook API ${action} failed`));
  }

  return response.json();
}

export async function sendOutlookEmail(params: {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  htmlBody: string;
  conversationId?: string;
  contactId?: string;
  threadId?: string;
}): Promise<any> {
  return callOutlookApi('send', params);
}

export async function replyToOutlookThread(params: {
  messageId: string;
  to: string;
  cc?: string;
  bcc?: string;
  htmlBody: string;
  conversationId?: string;
  contactId?: string;
}): Promise<any> {
  return callOutlookApi('reply', params);
}

export async function listOutlookMessages(params?: {
  limit?: number;
  folderId?: string;
}): Promise<any[]> {
  return callOutlookApi('list-messages', params);
}

export async function getOutlookMessage(messageId: string): Promise<any> {
  return callOutlookApi('get-message', { messageId });
}

export async function createOutlookDraft(params: {
  to: string;
  subject: string;
  htmlBody: string;
}): Promise<any> {
  return callOutlookApi('create-draft', params);
}

export async function getOutlookSignature(): Promise<string> {
  const result = await callOutlookApi('get-signature');
  return result.signature || '';
}

export async function getOutlookAttachment(
  messageId: string,
  attachmentId: string
): Promise<any> {
  return callOutlookApi('get-attachment', { messageId, attachmentId });
}
