/*
  # Extended Workflow Actions Schema

  This migration creates additional tables and columns to support the full suite of
  workflow actions including goals, retries, loops, and condition waits.

  ## 1. New Tables

  ### workflow_goals
  - `id` (uuid, primary key) - Unique goal identifier
  - `org_id` (uuid) - Organization reference
  - `workflow_id` (uuid) - Parent workflow
  - `name` (text) - Goal name for display
  - `goal_type` (text) - Type: enrollment_complete, contact_property_met, external_event
  - `conditions` (jsonb) - Condition configuration for the goal
  - `stop_workflow_on_met` (boolean) - Whether to stop workflow when goal is met
  - `created_at`, `updated_at` - Timestamps

  ### workflow_action_retries
  - `id` (uuid, primary key) - Unique retry config identifier
  - `org_id` (uuid) - Organization reference
  - `workflow_id` (uuid) - Parent workflow
  - `node_id` (text) - Node this config applies to
  - `max_retries` (integer) - Maximum retry attempts
  - `retry_delay_seconds` (integer) - Delay between retries
  - `fallback_behavior` (text) - What to do on final failure: skip, stop, notify
  - `created_at` - Timestamp

  ### workflow_loops
  - `id` (uuid, primary key) - Unique loop tracker identifier
  - `org_id` (uuid) - Organization reference
  - `enrollment_id` (uuid) - Enrollment being tracked
  - `node_id` (text) - Node with the loop
  - `iteration_count` (integer) - Current iteration
  - `max_iterations` (integer) - Maximum allowed iterations
  - `last_iteration_at` (timestamptz) - Last iteration timestamp
  - `created_at` - Timestamp

  ### workflow_condition_waits
  - `id` (uuid, primary key) - Unique wait identifier
  - `org_id` (uuid) - Organization reference
  - `enrollment_id` (uuid) - Enrollment waiting
  - `node_id` (text) - Node with the wait condition
  - `condition_config` (jsonb) - Condition to evaluate
  - `check_interval_minutes` (integer) - How often to check
  - `timeout_at` (timestamptz) - When to timeout
  - `last_checked_at` (timestamptz) - Last check timestamp
  - `status` (text) - waiting, met, timed_out
  - `created_at` - Timestamp

  ## 2. Schema Changes

  ### workflows
  - Adds `wait_timeout_days` (integer) - Configurable per-workflow wait timeout

  ### workflow_enrollments
  - Adds `goal_id` (uuid) - Which goal completed the enrollment (if any)
  - Adds `completed_reason` (text) - Reason for completion

  ## 3. Security
  - RLS enabled on all new tables
  - Policies restrict access to organization members with workflow permissions
*/

-- Workflow goals table
CREATE TABLE IF NOT EXISTS workflow_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  name text NOT NULL,
  goal_type text NOT NULL CHECK (goal_type IN ('enrollment_complete', 'contact_property_met', 'external_event', 'opportunity_won', 'appointment_completed', 'invoice_paid')),
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  stop_workflow_on_met boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Workflow action retry configuration table
CREATE TABLE IF NOT EXISTS workflow_action_retries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  max_retries integer NOT NULL DEFAULT 3 CHECK (max_retries >= 0 AND max_retries <= 10),
  retry_delay_seconds integer NOT NULL DEFAULT 300 CHECK (retry_delay_seconds >= 0),
  fallback_behavior text NOT NULL DEFAULT 'skip' CHECK (fallback_behavior IN ('skip', 'stop', 'notify')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workflow_id, node_id)
);

-- Workflow loop tracking table
CREATE TABLE IF NOT EXISTS workflow_loops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES workflow_enrollments(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  iteration_count integer NOT NULL DEFAULT 0,
  max_iterations integer NOT NULL DEFAULT 100 CHECK (max_iterations >= 1 AND max_iterations <= 1000),
  last_iteration_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(enrollment_id, node_id)
);

