/*
  # Row Level Security Policies

  ## Overview
  Implements comprehensive RLS policies for all tables to ensure:
  - Users can only access data within their organization
  - SuperAdmin bypasses all restrictions
  - Audit logs are append-only and viewable only by SuperAdmin
  - Proper CRUD permissions based on role

  ## 1. Helper Functions
  - get_user_org_id(): Returns current user's organization ID
  - get_user_role_name(): Returns current user's role name
  - is_super_admin(): Returns true if user is SuperAdmin
  - has_permission(key): Returns true if user has specific permission

  ## 2. Policy Structure
  Each table has policies for SELECT, INSERT, UPDATE, DELETE as needed
  SuperAdmin bypasses all checks via OR condition

  ## 3. Security Notes
  - Audit logs only allow INSERT (append-only)
  - Audit logs SELECT restricted to SuperAdmin
  - Roles/Permissions tables are read-only for most users
*/

CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT organization_id FROM users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION get_user_role_name()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT r.name FROM users u
  JOIN roles r ON u.role_id = r.id
  WHERE u.id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid() AND r.name = 'SuperAdmin'
  )
$$;

CREATE OR REPLACE FUNCTION has_permission(permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
    JOIN role_permissions rp ON u.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE u.id = auth.uid() AND p.key = permission_key
  ) OR is_super_admin()
$$;

CREATE OR REPLACE FUNCTION get_user_hierarchy_level()
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT r.hierarchy_level FROM users u
  JOIN roles r ON u.role_id = r.id
  WHERE u.id = auth.uid()
$$;

CREATE POLICY "SuperAdmin can do everything on organizations"
  ON organizations FOR ALL
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  TO authenticated
  USING (id = get_user_org_id());

CREATE POLICY "Admins can update their organization"
  ON organizations FOR UPDATE
  TO authenticated
  USING (id = get_user_org_id() AND has_permission('settings.manage'))
  WITH CHECK (id = get_user_org_id() AND has_permission('settings.manage'));

CREATE POLICY "SuperAdmin can do everything on departments"
  ON departments FOR ALL
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Users can view departments in their org"
  ON departments FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id());

CREATE POLICY "Admins can manage departments in their org"
  ON departments FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('settings.manage'));

CREATE POLICY "Admins can update departments in their org"
  ON departments FOR UPDATE
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('settings.manage'))
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('settings.manage'));

CREATE POLICY "Admins can delete departments in their org"
  ON departments FOR DELETE
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('settings.manage'));

CREATE POLICY "Anyone can view roles"
  ON roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "SuperAdmin can manage roles"
  ON roles FOR ALL
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Anyone can view permissions"
  ON permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "SuperAdmin can manage permissions"
  ON permissions FOR ALL
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Anyone can view role_permissions"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "SuperAdmin can manage role_permissions"
  ON role_permissions FOR ALL
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "SuperAdmin can do everything on users"
  ON users FOR ALL
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Users can view users in their org"
  ON users FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id());

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can insert users in their org"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = get_user_org_id() 
    AND has_permission('users.invite')
  );

CREATE POLICY "Admins can update users in their org"
  ON users FOR UPDATE
  TO authenticated
  USING (
    organization_id = get_user_org_id() 
    AND has_permission('users.manage')
    AND id != auth.uid()
  )
  WITH CHECK (
    organization_id = get_user_org_id() 
    AND has_permission('users.manage')
  );

CREATE POLICY "Only SuperAdmin can view audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can view feature flags"
  ON feature_flags FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "SuperAdmin can manage feature flags"
  ON feature_flags FOR ALL
  TO authenticated
  USING (is_super_admin());