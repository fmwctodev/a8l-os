/*
  # Fix LLM Model Catalog RLS Security Vulnerability

  This migration fixes a critical security vulnerability where the llm_model_catalog
  table had an overly permissive policy that allowed any authenticated user to
  access all records.

  1. Security Changes
    - Remove the overly permissive "Super admins can manage model catalog" policy
    - Replace with properly scoped policies using optimized helper functions:
      - Super admins can view ALL models (is_super_admin())
      - Super admins can insert models (is_super_admin() OR own org)
      - Super admins can update models (is_super_admin())
      - Super admins can delete models (is_super_admin())
      - Regular users can ONLY view enabled models (is_enabled = true)

  2. Impact
    - Before: Any authenticated user could read all model catalog entries
    - After: Regular users can only see enabled models; full access requires super admin

  3. Helper Functions Used
    - is_super_admin() - Returns true if current user has SuperAdmin role
    - get_auth_user_org_id() - Returns the organization_id for the current user
*/

-- Drop all existing policies on llm_model_catalog to start fresh
DROP POLICY IF EXISTS "Super admins can manage model catalog" ON llm_model_catalog;
DROP POLICY IF EXISTS "Super admins can view model catalog" ON llm_model_catalog;
DROP POLICY IF EXISTS "Super admins can view all models" ON llm_model_catalog;
DROP POLICY IF EXISTS "Super admins can insert model catalog" ON llm_model_catalog;
DROP POLICY IF EXISTS "Super admins can update model catalog" ON llm_model_catalog;
DROP POLICY IF EXISTS "Super admins can delete model catalog" ON llm_model_catalog;
DROP POLICY IF EXISTS "Users can view enabled models" ON llm_model_catalog;

-- Create properly secured policies using optimized helper functions

-- Super admins can view ALL models (enabled or disabled)
CREATE POLICY "Super admins can view all models"
  ON llm_model_catalog
  FOR SELECT
  TO authenticated
  USING (is_super_admin());

-- Super admins can insert new models, or users can insert for their own org
CREATE POLICY "Super admins can insert model catalog"
  ON llm_model_catalog
  FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin() OR (org_id = get_auth_user_org_id()));

-- Super admins can update any model
CREATE POLICY "Super admins can update model catalog"
  ON llm_model_catalog
  FOR UPDATE
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Super admins can delete any model
CREATE POLICY "Super admins can delete model catalog"
  ON llm_model_catalog
  FOR DELETE
  TO authenticated
  USING (is_super_admin());

-- Regular users can ONLY view models that are explicitly enabled
CREATE POLICY "Users can view enabled models"
  ON llm_model_catalog
  FOR SELECT
  TO authenticated
  USING (is_enabled = true);
