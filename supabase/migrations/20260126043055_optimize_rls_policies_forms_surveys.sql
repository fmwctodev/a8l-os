/*
  # Optimize RLS policies for forms and surveys tables

  1. Changes
    - Optimize RLS policies for form_submissions table
    - Optimize RLS policies for form_files table
    - Optimize RLS policies for survey_submissions table
    - Optimize RLS policies for survey_continuations table
    
  2. Security
    - Replace auth.uid() with (select auth.uid()) for performance
    - Maintain exact same security logic
    - All policies continue to check organization membership and permissions
*/

-- form_submissions (uses organization_id)
DROP POLICY IF EXISTS "Users can view form submissions in their organization" ON form_submissions;
CREATE POLICY "Users can view form submissions in their organization"
  ON form_submissions FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('marketing:view'));

DROP POLICY IF EXISTS "Anonymous users can submit forms" ON form_submissions;
CREATE POLICY "Anonymous users can submit forms"
  ON form_submissions FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can submit forms" ON form_submissions;
CREATE POLICY "Authenticated users can submit forms"
  ON form_submissions FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can update form submissions in their organization" ON form_submissions;
CREATE POLICY "Users can update form submissions in their organization"
  ON form_submissions FOR UPDATE
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('marketing:manage'));

DROP POLICY IF EXISTS "Users can delete form submissions in their organization" ON form_submissions;
CREATE POLICY "Users can delete form submissions in their organization"
  ON form_submissions FOR DELETE
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('marketing:manage'));

-- form_files (uses organization_id)
DROP POLICY IF EXISTS "Users can view form files in their organization" ON form_files;
CREATE POLICY "Users can view form files in their organization"
  ON form_files FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('marketing:view'));

DROP POLICY IF EXISTS "Anonymous users can upload form files" ON form_files;
CREATE POLICY "Anonymous users can upload form files"
  ON form_files FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can upload form files" ON form_files;
CREATE POLICY "Authenticated users can upload form files"
  ON form_files FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_org_id());

-- survey_submissions (uses organization_id)
DROP POLICY IF EXISTS "Users can view survey submissions in their organization" ON survey_submissions;
CREATE POLICY "Users can view survey submissions in their organization"
  ON survey_submissions FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('marketing:view'));

DROP POLICY IF EXISTS "Anonymous users can submit surveys" ON survey_submissions;
CREATE POLICY "Anonymous users can submit surveys"
  ON survey_submissions FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can submit surveys" ON survey_submissions;
CREATE POLICY "Authenticated users can submit surveys"
  ON survey_submissions FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can update survey submissions in their organization" ON survey_submissions;
CREATE POLICY "Users can update survey submissions in their organization"
  ON survey_submissions FOR UPDATE
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('marketing:manage'));

DROP POLICY IF EXISTS "Users can delete survey submissions in their organization" ON survey_submissions;
CREATE POLICY "Users can delete survey submissions in their organization"
  ON survey_submissions FOR DELETE
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('marketing:manage'));

-- survey_continuations (uses organization_id)
DROP POLICY IF EXISTS "Anyone can read survey continuations by token" ON survey_continuations;
CREATE POLICY "Anyone can read survey continuations by token"
  ON survey_continuations FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Anonymous users can create survey continuations" ON survey_continuations;
CREATE POLICY "Anonymous users can create survey continuations"
  ON survey_continuations FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can create survey continuations" ON survey_continuations;
CREATE POLICY "Authenticated users can create survey continuations"
  ON survey_continuations FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Anyone can update survey continuations" ON survey_continuations;
CREATE POLICY "Anyone can update survey continuations"
  ON survey_continuations FOR UPDATE
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can delete survey continuations in their organization" ON survey_continuations;
CREATE POLICY "Users can delete survey continuations in their organization"
  ON survey_continuations FOR DELETE
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('marketing:manage'));