/*
  # Project-created event dispatch trigger

  Adds an AFTER INSERT trigger on the `projects` table that writes a
  `project_created` row into `event_outbox`. This replaces the TS-side
  `emitEvent('project.created')` call in `src/services/projects.ts` and
  is the single source of truth for project-created events.

  Why: Two code paths create projects:
  1. TypeScript `createProject()` (manual UI)
  2. SQL `handle_contract_signed()` (DB trigger on contract signature)

  The TS path used to call `emitEvent`, but the SQL path bypassed it.
  Moving the event dispatch into a DB trigger ensures BOTH paths fire
  the event into the outbox, which the `workflow-processor` pg_cron job
  picks up to:
  - Fire any matching workflow triggers (existing behavior)
  - Auto-send a client portal invite to the project's contact (new)

  The TS-side `emitEvent('project.created')` call in projects.ts should
  be DELETED in the same commit so there's no double-fire.
*/

CREATE OR REPLACE FUNCTION trg_project_created_enqueue_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO event_outbox (org_id, event_type, contact_id, entity_type, entity_id, payload)
  VALUES (
    NEW.org_id,
    'project_created',
    NEW.contact_id,
    'project',
    NEW.id,
    jsonb_build_object(
      'project_id', NEW.id,
      'contact_id', NEW.contact_id,
      'opportunity_id', NEW.opportunity_id,
      'pipeline_id', NEW.pipeline_id,
      'stage_id', NEW.stage_id,
      'name', NEW.name
    )
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block project creation because the outbox insert failed.
    RAISE WARNING '[trg_project_created_enqueue_event] project_id=% failed: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_created_event_dispatch ON projects;

CREATE TRIGGER project_created_event_dispatch
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION trg_project_created_enqueue_event();
