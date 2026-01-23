/*
  # Fix Webhook Triggers to Use org_id

  ## Problem
  Webhook triggers on contacts table were referencing NEW.organization_id,
  but the contacts table uses org_id as the column name.

  ## Fix
  Update the contact webhook trigger functions to use NEW.org_id instead.
*/

-- Fix contact created trigger
CREATE OR REPLACE FUNCTION trigger_webhook_contact_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM queue_webhook_delivery(
    NEW.org_id,
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

-- Fix contact updated trigger
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
      NEW.org_id,
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
