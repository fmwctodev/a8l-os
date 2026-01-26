/*
  # Extend Workflow Enrollments Table

  1. Changes to `workflow_enrollments`
    - Add `workflow_version_number` column (integer) - Denormalized version number for fast reads
    - Add `trigger_type` column (text) - How enrollment was initiated (manual, event trigger, etc)
    - Add `assigned_user_id` column (uuid, FK) - Owner/assignee tracking

  2. Purpose
    - Version number provides fast reads without joining workflow_versions
    - Trigger type enables filtering runs by enrollment source
    - Assigned user enables permission scoping and ownership tracking

  3. Indexes
    - Index on trigger_type for filtering
    - Index on assigned_user_id for scoped queries
*/

-- Add workflow_version_number column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflow_enrollments' AND column_name = 'workflow_version_number'
  ) THEN
    ALTER TABLE workflow_enrollments ADD COLUMN workflow_version_number integer;
  END IF;
END $$;

-- Add trigger_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflow_enrollments' AND column_name = 'trigger_type'
  ) THEN
    ALTER TABLE workflow_enrollments ADD COLUMN trigger_type text DEFAULT 'manual';
  END IF;
END $$;

-- Add assigned_user_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflow_enrollments' AND column_name = 'assigned_user_id'
  ) THEN
    ALTER TABLE workflow_enrollments ADD COLUMN assigned_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_workflow_enrollments_trigger_type 
  ON workflow_enrollments(trigger_type);

CREATE INDEX IF NOT EXISTS idx_workflow_enrollments_assigned_user 
  ON workflow_enrollments(assigned_user_id) WHERE assigned_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_enrollments_version_number 
  ON workflow_enrollments(workflow_id, workflow_version_number);

-- Backfill existing enrollments with version numbers from their version_id
UPDATE workflow_enrollments we
SET workflow_version_number = wv.version_number
FROM workflow_versions wv
WHERE we.version_id = wv.id
AND we.workflow_version_number IS NULL;
