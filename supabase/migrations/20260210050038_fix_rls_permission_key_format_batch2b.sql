/*
  # Fix RLS permission key format - Batch 2b (Marketing, Integrations, Reputation, Social tables)

  Fixes colon-delimited permission keys to use dot-delimited format matching
  the actual permissions table entries.

  ## Tables fixed:
  - form_files: SELECT (marketing:view → marketing.view)
  - form_submissions: SELECT/UPDATE/DELETE (marketing:view/manage → marketing.view/manage)
  - forms: SELECT (marketing:view → marketing.view)
  - integration_logs: SELECT (integrations:view → integrations.view)
  - outgoing_webhooks: SELECT/UPDATE/DELETE (integrations:view/manage → integrations.view/manage)
  - report_exports: INSERT (reporting:export → reporting.export)
  - reports: INSERT (reporting:create → reporting.manage)
  - review_requests: INSERT/UPDATE/SELECT (reputation:request/view → reputation.request/view)
  - reviews: SELECT (reputation:view → reputation.view)
  - social_accounts: UPDATE/DELETE (social:manage_accounts → marketing.social.manage)
  - survey_continuations: DELETE (marketing:manage → marketing.manage)
  - survey_submissions: SELECT/UPDATE/DELETE (marketing:view/manage → marketing.view/manage)
  - surveys: SELECT (marketing:view → marketing.view)
  - webhook_deliveries: SELECT (integrations:view → integrations.view)
*/

-- form_files: SELECT
DROP POLICY IF EXISTS "Users can view form files in their organization" ON form_files;
CREATE POLICY "Users can view form files in their organization"
  ON form_files FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('marketing.view'));

-- form_submissions: SELECT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can view form submissions in their organization" ON form_submissions;
CREATE POLICY "Users can view form submissions in their organization"
  ON form_submissions FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('marketing.view'));

DROP POLICY IF EXISTS "Users can update form submissions in their organization" ON form_submissions;
CREATE POLICY "Users can update form submissions in their organization"
  ON form_submissions FOR UPDATE TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('marketing.manage'));

DROP POLICY IF EXISTS "Users can delete form submissions in their organization" ON form_submissions;
CREATE POLICY "Users can delete form submissions in their organization"
  ON form_submissions FOR DELETE TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('marketing.manage'));

-- forms: SELECT
DROP POLICY IF EXISTS "Users can view forms in their organization" ON forms;
CREATE POLICY "Users can view forms in their organization"
  ON forms FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('marketing.view'));

-- integration_logs: SELECT
DROP POLICY IF EXISTS "Users can view integration logs in their organization" ON integration_logs;
CREATE POLICY "Users can view integration logs in their organization"
  ON integration_logs FOR SELECT TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('integrations.view'));

-- outgoing_webhooks: SELECT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can view outgoing webhooks in their organization" ON outgoing_webhooks;
CREATE POLICY "Users can view outgoing webhooks in their organization"
  ON outgoing_webhooks FOR SELECT TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('integrations.view'));

DROP POLICY IF EXISTS "Users can update outgoing webhooks" ON outgoing_webhooks;
CREATE POLICY "Users can update outgoing webhooks"
  ON outgoing_webhooks FOR UPDATE TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('integrations.manage'));

DROP POLICY IF EXISTS "Users can delete outgoing webhooks" ON outgoing_webhooks;
CREATE POLICY "Users can delete outgoing webhooks"
  ON outgoing_webhooks FOR DELETE TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('integrations.manage'));

-- report_exports: INSERT
DROP POLICY IF EXISTS "Users can create report exports" ON report_exports;
CREATE POLICY "Users can create report exports"
  ON report_exports FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('reporting.export'));

-- reports: INSERT
DROP POLICY IF EXISTS "Users can create reports in their organization" ON reports;
CREATE POLICY "Users can create reports in their organization"
  ON reports FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('reporting.manage'));

-- review_requests: SELECT, INSERT, UPDATE
DROP POLICY IF EXISTS "Users can view review requests in their organization" ON review_requests;
CREATE POLICY "Users can view review requests in their organization"
  ON review_requests FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('reputation.view'));

DROP POLICY IF EXISTS "Users can create review requests" ON review_requests;
CREATE POLICY "Users can create review requests"
  ON review_requests FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('reputation.request'));

DROP POLICY IF EXISTS "Users can update review requests" ON review_requests;
CREATE POLICY "Users can update review requests"
  ON review_requests FOR UPDATE TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('reputation.request'))
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('reputation.request'));

-- reviews: SELECT
DROP POLICY IF EXISTS "Users can view reviews in their organization" ON reviews;
CREATE POLICY "Users can view reviews in their organization"
  ON reviews FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('reputation.view'));

-- social_accounts: UPDATE, DELETE
DROP POLICY IF EXISTS "Users with connect permission can update social accounts" ON social_accounts;
CREATE POLICY "Users with connect permission can update social accounts"
  ON social_accounts FOR UPDATE TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('marketing.social.manage'))
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('marketing.social.manage'));

DROP POLICY IF EXISTS "Users with connect permission can delete social accounts" ON social_accounts;
CREATE POLICY "Users with connect permission can delete social accounts"
  ON social_accounts FOR DELETE TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('marketing.social.manage'));

-- survey_continuations: DELETE
DROP POLICY IF EXISTS "Users can delete survey continuations in their organization" ON survey_continuations;
CREATE POLICY "Users can delete survey continuations in their organization"
  ON survey_continuations FOR DELETE TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('marketing.manage'));

-- survey_submissions: SELECT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can view survey submissions in their organization" ON survey_submissions;
CREATE POLICY "Users can view survey submissions in their organization"
  ON survey_submissions FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('marketing.view'));

DROP POLICY IF EXISTS "Users can update survey submissions in their organization" ON survey_submissions;
CREATE POLICY "Users can update survey submissions in their organization"
  ON survey_submissions FOR UPDATE TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('marketing.manage'));

DROP POLICY IF EXISTS "Users can delete survey submissions in their organization" ON survey_submissions;
CREATE POLICY "Users can delete survey submissions in their organization"
  ON survey_submissions FOR DELETE TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('marketing.manage'));

-- surveys: SELECT
DROP POLICY IF EXISTS "Users can view surveys in their organization" ON surveys;
CREATE POLICY "Users can view surveys in their organization"
  ON surveys FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('marketing.view'));

-- webhook_deliveries: SELECT
DROP POLICY IF EXISTS "Users can view webhook deliveries in their organization" ON webhook_deliveries;
CREATE POLICY "Users can view webhook deliveries in their organization"
  ON webhook_deliveries FOR SELECT TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('integrations.view'));
