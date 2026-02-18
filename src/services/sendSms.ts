import { callEdgeFunction } from '../lib/edgeFunction';
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

export async function sendSms(messageId: string): Promise<{ sid: string; status: string }> {
  const response = await callEdgeFunction('send-sms', { messageId });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Failed to send SMS');
  return result;
}

export async function retrySms(messageId: string): Promise<{ sid: string; status: string }> {
  const { error } = await supabase
    .from('messages')
    .update({ status: 'pending', metadata: {} })
    .eq('id', messageId);

  if (error) throw error;
  return sendSms(messageId);
}
