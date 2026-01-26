/*
  # Optimize RLS policies for custom values and contact-related tables

  1. Changes
    - Optimize RLS policies for custom_values table (uses org_id)
    - Optimize RLS policies for custom_value_categories table (uses org_id)
    - Optimize RLS policies for contact_notes table (uses contact_id -> contacts)
    - Optimize RLS policies for contact_tasks table (uses contact_id -> contacts)
    
  2. Security
    - Replace auth.uid() with (select auth.uid()) for performance
    - Maintain exact same security logic
    - All policies continue to check organization membership and permissions
*/

-- custom_values (uses org_id)
DROP POLICY IF EXISTS "Users can view custom values in their organization" ON custom_values;
CREATE POLICY "Users can view custom values in their organization"
  ON custom_values FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('custom_fields:view'));

DROP POLICY IF EXISTS "Users can create custom values" ON custom_values;
CREATE POLICY "Users can create custom values"
  ON custom_values FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('custom_fields:manage'));

DROP POLICY IF EXISTS "Users can update custom values" ON custom_values;
CREATE POLICY "Users can update custom values"
  ON custom_values FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('custom_fields:manage'));

DROP POLICY IF EXISTS "Users can delete custom values" ON custom_values;
CREATE POLICY "Users can delete custom values"
  ON custom_values FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('custom_fields:manage'));

-- custom_value_categories (uses org_id)
DROP POLICY IF EXISTS "Users can view custom value categories in their organization" ON custom_value_categories;
CREATE POLICY "Users can view custom value categories in their organization"
  ON custom_value_categories FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('custom_fields:view'));

DROP POLICY IF EXISTS "Users can create custom value categories" ON custom_value_categories;
CREATE POLICY "Users can create custom value categories"
  ON custom_value_categories FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('custom_fields:manage'));

DROP POLICY IF EXISTS "Users can update custom value categories" ON custom_value_categories;
CREATE POLICY "Users can update custom value categories"
  ON custom_value_categories FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('custom_fields:manage'));

DROP POLICY IF EXISTS "Users can delete custom value categories" ON custom_value_categories;
CREATE POLICY "Users can delete custom value categories"
  ON custom_value_categories FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('custom_fields:manage'));

-- contact_notes (links through contacts table, uses user_id not created_by)
DROP POLICY IF EXISTS "Users can view contact notes in their organization" ON contact_notes;
CREATE POLICY "Users can view contact notes in their organization"
  ON contact_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_notes.contact_id
      AND c.organization_id = get_user_org_id()
      AND has_permission('contacts:view')
    )
  );

DROP POLICY IF EXISTS "Users can create contact notes" ON contact_notes;
CREATE POLICY "Users can create contact notes"
  ON contact_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_notes.contact_id
      AND c.organization_id = get_user_org_id()
      AND has_permission('contacts:edit')
    )
  );

DROP POLICY IF EXISTS "Users can update their own contact notes" ON contact_notes;
CREATE POLICY "Users can update their own contact notes"
  ON contact_notes FOR UPDATE
  TO authenticated
  USING (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_notes.contact_id
      AND c.organization_id = get_user_org_id()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own contact notes" ON contact_notes;
CREATE POLICY "Users can delete their own contact notes"
  ON contact_notes FOR DELETE
  TO authenticated
  USING (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_notes.contact_id
      AND c.organization_id = get_user_org_id()
    )
  );

-- contact_tasks (links through contacts table)
DROP POLICY IF EXISTS "Users can view contact tasks in their organization" ON contact_tasks;
CREATE POLICY "Users can view contact tasks in their organization"
  ON contact_tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_tasks.contact_id
      AND c.organization_id = get_user_org_id()
      AND has_permission('contacts:view')
    )
  );

DROP POLICY IF EXISTS "Users can create contact tasks" ON contact_tasks;
CREATE POLICY "Users can create contact tasks"
  ON contact_tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by_user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_tasks.contact_id
      AND c.organization_id = get_user_org_id()
      AND has_permission('contacts:edit')
    )
  );

DROP POLICY IF EXISTS "Users can update contact tasks" ON contact_tasks;
CREATE POLICY "Users can update contact tasks"
  ON contact_tasks FOR UPDATE
  TO authenticated
  USING (
    (assigned_to_user_id = (select auth.uid()) OR has_permission('contacts:edit'))
    AND EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_tasks.contact_id
      AND c.organization_id = get_user_org_id()
    )
  );

DROP POLICY IF EXISTS "Users can delete contact tasks" ON contact_tasks;
CREATE POLICY "Users can delete contact tasks"
  ON contact_tasks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_tasks.contact_id
      AND c.organization_id = get_user_org_id()
      AND has_permission('contacts:edit')
    )
  );