/*
  # Create RLS Policies for Proposals Module

  This migration creates Row Level Security policies for all Proposals module tables.

  ## Security Model
  - Organization-based visibility for all users
  - Admins/Managers have full access within org
  - Regular users can view/create/update proposals they own or are assigned
  - Public token access for external proposal viewing

  ## Policies Created

  ### proposal_templates
  - SELECT: Users can view templates in their org
  - INSERT/UPDATE/DELETE: Only admins/managers

  ### proposals
  - SELECT: Users can view proposals they created/assigned or admins see all
  - INSERT: Users can create proposals in their org
  - UPDATE: Users can update own proposals or admins can update any
  - DELETE: Only admins can delete proposals

  ### proposal_line_items
  - Follows proposal permissions

  ### proposal_sections
  - Follows proposal permissions

  ### proposal_comments
  - SELECT: Users can view comments on accessible proposals
  - INSERT: Users can add comments to accessible proposals
  - UPDATE/DELETE: Users can modify their own comments

  ### proposal_activities
  - SELECT: Users can view activities for accessible proposals
  - INSERT: System creates activities
*/

-- Helper function to check if user can access proposal
CREATE OR REPLACE FUNCTION can_access_proposal(user_id uuid, proposal_row proposals)
RETURNS boolean AS $$
DECLARE
  user_record RECORD;
BEGIN
  SELECT u.organization_id, r.hierarchy_level
  INTO user_record
  FROM users u
  JOIN roles r ON u.role_id = r.id
  WHERE u.id = user_id;
  
  IF user_record.organization_id != proposal_row.org_id THEN
    RETURN false;
  END IF;
  
  IF user_record.hierarchy_level <= 2 THEN
    RETURN true;
  END IF;
  
  RETURN proposal_row.created_by = user_id 
    OR proposal_row.assigned_user_id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to check proposal access by ID
CREATE OR REPLACE FUNCTION can_access_proposal_by_id(user_id uuid, p_proposal_id uuid)
RETURNS boolean AS $$
DECLARE
  proposal_record proposals%ROWTYPE;
BEGIN
  SELECT * INTO proposal_record
  FROM proposals
  WHERE id = p_proposal_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  RETURN can_access_proposal(user_id, proposal_record);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to check if user is proposal admin
CREATE OR REPLACE FUNCTION is_proposal_admin(user_id uuid)
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

-- ============================================
-- PROPOSAL TEMPLATES POLICIES
-- ============================================

CREATE POLICY "Users can view templates in their org"
  ON proposal_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.organization_id = org_id
    )
  );

CREATE POLICY "Admins can create templates"
  ON proposal_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.organization_id = org_id
    )
    AND is_proposal_admin(auth.uid())
  );

CREATE POLICY "Admins can update templates"
  ON proposal_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.organization_id = org_id
    )
  )
  WITH CHECK (is_proposal_admin(auth.uid()));

CREATE POLICY "Admins can delete templates"
  ON proposal_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.organization_id = org_id
    )
    AND is_proposal_admin(auth.uid())
  );

-- ============================================
-- PROPOSALS POLICIES
-- ============================================

CREATE POLICY "Users can view accessible proposals"
  ON proposals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND u.organization_id = org_id
      AND (
        r.hierarchy_level <= 2
        OR created_by = auth.uid()
        OR assigned_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create proposals in their org"
  ON proposals FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.organization_id = org_id
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update accessible proposals"
  ON proposals FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND u.organization_id = org_id
      AND (
        r.hierarchy_level <= 2
        OR created_by = auth.uid()
        OR assigned_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND u.organization_id = org_id
      AND (
        r.hierarchy_level <= 2
        OR created_by = auth.uid()
        OR assigned_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can delete proposals"
  ON proposals FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.organization_id = org_id
    )
    AND is_proposal_admin(auth.uid())
  );

-- ============================================
-- PROPOSAL LINE ITEMS POLICIES
-- ============================================

CREATE POLICY "Users can view line items for accessible proposals"
  ON proposal_line_items FOR SELECT
  TO authenticated
  USING (can_access_proposal_by_id(auth.uid(), proposal_id));

CREATE POLICY "Users can create line items for accessible proposals"
  ON proposal_line_items FOR INSERT
  TO authenticated
  WITH CHECK (can_access_proposal_by_id(auth.uid(), proposal_id));

CREATE POLICY "Users can update line items for accessible proposals"
  ON proposal_line_items FOR UPDATE
  TO authenticated
  USING (can_access_proposal_by_id(auth.uid(), proposal_id))
  WITH CHECK (can_access_proposal_by_id(auth.uid(), proposal_id));

CREATE POLICY "Users can delete line items for accessible proposals"
  ON proposal_line_items FOR DELETE
  TO authenticated
  USING (can_access_proposal_by_id(auth.uid(), proposal_id));

-- ============================================
-- PROPOSAL SECTIONS POLICIES
-- ============================================

CREATE POLICY "Users can view sections for accessible proposals"
  ON proposal_sections FOR SELECT
  TO authenticated
  USING (can_access_proposal_by_id(auth.uid(), proposal_id));

CREATE POLICY "Users can create sections for accessible proposals"
  ON proposal_sections FOR INSERT
  TO authenticated
  WITH CHECK (can_access_proposal_by_id(auth.uid(), proposal_id));

CREATE POLICY "Users can update sections for accessible proposals"
  ON proposal_sections FOR UPDATE
  TO authenticated
  USING (can_access_proposal_by_id(auth.uid(), proposal_id))
  WITH CHECK (can_access_proposal_by_id(auth.uid(), proposal_id));

CREATE POLICY "Users can delete sections for accessible proposals"
  ON proposal_sections FOR DELETE
  TO authenticated
  USING (can_access_proposal_by_id(auth.uid(), proposal_id));

-- ============================================
-- PROPOSAL COMMENTS POLICIES
-- ============================================

CREATE POLICY "Users can view comments for accessible proposals"
  ON proposal_comments FOR SELECT
  TO authenticated
  USING (can_access_proposal_by_id(auth.uid(), proposal_id));

CREATE POLICY "Users can create comments on accessible proposals"
  ON proposal_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    can_access_proposal_by_id(auth.uid(), proposal_id)
    AND (user_id = auth.uid() OR user_id IS NULL)
  );

CREATE POLICY "Users can update their own comments"
  ON proposal_comments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments"
  ON proposal_comments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- PROPOSAL ACTIVITIES POLICIES
-- ============================================

CREATE POLICY "Users can view activities for accessible proposals"
  ON proposal_activities FOR SELECT
  TO authenticated
  USING (can_access_proposal_by_id(auth.uid(), proposal_id));

CREATE POLICY "System can create proposal activities"
  ON proposal_activities FOR INSERT
  TO authenticated
  WITH CHECK (can_access_proposal_by_id(auth.uid(), proposal_id));
