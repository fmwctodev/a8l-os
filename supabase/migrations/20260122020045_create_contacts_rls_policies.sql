/*
  # Contacts Module - RLS Policies

  ## Overview
  Implements department-based access control for contacts:
  - Sales/Ops users see all contacts in their department
  - Managers see all contacts in their department
  - Admin/SuperAdmin see all contacts across all departments
  - Archived/merged contacts visible only to Admin/SuperAdmin when directly accessed

  ## 1. Helper Functions
  - get_user_department_id(): Returns current user's department ID
  - is_admin_or_higher(): Returns true if user is Admin or SuperAdmin
  - can_access_contact(contact_id): Checks if user can access specific contact

  ## 2. Access Rules by Role
  - SuperAdmin: All contacts in organization
  - Admin: All contacts in organization
  - Manager: All active contacts in their department
  - Sales/Ops: All active contacts in their department
  - ReadOnly: All active contacts in their department (view only)

  ## 3. Special Rules
  - Archived contacts visible only via Admin/SuperAdmin direct access
  - Merged contacts visible only via Admin/SuperAdmin direct access
  - Tags, custom fields are org-wide (not department restricted)
  - Notes, tasks inherit contact access rules
*/

CREATE OR REPLACE FUNCTION get_user_department_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT department_id FROM users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION is_admin_or_higher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid() AND r.hierarchy_level <= 2
  )
$$;

CREATE OR REPLACE FUNCTION can_access_contact(p_contact_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM contacts c
    WHERE c.id = p_contact_id
    AND c.organization_id = get_user_org_id()
    AND (
      is_admin_or_higher()
      OR (
        c.department_id = get_user_department_id()
        AND c.status = 'active'
        AND c.merged_into_contact_id IS NULL
      )
    )
  )
$$;

CREATE POLICY "SuperAdmin and Admin can view all contacts"
  ON contacts FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND is_admin_or_higher()
  );

CREATE POLICY "Users can view active contacts in their department"
  ON contacts FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND department_id = get_user_department_id()
    AND status = 'active'
    AND merged_into_contact_id IS NULL
    AND NOT is_admin_or_higher()
  );

CREATE POLICY "Users with permission can create contacts"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = get_user_org_id()
    AND has_permission('contacts.create')
    AND (
      is_admin_or_higher()
      OR department_id = get_user_department_id()
    )
  );

CREATE POLICY "Users with permission can update contacts in their department"
  ON contacts FOR UPDATE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND has_permission('contacts.edit')
    AND (
      is_admin_or_higher()
      OR (
        department_id = get_user_department_id()
        AND status = 'active'
        AND merged_into_contact_id IS NULL
      )
    )
  )
  WITH CHECK (
    organization_id = get_user_org_id()
    AND has_permission('contacts.edit')
  );

CREATE POLICY "Only admins can delete contacts"
  ON contacts FOR DELETE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND has_permission('contacts.delete')
    AND is_admin_or_higher()
  );

CREATE POLICY "Users can view org tags"
  ON tags FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id());

CREATE POLICY "Users with edit permission can create tags"
  ON tags FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = get_user_org_id()
    AND has_permission('contacts.edit')
  );

CREATE POLICY "Users with edit permission can update tags"
  ON tags FOR UPDATE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND has_permission('contacts.edit')
  )
  WITH CHECK (
    organization_id = get_user_org_id()
    AND has_permission('contacts.edit')
  );

CREATE POLICY "Only admins can delete tags"
  ON tags FOR DELETE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND is_admin_or_higher()
  );

CREATE POLICY "Users can view contact tags for accessible contacts"
  ON contact_tags FOR SELECT
  TO authenticated
  USING (can_access_contact(contact_id));

CREATE POLICY "Users with edit permission can add tags to contacts"
  ON contact_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    can_access_contact(contact_id)
    AND has_permission('contacts.edit')
  );

CREATE POLICY "Users with edit permission can remove tags from contacts"
  ON contact_tags FOR DELETE
  TO authenticated
  USING (
    can_access_contact(contact_id)
    AND has_permission('contacts.edit')
  );

