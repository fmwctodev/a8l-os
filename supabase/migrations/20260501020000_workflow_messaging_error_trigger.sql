/*
  # messaging_error workflow trigger

  When a row in the `messages` table flips its `delivery_status` to a failure value,
  emit an event into `event_outbox` so any workflow with a `messaging_error` trigger
  fires. The workflow-processor reads from event_outbox and matches by event_type.

  Failure values handled: 'failed', 'undelivered', 'rejected', 'bounced'.
*/

CREATE OR REPLACE FUNCTION emit_messaging_error_event()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.delivery_status IS NOT NULL
     AND NEW.delivery_status IN ('failed', 'undelivered', 'rejected', 'bounced')
     AND (OLD.delivery_status IS DISTINCT FROM NEW.delivery_status)
  THEN
    INSERT INTO event_outbox (org_id, event_type, contact_id, entity_type, entity_id, payload, processed_at)
    VALUES (
      NEW.organization_id,
      'messaging_error',
      NEW.contact_id,
      'message',
      NEW.id,
      jsonb_build_object(
        'message_id', NEW.id,
        'channel', NEW.channel,
        'direction', NEW.direction,
        'delivery_status', NEW.delivery_status,
        'failed_at', now()
      ),
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS messages_emit_messaging_error ON messages;
CREATE TRIGGER messages_emit_messaging_error
  AFTER INSERT OR UPDATE OF delivery_status ON messages
  FOR EACH ROW
  EXECUTE FUNCTION emit_messaging_error_event();
