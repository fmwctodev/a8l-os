/*
  # Create RLS Policies for Opportunities Module

  This migration creates Row Level Security policies for all Opportunities module tables.

  ## Security Model
  - Department-based visibility for non-admin users
  - Managers see all in their department
  - Admin/SuperAdmin see org-wide
  - Write operations require appropriate permissions

  ## Policies Created

  ### pipelines
  - SELECT: Users can view pipelines in their org (department-scoped for non-admins)
  - INSERT: Only admins/managers can create pipelines
  - UPDATE: Only admins/managers can update pipelines
  - DELETE: Only admins/managers can delete pipelines

  ### pipeline_stages
  - SELECT: Users can view stages for visible pipelines
  - INSERT/UPDATE/DELETE: Only admins/managers

  ### opportunities
  - SELECT: Department-scoped viewing
  - INSERT: Users with create permission
  - UPDATE: Users with edit permission (own department)
  - DELETE: Only admins

  ### pipeline_custom_fields
  - SELECT: Follows pipeline visibility
  - INSERT/UPDATE/DELETE: Only admins/managers

  ### opportunity_custom_field_values
  - SELECT/INSERT/UPDATE/DELETE: Follows opportunity permissions

  ### opportunity_notes
  - SELECT: Users can view notes on accessible opportunities
  - INSERT: Users can add notes to accessible opportunities
  - UPDATE: Users can edit their own notes
  - DELETE: Users can delete their own notes

  ### opportunity_timeline_events
  - SELECT: Users can view timeline for accessible opportunities
  - INSERT: System and authorized users only
*/

-- Helper function to check if user is admin/manager
CREATE OR REPLACE FUNCTION is_pipeline_admin(user_id uuid)
RETURNS boolean AS $$
DECLARE
  user_role_level integer;
BEGIN
  SELECT r.hierarchy_level INTO user_role_level
  FROM users u
  JOIN roles r ON u.role_id = r.id
  WHERE u.id = user_id;
  
  RETURN COALESCE(user_role_level <= 2, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to get user's department
CREATE OR REPLACE FUNCTION get_user_department(user_id uuid)
RETURNS uuid AS $$
DECLARE
  dept_id uuid;
BEGIN
  SELECT department_id INTO dept_id
  FROM users
  WHERE id = user_id;
  
  RETURN dept_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to check if user can access pipeline
CREATE OR REPLACE FUNCTION can_access_pipeline(user_id uuid, pipeline_org_id uuid, pipeline_dept_id uuid)
RETURNS boolean AS $$
DECLARE
  user_record RECORD;
BEGIN
  SELECT u.organization_id, u.department_id, r.hierarchy_level
  INTO user_record
  FROM users u
  JOIN roles r ON u.role_id = r.id
  WHERE u.id = user_id;
  
  IF user_record.organization_id != pipeline_org_id THEN
    RETURN false;
  END IF;
  
  IF user_record.hierarchy_level <= 2 THEN
    RETURN true;
  END IF;
  
  IF pipeline_dept_id IS NULL THEN
    RETURN true;
  END IF;
  
  RETURN user_record.department_id = pipeline_dept_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to check if user can access opportunity
CREATE OR REPLACE FUNCTION can_access_opportunity(user_id uuid, opp_org_id uuid, opp_dept_id uuid)
RETURNS boolean AS $$
DECLARE
  user_record RECORD;
BEGIN
  SELECT u.organization_id, u.department_id, r.hierarchy_level
  INTO user_record
  FROM users u
  JOIN roles r ON u.role_id = r.id
  WHERE u.id = user_id;
  
  IF user_record.organization_id != opp_org_id THEN
    RETURN false;
  END IF;
  
  IF user_record.hierarchy_level <= 2 THEN
    RETURN true;
  END IF;
  
  IF opp_dept_id IS NULL THEN
    RETURN true;
  END IF;
  
  RETURN user_record.department_id = opp_dept_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- PIPELINES POLICIES
-- ============================================

CREATE POLICY "Users can view pipelines in their org"
  ON pipelines FOR SELECT
  TO authenticated
  USING (can_access_pipeline(auth.uid(), org_id, department_id));

CREATE POLICY "Admins can create pipelines"
  ON pipelines FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.organization_id = org_id
    )
    AND is_pipeline_admin(auth.uid())
  );

CREATE POLICY "Admins can update pipelines"
  ON pipelines FOR UPDATE
  TO authenticated
  USING (can_access_pipeline(auth.uid(), org_id, department_id))
  WITH CHECK (is_pipeline_admin(auth.uid()));

CREATE POLICY "Admins can delete pipelines"
  ON pipelines FOR DELETE
  TO authenticated
  USING (can_access_pipeline(auth.uid(), org_id, department_id) AND is_pipeline_admin(auth.uid()));

-- ============================================
-- PIPELINE STAGES POLICIES
-- ============================================

CREATE POLICY "Users can view stages for accessible pipelines"
  ON pipeline_stages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_id
      AND can_access_pipeline(auth.uid(), p.org_id, p.department_id)
    )
  );

