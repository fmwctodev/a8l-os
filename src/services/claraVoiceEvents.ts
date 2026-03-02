import { supabase } from '../lib/supabase';
import type { ClaraVoiceEventType } from '../types/assistant';

export function logVoiceEvent(
  userId: string,
  orgId: string,
  eventType: ClaraVoiceEventType,
  messageId?: string | null,
  metadata?: Record<string, unknown> | null
): void {
  supabase
    .from('clara_voice_events')
    .insert({
      user_id: userId,
      org_id: orgId,
      event_type: eventType,
      message_id: messageId || null,
      metadata: metadata || null,
    })
    .then(({ error }) => {
      if (error) {
        console.error('[claraVoiceEvents] Failed to log event:', error.message);
      }
    });
}
