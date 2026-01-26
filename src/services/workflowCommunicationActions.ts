import { supabase } from '../lib/supabase';
import type {
  SendSmsConfig,
  SendEmailConfig,
  SendInternalSmsConfig,
  SendInternalEmailConfig,
  VoiceActionConfig,
  VoicemailDropConfig,
  WebchatMessageConfig,
  SocialDMConfig,
  NotifyUserConfig,
  RecipientType,
} from '../types/workflowActions';

export interface CommunicationActionContext {
  orgId: string;
  contactId: string;
  enrollmentId: string;
  actorUserId?: string;
  contextData?: Record<string, unknown>;
}

export interface CommunicationActionResult {
  success: boolean;
  messageId?: string;
  error?: string;
  data?: Record<string, unknown>;
}

function resolveMergeFields(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
    const keys = path.split('.');
    let value: unknown = data;
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return '';
      }
    }
    if (value === undefined || value === null) return '';
    return String(value);
  });
}

async function getContactData(contactId: string): Promise<Record<string, unknown>> {
  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .maybeSingle();

  if (!contact) return {};

  return {
    first_name: contact.first_name,
    last_name: contact.last_name,
    full_name: `${contact.first_name} ${contact.last_name}`.trim(),
    email: contact.email,
    phone: contact.phone,
    company: contact.company,
    job_title: contact.job_title,
    source: contact.source,
  };
}

async function resolveRecipients(
  orgId: string,
  recipientType: RecipientType,
  recipientIds?: string[],
  roleNames?: string[],
  contactId?: string
): Promise<Array<{ userId: string; email?: string; phone?: string }>> {
  const recipients: Array<{ userId: string; email?: string; phone?: string }> = [];

  if (recipientType === 'user_id' && recipientIds?.length) {
    const { data: users } = await supabase
      .from('users')
      .select('id, email, phone')
      .in('id', recipientIds);

    users?.forEach(u => recipients.push({ userId: u.id, email: u.email, phone: u.phone }));
  }

  if (recipientType === 'role' && roleNames?.length) {
    const { data: roleUsers } = await supabase
      .from('users')
      .select('id, email, phone, role:roles!inner(name)')
      .eq('org_id', orgId)
      .in('roles.name', roleNames);

    roleUsers?.forEach(u => recipients.push({ userId: u.id, email: u.email, phone: u.phone }));
  }

  if (recipientType === 'team') {
    const { data: teamUsers } = await supabase
      .from('users')
      .select('id, email, phone')
      .eq('org_id', orgId)
      .eq('status', 'active');

    teamUsers?.forEach(u => recipients.push({ userId: u.id, email: u.email, phone: u.phone }));
  }

  if (recipientType === 'contact_owner' && contactId) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('assigned_user:users!assigned_user_id(id, email, phone)')
      .eq('id', contactId)
      .maybeSingle();

    const assignedUser = contact?.assigned_user as { id: string; email: string; phone: string } | null;
    if (assignedUser) {
      recipients.push({ userId: assignedUser.id, email: assignedUser.email, phone: assignedUser.phone });
    }
  }

  return recipients;
}

export async function sendSms(
  config: SendSmsConfig,
  context: CommunicationActionContext
): Promise<CommunicationActionResult> {
  try {
    const { data: contact } = await supabase
      .from('contacts')
      .select('phone')
      .eq('id', context.contactId)
      .maybeSingle();

    if (!contact?.phone) {
      return { success: false, error: 'Contact does not have a phone number' };
    }

    const contactData = await getContactData(context.contactId);
    const mergedMessage = resolveMergeFields(config.message, {
      ...contactData,
      ...context.contextData,
    });

    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        org_id: context.orgId,
        conversation_id: null,
        contact_id: context.contactId,
        direction: 'outbound',
        channel: 'sms',
        content: mergedMessage,
        status: 'queued',
        metadata: {
          workflow_enrollment_id: context.enrollmentId,
          from_number_id: config.fromNumberId,
          media_urls: config.mediaUrls,
          track_links: config.trackLinks,
        },
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      messageId: message.id,
      data: { message },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send SMS',
    };
  }
}

