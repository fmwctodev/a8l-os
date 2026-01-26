/*
  # Create Workflow Version Snapshots Table

  1. New Tables
    - `workflow_version_snapshots`
      - `id` (uuid, primary key) - Unique identifier
      - `workflow_version_id` (uuid, FK) - Reference to workflow_versions
      - `snapshot` (jsonb) - Complete workflow definition snapshot
      - `hash` (text) - SHA-256 hash for integrity verification
      - `created_at` (timestamptz) - When snapshot was created

  2. Purpose
    - Stores immutable JSON snapshots of workflow definitions at publish time
    - Hash provides integrity verification for rollback safety
    - One snapshot per version ensures consistency

  3. Security
    - Enable RLS on workflow_version_snapshots table
    - Policies use org_id from parent workflow_versions table
*/

-- Create workflow_version_snapshots table
CREATE TABLE IF NOT EXISTS workflow_version_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_version_id uuid NOT NULL REFERENCES workflow_versions(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT workflow_version_snapshots_version_unique UNIQUE (workflow_version_id)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_workflow_version_snapshots_version_id 
  ON workflow_version_snapshots(workflow_version_id);

-- Enable RLS
ALTER TABLE workflow_version_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workflow_version_snapshots
CREATE POLICY "Users can view workflow version snapshots in their org"
  ON workflow_version_snapshots
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workflow_versions wv
      WHERE wv.id = workflow_version_snapshots.workflow_version_id
      AND wv.org_id = get_user_org_id()
    )
    AND has_permission('automation.view')
  );

CREATE POLICY "Users can create workflow version snapshots in their org"
  ON workflow_version_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workflow_versions wv
      WHERE wv.id = workflow_version_snapshots.workflow_version_id
      AND wv.org_id = get_user_org_id()
    )
    AND has_permission('automation.manage')
  );

CREATE POLICY "Admins can delete workflow version snapshots in their org"
  ON workflow_version_snapshots
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workflow_versions wv
      WHERE wv.id = workflow_version_snapshots.workflow_version_id
      AND wv.org_id = get_user_org_id()
    )
    AND has_permission('automation.manage')
  );
