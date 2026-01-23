/*
  # Fix Appointment Webhook Trigger Column Names

  1. Problem
    - The trigger_webhook_appointment_booked function references incorrect column names
    - Uses start_time, end_time, timezone instead of start_at_utc, end_at_utc, visitor_timezone
    - This causes 400 Bad Request errors when creating appointments

  2. Changes
    - Updates the trigger_webhook_appointment_booked function to use correct column names:
      - start_time -> start_at_utc
      - end_time -> end_at_utc
      - timezone -> visitor_timezone

  3. Impact
    - Fixes appointment creation functionality
    - Webhook payloads will now include correct timestamp data
*/

CREATE OR REPLACE FUNCTION trigger_webhook_appointment_booked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
        'start_time', NEW.start_at_utc,
        'end_time', NEW.end_at_utc,
        'timezone', NEW.visitor_timezone,
        'created_at', NEW.created_at
      )
    )
  );
  RETURN NEW;
END;
$$;
