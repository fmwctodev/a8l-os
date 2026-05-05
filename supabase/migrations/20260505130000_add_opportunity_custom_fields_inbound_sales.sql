/*
  # Add pipeline_custom_fields for Inbound + wire form to opportunity custom fields

  When the get-in-touch form creates an Opportunity in Inbound / New Lead,
  the same qualifying data captured on the Contact (budget_range, urgency, etc.)
  should also surface on the Opportunity detail card so the sales rep doesn't
  have to drill into the Contact to see it.

  This migration:
  1. Adds 6 pipeline_custom_fields scoped to the Inbound pipeline:
     industry, project_type, urgency, budget_range, ideal_start, project_description
  2. Re-UPSERTs the get-in-touch form definition with new field.mapping.opportunityCustomFieldId
     entries so form-submit can write opportunity_custom_field_values when an
     opportunity is auto-created.

  Idempotent — UNIQUE(pipeline_id, field_key) on pipeline_custom_fields and
  ON CONFLICT (public_slug) DO UPDATE on forms.
*/

DO $$
DECLARE
  v_org_id uuid;
  v_user_id uuid;
  v_pipeline_id uuid;
  v_stage_id uuid;
  -- Contact custom fields (created in 120100)
  v_cf_industry uuid;
  v_cf_project_type uuid;
  v_cf_urgency uuid;
  v_cf_budget_range uuid;
  v_cf_ideal_start uuid;
  v_cf_project_description uuid;
  v_cf_sms_consent uuid;
  v_cf_human_ack uuid;
  -- Pipeline (Opportunity) custom fields (created here)
  v_pcf_industry uuid;
  v_pcf_project_type uuid;
  v_pcf_urgency uuid;
  v_pcf_budget_range uuid;
  v_pcf_ideal_start uuid;
  v_pcf_project_description uuid;
  v_definition jsonb;
  v_settings jsonb;