export async function sendEmail(
  config: SendEmailConfig,
  context: CommunicationActionContext
): Promise<CommunicationActionResult> {
  try {
    const { data: contact } = await supabase
      .from('contacts')
      .select('email')
      .eq('id', context.contactId)
      .maybeSingle();

    if (!contact?.email) {
      return { success: false, error: 'Contact does not have an email address' };
    }

    const contactData = await getContactData(context.contactId);
    const mergedSubject = resolveMergeFields(config.subject, {
      ...contactData,
      ...context.contextData,
    });
    const mergedBody = resolveMergeFields(config.body, {
      ...contactData,
      ...context.contextData,
    });

    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        org_id: context.orgId,
        conversation_id: null,
        contact_id: context.contactId,
        direction: 'outbound',
        channel: 'email',
        content: mergedBody,
        status: 'queued',
        metadata: {
          workflow_enrollment_id: context.enrollmentId,
          subject: mergedSubject,
          from_address_id: config.fromAddressId,
          reply_to: config.replyTo,
          template_id: config.templateId,
          attachments: config.attachments,
          track_opens: config.trackOpens,
          track_clicks: config.trackClicks,
        },
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      messageId: message.id,
      data: { message },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

export async function sendInternalSms(
  config: SendInternalSmsConfig,
  context: CommunicationActionContext
): Promise<CommunicationActionResult> {
  try {
    const recipients = await resolveRecipients(
      context.orgId,
      config.recipientType,
      config.recipientIds,
      config.roleNames,
      context.contactId
    );

    if (recipients.length === 0) {
      return { success: false, error: 'No recipients found' };
    }

    let messageContent = config.message;

    if (config.includeContactInfo) {
      const contactData = await getContactData(context.contactId);
      messageContent += `\n\nContact: ${contactData.full_name}`;
      if (contactData.phone) messageContent += ` | ${contactData.phone}`;
      if (contactData.email) messageContent += ` | ${contactData.email}`;
    }

    const messageInserts = recipients
      .filter(r => r.phone)
      .map(r => ({
        org_id: context.orgId,
        conversation_id: null,
        contact_id: null,
        direction: 'outbound' as const,
        channel: 'sms' as const,
        content: messageContent,
        status: 'queued' as const,
        metadata: {
          workflow_enrollment_id: context.enrollmentId,
          internal_recipient_user_id: r.userId,
          to_phone: r.phone,
          is_internal: true,
        },
      }));

    if (messageInserts.length === 0) {
      return { success: false, error: 'No recipients have phone numbers' };
    }

    const { data: messages, error } = await supabase
      .from('messages')
      .insert(messageInserts)
      .select();

    if (error) throw error;

    return {
      success: true,
      data: { messages, recipientCount: recipients.length },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send internal SMS',
    };
  }
}

export async function sendInternalEmail(
  config: SendInternalEmailConfig,
  context: CommunicationActionContext
): Promise<CommunicationActionResult> {
  try {
    const recipients = await resolveRecipients(
      context.orgId,
      config.recipientType,
      config.recipientIds,
      config.roleNames,
      context.contactId
    );

    if (recipients.length === 0) {
      return { success: false, error: 'No recipients found' };
    }

    const messageInserts = recipients
      .filter(r => r.email)
      .map(r => ({
        org_id: context.orgId,
        conversation_id: null,
        contact_id: null,
        direction: 'outbound' as const,
        channel: 'email' as const,
        content: config.body,
        status: 'queued' as const,
        metadata: {
          workflow_enrollment_id: context.enrollmentId,
          internal_recipient_user_id: r.userId,
          to_email: r.email,
          subject: config.subject,
          attachments: config.attachments,
          track_opens: config.trackOpens,
          is_internal: true,
        },
      }));

    if (messageInserts.length === 0) {
      return { success: false, error: 'No recipients have email addresses' };
    }

    const { data: messages, error } = await supabase
      .from('messages')
      .insert(messageInserts)
      .select();

    if (error) throw error;

    return {
      success: true,
      data: { messages, recipientCount: recipients.length },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send internal email',
    };
  }
}

export async function initiateCall(
  config: VoiceActionConfig,
  context: CommunicationActionContext
): Promise<CommunicationActionResult> {
  try {
    const { data: contact } = await supabase
      .from('contacts')
      .select('phone')
      .eq('id', context.contactId)
      .maybeSingle();

    if (!contact?.phone) {
      return { success: false, error: 'Contact does not have a phone number' };
    }

    const { data: callLog, error } = await supabase
      .from('call_logs')
      .insert({
        org_id: context.orgId,
        contact_id: context.contactId,
        direction: 'outbound',
        status: 'queued',
        to_number: contact.phone,
        call_script: config.callScript,
        record_call: config.recordCall || false,
        metadata: {
          workflow_enrollment_id: context.enrollmentId,
          assigned_number_id: config.assignedNumberId,
          media_url: config.mediaUrl,
          retry_on_busy: config.retryOnBusy,
          max_retries: config.maxRetries,
        },
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data: { callLog },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initiate call',
    };
  }
}

export async function dropVoicemail(
  config: VoicemailDropConfig,
  context: CommunicationActionContext
): Promise<CommunicationActionResult> {
  try {
    const { data: contact } = await supabase
      .from('contacts')
      .select('phone')
      .eq('id', context.contactId)
      .maybeSingle();

    if (!contact?.phone) {
      return { success: false, error: 'Contact does not have a phone number' };
    }

    const { data: callLog, error } = await supabase
      .from('call_logs')
      .insert({
        org_id: context.orgId,
        contact_id: context.contactId,
        direction: 'outbound',
        status: 'queued',
        to_number: contact.phone,
        call_type: 'voicemail_drop',
        metadata: {
          workflow_enrollment_id: context.enrollmentId,
          media_url: config.mediaUrl,
          from_number_id: config.fromNumberId,
        },
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data: { callLog },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to drop voicemail',
    };
  }
}

export async function sendWebchatMessage(
  config: WebchatMessageConfig,
  context: CommunicationActionContext
): Promise<CommunicationActionResult> {
  try {
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('org_id', context.orgId)
      .eq('contact_id', context.contactId)
      .eq('channel', 'webchat')
      .eq('status', 'open')
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!conversation) {
      return { success: false, error: 'No active webchat conversation found' };
    }

    const contactData = await getContactData(context.contactId);
    const mergedMessage = resolveMergeFields(config.message, {
      ...contactData,
      ...context.contextData,
    });

    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        org_id: context.orgId,
        conversation_id: conversation.id,
        contact_id: context.contactId,
        direction: 'outbound',
        channel: 'webchat',
        content: mergedMessage,
        status: 'sent',
        metadata: {
          workflow_enrollment_id: context.enrollmentId,
          sender_name: config.senderName,
          show_typing_indicator: config.showTypingIndicator,
        },
      })
      .select()
      .single();

    if (error) throw error;

    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversation.id);

    return {
      success: true,
      messageId: message.id,
      data: { message },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send webchat message',
    };
  }
}

