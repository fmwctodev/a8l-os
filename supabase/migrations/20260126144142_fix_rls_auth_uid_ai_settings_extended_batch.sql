/*
  # Fix RLS auth.uid() Performance - AI Settings Extended Batch
  
  This migration optimizes RLS policies for AI settings and related tables.
  
  ## Tables Fixed
  - ai_agent_settings_defaults (org_id)
  - ai_response_style_defaults (org_id)
  - ai_safety_prompts (org_id)
  - ai_usage_limits (org_id)
  - ai_usage_logs (org_id)
  - ai_voice_defaults (org_id)
  - ai_report_queries (organization_id)
  
  ## Changes
  - All auth.uid() calls wrapped in (select auth.uid())
  - Using get_auth_user_org_id() for org checks
*/

-- ============================================
-- ai_agent_settings_defaults (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view ai settings defaults in their org" ON ai_agent_settings_defaults;
DROP POLICY IF EXISTS "Admins can insert ai settings defaults" ON ai_agent_settings_defaults;
DROP POLICY IF EXISTS "Admins can update ai settings defaults" ON ai_agent_settings_defaults;

CREATE POLICY "Users can view ai settings defaults in their org"
  ON ai_agent_settings_defaults
  FOR SELECT
  TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can insert ai settings defaults"
  ON ai_agent_settings_defaults
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can update ai settings defaults"
  ON ai_agent_settings_defaults
  FOR UPDATE
  TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

-- ============================================
-- ai_response_style_defaults (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view org response style defaults" ON ai_response_style_defaults;
DROP POLICY IF EXISTS "Admins can insert org response style defaults" ON ai_response_style_defaults;
DROP POLICY IF EXISTS "Admins can update org response style defaults" ON ai_response_style_defaults;

CREATE POLICY "Users can view org response style defaults"
  ON ai_response_style_defaults
  FOR SELECT
  TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can insert org response style defaults"
  ON ai_response_style_defaults
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can update org response style defaults"
  ON ai_response_style_defaults
  FOR UPDATE
  TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

-- ============================================
-- ai_safety_prompts (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view org safety prompts" ON ai_safety_prompts;
DROP POLICY IF EXISTS "Admins can insert org safety prompts" ON ai_safety_prompts;
DROP POLICY IF EXISTS "Admins can update org safety prompts" ON ai_safety_prompts;

CREATE POLICY "Users can view org safety prompts"
  ON ai_safety_prompts
  FOR SELECT
  TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can insert org safety prompts"
  ON ai_safety_prompts
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can update org safety prompts"
  ON ai_safety_prompts
  FOR UPDATE
  TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

-- ============================================
-- ai_usage_limits (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view org usage limits" ON ai_usage_limits;
DROP POLICY IF EXISTS "Admins can insert org usage limits" ON ai_usage_limits;
DROP POLICY IF EXISTS "Admins can update org usage limits" ON ai_usage_limits;

CREATE POLICY "Users can view org usage limits"
  ON ai_usage_limits
  FOR SELECT
  TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can insert org usage limits"
  ON ai_usage_limits
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can update org usage limits"
  ON ai_usage_limits
  FOR UPDATE
  TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

-- ============================================
-- ai_usage_logs (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view org usage logs" ON ai_usage_logs;
DROP POLICY IF EXISTS "System can insert usage logs" ON ai_usage_logs;

CREATE POLICY "Users can view org usage logs"
  ON ai_usage_logs
  FOR SELECT
  TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "System can insert usage logs"
  ON ai_usage_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

-- ============================================
-- ai_voice_defaults (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view org voice defaults" ON ai_voice_defaults;
DROP POLICY IF EXISTS "Admins can insert org voice defaults" ON ai_voice_defaults;
DROP POLICY IF EXISTS "Admins can update org voice defaults" ON ai_voice_defaults;

CREATE POLICY "Users can view org voice defaults"
  ON ai_voice_defaults
  FOR SELECT
  TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can insert org voice defaults"
  ON ai_voice_defaults
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can update org voice defaults"
  ON ai_voice_defaults
  FOR UPDATE
  TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

-- ============================================
-- ai_report_queries (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view own AI queries" ON ai_report_queries;
DROP POLICY IF EXISTS "Users can create own AI queries" ON ai_report_queries;
DROP POLICY IF EXISTS "Users can update own AI queries" ON ai_report_queries;
DROP POLICY IF EXISTS "Users can delete own AI queries" ON ai_report_queries;

CREATE POLICY "Users can view own AI queries"
  ON ai_report_queries
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can create own AI queries"
  ON ai_report_queries
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own AI queries"
  ON ai_report_queries
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own AI queries"
  ON ai_report_queries
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));
