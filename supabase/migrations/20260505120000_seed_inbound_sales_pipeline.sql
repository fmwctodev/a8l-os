/*
  # Verify Inbound pipeline exists for marketing-site form intake

  The org's "Inbound" pipeline (created by 20260316013214_replace_sales_pipeline_with_inbound_outbound.sql)
  is the canonical destination for auto-form-generated opportunities. This
  migration verifies it exists with a "New Lead" stage so subsequent
  migrations that reference it can fail loudly if it's missing.

  No DML — purely a guard check. Safe to re-run.
*/

DO $$
DECLARE
  v_org_id uuid;
  v_pipeline_id uuid;
  v_stage_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations ORDER BY created_at LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found, skipping verification';
    RETURN;
  END IF;

  SELECT id INTO v_pipeline_id FROM pipelines WHERE org_id = v_org_id AND name = 'Inbound';
  IF v_pipeline_id IS NULL THEN
    RAISE EXCEPTION 'Expected "Inbound" pipeline not found. Apply 20260316013214_replace_sales_pipeline_with_inbound_outbound.sql first.';
  END IF;

  SELECT id INTO v_stage_id FROM pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'New Lead';
  IF v_stage_id IS NULL THEN
    RAISE EXCEPTION '"New Lead" stage not found in Inbound pipeline.';
  END IF;

  RAISE NOTICE 'Inbound pipeline verified (id %) with New Lead stage (id %)', v_pipeline_id, v_stage_id;
END $$;
