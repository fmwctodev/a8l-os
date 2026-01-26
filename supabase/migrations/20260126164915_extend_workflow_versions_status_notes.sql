/*
  # Extend Workflow Versions Table

  1. Changes to `workflow_versions`
    - Add `status` column (text) - published, archived, rolled_back
    - Add `notes` column (text) - Release notes for this version
    - Add `is_active` column (boolean) - Whether this is the current published version

  2. Purpose
    - Track version lifecycle states for better version management
    - Store release notes for documentation and rollback context
    - Identify active version quickly without complex queries

  3. Indexes
    - Index on (workflow_id, is_active) for fast active version lookup
*/

-- Add status column to workflow_versions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflow_versions' AND column_name = 'status'
  ) THEN
    ALTER TABLE workflow_versions ADD COLUMN status text NOT NULL DEFAULT 'published';
  END IF;
END $$;

-- Add notes column to workflow_versions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflow_versions' AND column_name = 'notes'
  ) THEN
    ALTER TABLE workflow_versions ADD COLUMN notes text;
  END IF;
END $$;

-- Add is_active column to workflow_versions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflow_versions' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE workflow_versions ADD COLUMN is_active boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Create index for fast active version lookup
CREATE INDEX IF NOT EXISTS idx_workflow_versions_active 
  ON workflow_versions(workflow_id, is_active) WHERE is_active = true;

-- Add check constraint for valid status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'workflow_versions' AND constraint_name = 'workflow_versions_status_check'
  ) THEN
    ALTER TABLE workflow_versions ADD CONSTRAINT workflow_versions_status_check
      CHECK (status IN ('published', 'archived', 'rolled_back'));
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
