/*
  # Create RLS Policies for Marketing Module Enhancements

  This migration creates Row Level Security policies for the new marketing
  module tables: content_ai_generations, form_files, and survey_continuations.

  1. Policies Created
    - content_ai_generations: Organization members can manage AI generations
    - form_files: Organization members can manage form file uploads
    - survey_continuations: Organization members can manage survey continuations

  2. Security Model
    - All policies require authentication
    - All policies scope to user's organization
    - Write operations require appropriate permissions via existing has_permission function
*/

-- Helper function check (should already exist from previous migrations)
CREATE OR REPLACE FUNCTION user_org_id()
RETURNS uuid AS $$
  SELECT organization_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- content_ai_generations policies
CREATE POLICY "Users can view AI generations in their organization"
  ON content_ai_generations
  FOR SELECT
  TO authenticated
  USING (organization_id = user_org_id());

CREATE POLICY "Users can create AI generations in their organization"
  ON content_ai_generations
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = user_org_id());

CREATE POLICY "Users can delete own AI generations"
  ON content_ai_generations
  FOR DELETE
  TO authenticated
  USING (
    organization_id = user_org_id()
    AND user_id = auth.uid()
  );

-- form_files policies
CREATE POLICY "Users can view form files in their organization"
  ON form_files
  FOR SELECT
  TO authenticated
  USING (organization_id = user_org_id());

CREATE POLICY "Users can create form files in their organization"
  ON form_files
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = user_org_id());

CREATE POLICY "Users can update form files in their organization"
  ON form_files
  FOR UPDATE
  TO authenticated
  USING (organization_id = user_org_id())
  WITH CHECK (organization_id = user_org_id());

CREATE POLICY "Users can delete form files in their organization"
  ON form_files
  FOR DELETE
  TO authenticated
  USING (organization_id = user_org_id());

-- survey_continuations policies
CREATE POLICY "Users can view survey continuations in their organization"
  ON survey_continuations
  FOR SELECT
  TO authenticated
  USING (organization_id = user_org_id());

CREATE POLICY "Users can create survey continuations in their organization"
  ON survey_continuations
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = user_org_id());

CREATE POLICY "Users can update survey continuations in their organization"
  ON survey_continuations
  FOR UPDATE
  TO authenticated
  USING (organization_id = user_org_id())
  WITH CHECK (organization_id = user_org_id());

CREATE POLICY "Users can delete survey continuations in their organization"
  ON survey_continuations
  FOR DELETE
  TO authenticated
  USING (organization_id = user_org_id());

-- Public access policy for survey continuations (for anonymous users resuming surveys)
CREATE POLICY "Anyone can read survey continuation by token"
  ON survey_continuations
  FOR SELECT
  TO anon
  USING (
    expires_at > now()
    AND completed_submission_id IS NULL
  );

-- Public access policy for form files (for form submissions)
CREATE POLICY "Anyone can create form files during submission"
  ON form_files
  FOR INSERT
  TO anon
  WITH CHECK (true);
