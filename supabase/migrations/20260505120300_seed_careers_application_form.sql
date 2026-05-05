/*
  # Seed the canonical "Careers Application" form

  Backs the careers form on https://autom8ionlab.com/join-us. Creates a contact
  but does NOT create an opportunity (career applications shouldn't pollute the
  sales pipeline). Form-submit Edge Function detects the absence of
  defaultPipelineId/defaultStageId in settings and skips opportunity creation.

  Idempotent UPSERT on slug so iterating field schema is safe.
*/

DO $$
DECLARE
  v_org_id uuid;
  v_user_id uuid;
  v_field_position uuid;
  v_field_yoe uuid;
  v_field_linkedin uuid;
  v_field_portfolio uuid;
  v_field_cover_letter uuid;
  v_field_resume uuid;
  v_field_clearance uuid;
  v_definition jsonb;
  v_settings jsonb;
BEGIN
  SELECT id INTO v_org_id FROM organizations ORDER BY created_at LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found, skipping careers form seed';
    RETURN;
  END IF;

  SELECT id INTO v_user_id
  FROM users
  WHERE organization_id = v_org_id AND status = 'active'
  ORDER BY created_at
  LIMIT 1;

  SELECT id INTO v_field_position FROM custom_fields WHERE organization_id = v_org_id AND field_key = 'position_applying_for';
  SELECT id INTO v_field_yoe FROM custom_fields WHERE organization_id = v_org_id AND field_key = 'years_of_experience';
  SELECT id INTO v_field_linkedin FROM custom_fields WHERE organization_id = v_org_id AND field_key = 'linkedin_url';
  SELECT id INTO v_field_portfolio FROM custom_fields WHERE organization_id = v_org_id AND field_key = 'portfolio_url';
  SELECT id INTO v_field_cover_letter FROM custom_fields WHERE organization_id = v_org_id AND field_key = 'cover_letter';
  SELECT id INTO v_field_resume FROM custom_fields WHERE organization_id = v_org_id AND field_key = 'resume_file_url';
  SELECT id INTO v_field_clearance FROM custom_fields WHERE organization_id = v_org_id AND field_key = 'federal_clearance';

  v_definition := jsonb_build_object(
    'fields', jsonb_build_array(
      jsonb_build_object('id', 'first_name', 'type', 'first_name', 'label', 'First Name', 'required', true),
      jsonb_build_object('id', 'last_name', 'type', 'last_name', 'label', 'Last Name', 'required', true),
      jsonb_build_object('id', 'email', 'type', 'email', 'label', 'Email Address', 'required', true,
        'validationRules', jsonb_build_array(jsonb_build_object('type', 'format'))),
      jsonb_build_object('id', 'phone', 'type', 'phone', 'label', 'Phone Number', 'required', true,
        'validationRules', jsonb_build_array(jsonb_build_object('type', 'format'))),
      jsonb_build_object('id', 'position_applying_for', 'type', 'text', 'label', 'Position', 'required', true,
        'mapping', jsonb_build_object('customFieldId', v_field_position)),
      jsonb_build_object('id', 'years_of_experience', 'type', 'select', 'label', 'Years of Experience', 'required', true,
        'mapping', jsonb_build_object('customFieldId', v_field_yoe)),
      jsonb_build_object('id', 'federal_clearance', 'type', 'select', 'label', 'Federal Clearance', 'required', false,
        'mapping', jsonb_build_object('customFieldId', v_field_clearance)),
      jsonb_build_object('id', 'linkedin_url', 'type', 'website', 'label', 'LinkedIn URL', 'required', false,
        'validationRules', jsonb_build_array(jsonb_build_object('type', 'format')),
        'mapping', jsonb_build_object('customFieldId', v_field_linkedin)),
      jsonb_build_object('id', 'portfolio_url', 'type', 'website', 'label', 'Portfolio / GitHub URL', 'required', false,
        'validationRules', jsonb_build_array(jsonb_build_object('type', 'format')),
        'mapping', jsonb_build_object('customFieldId', v_field_portfolio)),
      jsonb_build_object('id', 'cover_letter', 'type', 'textarea', 'label', 'Why Autom8ion Lab?', 'required', false,
        'mapping', jsonb_build_object('customFieldId', v_field_cover_letter)),
      jsonb_build_object('id', 'resume_file_url', 'type', 'text', 'label', 'Resume File URL', 'required', false,
        'mapping', jsonb_build_object('customFieldId', v_field_resume))
    )
  );

  v_settings := jsonb_build_object(
    'thankYouMessage', 'Application received. We review every submission within 5 business days.',
    'contactMatching', 'email_first',
    'fieldOverwrite', 'only_if_empty',
    'honeypotEnabled', true,
    'rateLimitPerIp', 3,
    'captchaEnabled', false
    -- defaultPipelineId / defaultStageId intentionally omitted: career applications
    -- should not create opportunities in the sales pipeline.
  );

  INSERT INTO forms (organization_id, name, description, public_slug, definition, settings, status, published_at, created_by)
  VALUES (
    v_org_id,
    'Careers Application (autom8ionlab.com)',
    'Public careers form on the marketing site. Creates contact only — no opportunity.',
    'careers-application',
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
