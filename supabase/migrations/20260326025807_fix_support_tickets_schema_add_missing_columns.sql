/*
  # Fix support tickets schema - add missing columns

  1. Modified Tables
    - `project_support_tickets`
      - Add `title` (text) - display title for the ticket
      - Add `steps_to_reproduce` (text) - reproduction steps
      - Add `expected_behavior` (text) - expected outcome
      - Add `actual_behavior` (text) - actual outcome
      - Add `affected_feature` (text) - specific feature affected
      - Add `affected_workflow_id` (text) - linked workflow
      - Add `affected_integration` (text) - linked integration
      - Add `environment` (text) - production/staging/dev
      - Add `browser_info` (text) - browser and device info
      - Add `error_messages` (text) - error output
      - Add `users_affected_count` (integer) - number of users affected
      - Add `workaround_available` (boolean) - whether workaround exists
      - Add `availability_window` (text) - when client is available
      - Add `expected_resolution_date` (date) - client's desired date
      - Add `first_response_at` (timestamptz) - first team response
      - Add `resolution_summary` (text) - how ticket was resolved
      - Add `created_by_user_id` (uuid) - internal user who created it
      - Add `expected_turnaround` (text) - desired turnaround time
      - Add `impact_description` (text) - business impact details
      - Add `affected_area` (text) - general affected area
      - Add `critical` stat helper column note

  2. Important Notes
    - Adds columns that the service layer expects but were missing
    - All new columns are nullable to preserve existing data
    - No destructive operations
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_support_tickets' AND column_name = 'title') THEN
    ALTER TABLE project_support_tickets ADD COLUMN title text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_support_tickets' AND column_name = 'steps_to_reproduce') THEN
    ALTER TABLE project_support_tickets ADD COLUMN steps_to_reproduce text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_support_tickets' AND column_name = 'expected_behavior') THEN
    ALTER TABLE project_support_tickets ADD COLUMN expected_behavior text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_support_tickets' AND column_name = 'actual_behavior') THEN
    ALTER TABLE project_support_tickets ADD COLUMN actual_behavior text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_support_tickets' AND column_name = 'affected_feature') THEN
    ALTER TABLE project_support_tickets ADD COLUMN affected_feature text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_support_tickets' AND column_name = 'affected_workflow_id') THEN
    ALTER TABLE project_support_tickets ADD COLUMN affected_workflow_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_support_tickets' AND column_name = 'affected_integration') THEN
    ALTER TABLE project_support_tickets ADD COLUMN affected_integration text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_support_tickets' AND column_name = 'environment') THEN
    ALTER TABLE project_support_tickets ADD COLUMN environment text DEFAULT 'production';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_support_tickets' AND column_name = 'browser_info') THEN
    ALTER TABLE project_support_tickets ADD COLUMN browser_info text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_support_tickets' AND column_name = 'error_messages') THEN
    ALTER TABLE project_support_tickets ADD COLUMN error_messages text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_support_tickets' AND column_name = 'users_affected_count') THEN
    ALTER TABLE project_support_tickets ADD COLUMN users_affected_count integer DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_support_tickets' AND column_name = 'workaround_available') THEN
    ALTER TABLE project_support_tickets ADD COLUMN workaround_available boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_support_tickets' AND column_name = 'availability_window') THEN
    ALTER TABLE project_support_tickets ADD COLUMN availability_window text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_support_tickets' AND column_name = 'expected_resolution_date') THEN
    ALTER TABLE project_support_tickets ADD COLUMN expected_resolution_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_support_tickets' AND column_name = 'first_response_at') THEN
    ALTER TABLE project_support_tickets ADD COLUMN first_response_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_support_tickets' AND column_name = 'resolution_summary') THEN
    ALTER TABLE project_support_tickets ADD COLUMN resolution_summary text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_support_tickets' AND column_name = 'created_by_user_id') THEN
    ALTER TABLE project_support_tickets ADD COLUMN created_by_user_id uuid REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_support_tickets' AND column_name = 'expected_turnaround') THEN
    ALTER TABLE project_support_tickets ADD COLUMN expected_turnaround text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_support_tickets' AND column_name = 'impact_description') THEN
    ALTER TABLE project_support_tickets ADD COLUMN impact_description text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_support_tickets' AND column_name = 'affected_area') THEN
    ALTER TABLE project_support_tickets ADD COLUMN affected_area text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_support_tickets_created_by ON project_support_tickets(created_by_user_id) WHERE created_by_user_id IS NOT NULL;
