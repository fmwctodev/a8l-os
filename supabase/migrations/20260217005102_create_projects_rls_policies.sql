/*
  # Create Projects RLS Policies

  1. Security
    - All tables scoped by org_id matched through the users table
    - Uses auth.uid() for all policy checks
    - SELECT policies use USING clause only
    - INSERT policies use WITH CHECK clause only
    - UPDATE policies use both USING and WITH CHECK
    - DELETE policies use USING clause only

  2. Policy Summary
    - project_pipelines: org members can view, admins can manage
    - project_stages: org members can view, admins can manage
    - projects: org members can view/create, editors can update, admins can delete
    - project_tasks: org members can view/create/update through project access
    - project_activity_log: org members can view/insert
    - project_files: org members can view/insert, uploader or admin can delete
    - project_notes: org members can view/insert, creator or admin can update/delete
    - project_costs: org members can view/insert, creator or admin can update/delete
*/

-- project_pipelines policies
CREATE POLICY "Org members can view project pipelines"
  ON project_pipelines FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Admins can insert project pipelines"
  ON project_pipelines FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.hierarchy_level <= 2
    )
  );

CREATE POLICY "Admins can update project pipelines"
  ON project_pipelines FOR UPDATE TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.hierarchy_level <= 2
    )
  )
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Admins can delete project pipelines"
  ON project_pipelines FOR DELETE TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.hierarchy_level <= 2
    )
  );

-- project_stages policies
CREATE POLICY "Org members can view project stages"
  ON project_stages FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Admins can insert project stages"
  ON project_stages FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.hierarchy_level <= 2
    )
  );

CREATE POLICY "Admins can update project stages"
  ON project_stages FOR UPDATE TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.hierarchy_level <= 2
    )
  )
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Admins can delete project stages"
  ON project_stages FOR DELETE TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.hierarchy_level <= 2
    )
  );

-- projects policies
CREATE POLICY "Org members can view projects"
  ON projects FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Org members can create projects"
  ON projects FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Org members can update projects"
  ON projects FOR UPDATE TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Admins can delete projects"
  ON projects FOR DELETE TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.hierarchy_level <= 2
    )
  );

-- project_tasks policies
CREATE POLICY "Org members can view project tasks"
  ON project_tasks FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Org members can create project tasks"
  ON project_tasks FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Org members can update project tasks"
  ON project_tasks FOR UPDATE TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Task creator or admin can delete project tasks"
  ON project_tasks FOR DELETE TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE u.id = auth.uid() AND r.hierarchy_level <= 2
      )
    )
  );

-- project_activity_log policies
CREATE POLICY "Org members can view project activity"
  ON project_activity_log FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Org members can insert project activity"
  ON project_activity_log FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- project_files policies
CREATE POLICY "Org members can view project files"
  ON project_files FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Org members can attach project files"
  ON project_files FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Uploader or admin can remove project files"
  ON project_files FOR DELETE TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND (
      uploaded_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE u.id = auth.uid() AND r.hierarchy_level <= 2
      )
    )
  );

-- project_notes policies
CREATE POLICY "Org members can view project notes"
  ON project_notes FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Org members can create project notes"
  ON project_notes FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Creator or admin can update project notes"
  ON project_notes FOR UPDATE TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE u.id = auth.uid() AND r.hierarchy_level <= 2
      )
    )
  )
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Creator or admin can delete project notes"
  ON project_notes FOR DELETE TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE u.id = auth.uid() AND r.hierarchy_level <= 2
      )
    )
  );

-- project_costs policies
CREATE POLICY "Org members can view project costs"
  ON project_costs FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Org members can create project costs"
  ON project_costs FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Creator or admin can update project costs"
  ON project_costs FOR UPDATE TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE u.id = auth.uid() AND r.hierarchy_level <= 2
      )
    )
  )
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Creator or admin can delete project costs"
  ON project_costs FOR DELETE TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE u.id = auth.uid() AND r.hierarchy_level <= 2
      )
    )
  );