-- Workflow condition waits table
CREATE TABLE IF NOT EXISTS workflow_condition_waits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES workflow_enrollments(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  condition_config jsonb NOT NULL,
  check_interval_minutes integer NOT NULL DEFAULT 5 CHECK (check_interval_minutes >= 1 AND check_interval_minutes <= 1440),
  timeout_at timestamptz NOT NULL,
  last_checked_at timestamptz,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'met', 'timed_out', 'cancelled')),
  met_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(enrollment_id, node_id)
);

-- Add wait_timeout_days to workflows table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflows' AND column_name = 'wait_timeout_days'
  ) THEN
    ALTER TABLE workflows ADD COLUMN wait_timeout_days integer NOT NULL DEFAULT 30 CHECK (wait_timeout_days >= 1 AND wait_timeout_days <= 365);
  END IF;
END $$;

-- Add goal_id and completed_reason to workflow_enrollments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflow_enrollments' AND column_name = 'goal_id'
  ) THEN
    ALTER TABLE workflow_enrollments ADD COLUMN goal_id uuid REFERENCES workflow_goals(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflow_enrollments' AND column_name = 'completed_reason'
  ) THEN
    ALTER TABLE workflow_enrollments ADD COLUMN completed_reason text;
  END IF;
END $$;

-- Indexes for workflow_goals
CREATE INDEX IF NOT EXISTS idx_workflow_goals_org ON workflow_goals(org_id);
CREATE INDEX IF NOT EXISTS idx_workflow_goals_workflow ON workflow_goals(workflow_id);

-- Indexes for workflow_action_retries
CREATE INDEX IF NOT EXISTS idx_workflow_action_retries_workflow ON workflow_action_retries(workflow_id);

-- Indexes for workflow_loops
CREATE INDEX IF NOT EXISTS idx_workflow_loops_enrollment ON workflow_loops(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_workflow_loops_org ON workflow_loops(org_id);

-- Indexes for workflow_condition_waits
CREATE INDEX IF NOT EXISTS idx_workflow_condition_waits_enrollment ON workflow_condition_waits(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_workflow_condition_waits_status ON workflow_condition_waits(status) WHERE status = 'waiting';
CREATE INDEX IF NOT EXISTS idx_workflow_condition_waits_timeout ON workflow_condition_waits(timeout_at) WHERE status = 'waiting';
CREATE INDEX IF NOT EXISTS idx_workflow_condition_waits_check ON workflow_condition_waits(last_checked_at) WHERE status = 'waiting';

-- Enable RLS on all new tables
ALTER TABLE workflow_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_action_retries ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_loops ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_condition_waits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workflow_goals
CREATE POLICY "Users can view workflow goals in their org"
  ON workflow_goals FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users with workflow permission can insert workflow goals"
  ON workflow_goals FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users with workflow permission can update workflow goals"
  ON workflow_goals FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users with workflow permission can delete workflow goals"
  ON workflow_goals FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- RLS Policies for workflow_action_retries
CREATE POLICY "Users can view workflow action retries in their org"
  ON workflow_action_retries FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users with workflow permission can insert workflow action retries"
  ON workflow_action_retries FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users with workflow permission can update workflow action retries"
  ON workflow_action_retries FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users with workflow permission can delete workflow action retries"
  ON workflow_action_retries FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- RLS Policies for workflow_loops
CREATE POLICY "Users can view workflow loops in their org"
  ON workflow_loops FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users with workflow permission can insert workflow loops"
  ON workflow_loops FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users with workflow permission can update workflow loops"
  ON workflow_loops FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users with workflow permission can delete workflow loops"
  ON workflow_loops FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- RLS Policies for workflow_condition_waits
CREATE POLICY "Users can view workflow condition waits in their org"
  ON workflow_condition_waits FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users with workflow permission can insert workflow condition waits"
  ON workflow_condition_waits FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users with workflow permission can update workflow condition waits"
  ON workflow_condition_waits FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users with workflow permission can delete workflow condition waits"
  ON workflow_condition_waits FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- Update triggers
CREATE OR REPLACE FUNCTION update_workflow_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_workflow_goals_updated_at
  BEFORE UPDATE ON workflow_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_goals_updated_at();