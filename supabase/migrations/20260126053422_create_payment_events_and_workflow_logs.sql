/*
  # Create Payment Events and Workflow Logs Tables for Analytics
  
  1. New Tables
    - `payment_events` - Tracks invoice lifecycle events for payment analytics
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key)
      - `invoice_id` (uuid, foreign key to invoices)
      - `event_type` (text) - created, sent, viewed, paid, overdue, voided, refunded
      - `amount` (numeric) - amount associated with event
      - `currency` (text)
      - `occurred_at` (timestamptz) - when the event happened
      - `metadata` (jsonb) - additional event details
      - `created_at` (timestamptz)
    
    - `workflow_logs` - Tracks workflow execution for automation analytics
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key)
      - `enrollment_id` (uuid, foreign key to workflow_enrollments)
      - `workflow_id` (uuid, foreign key to workflows)
      - `step_id` (text) - identifier of the step executed
      - `step_type` (text) - email, sms, delay, condition, action, etc.
      - `status` (text) - started, completed, failed, skipped
      - `error_message` (text) - error details if failed
      - `executed_at` (timestamptz)
      - `duration_ms` (integer) - execution time in milliseconds
      - `metadata` (jsonb)
      - `created_at` (timestamptz)
  
  2. Indexes
    - For time-based analytics queries
    - For workflow performance analysis
    - For payment lifecycle tracking
  
  3. Security
    - Enable RLS with organization-scoped policies
*/

-- Create payment_events table
CREATE TABLE IF NOT EXISTS payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  amount numeric(12, 2),
  currency text DEFAULT 'USD',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT payment_event_type_check CHECK (
    event_type IN ('created', 'sent', 'viewed', 'paid', 'overdue', 'voided', 'refunded', 'partial_payment', 'reminder_sent')
  )
);

-- Create indexes for payment_events
CREATE INDEX IF NOT EXISTS idx_payment_events_org_occurred 
  ON payment_events(organization_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_events_invoice 
  ON payment_events(invoice_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_events_type 
  ON payment_events(organization_id, event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_events_amount 
  ON payment_events(organization_id, amount DESC) 
  WHERE event_type = 'paid';

-- Enable RLS for payment_events
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_events
CREATE POLICY "Users can view their organization's payment events"
  ON payment_events FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert payment events for their organization"
  ON payment_events FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Create workflow_logs table
CREATE TABLE IF NOT EXISTS workflow_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES workflow_enrollments(id) ON DELETE SET NULL,
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  step_id text,
  step_type text NOT NULL,
  status text NOT NULL DEFAULT 'started',
  error_message text,
  executed_at timestamptz NOT NULL DEFAULT now(),
  duration_ms integer,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT workflow_log_status_check CHECK (
    status IN ('started', 'completed', 'failed', 'skipped', 'cancelled')
  )
);

-- Create indexes for workflow_logs
CREATE INDEX IF NOT EXISTS idx_workflow_logs_org_executed 
  ON workflow_logs(organization_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_logs_workflow 
  ON workflow_logs(workflow_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_logs_enrollment 
  ON workflow_logs(enrollment_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_logs_status 
  ON workflow_logs(organization_id, status, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_logs_step_type 
  ON workflow_logs(organization_id, step_type, executed_at DESC);

-- Enable RLS for workflow_logs
ALTER TABLE workflow_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workflow_logs
CREATE POLICY "Users can view their organization's workflow logs"
  ON workflow_logs FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert workflow logs for their organization"
  ON workflow_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );