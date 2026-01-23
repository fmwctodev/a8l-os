/*
  # RLS Policies for API Keys & Secrets Management
  
  1. Overview
    - Secure access control for secrets management tables
    - Users can only access secrets within their organization
    - Only admins can create, update, or delete secrets
    - Usage logs are append-only for users, readable by admins
  
  2. Policies Created
    - secret_categories: CRUD for org members with admin role
    - org_secrets: Restricted access - metadata visible, values via Edge Functions only
    - secret_dynamic_refs: Linked to secret access
    - secret_usage_log: Append for system, read for admins
  
  3. Security Notes
    - encrypted_value column should only be accessed via Edge Functions
    - RLS ensures org isolation
    - Admin-only write access for sensitive operations
*/

-- =============================================
-- SECRET CATEGORIES POLICIES
-- =============================================

-- Select: Users can view categories in their organization
CREATE POLICY "Users can view secret categories in their org"
  ON secret_categories
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Insert: Only admins can create categories
CREATE POLICY "Admins can create secret categories"
  ON secret_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT u.organization_id FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name IN ('SuperAdmin', 'Admin')
    )
  );

-- Update: Only admins can update categories
CREATE POLICY "Admins can update secret categories"
  ON secret_categories
  FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT u.organization_id FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name IN ('SuperAdmin', 'Admin')
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT u.organization_id FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name IN ('SuperAdmin', 'Admin')
    )
  );

-- Delete: Only admins can delete categories
CREATE POLICY "Admins can delete secret categories"
  ON secret_categories
  FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT u.organization_id FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name IN ('SuperAdmin', 'Admin')
    )
  );

-- =============================================
-- ORG SECRETS POLICIES
-- =============================================

-- Select: Users can view secret metadata (NOT the encrypted value) in their org
CREATE POLICY "Users can view secret metadata in their org"
  ON org_secrets
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Insert: Only admins can create secrets
CREATE POLICY "Admins can create secrets"
  ON org_secrets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT u.organization_id FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name IN ('SuperAdmin', 'Admin')
    )
  );

-- Update: Only admins can update secrets
CREATE POLICY "Admins can update secrets"
  ON org_secrets
  FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT u.organization_id FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name IN ('SuperAdmin', 'Admin')
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT u.organization_id FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name IN ('SuperAdmin', 'Admin')
    )
  );

-- Delete: Only admins can delete secrets (and only non-system secrets)
CREATE POLICY "Admins can delete non-system secrets"
  ON org_secrets
  FOR DELETE
  TO authenticated
  USING (
    is_system = false
    AND org_id IN (
      SELECT u.organization_id FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name IN ('SuperAdmin', 'Admin')
    )
  );

-- =============================================
-- SECRET DYNAMIC REFS POLICIES
-- =============================================

-- Select: Users can view dynamic refs for secrets they can access
CREATE POLICY "Users can view dynamic refs for accessible secrets"
  ON secret_dynamic_refs
  FOR SELECT
  TO authenticated
  USING (
    secret_id IN (
      SELECT s.id FROM org_secrets s
      JOIN users u ON s.org_id = u.organization_id
      WHERE u.id = auth.uid()
    )
  );

-- Insert: Only admins can create dynamic refs
CREATE POLICY "Admins can create dynamic refs"
  ON secret_dynamic_refs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    secret_id IN (
      SELECT s.id FROM org_secrets s
      JOIN users u ON s.org_id = u.organization_id
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name IN ('SuperAdmin', 'Admin')
    )
  );

-- Update: Only admins can update dynamic refs
CREATE POLICY "Admins can update dynamic refs"
  ON secret_dynamic_refs
  FOR UPDATE
  TO authenticated
  USING (
    secret_id IN (
      SELECT s.id FROM org_secrets s
      JOIN users u ON s.org_id = u.organization_id
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name IN ('SuperAdmin', 'Admin')
    )
  )
  WITH CHECK (
    secret_id IN (
      SELECT s.id FROM org_secrets s
      JOIN users u ON s.org_id = u.organization_id
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name IN ('SuperAdmin', 'Admin')
    )
  );

-- Delete: Only admins can delete dynamic refs
CREATE POLICY "Admins can delete dynamic refs"
  ON secret_dynamic_refs
  FOR DELETE
  TO authenticated
  USING (
    secret_id IN (
      SELECT s.id FROM org_secrets s
      JOIN users u ON s.org_id = u.organization_id
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name IN ('SuperAdmin', 'Admin')
    )
  );

-- =============================================
-- SECRET USAGE LOG POLICIES
-- =============================================

-- Select: Admins can view usage logs for their org
CREATE POLICY "Admins can view secret usage logs"
  ON secret_usage_log
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT u.organization_id FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name IN ('SuperAdmin', 'Admin')
    )
  );

-- Insert: Authenticated users and service role can insert logs
CREATE POLICY "System can insert usage logs"
  ON secret_usage_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );