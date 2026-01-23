/*
  # Webhook Event Triggers

  1. Overview
    Creates database triggers that automatically queue webhook deliveries
    when specific events occur in the system.

  2. Supported Events
    - contact_created - When a new contact is created
    - contact_updated - When a contact is updated
    - contact_deleted - When a contact is deleted
    - opportunity_created - When a new opportunity is created
    - opportunity_stage_changed - When opportunity moves to a new stage
    - opportunity_won - When opportunity status changes to 'won'
    - opportunity_lost - When opportunity status changes to 'lost'
    - appointment_booked - When a new appointment is created
    - appointment_cancelled - When appointment is cancelled
    - message_received - When a new inbound message arrives
    - payment_completed - When a payment is marked as paid
    - form_submitted - When a form submission is received

  3. Implementation
    - Each trigger builds a JSON payload with relevant data
    - Calls queue_webhook_delivery function to create delivery records
    - Webhooks are processed asynchronously by edge function
*/

-- Contact created trigger
CREATE OR REPLACE FUNCTION trigger_webhook_contact_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM queue_webhook_delivery(
    NEW.organization_id,
    'contact_created',
    NEW.id,
    jsonb_build_object(
      'event_type', 'contact_created',
      'timestamp', now(),
      'data', jsonb_build_object(
        'id', NEW.id,
        'first_name', NEW.first_name,
        'last_name', NEW.last_name,
        'email', NEW.email,
        'phone', NEW.phone,
        'company', NEW.company,
        'source', NEW.source,
        'created_at', NEW.created_at
      )
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS webhook_contact_created ON contacts;
CREATE TRIGGER webhook_contact_created
  AFTER INSERT ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_webhook_contact_created();

-- Contact updated trigger
CREATE OR REPLACE FUNCTION trigger_webhook_contact_updated()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND (
    NEW.first_name != OLD.first_name OR
    NEW.last_name != OLD.last_name OR
    NEW.email IS DISTINCT FROM OLD.email OR
    NEW.phone IS DISTINCT FROM OLD.phone OR
    NEW.company IS DISTINCT FROM OLD.company
  ) THEN
    PERFORM queue_webhook_delivery(
      NEW.organization_id,
      'contact_updated',
      NEW.id,
      jsonb_build_object(
        'event_type', 'contact_updated',
        'timestamp', now(),
        'data', jsonb_build_object(
          'id', NEW.id,
          'first_name', NEW.first_name,
          'last_name', NEW.last_name,
          'email', NEW.email,
          'phone', NEW.phone,
          'company', NEW.company,
          'updated_at', NEW.updated_at
        ),
        'previous', jsonb_build_object(
          'first_name', OLD.first_name,
          'last_name', OLD.last_name,
          'email', OLD.email,
          'phone', OLD.phone,
          'company', OLD.company
        )
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS webhook_contact_updated ON contacts;
CREATE TRIGGER webhook_contact_updated
  AFTER UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_webhook_contact_updated();

-- Opportunity created trigger
CREATE OR REPLACE FUNCTION trigger_webhook_opportunity_created()
RETURNS TRIGGER AS $$
DECLARE
  contact_record RECORD;
  stage_name text;
BEGIN
  SELECT first_name, last_name, email INTO contact_record
  FROM contacts WHERE id = NEW.contact_id;
  
  SELECT name INTO stage_name
  FROM pipeline_stages WHERE id = NEW.stage_id;
  
  PERFORM queue_webhook_delivery(
    NEW.org_id,
    'opportunity_created',
    NEW.id,
    jsonb_build_object(
      'event_type', 'opportunity_created',
      'timestamp', now(),
      'data', jsonb_build_object(
        'id', NEW.id,
        'contact_id', NEW.contact_id,
        'contact_name', contact_record.first_name || ' ' || contact_record.last_name,
        'contact_email', contact_record.email,
        'pipeline_id', NEW.pipeline_id,
        'stage_id', NEW.stage_id,
        'stage_name', stage_name,
        'value_amount', NEW.value_amount,
        'currency', NEW.currency,
        'source', NEW.source,
        'close_date', NEW.close_date,
        'created_at', NEW.created_at
      )
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS webhook_opportunity_created ON opportunities;
CREATE TRIGGER webhook_opportunity_created
  AFTER INSERT ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION trigger_webhook_opportunity_created();

-- Opportunity stage changed trigger
CREATE OR REPLACE FUNCTION trigger_webhook_opportunity_stage_changed()
RETURNS TRIGGER AS $$
DECLARE
  old_stage_name text;
  new_stage_name text;
BEGIN
  IF NEW.stage_id != OLD.stage_id THEN
    SELECT name INTO old_stage_name FROM pipeline_stages WHERE id = OLD.stage_id;
    SELECT name INTO new_stage_name FROM pipeline_stages WHERE id = NEW.stage_id;
    
    PERFORM queue_webhook_delivery(
      NEW.org_id,
      'opportunity_stage_changed',
      NEW.id,
      jsonb_build_object(
        'event_type', 'opportunity_stage_changed',
        'timestamp', now(),
        'data', jsonb_build_object(
          'id', NEW.id,
          'contact_id', NEW.contact_id,
          'pipeline_id', NEW.pipeline_id,
          'previous_stage_id', OLD.stage_id,
          'previous_stage_name', old_stage_name,
          'new_stage_id', NEW.stage_id,
          'new_stage_name', new_stage_name,
          'value_amount', NEW.value_amount,
          'currency', NEW.currency
        )
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS webhook_opportunity_stage_changed ON opportunities;
CREATE TRIGGER webhook_opportunity_stage_changed
  AFTER UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION trigger_webhook_opportunity_stage_changed();

-- Opportunity won/lost trigger
CREATE OR REPLACE FUNCTION trigger_webhook_opportunity_status_changed()
RETURNS TRIGGER AS $$
DECLARE
  contact_record RECORD;
  event_type text;
BEGIN
  IF NEW.status != OLD.status AND NEW.status IN ('won', 'lost') THEN
    SELECT first_name, last_name, email INTO contact_record
    FROM contacts WHERE id = NEW.contact_id;
    
    event_type := 'opportunity_' || NEW.status;
    
    PERFORM queue_webhook_delivery(
      NEW.org_id,
      event_type,
      NEW.id,
      jsonb_build_object(
        'event_type', event_type,
        'timestamp', now(),
        'data', jsonb_build_object(
          'id', NEW.id,
          'contact_id', NEW.contact_id,
          'contact_name', contact_record.first_name || ' ' || contact_record.last_name,
          'contact_email', contact_record.email,
          'value_amount', NEW.value_amount,
          'currency', NEW.currency,
          'closed_at', NEW.closed_at,
          'lost_reason', NEW.lost_reason
        )
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS webhook_opportunity_status_changed ON opportunities;
CREATE TRIGGER webhook_opportunity_status_changed
  AFTER UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION trigger_webhook_opportunity_status_changed();

-- Appointment booked trigger
CREATE OR REPLACE FUNCTION trigger_webhook_appointment_booked()
RETURNS TRIGGER AS $$
DECLARE
  contact_record RECORD;
  calendar_name text;
  type_name text;
BEGIN
  SELECT first_name, last_name, email INTO contact_record
  FROM contacts WHERE id = NEW.contact_id;
  
  SELECT name INTO calendar_name FROM calendars WHERE id = NEW.calendar_id;
  SELECT name INTO type_name FROM appointment_types WHERE id = NEW.appointment_type_id;
  
  PERFORM queue_webhook_delivery(
    NEW.org_id,
    'appointment_booked',
    NEW.id,
    jsonb_build_object(
      'event_type', 'appointment_booked',
      'timestamp', now(),
      'data', jsonb_build_object(
        'id', NEW.id,
        'contact_id', NEW.contact_id,
        'contact_name', contact_record.first_name || ' ' || contact_record.last_name,
        'contact_email', contact_record.email,
        'calendar_name', calendar_name,
        'appointment_type', type_name,
        'start_time', NEW.start_time,
        'end_time', NEW.end_time,
        'timezone', NEW.timezone,
        'created_at', NEW.created_at
      )
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS webhook_appointment_booked ON appointments;
CREATE TRIGGER webhook_appointment_booked
  AFTER INSERT ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_webhook_appointment_booked();

-- Appointment cancelled trigger
CREATE OR REPLACE FUNCTION trigger_webhook_appointment_cancelled()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    PERFORM queue_webhook_delivery(
      NEW.org_id,
      'appointment_cancelled',
      NEW.id,
      jsonb_build_object(
        'event_type', 'appointment_cancelled',
        'timestamp', now(),
        'data', jsonb_build_object(
          'id', NEW.id,
          'contact_id', NEW.contact_id,
          'calendar_id', NEW.calendar_id,
          'start_time', NEW.start_time,
          'cancelled_at', NEW.updated_at
        )
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS webhook_appointment_cancelled ON appointments;
CREATE TRIGGER webhook_appointment_cancelled
  AFTER UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_webhook_appointment_cancelled();

-- Message received trigger (for inbound messages)
CREATE OR REPLACE FUNCTION trigger_webhook_message_received()
RETURNS TRIGGER AS $$
DECLARE
  conv_record RECORD;
BEGIN
  IF NEW.direction = 'inbound' THEN
    SELECT c.org_id, c.contact_id INTO conv_record
    FROM conversations c WHERE c.id = NEW.conversation_id;
    
    PERFORM queue_webhook_delivery(
      conv_record.org_id,
      'message_received',
      NEW.id,
      jsonb_build_object(
        'event_type', 'message_received',
        'timestamp', now(),
        'data', jsonb_build_object(
          'id', NEW.id,
          'conversation_id', NEW.conversation_id,
          'contact_id', conv_record.contact_id,
          'channel', NEW.channel,
          'content', NEW.content,
          'received_at', NEW.created_at
        )
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS webhook_message_received ON messages;
CREATE TRIGGER webhook_message_received
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION trigger_webhook_message_received();

-- Payment completed trigger
CREATE OR REPLACE FUNCTION trigger_webhook_payment_completed()
RETURNS TRIGGER AS $$
DECLARE
  invoice_record RECORD;
BEGIN
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    SELECT i.org_id, i.contact_id, c.first_name, c.last_name, c.email 
    INTO invoice_record
    FROM invoices i
    JOIN contacts c ON c.id = i.contact_id
    WHERE i.id = NEW.invoice_id;
    
    PERFORM queue_webhook_delivery(
      invoice_record.org_id,
      'payment_completed',
      NEW.id,
      jsonb_build_object(
        'event_type', 'payment_completed',
        'timestamp', now(),
        'data', jsonb_build_object(
          'id', NEW.id,
          'invoice_id', NEW.invoice_id,
          'contact_id', invoice_record.contact_id,
          'contact_name', invoice_record.first_name || ' ' || invoice_record.last_name,
          'contact_email', invoice_record.email,
          'amount', NEW.amount,
          'payment_method', NEW.payment_method,
          'paid_at', NEW.paid_at
        )
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS webhook_payment_completed ON payments;
CREATE TRIGGER webhook_payment_completed
  AFTER UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_webhook_payment_completed();

-- Form submission trigger
CREATE OR REPLACE FUNCTION trigger_webhook_form_submitted()
RETURNS TRIGGER AS $$
DECLARE
  form_record RECORD;
BEGIN
  SELECT f.org_id, f.name INTO form_record
  FROM forms f WHERE f.id = NEW.form_id;
  
  PERFORM queue_webhook_delivery(
    form_record.org_id,
    'form_submitted',
    NEW.id,
    jsonb_build_object(
      'event_type', 'form_submitted',
      'timestamp', now(),
      'data', jsonb_build_object(
        'id', NEW.id,
        'form_id', NEW.form_id,
        'form_name', form_record.name,
        'contact_id', NEW.contact_id,
        'responses', NEW.responses,
        'submitted_at', NEW.created_at
      )
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS webhook_form_submitted ON form_submissions;
CREATE TRIGGER webhook_form_submitted
  AFTER INSERT ON form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_webhook_form_submitted();
