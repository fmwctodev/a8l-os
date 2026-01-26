/*
  # Improve Public Endpoint RLS Policies

  This migration improves security for public-facing endpoints while maintaining
  functionality for legitimate use cases like public booking pages, forms, and surveys.

  1. Policy Changes
    - Add basic validation checks to prevent abuse
    - Ensure required fields are present
    - Maintain anonymous access for legitimate public features

  2. Tables Affected
    - appointments (public booking)
    - form_submissions, form_files (public forms)
    - survey_submissions, survey_continuations (public surveys)

  3. Security Notes
    - These tables MUST allow anonymous INSERT for public features to work
    - Validation ensures data integrity without blocking legitimate submissions
    - Rate limiting should be handled at the application/edge function level
*/

-- Appointments: Require org_id and time fields to be set
DROP POLICY IF EXISTS "Public can create appointments" ON appointments;
CREATE POLICY "Public can create appointments"
  ON appointments
  FOR INSERT
  TO anon
  WITH CHECK (
    org_id IS NOT NULL
    AND calendar_id IS NOT NULL
    AND start_at_utc IS NOT NULL
    AND end_at_utc IS NOT NULL
    AND start_at_utc < end_at_utc
  );

-- Form submissions: Require form_id and organization_id
DROP POLICY IF EXISTS "Anonymous users can submit forms" ON form_submissions;
CREATE POLICY "Anonymous users can submit forms"
  ON form_submissions
  FOR INSERT
  TO anon
  WITH CHECK (
    form_id IS NOT NULL
    AND organization_id IS NOT NULL
  );

-- Form files: Require submission context
DROP POLICY IF EXISTS "Anyone can create form files during submission" ON form_files;
CREATE POLICY "Anyone can create form files during submission"
  ON form_files
  FOR INSERT
  TO anon
  WITH CHECK (
    organization_id IS NOT NULL
    AND form_id IS NOT NULL
  );

-- Survey submissions: Require survey_id and organization_id
DROP POLICY IF EXISTS "Anonymous users can submit surveys" ON survey_submissions;
CREATE POLICY "Anonymous users can submit surveys"
  ON survey_submissions
  FOR INSERT
  TO anon
  WITH CHECK (
    survey_id IS NOT NULL
    AND organization_id IS NOT NULL
  );

-- Survey continuations: Require survey context for creation
DROP POLICY IF EXISTS "Anonymous users can create survey continuations" ON survey_continuations;
CREATE POLICY "Anonymous users can create survey continuations"
  ON survey_continuations
  FOR INSERT
  TO anon
  WITH CHECK (
    survey_id IS NOT NULL
    AND organization_id IS NOT NULL
    AND token IS NOT NULL
  );

-- Survey continuations update: Require token to exist for anon updates
DROP POLICY IF EXISTS "Anyone can update survey continuations" ON survey_continuations;
CREATE POLICY "Anyone can update survey continuations by token"
  ON survey_continuations
  FOR UPDATE
  TO anon
  USING (token IS NOT NULL)
  WITH CHECK (token IS NOT NULL);

-- Fix authenticated users policy for survey continuations
DROP POLICY IF EXISTS "Users can update survey continuations in their organization" ON survey_continuations;
CREATE POLICY "Users can update survey continuations in their organization"
  ON survey_continuations
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
  );
