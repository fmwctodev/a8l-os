/*
  # Lead Scoring Module - Triggers and Functions

  1. Functions
    - `fn_process_scoring_event` - Main function to process scoring events
    - `fn_check_rule_cooldown` - Check if a rule can execute for an entity
    - `fn_apply_score_change` - Apply score change and log event
    - `fn_check_score_threshold` - Check if score dropped below notification threshold

  2. Triggers
    - Triggers on contacts, opportunities, appointments, form_submissions to fire scoring events

  3. Notes
    - Real-time scoring via database triggers
    - Cooldown enforcement for frequency-limited rules
    - Max score capping
    - Audit logging for all changes
*/

-- Function to check if a rule can execute based on cooldown
CREATE OR REPLACE FUNCTION fn_check_rule_cooldown(
  p_rule_id uuid,
  p_entity_id uuid,
  p_frequency_type text,
  p_cooldown_interval integer,
  p_cooldown_unit text
) RETURNS boolean AS $$
DECLARE
  v_last_execution timestamptz;
  v_cooldown_seconds integer;
BEGIN
  IF p_frequency_type = 'unlimited' THEN
    RETURN true;
  END IF;

  IF p_frequency_type = 'once' THEN
    SELECT executed_at INTO v_last_execution
    FROM scoring_rule_executions
    WHERE rule_id = p_rule_id AND entity_id = p_entity_id
    LIMIT 1;
    
    RETURN v_last_execution IS NULL;
  END IF;

  IF p_frequency_type = 'interval' THEN
    v_cooldown_seconds := CASE p_cooldown_unit
      WHEN 'minutes' THEN p_cooldown_interval * 60
      WHEN 'hours' THEN p_cooldown_interval * 3600
      WHEN 'days' THEN p_cooldown_interval * 86400
      ELSE 0
    END;

    SELECT executed_at INTO v_last_execution
    FROM scoring_rule_executions
    WHERE rule_id = p_rule_id AND entity_id = p_entity_id
    ORDER BY executed_at DESC
    LIMIT 1;

    IF v_last_execution IS NULL THEN
      RETURN true;
    END IF;

    RETURN (EXTRACT(EPOCH FROM (now() - v_last_execution)) >= v_cooldown_seconds);
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Function to apply score change and log event
CREATE OR REPLACE FUNCTION fn_apply_score_change(
  p_org_id uuid,
  p_model_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_points_delta integer,
  p_reason text,
  p_source text,
  p_rule_id uuid DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
) RETURNS integer AS $$
DECLARE
  v_current_score integer;
  v_new_score integer;
  v_max_score integer;
  v_starting_score integer;
  v_score_record entity_scores%ROWTYPE;
BEGIN
  SELECT max_score, starting_score INTO v_max_score, v_starting_score
  FROM scoring_models
  WHERE id = p_model_id;

  SELECT * INTO v_score_record
  FROM entity_scores
  WHERE model_id = p_model_id AND entity_type = p_entity_type AND entity_id = p_entity_id
  FOR UPDATE;

  IF v_score_record.id IS NULL THEN
    v_current_score := COALESCE(v_starting_score, 0);
    v_new_score := v_current_score + p_points_delta;
    
    IF v_max_score IS NOT NULL AND v_new_score > v_max_score THEN
      v_new_score := v_max_score;
    END IF;
    IF v_new_score < 0 THEN
      v_new_score := 0;
    END IF;

    INSERT INTO entity_scores (org_id, model_id, entity_type, entity_id, current_score, last_updated_at)
    VALUES (p_org_id, p_model_id, p_entity_type, p_entity_id, v_new_score, now());
  ELSE
    v_current_score := v_score_record.current_score;
    v_new_score := v_current_score + p_points_delta;
    
    IF v_max_score IS NOT NULL AND v_new_score > v_max_score THEN
      v_new_score := v_max_score;
    END IF;
    IF v_new_score < 0 THEN
      v_new_score := 0;
    END IF;

    UPDATE entity_scores
    SET current_score = v_new_score, last_updated_at = now()
    WHERE id = v_score_record.id;
  END IF;

  INSERT INTO score_events (org_id, model_id, entity_type, entity_id, rule_id, points_delta, previous_score, new_score, reason, source, created_by)
  VALUES (p_org_id, p_model_id, p_entity_type, p_entity_id, p_rule_id, p_points_delta, v_current_score, v_new_score, p_reason, p_source, p_created_by);

  RETURN v_new_score;
END;
$$ LANGUAGE plpgsql;

-- Function to process scoring events from triggers
CREATE OR REPLACE FUNCTION fn_process_scoring_event(
  p_org_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_trigger_type text,
  p_trigger_data jsonb DEFAULT '{}'
) RETURNS void AS $$
DECLARE
  v_rule RECORD;
  v_can_execute boolean;
BEGIN
  FOR v_rule IN
    SELECT sr.*, sm.org_id as model_org_id
    FROM scoring_rules sr
    JOIN scoring_models sm ON sr.model_id = sm.id
    WHERE sm.org_id = p_org_id
      AND sm.scope = p_entity_type
      AND sm.active = true
      AND sr.active = true
      AND sr.trigger_type = p_trigger_type
  LOOP
    v_can_execute := fn_check_rule_cooldown(
      v_rule.id,
      p_entity_id,
      v_rule.frequency_type,
      v_rule.cooldown_interval,
      v_rule.cooldown_unit
    );

    IF v_can_execute THEN
      PERFORM fn_apply_score_change(
        p_org_id,
        v_rule.model_id,
        p_entity_type,
        p_entity_id,
        v_rule.points,
        v_rule.name,
        'rule',
        v_rule.id
      );

      INSERT INTO scoring_rule_executions (rule_id, entity_id, executed_at)
      VALUES (v_rule.id, p_entity_id, now());
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to insert notification request when score drops below threshold
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

    INSERT INTO event_outbox (org_id, event_type, payload)
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

-- Trigger for score threshold notifications
DROP TRIGGER IF EXISTS trigger_score_threshold_notification ON entity_scores;
CREATE TRIGGER trigger_score_threshold_notification
  AFTER UPDATE ON entity_scores
  FOR EACH ROW
  EXECUTE FUNCTION fn_check_score_threshold();

-- Trigger function for contact updates
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

DROP TRIGGER IF EXISTS trigger_scoring_contact_changes ON contacts;
CREATE TRIGGER trigger_scoring_contact_changes
  AFTER INSERT OR UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION fn_trigger_scoring_contact_update();

-- Trigger function for appointment changes
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

DROP TRIGGER IF EXISTS trigger_scoring_appointment_changes ON appointments;
CREATE TRIGGER trigger_scoring_appointment_changes
  AFTER INSERT OR UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION fn_trigger_scoring_appointment();

-- Trigger function for form submissions
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

DROP TRIGGER IF EXISTS trigger_scoring_form_submission ON form_submissions;
CREATE TRIGGER trigger_scoring_form_submission
  AFTER INSERT ON form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION fn_trigger_scoring_form_submission();

-- Trigger function for opportunity stage changes
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

DROP TRIGGER IF EXISTS trigger_scoring_opportunity_changes ON opportunities;
CREATE TRIGGER trigger_scoring_opportunity_changes
  AFTER INSERT OR UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION fn_trigger_scoring_opportunity();

-- Trigger function for payments
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

DROP TRIGGER IF EXISTS trigger_scoring_payment ON payments;
CREATE TRIGGER trigger_scoring_payment
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION fn_trigger_scoring_payment();