CREATE POLICY "Users can view org custom fields"
  ON custom_fields FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id());

CREATE POLICY "Only admins can create custom fields"
  ON custom_fields FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = get_user_org_id()
    AND is_admin_or_higher()
  );

CREATE POLICY "Only admins can update custom fields"
  ON custom_fields FOR UPDATE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND is_admin_or_higher()
  )
  WITH CHECK (
    organization_id = get_user_org_id()
    AND is_admin_or_higher()
  );

CREATE POLICY "Only admins can delete custom fields"
  ON custom_fields FOR DELETE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND is_admin_or_higher()
  );

CREATE POLICY "Users can view custom field values for accessible contacts"
  ON contact_custom_field_values FOR SELECT
  TO authenticated
  USING (can_access_contact(contact_id));

CREATE POLICY "Users with edit permission can set custom field values"
  ON contact_custom_field_values FOR INSERT
  TO authenticated
  WITH CHECK (
    can_access_contact(contact_id)
    AND has_permission('contacts.edit')
  );

CREATE POLICY "Users with edit permission can update custom field values"
  ON contact_custom_field_values FOR UPDATE
  TO authenticated
  USING (
    can_access_contact(contact_id)
    AND has_permission('contacts.edit')
  )
  WITH CHECK (
    can_access_contact(contact_id)
    AND has_permission('contacts.edit')
  );

CREATE POLICY "Users with edit permission can delete custom field values"
  ON contact_custom_field_values FOR DELETE
  TO authenticated
  USING (
    can_access_contact(contact_id)
    AND has_permission('contacts.edit')
  );

CREATE POLICY "Users can view notes for accessible contacts"
  ON contact_notes FOR SELECT
  TO authenticated
  USING (can_access_contact(contact_id));

CREATE POLICY "Users with edit permission can create notes"
  ON contact_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    can_access_contact(contact_id)
    AND has_permission('contacts.edit')
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update their own notes"
  ON contact_notes FOR UPDATE
  TO authenticated
  USING (
    can_access_contact(contact_id)
    AND (user_id = auth.uid() OR is_admin_or_higher())
  )
  WITH CHECK (
    can_access_contact(contact_id)
    AND (user_id = auth.uid() OR is_admin_or_higher())
  );

CREATE POLICY "Users can delete their own notes or admins can delete any"
  ON contact_notes FOR DELETE
  TO authenticated
  USING (
    can_access_contact(contact_id)
    AND (user_id = auth.uid() OR is_admin_or_higher())
  );

CREATE POLICY "Users can view tasks for accessible contacts"
  ON contact_tasks FOR SELECT
  TO authenticated
  USING (can_access_contact(contact_id));

CREATE POLICY "Users with edit permission can create tasks"
  ON contact_tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    can_access_contact(contact_id)
    AND has_permission('contacts.edit')
    AND created_by_user_id = auth.uid()
  );

CREATE POLICY "Users can update tasks they created or are assigned to"
  ON contact_tasks FOR UPDATE
  TO authenticated
  USING (
    can_access_contact(contact_id)
    AND (
      created_by_user_id = auth.uid()
      OR assigned_to_user_id = auth.uid()
      OR is_admin_or_higher()
    )
  )
  WITH CHECK (
    can_access_contact(contact_id)
    AND (
      created_by_user_id = auth.uid()
      OR assigned_to_user_id = auth.uid()
      OR is_admin_or_higher()
    )
  );

CREATE POLICY "Users can delete tasks they created or admins can delete any"
  ON contact_tasks FOR DELETE
  TO authenticated
  USING (
    can_access_contact(contact_id)
    AND (created_by_user_id = auth.uid() OR is_admin_or_higher())
  );

CREATE POLICY "Users can view timeline for accessible contacts"
  ON contact_timeline FOR SELECT
  TO authenticated
  USING (can_access_contact(contact_id));

CREATE POLICY "System can insert timeline events"
  ON contact_timeline FOR INSERT
  TO authenticated
  WITH CHECK (can_access_contact(contact_id));