BEGIN
  SELECT id INTO v_org_id FROM organizations ORDER BY created_at LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found, skipping migration';
    RETURN;
  END IF;

  SELECT id INTO v_user_id FROM users
    WHERE organization_id = v_org_id AND status = 'active'
    ORDER BY created_at LIMIT 1;

  SELECT id INTO v_pipeline_id FROM pipelines WHERE org_id = v_org_id AND name = 'Inbound';
  IF v_pipeline_id IS NULL THEN
    RAISE EXCEPTION 'Inbound pipeline not found — apply 20260316013214_replace_sales_pipeline_with_inbound_outbound.sql first';
  END IF;
  SELECT id INTO v_stage_id FROM pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'New Lead';

  -- Seed pipeline_custom_fields for Inbound Sales pipeline
  -- Note: pipeline_custom_fields field_type uses 'dropdown' (not 'select' like contact custom_fields)
  INSERT INTO pipeline_custom_fields (org_id, pipeline_id, field_key, label, field_type, options, required, filterable, sort_order)
  VALUES
    (v_org_id, v_pipeline_id, 'industry', 'Industry', 'dropdown', '[
      {"label": "Construction", "value": "construction"},
      {"label": "Healthcare & Life Sciences", "value": "healthcare"},
      {"label": "Finance", "value": "finance"},
      {"label": "Real Estate & Property", "value": "real_estate"},
      {"label": "US Government", "value": "government"},
      {"label": "Defense Industrial Base", "value": "defense"},
      {"label": "Other", "value": "other"}
    ]'::jsonb, false, true, 100),
    (v_org_id, v_pipeline_id, 'project_type', 'Project Type', 'multi_select', '[
      {"label": "AI Agent Development", "value": "ai_agents"},
      {"label": "Custom LLM Systems", "value": "custom_llm"},
      {"label": "Workflow Automation", "value": "automation"},
      {"label": "API Integrations", "value": "integrations"},
      {"label": "Custom Software", "value": "custom_software"},
      {"label": "Cybersecurity Compliance", "value": "compliance"},
      {"label": "Cloud Infrastructure", "value": "cloud"},
      {"label": "Other / Not Sure", "value": "other"}
    ]'::jsonb, false, true, 110),
    (v_org_id, v_pipeline_id, 'urgency', 'Urgency', 'dropdown', '[
      {"label": "Just exploring", "value": "exploring"},
      {"label": "Within 30-60 days", "value": "30_60_days"},
      {"label": "Yesterday", "value": "asap"}
    ]'::jsonb, false, true, 120),
    (v_org_id, v_pipeline_id, 'budget_range', 'Budget Range', 'dropdown', '[
      {"label": "$25K - $75K", "value": "25_75k"},
      {"label": "$75K - $250K", "value": "75_250k"},
      {"label": "$250K+", "value": "250k_plus"},
      {"label": "Not sure yet", "value": "unknown"}
    ]'::jsonb, false, true, 130),
    (v_org_id, v_pipeline_id, 'ideal_start', 'Ideal Start', 'text', '[]'::jsonb, false, true, 140),
    (v_org_id, v_pipeline_id, 'project_description', 'Project Description', 'text', '[]'::jsonb, false, false, 150)
  ON CONFLICT (pipeline_id, field_key) DO NOTHING;

  -- Look up the IDs we just created/found for use in the form definition
  SELECT id INTO v_pcf_industry FROM pipeline_custom_fields WHERE pipeline_id = v_pipeline_id AND field_key = 'industry';
  SELECT id INTO v_pcf_project_type FROM pipeline_custom_fields WHERE pipeline_id = v_pipeline_id AND field_key = 'project_type';
  SELECT id INTO v_pcf_urgency FROM pipeline_custom_fields WHERE pipeline_id = v_pipeline_id AND field_key = 'urgency';
  SELECT id INTO v_pcf_budget_range FROM pipeline_custom_fields WHERE pipeline_id = v_pipeline_id AND field_key = 'budget_range';
  SELECT id INTO v_pcf_ideal_start FROM pipeline_custom_fields WHERE pipeline_id = v_pipeline_id AND field_key = 'ideal_start';
  SELECT id INTO v_pcf_project_description FROM pipeline_custom_fields WHERE pipeline_id = v_pipeline_id AND field_key = 'project_description';

  -- Lookup contact custom fields (already seeded in 120100)
  SELECT id INTO v_cf_industry FROM custom_fields WHERE organization_id = v_org_id AND field_key = 'industry';
  SELECT id INTO v_cf_project_type FROM custom_fields WHERE organization_id = v_org_id AND field_key = 'project_type';
  SELECT id INTO v_cf_urgency FROM custom_fields WHERE organization_id = v_org_id AND field_key = 'urgency';
  SELECT id INTO v_cf_budget_range FROM custom_fields WHERE organization_id = v_org_id AND field_key = 'budget_range';
  SELECT id INTO v_cf_ideal_start FROM custom_fields WHERE organization_id = v_org_id AND field_key = 'ideal_start';
  SELECT id INTO v_cf_project_description FROM custom_fields WHERE organization_id = v_org_id AND field_key = 'project_description';
  SELECT id INTO v_cf_sms_consent FROM custom_fields WHERE organization_id = v_org_id AND field_key = 'sms_consent';
  SELECT id INTO v_cf_human_ack FROM custom_fields WHERE organization_id = v_org_id AND field_key = 'human_acknowledgement';

  -- Re-UPSERT the get-in-touch form so each qualifying field now writes to BOTH
  -- the contact custom field AND the opportunity custom field.
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
        'mapping', jsonb_build_object('customFieldId', v_cf_industry, 'opportunityCustomFieldId', v_pcf_industry)),
      jsonb_build_object('id', 'project_type', 'type', 'multi_select', 'label', 'Project Type', 'required', false,
        'mapping', jsonb_build_object('customFieldId', v_cf_project_type, 'opportunityCustomFieldId', v_pcf_project_type)),
      jsonb_build_object('id', 'urgency', 'type', 'select', 'label', 'Urgency', 'required', false,
        'mapping', jsonb_build_object('customFieldId', v_cf_urgency, 'opportunityCustomFieldId', v_pcf_urgency)),
      jsonb_build_object('id', 'budget_range', 'type', 'select', 'label', 'Budget Range', 'required', false,
        'mapping', jsonb_build_object('customFieldId', v_cf_budget_range, 'opportunityCustomFieldId', v_pcf_budget_range)),
      jsonb_build_object('id', 'ideal_start', 'type', 'text', 'label', 'Ideal Start', 'required', false,
        'mapping', jsonb_build_object('customFieldId', v_cf_ideal_start, 'opportunityCustomFieldId', v_pcf_ideal_start)),
      jsonb_build_object('id', 'project_description', 'type', 'textarea', 'label', 'Project Description', 'required', false,
        'mapping', jsonb_build_object('customFieldId', v_cf_project_description, 'opportunityCustomFieldId', v_pcf_project_description)),
      jsonb_build_object('id', 'phone', 'type', 'phone', 'label', 'Phone (optional)', 'required', false,
        'validationRules', jsonb_build_array(jsonb_build_object('type', 'format'))),
      jsonb_build_object('id', 'sms_consent', 'type', 'boolean', 'label', 'I authorize Autom8ion Lab to send SMS messages about my inquiry', 'required', false,
        'mapping', jsonb_build_object('customFieldId', v_cf_sms_consent)),
      jsonb_build_object('id', 'human_acknowledgement', 'type', 'boolean', 'label', 'I am a real person interested in working with Autom8ion Lab', 'required', true,
        'mapping', jsonb_build_object('customFieldId', v_cf_human_ack))
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
    'Public contact form on the marketing site. Auto-creates contact + Inbound / New Lead opportunity on submission, mirroring qualifying data to opportunity custom fields.',
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
    description = EXCLUDED.description,
    updated_at = now();
END $$;
