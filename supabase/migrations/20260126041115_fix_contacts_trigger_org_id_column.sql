/*
  # Fix Contact Triggers - org_id to organization_id

  ## Overview
  The contacts table uses `organization_id` but several trigger functions were
  incorrectly referencing `org_id`, causing errors when creating or updating contacts.

  ## Functions Fixed
  1. `fn_trigger_scoring_contact_update` - Scoring trigger for contact changes
  2. `trigger_webhook_contact_created` - Webhook trigger for new contacts
  3. `trigger_webhook_contact_updated` - Webhook trigger for contact updates

  ## Change
  - Replace `NEW.org_id` with `NEW.organization_id` in all three functions
*/

CREATE OR REPLACE FUNCTION fn_trigger_scoring_contact_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM fn_process_scoring_event(
      NEW.organization_id,
      'contact',
      NEW.id,
      'contact_created',
      to_jsonb(NEW)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM fn_process_scoring_event(
        NEW.organization_id,
        'contact',
        NEW.id,
        'contact_status_changed',
        jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_webhook_contact_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

CREATE OR REPLACE FUNCTION trigger_webhook_contact_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;
