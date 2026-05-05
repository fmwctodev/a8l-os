/*
  # Seed the canonical "Get In Touch" form

  Backs the gamified contact form on https://autom8ionlab.com/get-in-touch
  (a8l-site repo, app/_components/GamifiedContactForm.tsx). Form-submit Edge
  Function looks up by public_slug "get-in-touch" so the marketing site only
  needs to know the slug, not a UUID.

  Settings include defaultPipelineId + defaultStageId, which the Edge Function
  reads to auto-create an Opportunity in "Inbound / New Lead" alongside
  the contact.

  Idempotent: re-runs UPDATE the existing form (so iterating field schema is
  a one-line edit + re-apply migration).
*/

DO $$
DECLARE
  v_org_id uuid;
  v_user_id uuid;
  v_pipeline_id uuid;
  v_stage_id uuid;
  v_field_industry uuid;
  v_field_project_type uuid;
  v_field_urgency uuid;
  v_field_budget_range uuid;
  v_field_ideal_start uuid;
  v_field_project_description uuid;
  v_field_sms_consent uuid;
  v_field_human_ack uuid;
  v_definition jsonb;
  v_settings jsonb;
BEGIN
  SELECT id INTO v_org_id FROM organizations ORDER BY created_at LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found, skipping get-in-touch form seed';
    RETURN;
  END IF;

  SELECT id INTO v_user_id
  FROM users
  WHERE organization_id = v_org_id AND status = 'active'
  ORDER BY created_at
  LIMIT 1;

  SELECT id INTO v_pipeline_id FROM pipelines WHERE org_id = v_org_id AND name = 'Inbound';
  IF v_pipeline_id IS NULL THEN
    RAISE EXCEPTION 'Inbound pipeline not found — apply 20260316013214_replace_sales_pipeline_with_inbound_outbound.sql first';
  END IF;

  SELECT id INTO v_stage_id FROM pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'New Lead';
  IF v_stage_id IS NULL THEN
    RAISE EXCEPTION 'New Lead stage not found in Inbound pipeline';
  END IF;

  SELECT id INTO v_field_industry FROM custom_fields WHERE organization_id = v_org_id AND field_key = 'industry';
  SELECT id INTO v_field_project_type FROM custom_fields WHERE organization_id = v_org_id AND field_key = 'project_type';
  SELECT id INTO v_field_urgency FROM custom_fields WHERE organization_id = v_org_id AND field_key = 'urgency';
  SELECT id INTO v_field_budget_range FROM custom_fields WHERE organization_id = v_org_id AND field_key = 'budget_range';
  SELECT id INTO v_field_ideal_start FROM custom_fields WHERE organization_id = v_org_id AND field_key = 'ideal_start';
  SELECT id INTO v_field_project_description FROM custom_fields WHERE organization_id = v_org_id AND field_key = 'project_description';
  SELECT id INTO v_field_sms_consent FROM custom_fields WHERE organization_id = v_org_id AND field_key = 'sms_consent';
  SELECT id INTO v_field_human_ack FROM custom_fields WHERE organization_id = v_org_id AND field_key = 'human_acknowledgement';

  v_definition := jsonb_build_object(
    'fields', jsonb_build_array(
      jsonb_build_object('id', 'first_name', 'type', 'first_name', 'label', 'First Name', 'required', true),
      jsonb_build_object('id', 'last_name', 'type', 'last_name', 'label', 'Last Name', 'required', true),
      jsonb_build_object('id', 'email', 'type', 'email', 'label', 'Email Address', 'required', true,
        'validationRules', jsonb_build_array(jsonb_build_object('type', 'format'))),
      jsonb_build_object('id', 'company', 'type', 'company', 'label', 'Company', 'required', false),
      jsonb_build_object('id', 'job_title', 'type', 'text', 'label', 'Job Title', 'required', false,
        'mapping', jsonb_build_object('contactField', 'job_title')),
      jsonb_build_object('id', 'industry', 'type', 'select', 'label', 'Industry', 'required', false,
        'mapping', jsonb_build_object('customFieldId', v_field_industry)),
      jsonb_build_object('id', 'project_type', 'type', 'multi_select', 'label', 'Project Type', 'required', false,
        'mapping', jsonb_build_object('customFieldId', v_field_project_type)),
      jsonb_build_object('id', 'urgency', 'type', 'select', 'label', 'Urgency', 'required', false,
        'mapping', jsonb_build_object('customFieldId', v_field_urgency)),
      jsonb_build_object('id', 'budget_range', 'type', 'select', 'label', 'Budget Range', 'required', false,
        'mapping', jsonb_build_object('customFieldId', v_field_budget_range)),
      jsonb_build_object('id', 'ideal_start', 'type', 'text', 'label', 'Ideal Start', 'required', false,
        'mapping', jsonb_build_object('customFieldId', v_field_ideal_start)),
      jsonb_build_object('id', 'project_description', 'type', 'textarea', 'label', 'Project Description', 'required', false,
        'mapping', jsonb_build_object('customFieldId', v_field_project_description)),
      jsonb_build_object('id', 'phone', 'type', 'phone', 'label', 'Phone (optional)', 'required', false,
        'validationRules', jsonb_build_array(jsonb_build_object('type', 'format'))),
      jsonb_build_object('id', 'sms_consent', 'type', 'boolean', 'label', 'I authorize Autom8ion Lab to send SMS messages about my inquiry', 'required', false,
        'mapping', jsonb_build_object('customFieldId', v_field_sms_consent)),
      jsonb_build_object('id', 'human_acknowledgement', 'type', 'boolean', 'label', 'I am a real person interested in working with Autom8ion Lab', 'required', true,
        'mapping', jsonb_build_object('customFieldId', v_field_human_ack))
    )
  );

  v_settings := jsonb_build_object(
    'thankYouMessage', 'Got it. Sean will reply within 1 business day.',
    'contactMatching', 'email_first',
    'fieldOverwrite', 'only_if_empty',
    'honeypotEnabled', true,
    'rateLimitPerIp', 5,
    'captchaEnabled', false,
    'defaultPipelineId', v_pipeline_id,
    'defaultStageId', v_stage_id
  );

  INSERT INTO forms (organization_id, name, description, public_slug, definition, settings, status, published_at, created_by)
  VALUES (
    v_org_id,
    'Get In Touch (autom8ionlab.com)',
    'Public contact form on the marketing site. Auto-creates contact + Inbound / New Lead opportunity on submission.',
    'get-in-touch',
    v_definition,
    v_settings,
    'published',
    now(),
    v_user_id
  )
  ON CONFLICT (public_slug) DO UPDATE SET
    definition = EXCLUDED.definition,
    settings = EXCLUDED.settings,
    status = EXCLUDED.status,
    published_at = COALESCE(forms.published_at, EXCLUDED.published_at),
    updated_at = now();
END $$;
