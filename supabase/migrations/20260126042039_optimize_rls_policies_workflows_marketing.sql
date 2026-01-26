/*
  # Optimize RLS Policies - Workflows and Marketing Tables
  
  1. Changes
    - Optimizes RLS policies for workflows (use org_id)
    - Optimizes RLS policies for forms, surveys, social posts (use organization_id)
  
  2. Tables Affected
    - workflows, workflow_enrollments (use org_id)
    - forms, surveys, social_posts, social_accounts (use organization_id)
  
  3. Security
    - No changes to actual security logic
    - Performance optimization only
*/

-- =============================================
-- WORKFLOWS TABLE (uses org_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view workflows in their organization" ON workflows;
CREATE POLICY "Users can view workflows in their organization"
  ON workflows FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('automation:view'));

DROP POLICY IF EXISTS "Users can create workflows in their organization" ON workflows;
CREATE POLICY "Users can create workflows in their organization"
  ON workflows FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('automation:create'));

DROP POLICY IF EXISTS "Users can update workflows in their organization" ON workflows;
CREATE POLICY "Users can update workflows in their organization"
  ON workflows FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('automation:edit'))
  WITH CHECK (org_id = get_user_org_id() AND has_permission('automation:edit'));

DROP POLICY IF EXISTS "Users can delete workflows in their organization" ON workflows;
CREATE POLICY "Users can delete workflows in their organization"
  ON workflows FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('automation:delete'));

-- =============================================
-- WORKFLOW_ENROLLMENTS TABLE (uses org_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view workflow enrollments in their organization" ON workflow_enrollments;
CREATE POLICY "Users can view workflow enrollments in their organization"
  ON workflow_enrollments FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('automation:view'));

DROP POLICY IF EXISTS "Users can create workflow enrollments" ON workflow_enrollments;
CREATE POLICY "Users can create workflow enrollments"
  ON workflow_enrollments FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('automation:edit'));

DROP POLICY IF EXISTS "Users can update workflow enrollments" ON workflow_enrollments;
CREATE POLICY "Users can update workflow enrollments"
  ON workflow_enrollments FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('automation:edit'))
  WITH CHECK (org_id = get_user_org_id() AND has_permission('automation:edit'));

-- =============================================
-- FORMS TABLE (uses organization_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view forms in their organization" ON forms;
CREATE POLICY "Users can view forms in their organization"
  ON forms FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('marketing:view'));

DROP POLICY IF EXISTS "Users can create forms in their organization" ON forms;
CREATE POLICY "Users can create forms in their organization"
  ON forms FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('marketing:create'));

DROP POLICY IF EXISTS "Users can update forms in their organization" ON forms;
CREATE POLICY "Users can update forms in their organization"
  ON forms FOR UPDATE
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('marketing:edit'))
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('marketing:edit'));

DROP POLICY IF EXISTS "Users can delete forms in their organization" ON forms;
CREATE POLICY "Users can delete forms in their organization"
  ON forms FOR DELETE
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('marketing:delete'));

-- =============================================
-- SURVEYS TABLE (uses organization_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view surveys in their organization" ON surveys;
CREATE POLICY "Users can view surveys in their organization"
  ON surveys FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('marketing:view'));

DROP POLICY IF EXISTS "Users can create surveys in their organization" ON surveys;
CREATE POLICY "Users can create surveys in their organization"
  ON surveys FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('marketing:create'));

DROP POLICY IF EXISTS "Users can update surveys in their organization" ON surveys;
CREATE POLICY "Users can update surveys in their organization"
  ON surveys FOR UPDATE
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('marketing:edit'))
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('marketing:edit'));

DROP POLICY IF EXISTS "Users can delete surveys in their organization" ON surveys;
CREATE POLICY "Users can delete surveys in their organization"
  ON surveys FOR DELETE
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('marketing:delete'));

-- =============================================
-- SOCIAL_POSTS TABLE (uses organization_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view social posts in their organization" ON social_posts;
CREATE POLICY "Users can view social posts in their organization"
  ON social_posts FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('social:view'));

DROP POLICY IF EXISTS "Users can create social posts in their organization" ON social_posts;
CREATE POLICY "Users can create social posts in their organization"
  ON social_posts FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('social:create'));

DROP POLICY IF EXISTS "Users can update social posts in their organization" ON social_posts;
CREATE POLICY "Users can update social posts in their organization"
  ON social_posts FOR UPDATE
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('social:edit'))
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('social:edit'));

DROP POLICY IF EXISTS "Users can delete social posts in their organization" ON social_posts;
CREATE POLICY "Users can delete social posts in their organization"
  ON social_posts FOR DELETE
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('social:delete'));

-- =============================================
-- SOCIAL_ACCOUNTS TABLE (uses organization_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view social accounts in their organization" ON social_accounts;
CREATE POLICY "Users can view social accounts in their organization"
  ON social_accounts FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can manage social accounts" ON social_accounts;
CREATE POLICY "Users can manage social accounts"
  ON social_accounts FOR ALL
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('social:manage_accounts'))
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('social:manage_accounts'));