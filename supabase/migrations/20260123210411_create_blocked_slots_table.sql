/*
  # Create Blocked Slots Table

  1. New Tables
    - `blocked_slots`
      - `id` (uuid, primary key)
      - `org_id` (uuid, foreign key to organizations)
      - `calendar_id` (uuid, foreign key to calendars)
      - `user_id` (uuid, nullable, foreign key to users - for user-specific blocks)
      - `title` (text, e.g., "Lunch Break", "Out of Office")
      - `start_at_utc` (timestamptz)
      - `end_at_utc` (timestamptz)
      - `all_day` (boolean, default false)
      - `recurring` (boolean, default false)
      - `recurrence_rule` (text, nullable - for recurring blocks like RRULE)
      - `created_by` (uuid, foreign key to users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `blocked_slots` table
    - Add policies for organization-based access control

  3. Indexes
    - Index on calendar_id and date range for query performance
*/

CREATE TABLE IF NOT EXISTS blocked_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  calendar_id uuid NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Blocked',
  start_at_utc timestamptz NOT NULL,
  end_at_utc timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  recurring boolean NOT NULL DEFAULT false,
  recurrence_rule text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_blocked_slots_calendar_id ON blocked_slots(calendar_id);
CREATE INDEX IF NOT EXISTS idx_blocked_slots_org_id ON blocked_slots(org_id);
CREATE INDEX IF NOT EXISTS idx_blocked_slots_date_range ON blocked_slots(calendar_id, start_at_utc, end_at_utc);

CREATE POLICY "Users can view blocked slots in their organization"
  ON blocked_slots
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users with calendars.manage can create blocked slots"
  ON blocked_slots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = auth.uid() AND p.key = 'calendars.manage'
    )
  );

CREATE POLICY "Users with calendars.manage can update blocked slots"
  ON blocked_slots
  FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = auth.uid() AND p.key = 'calendars.manage'
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = auth.uid() AND p.key = 'calendars.manage'
    )
  );

CREATE POLICY "Users with calendars.manage can delete blocked slots"
  ON blocked_slots
  FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = auth.uid() AND p.key = 'calendars.manage'
    )
  );

CREATE OR REPLACE FUNCTION update_blocked_slots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blocked_slots_updated_at
  BEFORE UPDATE ON blocked_slots
  FOR EACH ROW
  EXECUTE FUNCTION update_blocked_slots_updated_at();
