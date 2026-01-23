/*
  # Create Activity Log Table

  1. New Tables
    - `activity_log`
      - `id` (uuid, primary key) - unique identifier
      - `organization_id` (uuid, foreign key) - organization scope
      - `user_id` (uuid, nullable) - actor who performed action
      - `event_type` (text) - type of event (e.g., contact_created, opportunity_stage_changed)
      - `entity_type` (text) - type of entity (contact, conversation, opportunity, etc.)
      - `entity_id` (uuid) - ID of the affected entity
      - `contact_id` (uuid, nullable) - linked contact for filtering
      - `summary` (text) - human-readable event description
      - `payload` (jsonb) - additional event metadata
      - `created_at` (timestamptz) - when the event occurred

  2. Indexes
    - organization_id for org-scoped queries
    - user_id for user activity queries
    - entity_type for filtering by entity
    - contact_id for contact-related activity
    - created_at for time-based queries
    - Composite index for common dashboard query pattern

  3. Security
    - Enable RLS on activity_log table
    - Policy for users to read their organization's activity
    - Policy for users to insert activity in their organization
*/

CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  summary text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_log_organization_id ON activity_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity_type ON activity_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_contact_id ON activity_log(contact_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_dashboard ON activity_log(organization_id, created_at DESC);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their organization activity"
  ON activity_log
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert activity in their organization"
  ON activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );