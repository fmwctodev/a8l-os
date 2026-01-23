/*
  # Fix Scoring Triggers to Use org_id

  ## Problem
  Scoring triggers were referencing organization_id column, but contacts and 
  opportunities tables use org_id as the column name. The same applies to
  forms and other tables.

  ## Fix
  Update all scoring trigger functions to use correct column names:
  - contacts.org_id (not organization_id)
  - opportunities.org_id (not organization_id)
  - forms.org_id (not organization_id)
*/

-- Fix contact update trigger
CREATE OR REPLACE FUNCTION fn_trigger_scoring_contact_update()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM fn_process_scoring_event(
      NEW.org_id,
      'contact',
      NEW.id,
      'contact_created',
      to_jsonb(NEW)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM fn_process_scoring_event(
        NEW.org_id,
        'contact',
        NEW.id,
        'contact_status_changed',
        jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix appointment trigger
CREATE OR REPLACE FUNCTION fn_trigger_scoring_appointment()
RETURNS TRIGGER AS $$
DECLARE
  v_contact_org_id uuid;
BEGIN
  SELECT org_id INTO v_contact_org_id FROM contacts WHERE id = NEW.contact_id;
  
  IF v_contact_org_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM fn_process_scoring_event(
      v_contact_org_id,
      'contact',
      NEW.contact_id,
      'appointment_booked',
      to_jsonb(NEW)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'completed' THEN
        PERFORM fn_process_scoring_event(
          v_contact_org_id,
          'contact',
          NEW.contact_id,
          'appointment_completed',
          to_jsonb(NEW)
        );
      ELSIF NEW.status = 'no_show' THEN
        PERFORM fn_process_scoring_event(
          v_contact_org_id,
          'contact',
          NEW.contact_id,
          'appointment_noshow',
          to_jsonb(NEW)
        );
      ELSIF NEW.status = 'cancelled' THEN
        PERFORM fn_process_scoring_event(
          v_contact_org_id,
          'contact',
          NEW.contact_id,
          'appointment_cancelled',
          to_jsonb(NEW)
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix form submission trigger
CREATE OR REPLACE FUNCTION fn_trigger_scoring_form_submission()
RETURNS TRIGGER AS $$
DECLARE
  v_form_org_id uuid;
BEGIN
  SELECT org_id INTO v_form_org_id FROM forms WHERE id = NEW.form_id;
  
  IF v_form_org_id IS NULL OR NEW.contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM fn_process_scoring_event(
    v_form_org_id,
    'contact',
    NEW.contact_id,
    'form_submitted',
    jsonb_build_object('form_id', NEW.form_id, 'submission_id', NEW.id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix opportunity trigger  
CREATE OR REPLACE FUNCTION fn_trigger_scoring_opportunity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM fn_process_scoring_event(
      NEW.org_id,
      'opportunity',
      NEW.id,
      'opportunity_created',
      to_jsonb(NEW)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
      PERFORM fn_process_scoring_event(
        NEW.org_id,
        'opportunity',
        NEW.id,
        'opportunity_stage_changed',
        jsonb_build_object('old_stage_id', OLD.stage_id, 'new_stage_id', NEW.stage_id)
      );
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'won' THEN
        PERFORM fn_process_scoring_event(
          NEW.org_id,
          'opportunity',
          NEW.id,
          'opportunity_won',
          to_jsonb(NEW)
        );
      ELSIF NEW.status = 'lost' THEN
        PERFORM fn_process_scoring_event(
          NEW.org_id,
          'opportunity',
          NEW.id,
          'opportunity_lost',
          to_jsonb(NEW)
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix payment trigger
CREATE OR REPLACE FUNCTION fn_trigger_scoring_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_contact_org_id uuid;
BEGIN
  IF NEW.contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT org_id INTO v_contact_org_id FROM contacts WHERE id = NEW.contact_id;
  
  IF v_contact_org_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'completed') THEN
    PERFORM fn_process_scoring_event(
      v_contact_org_id,
      'contact',
      NEW.contact_id,
      'payment_completed',
      jsonb_build_object('payment_id', NEW.id, 'amount', NEW.amount)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
