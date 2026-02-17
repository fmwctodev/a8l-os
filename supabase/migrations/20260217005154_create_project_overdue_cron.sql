/*
  # Create Project Overdue Check Cron Job

  1. New Function
    - `check_project_overdue()` - Checks for active projects past their target end date
    - Inserts overdue events into event_outbox for workflow triggers
    - Logs overdue events in project_activity_log

  2. Cron Schedule
    - Runs nightly at 2:00 AM UTC
    - Only fires for projects that haven't already received an overdue event today

  Important Notes:
    - Uses pg_cron extension (already enabled)
    - Function is SECURITY DEFINER with search_path set to public
    - Deduplicates by checking for existing overdue events on the same date
*/

CREATE OR REPLACE FUNCTION check_project_overdue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project RECORD;
BEGIN
  FOR v_project IN
    SELECT p.id, p.org_id, p.contact_id, p.name, p.target_end_date
    FROM projects p
    WHERE p.status = 'active'
      AND p.target_end_date < CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM event_outbox eo
        WHERE eo.entity_id = p.id::text
          AND eo.event_type = 'project_overdue'
          AND eo.created_at::date = CURRENT_DATE
      )
  LOOP
    INSERT INTO event_outbox (org_id, event_type, entity_type, entity_id, contact_id, payload)
    VALUES (
      v_project.org_id,
      'project_overdue',
      'project',
      v_project.id::text,
      v_project.contact_id::text,
      jsonb_build_object(
        'project_name', v_project.name,
        'target_end_date', v_project.target_end_date::text,
        'days_overdue', (CURRENT_DATE - v_project.target_end_date)
      )
    );

    INSERT INTO project_activity_log (org_id, project_id, event_type, summary, payload)
    VALUES (
      v_project.org_id,
      v_project.id,
      'project_overdue',
      'Project is ' || (CURRENT_DATE - v_project.target_end_date) || ' days past target end date',
      jsonb_build_object(
        'target_end_date', v_project.target_end_date::text,
        'days_overdue', (CURRENT_DATE - v_project.target_end_date)
      )
    );
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'check-project-overdue',
  '0 2 * * *',
  'SELECT check_project_overdue()'
);
