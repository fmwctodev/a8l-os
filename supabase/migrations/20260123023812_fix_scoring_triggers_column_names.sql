/*
  # Fix Scoring Triggers - Column Name Corrections

  1. Updates
    - Fix trigger functions to use correct column names
    - contacts table uses `organization_id` instead of `org_id`
    - opportunities table uses `organization_id` instead of `org_id`

  2. Notes
    - Recreates trigger functions with correct schema references
*/

-- Fix contact update trigger
CREATE OR REPLACE FUNCTION fn_trigger_scoring_contact_update()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Fix appointment trigger
CREATE OR REPLACE FUNCTION fn_trigger_scoring_appointment()
RETURNS TRIGGER AS $$
DECLARE
  v_contact_org_id uuid;
BEGIN
  SELECT organization_id INTO v_contact_org_id FROM contacts WHERE id = NEW.contact_id;
  
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
  SELECT organization_id INTO v_form_org_id FROM forms WHERE id = NEW.form_id;
  
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
      NEW.organization_id,
      'opportunity',
      NEW.id,
      'opportunity_created',
      to_jsonb(NEW)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
      PERFORM fn_process_scoring_event(
        NEW.organization_id,
        'opportunity',
        NEW.id,
        'opportunity_stage_changed',
        jsonb_build_object('old_stage_id', OLD.stage_id, 'new_stage_id', NEW.stage_id)
      );
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'won' THEN
        PERFORM fn_process_scoring_event(
          NEW.organization_id,
          'opportunity',
          NEW.id,
          'opportunity_won',
          to_jsonb(NEW)
        );
      ELSIF NEW.status = 'lost' THEN
        PERFORM fn_process_scoring_event(
          NEW.organization_id,
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

  SELECT organization_id INTO v_contact_org_id FROM contacts WHERE id = NEW.contact_id;
  
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

-- Fix score threshold check to use correct entity name lookups
CREATE OR REPLACE FUNCTION fn_check_score_threshold()
RETURNS TRIGGER AS $$
DECLARE
  v_decay_config scoring_model_decay_config%ROWTYPE;
  v_model_name text;
  v_entity_name text;
BEGIN
  IF NEW.current_score >= OLD.current_score THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_decay_config
  FROM scoring_model_decay_config
  WHERE model_id = NEW.model_id;

  IF v_decay_config.id IS NULL OR v_decay_config.notification_threshold IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.current_score >= v_decay_config.notification_threshold 
     AND NEW.current_score < v_decay_config.notification_threshold THEN
    
    SELECT name INTO v_model_name FROM scoring_models WHERE id = NEW.model_id;
    
    IF NEW.entity_type = 'contact' THEN
      SELECT COALESCE(first_name || ' ' || last_name, email, phone) INTO v_entity_name
      FROM contacts WHERE id = NEW.entity_id;
    ELSIF NEW.entity_type = 'opportunity' THEN
      SELECT name INTO v_entity_name FROM opportunities WHERE id = NEW.entity_id;
    END IF;

    INSERT INTO event_outbox (organization_id, event_type, payload)
    VALUES (
      NEW.org_id,
      'score_threshold_crossed',
      jsonb_build_object(
        'entity_type', NEW.entity_type,
        'entity_id', NEW.entity_id,
        'entity_name', v_entity_name,
        'model_id', NEW.model_id,
        'model_name', v_model_name,
        'previous_score', OLD.current_score,
        'new_score', NEW.current_score,
        'threshold', v_decay_config.notification_threshold,
        'notify_in_app', v_decay_config.notify_in_app,
        'notify_email', v_decay_config.notify_email,
        'notify_sms', v_decay_config.notify_sms
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
