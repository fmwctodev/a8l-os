/*
  # Add foreign key from project_support_tickets to projects

  1. Changes
    - Adds missing foreign key constraint on `project_support_tickets.project_id` -> `projects.id`
    - This is required for PostgREST embedded resource joins used by the support-ticket-notify edge function

  2. Important Notes
    - Without this FK, the edge function query `projects!inner(name)` silently fails
    - This caused support ticket notification emails to never be sent
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_project_support_tickets_project'
    AND table_name = 'project_support_tickets'
  ) THEN
    ALTER TABLE project_support_tickets
      ADD CONSTRAINT fk_project_support_tickets_project
      FOREIGN KEY (project_id) REFERENCES projects(id);
  END IF;
END $$;
