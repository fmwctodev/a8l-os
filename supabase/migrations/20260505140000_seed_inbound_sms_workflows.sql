/*
  # Seed Inbound SMS workflows (DRAFT) — Phase B

  Creates 5 workflow records that drive proactive SMS via Plivo when contacts
  interact with the marketing-site funnel. All workflows are seeded in DRAFT
  status with their workflow_triggers set to is_active=false, so nothing fires
  until the user explicitly publishes them after the TCR/Plivo campaign clears
  in Phase C.

  Workflows:
    1. Welcome SMS — fires on get-in-touch form submission, doubles as
       TCPA-mandated opt-in confirmation
    2. Appointment confirmation
    3. Appointment 24h reminder
    4. Opportunity stage update SMS
    5. STOP / HELP / START auto-reply (carrier-required compliance handler)

  TCPA gating model:
    The form-submit Edge Function refuses to write contacts.phone unless
    sms_consent === true (server-side gate added alongside this migration).
    Workflows therefore use `contact.phone is_not_empty` as the consent
    proxy — if the phone is on the contact, consent was given.

  Idempotent: SELECT-first guards prevent duplicate workflows on re-run.
  Use a temporary helper function inside the same transaction.
*/

CREATE OR REPLACE FUNCTION pg_temp.upsert_sms_workflow(
  p_org_id uuid,
  p_user_id uuid,
  p_name text,
  p_desc text,
  p_def jsonb,
  p_trigger_type text,
  p_trigger_config jsonb
) RETURNS void AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM workflows WHERE org_id = p_org_id AND name = p_name;
  IF v_id IS NULL THEN
    INSERT INTO workflows (org_id, name, description, status, draft_definition, created_by_user_id)
    VALUES (p_org_id, p_name, p_desc, 'draft', p_def, p_user_id)
    RETURNING id INTO v_id;
  ELSE
    UPDATE workflows
      SET draft_definition = p_def, description = p_desc, updated_at = now()
      WHERE id = v_id;
  END IF;

  -- Idempotent trigger upsert: replace any existing triggers for this workflow
  DELETE FROM workflow_triggers WHERE workflow_id = v_id;
  INSERT INTO workflow_triggers (org_id, workflow_id, trigger_type, trigger_config, is_active)
  VALUES (p_org_id, v_id, p_trigger_type::workflow_trigger_type, p_trigger_config, false);
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  v_org_id uuid;
  v_user_id uuid;
  v_form_id uuid;
  v_def jsonb;
