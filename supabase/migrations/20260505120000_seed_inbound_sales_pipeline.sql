/*
  # Seed Inbound Sales pipeline + stages

  Creates the canonical pipeline that auto-form-generated opportunities land in.
  Idempotent: safe to re-run, won't duplicate or overwrite existing data.

  Pipeline: "Inbound Sales"
  Stages: New Lead -> Qualified -> Discovery -> Proposal -> Closed Won -> Closed Lost
*/

DO $$
DECLARE
  v_org_id uuid;
  v_pipeline_id uuid;
  v_stage_idx int;
  v_stages text[] := ARRAY['New Lead', 'Qualified', 'Discovery', 'Proposal', 'Closed Won', 'Closed Lost'];
  v_stage_name text;
BEGIN
  SELECT id INTO v_org_id FROM organizations ORDER BY created_at LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found, skipping Inbound Sales pipeline seed';
    RETURN;
  END IF;

  SELECT id INTO v_pipeline_id
  FROM pipelines
  WHERE org_id = v_org_id AND name = 'Inbound Sales';

  IF v_pipeline_id IS NULL THEN
    INSERT INTO pipelines (org_id, name, sort_order)
    VALUES (v_org_id, 'Inbound Sales', 0)
    RETURNING id INTO v_pipeline_id;
  END IF;

  v_stage_idx := 0;
  FOREACH v_stage_name IN ARRAY v_stages LOOP
    INSERT INTO pipeline_stages (org_id, pipeline_id, name, sort_order)
    VALUES (v_org_id, v_pipeline_id, v_stage_name, v_stage_idx)
    ON CONFLICT (pipeline_id, name) DO NOTHING;
    v_stage_idx := v_stage_idx + 1;
  END LOOP;
END $$;