export async function sendSocialDM(
  config: SocialDMConfig,
  context: CommunicationActionContext,
  platform: 'facebook' | 'instagram'
): Promise<CommunicationActionResult> {
  try {
    const contactData = await getContactData(context.contactId);
    const mergedMessage = resolveMergeFields(config.message, {
      ...contactData,
      ...context.contextData,
    });

    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        org_id: context.orgId,
        conversation_id: null,
        contact_id: context.contactId,
        direction: 'outbound',
        channel: platform,
        content: mergedMessage,
        status: 'queued',
        metadata: {
          workflow_enrollment_id: context.enrollmentId,
          account_id: config.accountId,
          media_urls: config.mediaUrls,
        },
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      messageId: message.id,
      data: { message },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : `Failed to send ${platform} DM`,
    };
  }
}

export async function notifyUser(
  config: NotifyUserConfig,
  context: CommunicationActionContext
): Promise<CommunicationActionResult> {
  try {
    const recipients = await resolveRecipients(
      context.orgId,
      config.recipientType,
      config.recipientIds,
      config.roleNames,
      context.contactId
    );

    if (recipients.length === 0) {
      return { success: false, error: 'No recipients found' };
    }

    const contactData = config.includeContactLink
      ? await getContactData(context.contactId)
      : null;

    const mergedMessage = resolveMergeFields(config.message, {
      ...contactData,
      ...context.contextData,
    });

    const notificationInserts = recipients.map(r => ({
      org_id: context.orgId,
      user_id: r.userId,
      event_type: 'workflow_notification',
      title: config.subject || 'Workflow Notification',
      body: mergedMessage,
      priority: config.priority || 'normal',
      metadata: {
        workflow_enrollment_id: context.enrollmentId,
        contact_id: config.includeContactLink ? context.contactId : null,
        channels: config.channels,
      },
      read: false,
    }));

    const { error } = await supabase.from('inbox_events').insert(notificationInserts);

    if (error) throw error;

    if (config.channels.includes('email')) {
      const emailRecipients = recipients.filter(r => r.email);
      if (emailRecipients.length > 0) {
        const emailInserts = emailRecipients.map(r => ({
          org_id: context.orgId,
          conversation_id: null,
          contact_id: null,
          direction: 'outbound' as const,
          channel: 'email' as const,
          content: mergedMessage,
          status: 'queued' as const,
          metadata: {
            internal_recipient_user_id: r.userId,
            to_email: r.email,
            subject: config.subject || 'Workflow Notification',
            is_internal: true,
            is_notification: true,
          },
        }));

        await supabase.from('messages').insert(emailInserts);
      }
    }

    if (config.channels.includes('sms')) {
      const smsRecipients = recipients.filter(r => r.phone);
      if (smsRecipients.length > 0) {
        const smsInserts = smsRecipients.map(r => ({
          org_id: context.orgId,
          conversation_id: null,
          contact_id: null,
          direction: 'outbound' as const,
          channel: 'sms' as const,
          content: mergedMessage,
          status: 'queued' as const,
          metadata: {
            internal_recipient_user_id: r.userId,
            to_phone: r.phone,
            is_internal: true,
            is_notification: true,
          },
        }));

        await supabase.from('messages').insert(smsInserts);
      }
    }

    return {
      success: true,
      data: { recipientCount: recipients.length, channels: config.channels },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to notify users',
    };
  }
}
