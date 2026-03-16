/*
  # Create Trigger Evaluation Logs Table

  1. New Tables
    - `trigger_evaluation_logs`
      - `id` (uuid, primary key) - unique log entry ID
      - `org_id` (uuid, FK to organizations) - organization that owns the workflow
      - `workflow_id` (uuid) - the workflow being evaluated
      - `trigger_id` (text) - the trigger node ID within the workflow
      - `trigger_type` (text) - the type of trigger (e.g. contact_changed, event_custom)
      - `entity_type` (text) - type of entity that fired the event
      - `entity_id` (text) - ID of the entity that fired the event
      - `matched` (boolean) - whether the trigger config matched the event payload
      - `evaluation_time_ms` (integer) - how long the evaluation took in milliseconds
      - `payload_summary` (jsonb) - truncated summary of the event payload
      - `config_snapshot` (jsonb) - snapshot of the trigger config at evaluation time
      - `created_at` (timestamptz) - when the evaluation occurred

  2. Indexes
    - Composite index on org_id + workflow_id for filtered queries
    - Index on trigger_type for analytics grouping
    - Index on created_at for time-range queries

  3. Security
    - RLS enabled
    - Authenticated users can read logs for their own organization
    - Insert is allowed for authenticated users (logs created by the system)

  4. Notes
    - This table is append-only for analytics/debugging
    - Old records can be purged periodically via cron
*/

CREATE TABLE IF NOT EXISTS trigger_evaluation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  workflow_id uuid NOT NULL,
  trigger_id text NOT NULL DEFAULT '',
  trigger_type text NOT NULL,
  entity_type text NOT NULL DEFAULT '',
  entity_id text NOT NULL DEFAULT '',
  matched boolean NOT NULL DEFAULT false,
  evaluation_time_ms integer NOT NULL DEFAULT 0,
  payload_summary jsonb,
  config_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trigger_eval_logs_org_workflow
  ON trigger_evaluation_logs(org_id, workflow_id);

CREATE INDEX IF NOT EXISTS idx_trigger_eval_logs_trigger_type
  ON trigger_evaluation_logs(trigger_type);

CREATE INDEX IF NOT EXISTS idx_trigger_eval_logs_created_at
  ON trigger_evaluation_logs(created_at);

ALTER TABLE trigger_evaluation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read trigger eval logs for own org"
  ON trigger_evaluation_logs
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert trigger eval logs for own org"
  ON trigger_evaluation_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );
