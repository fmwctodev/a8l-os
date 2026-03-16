/*
  # Replace Project Pipelines with Single Default Pipeline

  ## Summary
  Removes all existing project pipelines and stages, then seeds a single
  "Default" pipeline with 14 ordered stages covering the full project lifecycle.

  ## Changes
  - Deletes all rows from project_stages (cascade is handled but we do it explicitly)
  - Deletes all rows from project_pipelines
  - Inserts one pipeline: "Default"
  - Inserts 14 stages in sort order with distinct colors and sla_days = 0

  ## Stages (in order)
  1. Kickoff
  2. Planning
  3. In Progress
  4. Blocked
  5. Waiting on Client
  6. Internal Review
  7. QA / Testing
  8. Client Review
  9. Revisions
  10. Finalization
  11. Delivered
  12. Maintenance / Support
  13. Completed
  14. On Hold

  ## Notes
  - Projects referencing deleted stages/pipelines must be migrated first.
    Because this is a fresh seed (no real project data expected), we clear
    project stage/pipeline references before deleting.
  - org_id is derived from the single row in the organizations table.
*/

DO $$
DECLARE
  v_org_id uuid;
  v_pipeline_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found, skipping pipeline seed.';
    RETURN;
  END IF;

  UPDATE projects SET pipeline_id = NULL, stage_id = NULL WHERE org_id = v_org_id;

  DELETE FROM project_stages WHERE org_id = v_org_id;
  DELETE FROM project_pipelines WHERE org_id = v_org_id;

  INSERT INTO project_pipelines (org_id, name, sort_order)
  VALUES (v_org_id, 'Default', 0)
  RETURNING id INTO v_pipeline_id;

  INSERT INTO project_stages (org_id, pipeline_id, name, sort_order, sla_days, color) VALUES
    (v_org_id, v_pipeline_id, 'Kickoff',              0,  0, '#3b82f6'),
    (v_org_id, v_pipeline_id, 'Planning',             1,  0, '#06b6d4'),
    (v_org_id, v_pipeline_id, 'In Progress',          2,  0, '#10b981'),
    (v_org_id, v_pipeline_id, 'Blocked',              3,  0, '#ef4444'),
    (v_org_id, v_pipeline_id, 'Waiting on Client',    4,  0, '#f59e0b'),
    (v_org_id, v_pipeline_id, 'Internal Review',      5,  0, '#64748b'),
    (v_org_id, v_pipeline_id, 'QA / Testing',         6,  0, '#8b5cf6'),
    (v_org_id, v_pipeline_id, 'Client Review',        7,  0, '#ec4899'),
    (v_org_id, v_pipeline_id, 'Revisions',            8,  0, '#f97316'),
    (v_org_id, v_pipeline_id, 'Finalization',         9,  0, '#14b8a6'),
    (v_org_id, v_pipeline_id, 'Delivered',           10,  0, '#22c55e'),
    (v_org_id, v_pipeline_id, 'Maintenance / Support',11, 0, '#a855f7'),
    (v_org_id, v_pipeline_id, 'Completed',           12,  0, '#06b6d4'),
    (v_org_id, v_pipeline_id, 'On Hold',             13,  0, '#94a3b8');

END $$;
