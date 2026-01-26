/*
  # Fix RLS auth.uid() Performance - Activity & Brands Batch
  
  This migration optimizes RLS policies for activity log and brand-related tables.
  
  ## Tables Fixed
  - activity_log (uses organization_id)
  - brand_kits, brand_kit_versions (uses org_id)
  - brand_voices, brand_voice_versions (uses org_id)
  - brand_usage (uses org_id)
  
  ## Changes
  - All auth.uid() calls wrapped in (select auth.uid())
  - Using get_auth_user_org_id() for org checks
*/

-- ============================================
-- activity_log (uses organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can insert activity in their organization" ON activity_log;
DROP POLICY IF EXISTS "Users can read their organization activity" ON activity_log;

CREATE POLICY "Users can read their organization activity"
  ON activity_log
  FOR SELECT
  TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can insert activity in their organization"
  ON activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

-- ============================================
-- brand_kits (uses org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view org brand kits" ON brand_kits;
DROP POLICY IF EXISTS "Users can create brand kits" ON brand_kits;
DROP POLICY IF EXISTS "Users can create org brand kits" ON brand_kits;
DROP POLICY IF EXISTS "Users can update org brand kits" ON brand_kits;
DROP POLICY IF EXISTS "Users can delete org brand kits" ON brand_kits;

CREATE POLICY "Users can view org brand kits"
  ON brand_kits
  FOR SELECT
  TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can create org brand kits"
  ON brand_kits
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update org brand kits"
  ON brand_kits
  FOR UPDATE
  TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can delete org brand kits"
  ON brand_kits
  FOR DELETE
  TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- brand_kit_versions
-- ============================================
DROP POLICY IF EXISTS "Users can view org brand kit versions" ON brand_kit_versions;
DROP POLICY IF EXISTS "Users can create brand kit versions" ON brand_kit_versions;

CREATE POLICY "Users can view org brand kit versions"
  ON brand_kit_versions
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM brand_kits bk 
    WHERE bk.id = brand_kit_versions.brand_kit_id 
    AND bk.org_id = get_auth_user_org_id()
  ));

CREATE POLICY "Users can create brand kit versions"
  ON brand_kit_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM brand_kits bk 
    WHERE bk.id = brand_kit_versions.brand_kit_id 
    AND bk.org_id = get_auth_user_org_id()
  ));

-- ============================================
-- brand_voices (uses org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view org brand voices" ON brand_voices;
DROP POLICY IF EXISTS "Users can create brand voices" ON brand_voices;
DROP POLICY IF EXISTS "Users can create org brand voices" ON brand_voices;
DROP POLICY IF EXISTS "Users can update org brand voices" ON brand_voices;
DROP POLICY IF EXISTS "Users can delete org brand voices" ON brand_voices;

CREATE POLICY "Users can view org brand voices"
  ON brand_voices
  FOR SELECT
  TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can create org brand voices"
  ON brand_voices
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update org brand voices"
  ON brand_voices
  FOR UPDATE
  TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can delete org brand voices"
  ON brand_voices
  FOR DELETE
  TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- brand_voice_versions
-- ============================================
DROP POLICY IF EXISTS "Users can view org brand voice versions" ON brand_voice_versions;
DROP POLICY IF EXISTS "Users can create brand voice versions" ON brand_voice_versions;

CREATE POLICY "Users can view org brand voice versions"
  ON brand_voice_versions
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM brand_voices bv 
    WHERE bv.id = brand_voice_versions.brand_voice_id 
    AND bv.org_id = get_auth_user_org_id()
  ));

CREATE POLICY "Users can create brand voice versions"
  ON brand_voice_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM brand_voices bv 
    WHERE bv.id = brand_voice_versions.brand_voice_id 
    AND bv.org_id = get_auth_user_org_id()
  ));

-- ============================================
-- brand_usage (uses org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view org brand usage" ON brand_usage;
DROP POLICY IF EXISTS "Users can track brand usage" ON brand_usage;
DROP POLICY IF EXISTS "Users can update brand usage" ON brand_usage;
DROP POLICY IF EXISTS "Users can delete brand usage" ON brand_usage;

CREATE POLICY "Users can view org brand usage"
  ON brand_usage
  FOR SELECT
  TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can track brand usage"
  ON brand_usage
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update brand usage"
  ON brand_usage
  FOR UPDATE
  TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can delete brand usage"
  ON brand_usage
  FOR DELETE
  TO authenticated
  USING (org_id = get_auth_user_org_id());
