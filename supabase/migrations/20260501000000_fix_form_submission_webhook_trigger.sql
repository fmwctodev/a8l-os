/*
  # Fix trigger_webhook_form_submitted column references

  The trigger was written against an older form_submissions schema:
  - referenced f.org_id   (real column: organization_id)
  - referenced NEW.responses  (real column: payload)
  - referenced NEW.created_at (real column: submitted_at)

  This caused every form submission to fail with a 500 because the trigger
  raised "column f.org_id does not exist" before the row was committed.
*/

CREATE OR REPLACE FUNCTION public.trigger_webhook_form_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  form_record RECORD;
BEGIN
  SELECT f.organization_id, f.name INTO form_record
  FROM forms f WHERE f.id = NEW.form_id;

  PERFORM queue_webhook_delivery(
    form_record.organization_id,
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
        'payload', NEW.payload,
        'submitted_at', NEW.submitted_at
      )
    )
  );
  RETURN NEW;
END;
$function$;
