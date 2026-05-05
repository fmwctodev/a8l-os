/*
  # Seed custom fields used by the get-in-touch + careers-application forms

  Org-wide custom fields so qualifying data captured at form submission time is
  filterable/searchable on the contact (not buried in form_submissions.payload).

  Idempotent: ON CONFLICT (organization_id, field_key) DO NOTHING — safe to re-run.

  Field keys are stable identifiers used by the form definitions in subsequent
  migrations to wire field.mapping.customFieldId.
*/

DO $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations ORDER BY created_at LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found, skipping custom field seed';
    RETURN;
  END IF;

  -- Get In Touch form custom fields
  INSERT INTO custom_fields (organization_id, name, field_key, field_type, options, is_required, display_order)
  VALUES
    (v_org_id, 'Industry', 'industry', 'select', '[
      {"label": "Construction", "value": "construction"},
      {"label": "Healthcare & Life Sciences", "value": "healthcare"},
      {"label": "Finance", "value": "finance"},
      {"label": "Real Estate & Property", "value": "real_estate"},
      {"label": "US Government", "value": "government"},
      {"label": "Defense Industrial Base", "value": "defense"},
      {"label": "Other", "value": "other"}
    ]'::jsonb, false, 100),
    (v_org_id, 'Project Type', 'project_type', 'multi_select', '[
      {"label": "AI Agent Development", "value": "ai_agents"},
      {"label": "Custom LLM Systems", "value": "custom_llm"},
      {"label": "Workflow Automation", "value": "automation"},
      {"label": "API Integrations", "value": "integrations"},
      {"label": "Custom Software", "value": "custom_software"},
      {"label": "Cybersecurity Compliance", "value": "compliance"},
      {"label": "Cloud Infrastructure", "value": "cloud"},
      {"label": "Other / Not Sure", "value": "other"}
    ]'::jsonb, false, 110),
    (v_org_id, 'Urgency', 'urgency', 'select', '[
      {"label": "Just exploring", "value": "exploring"},
      {"label": "Within 30-60 days", "value": "30_60_days"},
      {"label": "Yesterday", "value": "asap"}
    ]'::jsonb, false, 120),
    (v_org_id, 'Budget Range', 'budget_range', 'select', '[
      {"label": "$25K - $75K", "value": "25_75k"},
      {"label": "$75K - $250K", "value": "75_250k"},
      {"label": "$250K+", "value": "250k_plus"},
      {"label": "Not sure yet", "value": "unknown"}
    ]'::jsonb, false, 130),
    (v_org_id, 'Ideal Start', 'ideal_start', 'text', NULL, false, 140),
    (v_org_id, 'Project Description', 'project_description', 'text', NULL, false, 150),
    (v_org_id, 'SMS Consent', 'sms_consent', 'boolean', NULL, false, 160),
    (v_org_id, 'Human Acknowledgement', 'human_acknowledgement', 'boolean', NULL, false, 170),
    -- Careers form custom fields
    (v_org_id, 'Position Applying For', 'position_applying_for', 'text', NULL, false, 200),
    (v_org_id, 'Years of Experience', 'years_of_experience', 'select', '[
      {"label": "0-2 years", "value": "0_2"},
      {"label": "3-5 years", "value": "3_5"},
      {"label": "6-10 years", "value": "6_10"},
      {"label": "10+ years", "value": "10_plus"}
    ]'::jsonb, false, 210),
    (v_org_id, 'LinkedIn URL', 'linkedin_url', 'text', NULL, false, 220),
    (v_org_id, 'Portfolio URL', 'portfolio_url', 'text', NULL, false, 230),
    (v_org_id, 'Cover Letter', 'cover_letter', 'text', NULL, false, 240),
    (v_org_id, 'Resume File URL', 'resume_file_url', 'text', NULL, false, 250),
    (v_org_id, 'Federal Clearance', 'federal_clearance', 'select', '[
      {"label": "None", "value": "none"},
      {"label": "Public Trust", "value": "public_trust"},
      {"label": "Secret", "value": "secret"},
      {"label": "Top Secret", "value": "top_secret"},
      {"label": "TS/SCI", "value": "ts_sci"}
    ]'::jsonb, false, 260)
  ON CONFLICT (organization_id, field_key) DO NOTHING;
END $$;
