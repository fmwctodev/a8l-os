import { supabase } from '../lib/supabase';
import * as gmailApi from './gmailApi';
import * as outlookApi from './outlookApi';

export type EmailProvider = 'google' | 'microsoft';

export async function detectEmailProvider(userId: string): Promise<EmailProvider> {
  const { data: msToken } = await supabase
    .from('microsoft_oauth_master')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (msToken) return 'microsoft';
  return 'google';
}

export async function sendEmail(
  provider: EmailProvider,
  params: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    htmlBody: string;
    conversationId?: string;
    contactId?: string;
    threadId?: string;
    inReplyTo?: string;
    references?: string;
  }
): Promise<any> {
  if (provider === 'microsoft') {
    return outlookApi.sendOutlookEmail(params);
  }
  return gmailApi.sendGmailEmail(params);
}

export async function replyToThread(
  provider: EmailProvider,
  params: {
    messageId?: string;
    to: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    htmlBody: string;
    threadId?: string;
    inReplyTo?: string;
    references?: string;
    conversationId?: string;
    contactId?: string;
  }
): Promise<any> {
  if (provider === 'microsoft') {
    return outlookApi.replyToOutlookThread({
      messageId: params.messageId!,
      to: params.to,
      cc: params.cc,
      bcc: params.bcc,
      htmlBody: params.htmlBody,
      conversationId: params.conversationId,
      contactId: params.contactId,
    });
  }
  return gmailApi.replyToGmailThread({
    to: params.to,
    cc: params.cc,
    bcc: params.bcc,
    subject: params.subject,
    htmlBody: params.htmlBody,
    threadId: params.threadId!,
    inReplyTo: params.inReplyTo,
    references: params.references,
    conversationId: params.conversationId,
    contactId: params.contactId,
  });
}

export async function getSignature(provider: EmailProvider): Promise<string> {
  if (provider === 'microsoft') {
    return outlookApi.getOutlookSignature();
  }
  // Google signature is handled in the gmail-api edge function
  return '';
}