BEGIN
  SELECT id INTO v_org_id FROM organizations ORDER BY created_at LIMIT 1;
  IF v_org_id IS NULL THEN RAISE NOTICE 'No org, skip'; RETURN; END IF;

  SELECT id INTO v_user_id FROM users WHERE organization_id = v_org_id AND status = 'active' ORDER BY created_at LIMIT 1;
  SELECT id INTO v_form_id FROM forms WHERE organization_id = v_org_id AND public_slug = 'get-in-touch';
  IF v_form_id IS NULL THEN RAISE EXCEPTION 'get-in-touch form missing — apply prior migrations first'; END IF;

  ---------------------------------------------------------------------
  -- Workflow 1: Inbound — Welcome SMS / Opt-in Confirmation
  ---------------------------------------------------------------------
  v_def := jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object('id', 'trigger_1', 'type', 'trigger', 'label', 'Form Submitted',
        'position', jsonb_build_object('x', 200, 'y', 40),
        'data', jsonb_build_object('triggerType', 'form_submitted', 'triggerCategory', 'event')),
      jsonb_build_object('id', 'cond_phone', 'type', 'condition', 'label', 'Has phone (TCPA-gated)',
        'position', jsonb_build_object('x', 200, 'y', 160),
        'data', jsonb_build_object('conditions', jsonb_build_object('logic', 'and',
          'rules', jsonb_build_array(jsonb_build_object('field', 'contact.phone', 'operator', 'is_not_empty', 'value', ''))))),
      jsonb_build_object('id', 'action_welcome', 'type', 'action', 'label', 'Send welcome + opt-in confirmation SMS',
        'position', jsonb_build_object('x', 200, 'y', 300),
        'data', jsonb_build_object('actionType', 'send_sms', 'config', jsonb_build_object(
          'body', 'Autom8ion Lab: Thanks {{contact.first_name}}! Got your inquiry — Sean will reply within 1 business day. Msg & data rates may apply. Reply HELP for help, STOP to opt out.')))
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('id', 'e_t_c', 'source', 'trigger_1', 'target', 'cond_phone'),
      jsonb_build_object('id', 'e_c_a', 'source', 'cond_phone', 'sourceHandle', 'true', 'target', 'action_welcome')),
    'viewport', jsonb_build_object('x', 0, 'y', 0, 'zoom', 1)
  );
  PERFORM pg_temp.upsert_sms_workflow(
    v_org_id, v_user_id,
    'Inbound — Welcome SMS / Opt-in Confirmation',
    'Fires on get-in-touch form submission. TCPA-gated via contact.phone (which the form-submit Edge Function only sets when sms_consent=true). Welcome message doubles as the carrier-required opt-in confirmation.',
    v_def, 'form_submitted',
    jsonb_build_object('logic', 'and', 'rules', jsonb_build_array(
      jsonb_build_object('field', 'form_id', 'operator', 'equals', 'value', v_form_id::text)))
  );

  ---------------------------------------------------------------------
  -- Workflow 2: Appointment Confirmation
  ---------------------------------------------------------------------
  v_def := jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object('id', 'trigger_1', 'type', 'trigger', 'label', 'Appointment Booked',
        'position', jsonb_build_object('x', 200, 'y', 40),
        'data', jsonb_build_object('triggerType', 'appointment_booked', 'triggerCategory', 'event')),
      jsonb_build_object('id', 'cond_phone', 'type', 'condition', 'label', 'Has phone',
        'position', jsonb_build_object('x', 200, 'y', 160),
        'data', jsonb_build_object('conditions', jsonb_build_object('logic', 'and',
          'rules', jsonb_build_array(jsonb_build_object('field', 'contact.phone', 'operator', 'is_not_empty', 'value', ''))))),
      jsonb_build_object('id', 'action_confirm', 'type', 'action', 'label', 'Send confirmation SMS',
        'position', jsonb_build_object('x', 200, 'y', 300),
        'data', jsonb_build_object('actionType', 'send_sms', 'config', jsonb_build_object(
          'body', 'Autom8ion Lab: Confirming your call with Sean on {{appointment.date}} at {{appointment.time}} ET. Reply C to confirm, R to reschedule, STOP to opt out.')))
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('id', 'e_t_c', 'source', 'trigger_1', 'target', 'cond_phone'),
      jsonb_build_object('id', 'e_c_a', 'source', 'cond_phone', 'sourceHandle', 'true', 'target', 'action_confirm')),
    'viewport', jsonb_build_object('x', 0, 'y', 0, 'zoom', 1)
  );
  PERFORM pg_temp.upsert_sms_workflow(
    v_org_id, v_user_id,
    'Inbound — Appointment Confirmation',
    'Fires when an appointment is booked. Sends a confirmation SMS to the contact (gated on contact.phone existing).',
    v_def, 'appointment_booked', '{}'::jsonb
  );

  ---------------------------------------------------------------------
  -- Workflow 3: Appointment 24h Reminder
  ---------------------------------------------------------------------
  v_def := jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object('id', 'trigger_1', 'type', 'trigger', 'label', 'Appointment Booked',
        'position', jsonb_build_object('x', 200, 'y', 40),
        'data', jsonb_build_object('triggerType', 'appointment_booked', 'triggerCategory', 'event')),
      jsonb_build_object('id', 'delay_24h', 'type', 'delay', 'label', 'Wait until 24h before appointment',
        'position', jsonb_build_object('x', 200, 'y', 160),
        'data', jsonb_build_object('delayType', 'wait_until_datetime', 'datetime', '{{appointment.start_at_minus_24h}}')),
      jsonb_build_object('id', 'cond_phone', 'type', 'condition', 'label', 'Has phone',
        'position', jsonb_build_object('x', 200, 'y', 280),
        'data', jsonb_build_object('conditions', jsonb_build_object('logic', 'and',
          'rules', jsonb_build_array(jsonb_build_object('field', 'contact.phone', 'operator', 'is_not_empty', 'value', ''))))),
      jsonb_build_object('id', 'action_remind', 'type', 'action', 'label', 'Send reminder SMS',
        'position', jsonb_build_object('x', 200, 'y', 420),
        'data', jsonb_build_object('actionType', 'send_sms', 'config', jsonb_build_object(
          'body', 'Autom8ion Lab: Reminder — your call with Sean is tomorrow at {{appointment.time}} ET. Reply STOP to opt out, HELP for help.')))
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('id', 'e_t_d', 'source', 'trigger_1', 'target', 'delay_24h'),
      jsonb_build_object('id', 'e_d_c', 'source', 'delay_24h', 'target', 'cond_phone'),
      jsonb_build_object('id', 'e_c_a', 'source', 'cond_phone', 'sourceHandle', 'true', 'target', 'action_remind')),
    'viewport', jsonb_build_object('x', 0, 'y', 0, 'zoom', 1)
  );
  PERFORM pg_temp.upsert_sms_workflow(
    v_org_id, v_user_id,
    'Inbound — Appointment 24h Reminder',
    'Fires when an appointment is booked, then waits until 24h before the appointment to send a reminder SMS. NOTE: the wait_until_datetime delay needs the appointment.start_at_minus_24h merge field — wire that up via the booking flow when ready.',
    v_def, 'appointment_booked', '{}'::jsonb
  );

  ---------------------------------------------------------------------
  -- Workflow 4: Opportunity Stage Update SMS
  ---------------------------------------------------------------------
  v_def := jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object('id', 'trigger_1', 'type', 'trigger', 'label', 'Opportunity Stage Changed',
        'position', jsonb_build_object('x', 200, 'y', 40),
        'data', jsonb_build_object('triggerType', 'opportunity_stage_changed', 'triggerCategory', 'event')),
      jsonb_build_object('id', 'cond_phone', 'type', 'condition', 'label', 'Has phone',
        'position', jsonb_build_object('x', 200, 'y', 160),
        'data', jsonb_build_object('conditions', jsonb_build_object('logic', 'and',
          'rules', jsonb_build_array(jsonb_build_object('field', 'contact.phone', 'operator', 'is_not_empty', 'value', ''))))),
      jsonb_build_object('id', 'action_update', 'type', 'action', 'label', 'Send status update SMS',
        'position', jsonb_build_object('x', 200, 'y', 300),
        'data', jsonb_build_object('actionType', 'send_sms', 'config', jsonb_build_object(
          'body', 'Autom8ion Lab: Hi {{contact.first_name}}, your project moved to {{opportunity.stage_name}}. Details in the client portal: os.autom8ionlab.com/client-portal. Reply STOP, HELP.')))
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('id', 'e_t_c', 'source', 'trigger_1', 'target', 'cond_phone'),
      jsonb_build_object('id', 'e_c_a', 'source', 'cond_phone', 'sourceHandle', 'true', 'target', 'action_update')),
    'viewport', jsonb_build_object('x', 0, 'y', 0, 'zoom', 1)
  );
  PERFORM pg_temp.upsert_sms_workflow(
    v_org_id, v_user_id,
    'Inbound — Opportunity Stage Update SMS',
    'Fires whenever an opportunity moves to a new stage. Useful for keeping clients in the loop on Discovery → Proposal → Closed transitions. Refine trigger filter in the UI to scope to specific stages if desired.',
    v_def, 'opportunity_stage_changed', '{}'::jsonb
  );

  ---------------------------------------------------------------------
  -- Workflow 5: STOP / HELP / START Auto-Reply
  ---------------------------------------------------------------------
  v_def := jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object('id', 'trigger_1', 'type', 'trigger', 'label', 'Inbound Message',
        'position', jsonb_build_object('x', 300, 'y', 40),
        'data', jsonb_build_object('triggerType', 'conversation_message_received', 'triggerCategory', 'event')),
      jsonb_build_object('id', 'cond_stop', 'type', 'condition', 'label', 'STOP variant',
        'position', jsonb_build_object('x', 100, 'y', 180),
        'data', jsonb_build_object('conditions', jsonb_build_object('logic', 'or',
          'rules', jsonb_build_array(
            jsonb_build_object('field', 'context.message_body_upper', 'operator', 'equals', 'value', 'STOP'),
            jsonb_build_object('field', 'context.message_body_upper', 'operator', 'equals', 'value', 'STOPALL'),
            jsonb_build_object('field', 'context.message_body_upper', 'operator', 'equals', 'value', 'UNSUBSCRIBE'),
            jsonb_build_object('field', 'context.message_body_upper', 'operator', 'equals', 'value', 'CANCEL'),
            jsonb_build_object('field', 'context.message_body_upper', 'operator', 'equals', 'value', 'END'),
            jsonb_build_object('field', 'context.message_body_upper', 'operator', 'equals', 'value', 'QUIT'))))),
      jsonb_build_object('id', 'action_stop_reply', 'type', 'action', 'label', 'STOP reply',
        'position', jsonb_build_object('x', 100, 'y', 340),
        'data', jsonb_build_object('actionType', 'send_sms', 'config', jsonb_build_object(
          'body', 'Autom8ion Lab: You''re unsubscribed and will not receive further messages. Reply HELP for help or email info@autom8ionlab.com.'))),
      jsonb_build_object('id', 'cond_help', 'type', 'condition', 'label', 'HELP / INFO',
        'position', jsonb_build_object('x', 350, 'y', 180),
        'data', jsonb_build_object('conditions', jsonb_build_object('logic', 'or',
          'rules', jsonb_build_array(
            jsonb_build_object('field', 'context.message_body_upper', 'operator', 'equals', 'value', 'HELP'),
            jsonb_build_object('field', 'context.message_body_upper', 'operator', 'equals', 'value', 'INFO'))))),
      jsonb_build_object('id', 'action_help_reply', 'type', 'action', 'label', 'HELP reply',
        'position', jsonb_build_object('x', 350, 'y', 340),
        'data', jsonb_build_object('actionType', 'send_sms', 'config', jsonb_build_object(
          'body', 'Autom8ion Lab support: info@autom8ionlab.com or +1 855-508-6062. Msg & data rates may apply. Reply STOP to opt out.'))),
      jsonb_build_object('id', 'cond_start', 'type', 'condition', 'label', 'START / UNSTOP',
        'position', jsonb_build_object('x', 600, 'y', 180),
        'data', jsonb_build_object('conditions', jsonb_build_object('logic', 'or',
          'rules', jsonb_build_array(
            jsonb_build_object('field', 'context.message_body_upper', 'operator', 'equals', 'value', 'START'),
            jsonb_build_object('field', 'context.message_body_upper', 'operator', 'equals', 'value', 'UNSTOP'))))),
      jsonb_build_object('id', 'action_start_reply', 'type', 'action', 'label', 'START reply',
        'position', jsonb_build_object('x', 600, 'y', 340),
        'data', jsonb_build_object('actionType', 'send_sms', 'config', jsonb_build_object(
          'body', 'Autom8ion Lab: You''re re-subscribed and will receive messages again. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out.')))
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('id', 'e_t_stop', 'source', 'trigger_1', 'target', 'cond_stop'),
      jsonb_build_object('id', 'e_stop_a', 'source', 'cond_stop', 'sourceHandle', 'true', 'target', 'action_stop_reply'),
      jsonb_build_object('id', 'e_t_help', 'source', 'trigger_1', 'target', 'cond_help'),
      jsonb_build_object('id', 'e_help_a', 'source', 'cond_help', 'sourceHandle', 'true', 'target', 'action_help_reply'),
      jsonb_build_object('id', 'e_t_start', 'source', 'trigger_1', 'target', 'cond_start'),
      jsonb_build_object('id', 'e_start_a', 'source', 'cond_start', 'sourceHandle', 'true', 'target', 'action_start_reply')),
    'viewport', jsonb_build_object('x', 0, 'y', 0, 'zoom', 0.85)
  );
  PERFORM pg_temp.upsert_sms_workflow(
    v_org_id, v_user_id,
    'SMS Compliance — STOP / HELP / START Auto-Reply',
    'Carrier-required inbound handler. Replies to STOP/UNSUBSCRIBE/CANCEL/END/QUIT (opt-out), HELP/INFO (support), START/UNSTOP (re-subscribe). The STOP branch should ALSO clear contact.phone or set DND to ensure no further SMS fires — wire that as an additional action node when publishing in the UI.',
    v_def, 'conversation_message_received', '{}'::jsonb
  );

  RAISE NOTICE 'Seeded 5 SMS workflows in DRAFT state. Publish via UI after Phase C clears.';
END $$;
