/*
  # Lead Scoring Module - Sample Data

  1. Sample Data
    - Default "Lead Score" model for contacts with decay config
    - Sample scoring rules for common triggers
    - Default adjustment limits
    - Sample entity scores for existing contacts
    - Sample score events for audit history

  2. Notes
    - Uses first organization found for sample data
    - Creates varied sample scores to demonstrate functionality
*/

DO $$
DECLARE
  v_org_id uuid;
  v_model_id uuid;
  v_rule_id uuid;
  v_contact RECORD;
  v_score integer;
  v_counter integer := 0;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  
  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found, skipping scoring seed data';
    RETURN;
  END IF;

  INSERT INTO scoring_models (org_id, name, scope, starting_score, max_score, is_primary, active)
  VALUES (v_org_id, 'Lead Score', 'contact', 0, 100, true, true)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_model_id;

  IF v_model_id IS NULL THEN
    SELECT id INTO v_model_id FROM scoring_models 
    WHERE org_id = v_org_id AND name = 'Lead Score' LIMIT 1;
  END IF;

  IF v_model_id IS NOT NULL THEN
    INSERT INTO scoring_model_decay_config (
      model_id, enabled, decay_type, decay_amount, interval_days, 
      min_score_floor, notification_threshold, notify_in_app, notify_email, notify_sms
    ) VALUES (
      v_model_id, true, 'linear', 5, 30, 0, 20, true, true, false
    ) ON CONFLICT (model_id) DO NOTHING;

    INSERT INTO scoring_rules (model_id, name, trigger_type, trigger_config, points, frequency_type, cooldown_interval, cooldown_unit, active)
    VALUES 
      (v_model_id, 'Form Submission', 'form_submitted', '{}', 10, 'interval', 1, 'days', true),
      (v_model_id, 'Appointment Booked', 'appointment_booked', '{}', 15, 'unlimited', NULL, NULL, true),
      (v_model_id, 'Appointment Completed', 'appointment_completed', '{}', 20, 'unlimited', NULL, NULL, true),
      (v_model_id, 'Appointment No-Show', 'appointment_noshow', '{}', -20, 'unlimited', NULL, NULL, true),
      (v_model_id, 'Payment Completed', 'payment_completed', '{}', 25, 'unlimited', NULL, NULL, true),
      (v_model_id, 'Contact Created', 'contact_created', '{}', 5, 'once', NULL, NULL, true)
    ON CONFLICT DO NOTHING;

    INSERT INTO scoring_adjustment_limits (org_id, max_positive_adjustment, max_negative_adjustment, require_reason)
    VALUES (v_org_id, 100, 100, true)
    ON CONFLICT (org_id) DO NOTHING;

    FOR v_contact IN 
      SELECT id FROM contacts WHERE organization_id = v_org_id LIMIT 10
    LOOP
      v_counter := v_counter + 1;
      v_score := (v_counter * 7 + 15) % 100;
      
      INSERT INTO entity_scores (org_id, model_id, entity_type, entity_id, current_score, last_updated_at)
      VALUES (v_org_id, v_model_id, 'contact', v_contact.id, v_score, now() - (v_counter || ' days')::interval)
      ON CONFLICT (model_id, entity_type, entity_id) DO NOTHING;

      SELECT id INTO v_rule_id FROM scoring_rules WHERE model_id = v_model_id AND name = 'Contact Created' LIMIT 1;
      
      IF v_rule_id IS NOT NULL THEN
        INSERT INTO score_events (org_id, model_id, entity_type, entity_id, rule_id, points_delta, previous_score, new_score, reason, source)
        VALUES (v_org_id, v_model_id, 'contact', v_contact.id, v_rule_id, 5, 0, 5, 'Contact Created', 'rule')
        ON CONFLICT DO NOTHING;
      END IF;

      IF v_counter % 3 = 0 THEN
        INSERT INTO score_events (org_id, model_id, entity_type, entity_id, rule_id, points_delta, previous_score, new_score, reason, source)
        VALUES (v_org_id, v_model_id, 'contact', v_contact.id, NULL, v_score - 5, 5, v_score, 'Manual adjustment for engagement', 'manual')
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;
END $$;
