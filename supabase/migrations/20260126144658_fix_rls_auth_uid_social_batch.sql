/*
  # Fix RLS auth.uid() Performance - Social Batch
  
  This migration optimizes RLS policies for social media tables.
  
  ## Tables Fixed
  - social_accounts, social_posts, social_oauth_states, social_account_groups (organization_id)
  - social_post_content, social_post_media (via post_id -> social_posts)
  - social_post_metrics, social_post_ai_metadata, social_ai_learning_signals (organization_id)
  - content_ai_generations (organization_id)
  
  ## Changes
  - All auth.uid() calls wrapped in (select auth.uid())
  - Using get_auth_user_org_id() for org checks
*/

-- ============================================
-- social_accounts (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users with connect permission can create social accounts" ON social_accounts;

CREATE POLICY "Users with connect permission can create social accounts"
  ON social_accounts FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

-- ============================================
-- social_posts (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users with manage permission can create social posts" ON social_posts;
DROP POLICY IF EXISTS "Users with manage permission can update social posts" ON social_posts;
DROP POLICY IF EXISTS "Users with manage permission can delete social posts" ON social_posts;

CREATE POLICY "Users with manage permission can create social posts"
  ON social_posts FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users with manage permission can update social posts"
  ON social_posts FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id())
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users with manage permission can delete social posts"
  ON social_posts FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id());

-- ============================================
-- social_oauth_states (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view their own OAuth states" ON social_oauth_states;
DROP POLICY IF EXISTS "Users can create their own OAuth states" ON social_oauth_states;
DROP POLICY IF EXISTS "Users can delete their own OAuth states" ON social_oauth_states;

CREATE POLICY "Users can view their own OAuth states"
  ON social_oauth_states FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Users can create their own OAuth states"
  ON social_oauth_states FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own OAuth states"
  ON social_oauth_states FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

-- ============================================
-- social_account_groups (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view account groups in their organization" ON social_account_groups;
DROP POLICY IF EXISTS "Users can create account groups in their organization" ON social_account_groups;
DROP POLICY IF EXISTS "Users can update account groups in their organization" ON social_account_groups;
DROP POLICY IF EXISTS "Users can delete account groups in their organization" ON social_account_groups;

CREATE POLICY "Users can view account groups in their organization"
  ON social_account_groups FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can create account groups in their organization"
  ON social_account_groups FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can update account groups in their organization"
  ON social_account_groups FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id())
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can delete account groups in their organization"
  ON social_account_groups FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id());

-- ============================================
-- social_post_content (via post_id -> social_posts)
-- ============================================
DROP POLICY IF EXISTS "Users can view post content in their organization" ON social_post_content;
DROP POLICY IF EXISTS "Users can create post content in their organization" ON social_post_content;
DROP POLICY IF EXISTS "Users can update post content in their organization" ON social_post_content;
DROP POLICY IF EXISTS "Users can delete post content in their organization" ON social_post_content;

CREATE POLICY "Users can view post content in their organization"
  ON social_post_content FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM social_posts sp WHERE sp.id = social_post_content.post_id AND sp.organization_id = get_auth_user_org_id()
  ));

CREATE POLICY "Users can create post content in their organization"
  ON social_post_content FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM social_posts sp WHERE sp.id = social_post_content.post_id AND sp.organization_id = get_auth_user_org_id()
  ));

CREATE POLICY "Users can update post content in their organization"
  ON social_post_content FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM social_posts sp WHERE sp.id = social_post_content.post_id AND sp.organization_id = get_auth_user_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM social_posts sp WHERE sp.id = social_post_content.post_id AND sp.organization_id = get_auth_user_org_id()
  ));

CREATE POLICY "Users can delete post content in their organization"
  ON social_post_content FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM social_posts sp WHERE sp.id = social_post_content.post_id AND sp.organization_id = get_auth_user_org_id()
  ));

