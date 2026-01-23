/*
  # Add Lost Reasons and Stage Aging Threshold

  This migration adds organization-wide lost reasons for tracking why opportunities
  are marked as lost, and per-stage aging thresholds for identifying stale deals.

  ## 1. New Tables

  ### lost_reasons
  - `id` (uuid, primary key) - Unique identifier
  - `org_id` (uuid) - Organization that owns this reason
  - `name` (text) - Display name for the lost reason
  - `sort_order` (integer) - Display order in dropdowns
  - `is_active` (boolean) - Whether reason is available for selection
  - `created_at`, `updated_at` - Timestamps

  ## 2. Schema Changes

  ### pipeline_stages
  - Adds `aging_threshold_days` (integer, nullable) - Days after which opportunity is considered stale

  ### opportunities
  - Adds `lost_reason_id` (uuid, nullable) - Reference to lost_reasons table
  - Adds `stage_changed_at` (timestamptz, nullable) - Tracks when opportunity entered current stage

  ## 3. Security
  - RLS enabled on lost_reasons
  - Policies for authenticated users to read org lost reasons
  - Admin/SuperAdmin policies for management

  ## 4. Seed Data
  - Default lost reasons seeded for organizations
*/

-- Lost reasons table (organization-wide)
CREATE TABLE IF NOT EXISTS lost_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, name)
);

-- Add aging_threshold_days to pipeline_stages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_stages' AND column_name = 'aging_threshold_days'
  ) THEN
    ALTER TABLE pipeline_stages ADD COLUMN aging_threshold_days integer;
  END IF;
END $$;

-- Add lost_reason_id to opportunities (reference to lost_reasons table)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'opportunities' AND column_name = 'lost_reason_id'
  ) THEN
    ALTER TABLE opportunities ADD COLUMN lost_reason_id uuid REFERENCES lost_reasons(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add stage_changed_at to opportunities for tracking time in current stage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'opportunities' AND column_name = 'stage_changed_at'
  ) THEN
    ALTER TABLE opportunities ADD COLUMN stage_changed_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Indexes for lost_reasons
CREATE INDEX IF NOT EXISTS idx_lost_reasons_org ON lost_reasons(org_id);
CREATE INDEX IF NOT EXISTS idx_lost_reasons_org_active ON lost_reasons(org_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_lost_reasons_sort ON lost_reasons(org_id, sort_order);

-- Index for opportunities lost_reason_id
CREATE INDEX IF NOT EXISTS idx_opportunities_lost_reason ON opportunities(lost_reason_id) WHERE lost_reason_id IS NOT NULL;

-- Index for stage_changed_at for aging queries
CREATE INDEX IF NOT EXISTS idx_opportunities_stage_changed ON opportunities(stage_id, stage_changed_at);

-- Enable RLS on lost_reasons
ALTER TABLE lost_reasons ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lost_reasons

-- Authenticated users can view active lost reasons in their org
CREATE POLICY "Users can view active lost reasons"
  ON lost_reasons
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Admins and SuperAdmins can insert lost reasons
CREATE POLICY "Admins can create lost reasons"
  ON lost_reasons
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT u.organization_id FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name IN ('SuperAdmin', 'Admin')
    )
  );

-- Admins and SuperAdmins can update lost reasons
CREATE POLICY "Admins can update lost reasons"
  ON lost_reasons
  FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT u.organization_id FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name IN ('SuperAdmin', 'Admin')
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT u.organization_id FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name IN ('SuperAdmin', 'Admin')
    )
  );

-- Admins and SuperAdmins can delete lost reasons
CREATE POLICY "Admins can delete lost reasons"
  ON lost_reasons
  FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT u.organization_id FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name IN ('SuperAdmin', 'Admin')
    )
  );

-- Update trigger for lost_reasons updated_at
CREATE TRIGGER set_lost_reasons_updated_at
  BEFORE UPDATE ON lost_reasons
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunities_updated_at();

-- Trigger to update stage_changed_at when stage_id changes
CREATE OR REPLACE FUNCTION update_opportunity_stage_changed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    NEW.stage_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_opportunity_stage_changed_at ON opportunities;
CREATE TRIGGER set_opportunity_stage_changed_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunity_stage_changed_at();

-- Seed default lost reasons for existing organizations
INSERT INTO lost_reasons (org_id, name, sort_order, is_active)
SELECT 
  o.id,
  reason.name,
  reason.sort_order,
  true
FROM organizations o
CROSS JOIN (
  VALUES 
    ('Budget constraints', 0),
    ('Chose competitor', 1),
    ('No response', 2),
    ('Timing not right', 3),
    ('Requirements changed', 4),
    ('Other', 5)
) AS reason(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM lost_reasons lr 
  WHERE lr.org_id = o.id AND lr.name = reason.name
);
