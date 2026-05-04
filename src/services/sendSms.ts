import { supabase } from '../lib/supabase';

export const MMS_MAX_FILES = 10;
export const MMS_MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function uploadMessageMedia(file: File, orgId: string): Promise<string> {
  const ext = file.name.split('.').pop() || 'bin';
  const path = `${orgId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from('message-media')
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) throw new Error(`Media upload failed: ${error.message}`);

  const { data } = supabase.storage.from('message-media').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Send a previously-inserted outbound SMS row via Plivo. Looks up the row,
 * resolves to/from/body/media from it, then invokes plivo-sms-send with
 * existingMessageId so that function updates this row in place rather than
 * inserting a duplicate.
 */
export async function sendSms(messageId: string): Promise<{ sid: string; status: string }> {
  const { data: msg, error: fetchErr } = await supabase
    .from('messages')
    .select('id, organization_id, body, media_urls, metadata, contact_id, conversation_id')
    .eq('id', messageId)
    .single();

  if (fetchErr || !msg) throw new Error(fetchErr?.message || 'Message not found');

  const meta = (msg.metadata || {}) as Record<string, unknown>;
  const toNumber = (meta.to_number as string) || '';
  const fromNumber = meta.from_number as string | undefined;

  if (!toNumber) throw new Error('Message has no to_number in metadata');

  const { data, error } = await supabase.functions.invoke('plivo-sms-send', {
    body: {
      orgId: msg.organization_id,
      toNumber,
      fromNumber,
      body: msg.body,
      mediaUrls: (msg.media_urls as string[]) || [],
      contactId: msg.contact_id,
      conversationId: msg.conversation_id,
      existingMessageId: msg.id,
      metadata: { source: 'composer' },
    },
  });

  if (error) throw new Error(error.message || 'Failed to send SMS');
  if (!data?.success) throw new Error(data?.error || 'Failed to send SMS');

  return { sid: data.plivoMessageUuid || '', status: 'sent' };
}

export async function retrySms(messageId: string): Promise<{ sid: string; status: string }> {
  const { error } = await supabase
    .from('messages')
    .update({ status: 'pending', metadata: {} })
    .eq('id', messageId);

  if (error) throw error;
  return sendSms(messageId);
}
