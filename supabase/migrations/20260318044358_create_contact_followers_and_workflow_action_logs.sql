/*
  # Create Contact Followers and Workflow Action Logs

  ## Summary
  Adds two new tables to support expanded GHL-style workflow actions.

  ## New Tables

  ### 1. `contact_followers`
  Tracks which users are following a contact for update notifications.
  - `id` - Primary key
  - `org_id` - Organization reference
  - `contact_id` - Contact being followed
  - `user_id` - User who is following
  - `created_at` - When the follow was created

  ### 2. `workflow_action_logs`
  Audit log for workflow action executions.
  - `id` - Primary key
  - `org_id` - Organization reference
  - `enrollment_id` - Workflow enrollment reference
  - `action_type` - The type of action executed
  - `status` - Execution status (success, failed, skipped, pending)
  - `notes` - Human-readable notes or error messages
  - `metadata` - Arbitrary JSON payload
  - `created_at` - When the log entry was created

  ## Security
  - RLS enabled on both tables
  - Org members can read/write their own org's data
*/

CREATE TABLE IF NOT EXISTS contact_followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (contact_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_followers_org_id ON contact_followers(org_id);
CREATE INDEX IF NOT EXISTS idx_contact_followers_contact_id ON contact_followers(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_followers_user_id ON contact_followers(user_id);

ALTER TABLE contact_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view contact followers"
  ON contact_followers FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Org members can insert contact followers"
  ON contact_followers FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Org members can delete contact followers"
  ON contact_followers FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS workflow_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES workflow_enrollments(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'skipped', 'pending')),
  notes text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_action_logs_org_id ON workflow_action_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_workflow_action_logs_enrollment_id ON workflow_action_logs(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_workflow_action_logs_action_type ON workflow_action_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_workflow_action_logs_created_at ON workflow_action_logs(created_at DESC);

ALTER TABLE workflow_action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view workflow action logs"
  ON workflow_action_logs FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Org members can insert workflow action logs"
  ON workflow_action_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );
