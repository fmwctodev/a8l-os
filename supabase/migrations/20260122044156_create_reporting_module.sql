/*
  # Create Reporting Module Tables

  This migration creates the core tables for the custom report builder feature.

  1. New Tables
    - `reports` - Saved report configurations with visualization settings
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `name` (text) - Report display name
      - `description` (text) - Optional description
      - `data_source` (text) - Source table: contacts, conversations, appointments, forms, surveys, workflows
      - `config` (jsonb) - Full report configuration including dimensions, metrics, filters, sorting
      - `visualization_type` (text) - table, bar, line, pie
      - `visibility` (text) - private, department, organization
      - `department_id` (uuid, optional) - For department-scoped visibility
      - `created_by` (uuid) - User who created the report
      - `created_at`, `updated_at` timestamps
    
    - `report_runs` - Execution history for each report run
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key)
      - `report_id` (uuid, foreign key to reports)
      - `triggered_by` (text) - user or schedule
      - `triggered_by_user_id` (uuid, optional) - User who triggered if manual
      - `status` (text) - running, success, failed
      - `row_count` (integer) - Number of rows returned
      - `started_at`, `finished_at` timestamps
      - `error` (text) - Error message if failed
    
    - `report_exports` - CSV export jobs with 14-day expiration
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key)
      - `report_run_id` (uuid, foreign key to report_runs)
      - `status` (text) - queued, running, complete, failed
      - `file_path` (text) - Storage path to CSV file
      - `file_size` (bigint) - File size in bytes
      - `error` (text) - Error message if failed
      - `created_at`, `completed_at` timestamps
      - `expires_at` (timestamptz) - Auto-set to 14 days from creation
    
    - `report_schedules` - Scheduled report delivery configuration
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key)
      - `report_id` (uuid, foreign key to reports)
      - `cadence` (text) - daily, weekly, monthly
      - `day_of_week` (integer) - 0-6 for weekly schedules
      - `day_of_month` (integer) - 1-31 for monthly schedules
      - `time_of_day` (time) - Time to run
      - `timezone` (text) - IANA timezone
      - `recipients` (jsonb) - Array of user_ids and external emails
      - `enabled` (boolean) - Whether schedule is active
      - `created_by` (uuid) - User who created the schedule
      - `last_run_at`, `next_run_at` timestamps
    
    - `report_email_queue` - SendGrid email delivery tracking
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key)
      - `schedule_id` (uuid, foreign key to report_schedules)
      - `report_run_id` (uuid, foreign key to report_runs)
      - `recipient_email` (text) - Email address
      - `status` (text) - pending, sent, failed
      - `sendgrid_message_id` (text) - SendGrid tracking ID
      - `error` (text) - Error if failed
      - `created_at`, `sent_at` timestamps

  2. Indexes
    - reports(organization_id, visibility)
    - report_runs(report_id, started_at)
    - report_exports(status, expires_at)
    - report_schedules(report_id, enabled, next_run_at)
    - report_email_queue(status, created_at)

  3. Security
    - RLS enabled on all tables
    - Policies added in separate migration
*/

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  data_source text NOT NULL CHECK (data_source IN ('contacts', 'conversations', 'appointments', 'forms', 'surveys', 'workflows')),
  config jsonb NOT NULL DEFAULT '{}',
  visualization_type text NOT NULL DEFAULT 'table' CHECK (visualization_type IN ('table', 'bar', 'line', 'pie')),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'department', 'organization')),
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create report_runs table
CREATE TABLE IF NOT EXISTS report_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  triggered_by text NOT NULL DEFAULT 'user' CHECK (triggered_by IN ('user', 'schedule')),
  triggered_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
  row_count integer,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  error text
);

-- Create report_exports table
CREATE TABLE IF NOT EXISTS report_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_run_id uuid NOT NULL REFERENCES report_runs(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'complete', 'failed')),
  file_path text,
  file_size bigint,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days')
);

-- Create report_schedules table
CREATE TABLE IF NOT EXISTS report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  cadence text NOT NULL CHECK (cadence IN ('daily', 'weekly', 'monthly')),
  day_of_week integer CHECK (day_of_week >= 0 AND day_of_week <= 6),
  day_of_month integer CHECK (day_of_month >= 1 AND day_of_month <= 31),
  time_of_day time NOT NULL DEFAULT '09:00:00',
  timezone text NOT NULL DEFAULT 'America/New_York',
  recipients jsonb NOT NULL DEFAULT '{"user_ids": [], "emails": []}',
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create report_email_queue table
CREATE TABLE IF NOT EXISTS report_email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  schedule_id uuid NOT NULL REFERENCES report_schedules(id) ON DELETE CASCADE,
  report_run_id uuid NOT NULL REFERENCES report_runs(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sendgrid_message_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reports_org_visibility ON reports(organization_id, visibility);
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON reports(created_by);
CREATE INDEX IF NOT EXISTS idx_reports_data_source ON reports(organization_id, data_source);

CREATE INDEX IF NOT EXISTS idx_report_runs_report ON report_runs(report_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_runs_status ON report_runs(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_report_exports_status ON report_exports(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_report_exports_run ON report_exports(report_run_id);

CREATE INDEX IF NOT EXISTS idx_report_schedules_report ON report_schedules(report_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_next_run ON report_schedules(enabled, next_run_at) WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_report_email_queue_status ON report_email_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_report_email_queue_schedule ON report_email_queue(schedule_id);

-- Enable RLS on all tables
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_email_queue ENABLE ROW LEVEL SECURITY;

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_reports_updated_at ON reports;
CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_report_schedules_updated_at ON report_schedules;
CREATE TRIGGER update_report_schedules_updated_at
  BEFORE UPDATE ON report_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();