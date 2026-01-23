/*
  # Create Workflows/Automations Module

  This migration creates the core tables for the workflow automation system.

  1. New Tables
    - `workflows` - Main workflow definitions with draft and published states
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `name` (text) - User-friendly workflow name
      - `description` (text, nullable) - Optional description
      - `status` (text) - draft, published, or archived
      - `draft_definition` (jsonb) - Current editable node graph
      - `published_definition` (jsonb, nullable) - Immutable published version
      - `published_at` (timestamptz, nullable) - When last published
      - `created_by_user_id` (uuid, FK to users)
      - `created_at`, `updated_at` (timestamptz)

    - `workflow_versions` - Immutable snapshots of published workflows
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `workflow_id` (uuid, FK to workflows)
      - `version_number` (integer) - Auto-incrementing per workflow
      - `definition` (jsonb) - The full node graph at this version
      - `created_by_user_id` (uuid, FK to users)
      - `created_at` (timestamptz)

    - `workflow_triggers` - Defines what events start a workflow
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `workflow_id` (uuid, FK to workflows)
      - `trigger_type` (text) - Event type like contact_created, message_received
      - `trigger_config` (jsonb) - Conditions/filters for this trigger
      - `is_active` (boolean) - Whether trigger is enabled
      - `created_at`, `updated_at` (timestamptz)

    - `workflow_enrollments` - Tracks contacts going through workflows
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `workflow_id` (uuid, FK to workflows)
      - `version_id` (uuid, FK to workflow_versions)
      - `contact_id` (uuid, FK to contacts)
      - `status` (text) - active, completed, stopped, errored
      - `current_node_id` (text, nullable) - Which node contact is at
      - `context_data` (jsonb) - Runtime data accumulated during execution
      - `started_at`, `updated_at`, `completed_at` (timestamptz)
      - `stopped_reason` (text, nullable) - Why enrollment was stopped

    - `workflow_jobs` - Queue for scheduled workflow actions
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `enrollment_id` (uuid, FK to workflow_enrollments)
      - `node_id` (text) - Which node this job executes
      - `run_at` (timestamptz) - When to execute (for delays)
      - `status` (text) - pending, running, done, failed
      - `attempts` (integer) - Number of execution attempts
      - `last_error` (text, nullable) - Error message if failed
      - `execution_key` (text) - For idempotency
      - `created_at`, `updated_at` (timestamptz)

    - `workflow_execution_logs` - Detailed audit trail of executions
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `enrollment_id` (uuid, FK to workflow_enrollments)
      - `node_id` (text) - Which node was executed
      - `event_type` (text) - node_started, node_completed, node_failed, action_sent
      - `payload` (jsonb) - Execution details
      - `duration_ms` (integer, nullable) - How long execution took
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all tables (policies in separate migration)
    - All tables scoped to organization via org_id

  3. Indexes
    - workflow_jobs(run_at, status) for efficient queue polling
    - workflow_enrollments(contact_id, workflow_id, status) for duplicate checking
    - workflow_triggers(trigger_type, is_active) for event matching
*/

-- Create workflow status enum type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_status') THEN
    CREATE TYPE workflow_status AS ENUM ('draft', 'published', 'archived');
  END IF;
END $$;

-- Create enrollment status enum type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_status') THEN
    CREATE TYPE enrollment_status AS ENUM ('active', 'completed', 'stopped', 'errored');
  END IF;
END $$;

-- Create job status enum type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_job_status') THEN
    CREATE TYPE workflow_job_status AS ENUM ('pending', 'running', 'done', 'failed');
  END IF;
END $$;

-- Create trigger type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_trigger_type') THEN
    CREATE TYPE workflow_trigger_type AS ENUM (
      'contact_created',
      'contact_updated',
      'contact_tag_added',
      'contact_tag_removed',
      'contact_owner_changed',
      'contact_department_changed',
      'conversation_message_received',
      'conversation_status_changed',
      'conversation_assigned',
      'appointment_booked',
      'appointment_rescheduled',
      'appointment_canceled'
    );
  END IF;
END $$;

-- Main workflows table
CREATE TABLE IF NOT EXISTS workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status workflow_status NOT NULL DEFAULT 'draft',
  draft_definition jsonb NOT NULL DEFAULT '{"nodes": [], "edges": [], "viewport": {"x": 0, "y": 0, "zoom": 1}}'::jsonb,
  published_definition jsonb,
  published_at timestamptz,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Workflow versions for immutable snapshots
CREATE TABLE IF NOT EXISTS workflow_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  definition jsonb NOT NULL,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(workflow_id, version_number)
);

-- Workflow triggers
CREATE TABLE IF NOT EXISTS workflow_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  trigger_type workflow_trigger_type NOT NULL,
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Workflow enrollments
CREATE TABLE IF NOT EXISTS workflow_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES workflow_versions(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status enrollment_status NOT NULL DEFAULT 'active',
  current_node_id text,
  context_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  stopped_reason text
);

-- Workflow jobs queue
CREATE TABLE IF NOT EXISTS workflow_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES workflow_enrollments(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  run_at timestamptz NOT NULL DEFAULT now(),
  status workflow_job_status NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  execution_key text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Workflow execution logs
CREATE TABLE IF NOT EXISTS workflow_execution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES workflow_enrollments(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_ms integer,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_execution_logs ENABLE ROW LEVEL SECURITY;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_workflows_org_status ON workflows(org_id, status);
CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow ON workflow_versions(workflow_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_triggers_type_active ON workflow_triggers(trigger_type, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_workflow_triggers_workflow ON workflow_triggers(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_enrollments_contact ON workflow_enrollments(contact_id, workflow_id, status);
CREATE INDEX IF NOT EXISTS idx_workflow_enrollments_workflow_status ON workflow_enrollments(workflow_id, status);
CREATE INDEX IF NOT EXISTS idx_workflow_jobs_queue ON workflow_jobs(run_at, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_workflow_jobs_enrollment ON workflow_jobs(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_enrollment ON workflow_execution_logs(enrollment_id, created_at DESC);

-- Create trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION update_workflow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS workflows_updated_at ON workflows;
CREATE TRIGGER workflows_updated_at
  BEFORE UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION update_workflow_updated_at();

DROP TRIGGER IF EXISTS workflow_triggers_updated_at ON workflow_triggers;
CREATE TRIGGER workflow_triggers_updated_at
  BEFORE UPDATE ON workflow_triggers
  FOR EACH ROW EXECUTE FUNCTION update_workflow_updated_at();

DROP TRIGGER IF EXISTS workflow_enrollments_updated_at ON workflow_enrollments;
CREATE TRIGGER workflow_enrollments_updated_at
  BEFORE UPDATE ON workflow_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_workflow_updated_at();

DROP TRIGGER IF EXISTS workflow_jobs_updated_at ON workflow_jobs;
CREATE TRIGGER workflow_jobs_updated_at
  BEFORE UPDATE ON workflow_jobs
  FOR EACH ROW EXECUTE FUNCTION update_workflow_updated_at();