-- ============================================
-- social_post_media (via post_id -> social_posts)
-- ============================================
DROP POLICY IF EXISTS "Users can view post media in their organization" ON social_post_media;
DROP POLICY IF EXISTS "Users can create post media in their organization" ON social_post_media;
DROP POLICY IF EXISTS "Users can update post media in their organization" ON social_post_media;
DROP POLICY IF EXISTS "Users can delete post media in their organization" ON social_post_media;

CREATE POLICY "Users can view post media in their organization"
  ON social_post_media FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM social_posts sp WHERE sp.id = social_post_media.post_id AND sp.organization_id = get_auth_user_org_id()
  ));

CREATE POLICY "Users can create post media in their organization"
  ON social_post_media FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM social_posts sp WHERE sp.id = social_post_media.post_id AND sp.organization_id = get_auth_user_org_id()
  ));

CREATE POLICY "Users can update post media in their organization"
  ON social_post_media FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM social_posts sp WHERE sp.id = social_post_media.post_id AND sp.organization_id = get_auth_user_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM social_posts sp WHERE sp.id = social_post_media.post_id AND sp.organization_id = get_auth_user_org_id()
  ));

CREATE POLICY "Users can delete post media in their organization"
  ON social_post_media FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM social_posts sp WHERE sp.id = social_post_media.post_id AND sp.organization_id = get_auth_user_org_id()
  ));

-- ============================================
-- social_post_metrics (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view their organization's post metrics" ON social_post_metrics;
DROP POLICY IF EXISTS "Users can insert metrics for their organization" ON social_post_metrics;
DROP POLICY IF EXISTS "Users can update metrics for their organization" ON social_post_metrics;
DROP POLICY IF EXISTS "Users can delete metrics for their organization" ON social_post_metrics;

CREATE POLICY "Users can view their organization's post metrics"
  ON social_post_metrics FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can insert metrics for their organization"
  ON social_post_metrics FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can update metrics for their organization"
  ON social_post_metrics FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id())
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can delete metrics for their organization"
  ON social_post_metrics FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id());

-- ============================================
-- social_post_ai_metadata (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view AI metadata in their organization" ON social_post_ai_metadata;
DROP POLICY IF EXISTS "Users can create AI metadata in their organization" ON social_post_ai_metadata;
DROP POLICY IF EXISTS "Users can update AI metadata they created" ON social_post_ai_metadata;

CREATE POLICY "Users can view AI metadata in their organization"
  ON social_post_ai_metadata FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can create AI metadata in their organization"
  ON social_post_ai_metadata FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can update AI metadata they created"
  ON social_post_ai_metadata FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id())
  WITH CHECK (organization_id = get_auth_user_org_id());

-- ============================================
-- social_ai_learning_signals (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view their organization's learning signals" ON social_ai_learning_signals;
DROP POLICY IF EXISTS "Users can insert learning signals for their organization" ON social_ai_learning_signals;
DROP POLICY IF EXISTS "Users can update learning signals for their organization" ON social_ai_learning_signals;
DROP POLICY IF EXISTS "Users can delete learning signals for their organization" ON social_ai_learning_signals;

CREATE POLICY "Users can view their organization's learning signals"
  ON social_ai_learning_signals FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can insert learning signals for their organization"
  ON social_ai_learning_signals FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can update learning signals for their organization"
  ON social_ai_learning_signals FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id())
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can delete learning signals for their organization"
  ON social_ai_learning_signals FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id());

-- ============================================
-- content_ai_generations (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can create AI generations" ON content_ai_generations;
DROP POLICY IF EXISTS "Users can update their AI generations" ON content_ai_generations;
DROP POLICY IF EXISTS "Users can delete their AI generations" ON content_ai_generations;

CREATE POLICY "Users can view AI generations in their org"
  ON content_ai_generations FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can create AI generations"
  ON content_ai_generations FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Users can update their AI generations"
  ON content_ai_generations FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND user_id = (select auth.uid()))
  WITH CHECK (organization_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Users can delete their AI generations"
  ON content_ai_generations FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND user_id = (select auth.uid()));