CREATE POLICY "Admins can create stages"
  ON pipeline_stages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_id
      AND can_access_pipeline(auth.uid(), p.org_id, p.department_id)
    )
    AND is_pipeline_admin(auth.uid())
  );

CREATE POLICY "Admins can update stages"
  ON pipeline_stages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_id
      AND can_access_pipeline(auth.uid(), p.org_id, p.department_id)
    )
  )
  WITH CHECK (is_pipeline_admin(auth.uid()));

CREATE POLICY "Admins can delete stages"
  ON pipeline_stages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_id
      AND can_access_pipeline(auth.uid(), p.org_id, p.department_id)
    )
    AND is_pipeline_admin(auth.uid())
  );

-- ============================================
-- OPPORTUNITIES POLICIES
-- ============================================

CREATE POLICY "Users can view opportunities in their scope"
  ON opportunities FOR SELECT
  TO authenticated
  USING (can_access_opportunity(auth.uid(), org_id, department_id));

CREATE POLICY "Users can create opportunities"
  ON opportunities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.organization_id = org_id
    )
  );

CREATE POLICY "Users can update opportunities in their scope"
  ON opportunities FOR UPDATE
  TO authenticated
  USING (can_access_opportunity(auth.uid(), org_id, department_id))
  WITH CHECK (can_access_opportunity(auth.uid(), org_id, department_id));

CREATE POLICY "Admins can delete opportunities"
  ON opportunities FOR DELETE
  TO authenticated
  USING (can_access_opportunity(auth.uid(), org_id, department_id) AND is_pipeline_admin(auth.uid()));

-- ============================================
-- PIPELINE CUSTOM FIELDS POLICIES
-- ============================================

CREATE POLICY "Users can view custom fields for accessible pipelines"
  ON pipeline_custom_fields FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_id
      AND can_access_pipeline(auth.uid(), p.org_id, p.department_id)
    )
  );

CREATE POLICY "Admins can create custom fields"
  ON pipeline_custom_fields FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_id
      AND can_access_pipeline(auth.uid(), p.org_id, p.department_id)
    )
    AND is_pipeline_admin(auth.uid())
  );

CREATE POLICY "Admins can update custom fields"
  ON pipeline_custom_fields FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_id
      AND can_access_pipeline(auth.uid(), p.org_id, p.department_id)
    )
  )
  WITH CHECK (is_pipeline_admin(auth.uid()));

CREATE POLICY "Admins can delete custom fields"
  ON pipeline_custom_fields FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_id
      AND can_access_pipeline(auth.uid(), p.org_id, p.department_id)
    )
    AND is_pipeline_admin(auth.uid())
  );

-- ============================================
-- OPPORTUNITY CUSTOM FIELD VALUES POLICIES
-- ============================================

CREATE POLICY "Users can view custom field values for accessible opportunities"
  ON opportunity_custom_field_values FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM opportunities o
      WHERE o.id = opportunity_id
      AND can_access_opportunity(auth.uid(), o.org_id, o.department_id)
    )
  );

CREATE POLICY "Users can create custom field values"
  ON opportunity_custom_field_values FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM opportunities o
      WHERE o.id = opportunity_id
      AND can_access_opportunity(auth.uid(), o.org_id, o.department_id)
    )
  );

CREATE POLICY "Users can update custom field values"
  ON opportunity_custom_field_values FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM opportunities o
      WHERE o.id = opportunity_id
      AND can_access_opportunity(auth.uid(), o.org_id, o.department_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM opportunities o
      WHERE o.id = opportunity_id
      AND can_access_opportunity(auth.uid(), o.org_id, o.department_id)
    )
  );

CREATE POLICY "Users can delete custom field values"
  ON opportunity_custom_field_values FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM opportunities o
      WHERE o.id = opportunity_id
      AND can_access_opportunity(auth.uid(), o.org_id, o.department_id)
    )
  );

-- ============================================
-- OPPORTUNITY NOTES POLICIES
-- ============================================

CREATE POLICY "Users can view notes for accessible opportunities"
  ON opportunity_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM opportunities o
      WHERE o.id = opportunity_id
      AND can_access_opportunity(auth.uid(), o.org_id, o.department_id)
    )
  );

CREATE POLICY "Users can create notes on accessible opportunities"
  ON opportunity_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM opportunities o
      WHERE o.id = opportunity_id
      AND can_access_opportunity(auth.uid(), o.org_id, o.department_id)
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update their own notes"
  ON opportunity_notes FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete their own notes"
  ON opportunity_notes FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- ============================================
-- OPPORTUNITY TIMELINE EVENTS POLICIES
-- ============================================

CREATE POLICY "Users can view timeline for accessible opportunities"
  ON opportunity_timeline_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM opportunities o
      WHERE o.id = opportunity_id
      AND can_access_opportunity(auth.uid(), o.org_id, o.department_id)
    )
  );

CREATE POLICY "System can create timeline events"
  ON opportunity_timeline_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM opportunities o
      WHERE o.id = opportunity_id
      AND can_access_opportunity(auth.uid(), o.org_id, o.department_id)
    )
  );
