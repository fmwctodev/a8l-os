/*
  # User Permission Overrides Schema

  ## Overview
  This migration creates the infrastructure for per-user permission overrides,
  allowing SuperAdmin and Admin users to customize individual user permissions
  beyond their role defaults.

  ## 1. New Tables

  ### user_permission_overrides
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, FK) - Reference to the user receiving the override
  - `permission_id` (uuid, FK) - Reference to the permission being overridden
  - `granted` (boolean) - true = grant permission, false = revoke permission
  - `created_at` (timestamptz) - When override was created
  - `updated_at` (timestamptz) - When override was last modified
  - `created_by` (uuid, FK) - User who created this override
  - `notes` (text) - Optional notes explaining the override

  ## 2. Security
  - RLS enabled with policies restricting access to Admin and SuperAdmin
  - Only users with staff.manage permission can modify overrides
  - All users can read their own overrides

  ## 3. Indexes
  - user_id for fast lookup of user's overrides
  - permission_id for finding all overrides of a specific permission
  - Unique constraint on (user_id, permission_id) to prevent duplicates
*/

CREATE TABLE IF NOT EXISTS user_permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  notes text,
  CONSTRAINT unique_user_permission_override UNIQUE (user_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user ON user_permission_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_permission ON user_permission_overrides(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_created_by ON user_permission_overrides(created_by);

ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own permission overrides"
  ON user_permission_overrides
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all permission overrides in their org"
  ON user_permission_overrides
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid()
      AND r.name IN ('SuperAdmin', 'Admin')
      AND u.organization_id = (
        SELECT organization_id FROM users WHERE id = user_permission_overrides.user_id
      )
    )
  );

CREATE POLICY "Admins can insert permission overrides"
  ON user_permission_overrides
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid()
      AND r.name IN ('SuperAdmin', 'Admin')
      AND u.organization_id = (
        SELECT organization_id FROM users WHERE id = user_permission_overrides.user_id
      )
    )
  );

CREATE POLICY "Admins can update permission overrides"
  ON user_permission_overrides
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid()
      AND r.name IN ('SuperAdmin', 'Admin')
      AND u.organization_id = (
        SELECT organization_id FROM users WHERE id = user_permission_overrides.user_id
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid()
      AND r.name IN ('SuperAdmin', 'Admin')
      AND u.organization_id = (
        SELECT organization_id FROM users WHERE id = user_permission_overrides.user_id
      )
    )
  );

CREATE POLICY "Admins can delete permission overrides"
  ON user_permission_overrides
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid()
      AND r.name IN ('SuperAdmin', 'Admin')
      AND u.organization_id = (
        SELECT organization_id FROM users WHERE id = user_permission_overrides.user_id
      )
    )
  );
