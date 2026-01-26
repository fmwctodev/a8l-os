/*
  # Optimize RLS Policies - Opportunities and Calendars

  Optimizes RLS policies to use `(select auth.uid())` pattern.

  1. Tables Updated
    - opportunities
    - pipelines
    - pipeline_stages
    - calendars
    - appointments
*/

-- ============================================
-- OPPORTUNITIES TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view opportunities in their org" ON opportunities;
DROP POLICY IF EXISTS "Users can create opportunities in their org" ON opportunities;
DROP POLICY IF EXISTS "Users can update opportunities in their org" ON opportunities;
DROP POLICY IF EXISTS "Users can delete opportunities in their org" ON opportunities;

CREATE POLICY "Users can view opportunities in their org"
  ON opportunities FOR SELECT
  TO authenticated
  USING (
    org_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

CREATE POLICY "Users can create opportunities in their org"
  ON opportunities FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

CREATE POLICY "Users can update opportunities in their org"
  ON opportunities FOR UPDATE
  TO authenticated
  USING (
    org_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  )
  WITH CHECK (
    org_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

CREATE POLICY "Users can delete opportunities in their org"
  ON opportunities FOR DELETE
  TO authenticated
  USING (
    org_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

-- ============================================
-- PIPELINES TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view pipelines in their org" ON pipelines;
DROP POLICY IF EXISTS "Users can create pipelines in their org" ON pipelines;
DROP POLICY IF EXISTS "Users can update pipelines in their org" ON pipelines;
DROP POLICY IF EXISTS "Users can delete pipelines in their org" ON pipelines;

CREATE POLICY "Users can view pipelines in their org"
  ON pipelines FOR SELECT
  TO authenticated
  USING (
    org_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

CREATE POLICY "Users can create pipelines in their org"
  ON pipelines FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

CREATE POLICY "Users can update pipelines in their org"
  ON pipelines FOR UPDATE
  TO authenticated
  USING (
    org_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  )
  WITH CHECK (
    org_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

CREATE POLICY "Users can delete pipelines in their org"
  ON pipelines FOR DELETE
  TO authenticated
  USING (
    org_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

-- ============================================
-- PIPELINE_STAGES TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view stages in their org" ON pipeline_stages;
DROP POLICY IF EXISTS "Users can create stages in their org" ON pipeline_stages;
DROP POLICY IF EXISTS "Users can update stages in their org" ON pipeline_stages;
DROP POLICY IF EXISTS "Users can delete stages in their org" ON pipeline_stages;

CREATE POLICY "Users can view stages in their org"
  ON pipeline_stages FOR SELECT
  TO authenticated
  USING (
    org_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

CREATE POLICY "Users can create stages in their org"
  ON pipeline_stages FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

CREATE POLICY "Users can update stages in their org"
  ON pipeline_stages FOR UPDATE
  TO authenticated
  USING (
    org_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  )
  WITH CHECK (
    org_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

CREATE POLICY "Users can delete stages in their org"
  ON pipeline_stages FOR DELETE
  TO authenticated
  USING (
    org_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

-- ============================================
-- CALENDARS TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view calendars in their org" ON calendars;
DROP POLICY IF EXISTS "Users can create calendars in their org" ON calendars;
DROP POLICY IF EXISTS "Users can update calendars in their org" ON calendars;
DROP POLICY IF EXISTS "Users can delete calendars in their org" ON calendars;

CREATE POLICY "Users can view calendars in their org"
  ON calendars FOR SELECT
  TO authenticated
  USING (
    org_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

CREATE POLICY "Users can create calendars in their org"
  ON calendars FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

CREATE POLICY "Users can update calendars in their org"
  ON calendars FOR UPDATE
  TO authenticated
  USING (
    org_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  )
  WITH CHECK (
    org_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

CREATE POLICY "Users can delete calendars in their org"
  ON calendars FOR DELETE
  TO authenticated
  USING (
    org_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

-- ============================================
-- APPOINTMENTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view appointments in their org" ON appointments;
DROP POLICY IF EXISTS "Users can create appointments in their org" ON appointments;
DROP POLICY IF EXISTS "Users can update appointments in their org" ON appointments;
DROP POLICY IF EXISTS "Users can delete appointments in their org" ON appointments;
DROP POLICY IF EXISTS "Public can create appointments" ON appointments;

CREATE POLICY "Users can view appointments in their org"
  ON appointments FOR SELECT
  TO authenticated
  USING (
    org_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

CREATE POLICY "Users can create appointments in their org"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

CREATE POLICY "Users can update appointments in their org"
  ON appointments FOR UPDATE
  TO authenticated
  USING (
    org_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  )
  WITH CHECK (
    org_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

CREATE POLICY "Users can delete appointments in their org"
  ON appointments FOR DELETE
  TO authenticated
  USING (
    org_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

CREATE POLICY "Public can create appointments"
  ON appointments FOR INSERT
  TO anon
  WITH CHECK (true);
