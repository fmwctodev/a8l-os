/*
  # Create Social Account Groups Table

  1. New Tables
    - `social_account_groups`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `name` (text, group name)
      - `description` (text, optional description)
      - `account_ids` (uuid array, references social_accounts)
      - `created_by` (uuid, foreign key to users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `social_account_groups` table
    - Add policies for authenticated users within same organization

  3. Indexes
    - organization_id for efficient org-scoped queries
    - created_by for user's groups lookup
*/

CREATE TABLE IF NOT EXISTS social_account_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  account_ids uuid[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_account_groups_org_id ON social_account_groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_social_account_groups_created_by ON social_account_groups(created_by);

ALTER TABLE social_account_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view account groups in their organization"
  ON social_account_groups
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create account groups in their organization"
  ON social_account_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update account groups in their organization"
  ON social_account_groups
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete account groups in their organization"
  ON social_account_groups
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION update_social_account_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_social_account_groups_updated_at
  BEFORE UPDATE ON social_account_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_social_account_groups_updated_at();
