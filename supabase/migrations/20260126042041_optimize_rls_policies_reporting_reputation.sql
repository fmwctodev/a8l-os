/*
  # Optimize RLS Policies - Reporting and Reputation Tables
  
  1. Changes
    - Optimizes RLS policies for reports (use organization_id)
    - Optimizes RLS policies for reviews, review_requests, review_providers (use organization_id)
    - Optimizes RLS policies for reputation_settings (use organization_id)
  
  2. Tables Affected
    - reports, report_schedules, report_exports (use organization_id)
    - reviews, review_requests, review_providers, reputation_settings (use organization_id)
  
  3. Security
    - No changes to actual security logic
    - Performance optimization only
*/

-- =============================================
-- REPORTS TABLE (uses organization_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view reports in their organization" ON reports;
CREATE POLICY "Users can view reports in their organization"
  ON reports FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('reporting:view'));

DROP POLICY IF EXISTS "Users can create reports in their organization" ON reports;
CREATE POLICY "Users can create reports in their organization"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('reporting:create'));

DROP POLICY IF EXISTS "Users can update reports in their organization" ON reports;
CREATE POLICY "Users can update reports in their organization"
  ON reports FOR UPDATE
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('reporting:edit'))
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('reporting:edit'));

DROP POLICY IF EXISTS "Users can delete reports in their organization" ON reports;
CREATE POLICY "Users can delete reports in their organization"
  ON reports FOR DELETE
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('reporting:delete'));

-- =============================================
-- REPORT_SCHEDULES TABLE (uses organization_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view report schedules in their organization" ON report_schedules;
CREATE POLICY "Users can view report schedules in their organization"
  ON report_schedules FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can manage report schedules" ON report_schedules;
CREATE POLICY "Users can manage report schedules"
  ON report_schedules FOR ALL
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('reporting:schedule'))
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('reporting:schedule'));

-- =============================================
-- REPORT_EXPORTS TABLE (uses organization_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view report exports in their organization" ON report_exports;
CREATE POLICY "Users can view report exports in their organization"
  ON report_exports FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can create report exports" ON report_exports;
CREATE POLICY "Users can create report exports"
  ON report_exports FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('reporting:export'));

-- =============================================
-- REVIEWS TABLE (uses organization_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view reviews in their organization" ON reviews;
CREATE POLICY "Users can view reviews in their organization"
  ON reviews FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('reputation:view'));

DROP POLICY IF EXISTS "Users can manage reviews in their organization" ON reviews;
CREATE POLICY "Users can manage reviews in their organization"
  ON reviews FOR UPDATE
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('reputation:manage'))
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('reputation:manage'));

-- =============================================
-- REVIEW_REQUESTS TABLE (uses organization_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view review requests in their organization" ON review_requests;
CREATE POLICY "Users can view review requests in their organization"
  ON review_requests FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('reputation:view'));

DROP POLICY IF EXISTS "Users can create review requests" ON review_requests;
CREATE POLICY "Users can create review requests"
  ON review_requests FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('reputation:request'));

DROP POLICY IF EXISTS "Users can update review requests" ON review_requests;
CREATE POLICY "Users can update review requests"
  ON review_requests FOR UPDATE
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('reputation:request'))
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('reputation:request'));

-- =============================================
-- REVIEW_PROVIDERS TABLE (uses organization_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view review providers in their organization" ON review_providers;
CREATE POLICY "Users can view review providers in their organization"
  ON review_providers FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can manage review providers" ON review_providers;
CREATE POLICY "Users can manage review providers"
  ON review_providers FOR ALL
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('reputation:settings'))
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('reputation:settings'));

-- =============================================
-- REPUTATION_SETTINGS TABLE (uses organization_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view reputation settings in their organization" ON reputation_settings;
CREATE POLICY "Users can view reputation settings in their organization"
  ON reputation_settings FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can manage reputation settings" ON reputation_settings;
CREATE POLICY "Users can manage reputation settings"
  ON reputation_settings FOR ALL
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('reputation:settings'))
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('reputation:settings'));