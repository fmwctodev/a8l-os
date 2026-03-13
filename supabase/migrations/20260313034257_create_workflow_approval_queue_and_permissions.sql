/*
  # Create Workflow Approval Queue, Enrollment Attempts, Delayed Queue, and Granular Permissions

  1. New Tables
    - `workflow_approval_queue` - stores actions awaiting human approval
    - `workflow_enrollment_attempts` - tracks every enrollment attempt with result
    - `delayed_action_queue` - stores delayed/waiting steps for cron resume

  2. Schema Changes
    - Add `enrollment_rules` jsonb column to `workflows` table

  3. Security
    - RLS enabled on all new tables
    - Policies scoped to org membership

  4. Permissions
    - automations.view, automations.create, automations.edit,
      automations.publish, automations.approve, automations.logs
*/

-- workflow_approval_queue
CREATE TABLE IF NOT EXISTS workflow_approval_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES workflow_enrollments(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  action_type text NOT NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  draft_content jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval', 'approved', 'rejected')),
  resolution_note text,
  ai_run_id uuid,
  pending_next_node_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_queue_org_status
  ON workflow_approval_queue(org_id, status) WHERE status = 'pending_approval';
CREATE INDEX IF NOT EXISTS idx_approval_queue_enrollment
  ON workflow_approval_queue(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_approval_queue_workflow
  ON workflow_approval_queue(workflow_id);

ALTER TABLE workflow_approval_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view approval queue"
  ON workflow_approval_queue FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can update approval queue"
  ON workflow_approval_queue FOR UPDATE TO authenticated
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can insert approval queue"
  ON workflow_approval_queue FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- workflow_enrollment_attempts
CREATE TABLE IF NOT EXISTS workflow_enrollment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  result text NOT NULL CHECK (result IN ('enrolled', 'blocked_duplicate', 'blocked_rule', 'blocked_inactive')),
  enrollment_id uuid REFERENCES workflow_enrollments(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enrollment_attempts_org
  ON workflow_enrollment_attempts(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrollment_attempts_workflow
  ON workflow_enrollment_attempts(workflow_id, created_at DESC);

ALTER TABLE workflow_enrollment_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view enrollment attempts"
  ON workflow_enrollment_attempts FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can insert enrollment attempts"
  ON workflow_enrollment_attempts FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- delayed_action_queue
CREATE TABLE IF NOT EXISTS delayed_action_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES workflow_enrollments(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  resume_at timestamptz NOT NULL,
  wait_type text NOT NULL DEFAULT 'delay'
    CHECK (wait_type IN ('delay', 'wait_until_date', 'wait_until_condition', 'wait_until_event')),
  condition_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'resumed', 'timed_out', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_delayed_queue_due
  ON delayed_action_queue(resume_at) WHERE status = 'waiting';
CREATE INDEX IF NOT EXISTS idx_delayed_queue_enrollment
  ON delayed_action_queue(enrollment_id);

ALTER TABLE delayed_action_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view delayed queue"
  ON delayed_action_queue FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can insert delayed queue"
  ON delayed_action_queue FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members can update delayed queue"
  ON delayed_action_queue FOR UPDATE TO authenticated
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Add enrollment_rules column to workflows table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflows' AND column_name = 'enrollment_rules'
  ) THEN
    ALTER TABLE workflows ADD COLUMN enrollment_rules jsonb NOT NULL DEFAULT '{
      "allow_re_enrollment": "after_completion",
      "max_concurrent_enrollments": 1,
      "stop_existing_on_re_entry": false
    }'::jsonb;
  END IF;
END $$;

-- Add granular automation permissions
INSERT INTO permissions (id, key, description, module_name, created_at)
VALUES
  (gen_random_uuid(), 'automations.view', 'View workflows and enrollments', 'automation', now()),
  (gen_random_uuid(), 'automations.create', 'Create new workflows', 'automation', now()),
  (gen_random_uuid(), 'automations.edit', 'Edit existing workflows', 'automation', now()),
  (gen_random_uuid(), 'automations.publish', 'Publish workflows to make them active', 'automation', now()),
  (gen_random_uuid(), 'automations.approve', 'Approve or reject pending workflow actions', 'automation', now()),
  (gen_random_uuid(), 'automations.logs', 'View execution logs and analytics', 'automation', now())
ON CONFLICT (key) DO NOTHING;

-- Grant all automation permissions to superadmin and admin roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('superadmin', 'admin')
  AND p.key IN ('automations.view', 'automations.create', 'automations.edit', 'automations.publish', 'automations.approve', 'automations.logs')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant view and logs to manager role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'manager'
  AND p.key IN ('automations.view', 'automations.logs')
ON CONFLICT (role_id, permission_id) DO NOTHING;
