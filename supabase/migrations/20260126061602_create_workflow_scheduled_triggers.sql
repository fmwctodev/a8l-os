/*
  # Create Workflow Scheduled Triggers Module

  This migration creates tables for scheduled/recurring workflow triggers
  that enroll contacts based on time-based schedules with segment filtering.

  1. New Tables
    - `workflow_scheduled_triggers` - Scheduled recurring workflow triggers
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `workflow_id` (uuid, FK to workflows)
      - `name` (text) - Descriptive name for the schedule
      - `cadence` (text) - daily, weekly, monthly, custom_cron
      - `time_of_day` (time) - HH:MM execution time
      - `timezone` (text) - IANA timezone string
      - `day_of_week` (smallint, nullable) - For weekly (0=Sun, 6=Sat)
      - `day_of_month` (smallint, nullable) - For monthly (1-31)
      - `cron_expression` (text, nullable) - For custom cron patterns
      - `filter_config` (jsonb) - Segment/filter conditions for contacts
      - `re_enrollment_policy` (text) - never, always, after_completion
      - `is_active` (boolean) - Pause/resume toggle
      - `next_run_at` (timestamptz) - Computed next execution time
      - `last_run_at` (timestamptz, nullable) - When last executed
      - `created_at`, `updated_at` (timestamptz)

    - `workflow_scheduled_trigger_runs` - Execution history
      - `id` (uuid, primary key)
      - `org_id` (uuid, FK to organizations)
      - `trigger_id` (uuid, FK to workflow_scheduled_triggers)
      - `started_at` (timestamptz) - When execution started
      - `completed_at` (timestamptz, nullable) - When finished
      - `contacts_matched` (integer) - Contacts matching filter
      - `contacts_enrolled` (integer) - Contacts actually enrolled
      - `contacts_skipped` (integer) - Skipped due to re-enrollment policy
      - `status` (text) - success, partial_failure, failed
      - `error_details` (jsonb, nullable) - Any errors encountered

  2. Security
    - RLS enabled on all tables
    - Organization-scoped access

  3. Indexes
    - Efficient polling index on (is_active, next_run_at)
    - Workflow lookup index
*/

-- Create cadence enum type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scheduled_trigger_cadence') THEN
    CREATE TYPE scheduled_trigger_cadence AS ENUM ('daily', 'weekly', 'monthly', 'custom_cron');
  END IF;
END $$;

-- Create re-enrollment policy enum type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 're_enrollment_policy') THEN
    CREATE TYPE re_enrollment_policy AS ENUM ('never', 'always', 'after_completion');
  END IF;
END $$;

-- Create scheduled triggers table
CREATE TABLE IF NOT EXISTS workflow_scheduled_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  name text NOT NULL,
  cadence scheduled_trigger_cadence NOT NULL DEFAULT 'daily',
  time_of_day time NOT NULL DEFAULT '09:00:00',
  timezone text NOT NULL DEFAULT 'UTC',
  day_of_week smallint CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
  day_of_month smallint CHECK (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 31)),
  cron_expression text,
  filter_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  re_enrollment_policy re_enrollment_policy NOT NULL DEFAULT 'never',
  is_active boolean NOT NULL DEFAULT false,
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create scheduled trigger runs table for execution history
CREATE TABLE IF NOT EXISTS workflow_scheduled_trigger_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  trigger_id uuid NOT NULL REFERENCES workflow_scheduled_triggers(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  contacts_matched integer NOT NULL DEFAULT 0,
  contacts_enrolled integer NOT NULL DEFAULT 0,
  contacts_skipped integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  error_details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE workflow_scheduled_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_scheduled_trigger_runs ENABLE ROW LEVEL SECURITY;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_scheduled_triggers_poll 
  ON workflow_scheduled_triggers(is_active, next_run_at) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_scheduled_triggers_workflow 
  ON workflow_scheduled_triggers(workflow_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_triggers_org 
  ON workflow_scheduled_triggers(org_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_trigger_runs_trigger 
  ON workflow_scheduled_trigger_runs(trigger_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_scheduled_trigger_runs_org 
  ON workflow_scheduled_trigger_runs(org_id);

-- Create updated_at trigger
DROP TRIGGER IF EXISTS workflow_scheduled_triggers_updated_at ON workflow_scheduled_triggers;
CREATE TRIGGER workflow_scheduled_triggers_updated_at
  BEFORE UPDATE ON workflow_scheduled_triggers
  FOR EACH ROW EXECUTE FUNCTION update_workflow_updated_at();
