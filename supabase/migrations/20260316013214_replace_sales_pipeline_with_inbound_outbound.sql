/*
  # Replace Sales Pipeline with Inbound and Outbound Pipelines

  ## Summary
  Autom8ion Lab operates as a single-tenant system with two fixed lead-source pipelines.
  This migration removes any existing pipelines and replaces them with two permanent ones:
  "Inbound" and "Outbound", each with 12 identical stages.

  ## Changes

  ### Deleted
  - All existing pipeline stages (cascade from pipeline delete)
  - All existing pipelines

  ### New Tables/Data
  - 2 new pipelines: "Inbound" (sort_order 0) and "Outbound" (sort_order 1)
    - No department assignment (visible to all)
  - 12 stages per pipeline, in order:
    1. New Lead
    2. Contacted
    3. Engaged
    4. Qualified
    5. Discovery / Demo Scheduled
    6. Discovery Completed
    7. Proposal Sent
    8. Negotiation / Follow Up
    9. Agreement Signed
    10. Payment Pending
    11. Closed Won
    12. Closed Lost

  ## Notes
  - org_id is fetched dynamically from the organizations table (single-tenant)
  - Existing opportunities will have their pipeline_stage_id set to NULL if their
    stage is deleted, preserving the opportunity records themselves
*/

DO $$
DECLARE
  v_org_id uuid;
  v_inbound_id uuid;
  v_outbound_id uuid;
  stage_names text[] := ARRAY[
    'New Lead',
    'Contacted',
    'Engaged',
    'Qualified',
    'Discovery / Demo Scheduled',
    'Discovery Completed',
    'Proposal Sent',
    'Negotiation / Follow Up',
    'Agreement Signed',
    'Payment Pending',
    'Closed Won',
    'Closed Lost'
  ];
  i int;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found';
  END IF;

  DELETE FROM pipelines WHERE org_id = v_org_id;

  INSERT INTO pipelines (org_id, name, sort_order, department_id)
  VALUES (v_org_id, 'Inbound', 0, NULL)
  RETURNING id INTO v_inbound_id;

  INSERT INTO pipelines (org_id, name, sort_order, department_id)
  VALUES (v_org_id, 'Outbound', 1, NULL)
  RETURNING id INTO v_outbound_id;

  FOR i IN 1..array_length(stage_names, 1) LOOP
    INSERT INTO pipeline_stages (org_id, pipeline_id, name, sort_order)
    VALUES (v_org_id, v_inbound_id, stage_names[i], i - 1);

    INSERT INTO pipeline_stages (org_id, pipeline_id, name, sort_order)
    VALUES (v_org_id, v_outbound_id, stage_names[i], i - 1);
  END LOOP;

END $$;
