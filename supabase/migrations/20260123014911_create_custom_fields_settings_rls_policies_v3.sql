/*
  # RLS Policies for Custom Fields Settings Module

  ## Overview
  Creates Row Level Security policies for custom_field_groups and 
  org_opportunity_custom_field_values tables.

  ## 1. custom_field_groups Policies
  - SELECT: Org members can view groups in their organization
  - INSERT/UPDATE/DELETE: Requires custom_fields.manage permission

  ## 2. org_opportunity_custom_field_values Policies
  - SELECT: Follows opportunity access patterns (org members)
  - INSERT/UPDATE/DELETE: Requires opportunities.edit permission

  ## 3. Notes
  - Policies check organization membership via users table
  - Write operations check for specific permissions
  - Uses existing user_has_permission helper function
*/

-- custom_field_groups policies

-- SELECT: Org members can view groups
CREATE POLICY "Org members can view custom field groups"
  ON custom_field_groups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = custom_field_groups.organization_id
    )
  );

-- INSERT: Requires custom_fields.manage permission
CREATE POLICY "Users with custom_fields.manage can create groups"
  ON custom_field_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = custom_field_groups.organization_id
    )
    AND user_has_permission(auth.uid(), 'custom_fields.manage')
  );

-- UPDATE: Requires custom_fields.manage permission
CREATE POLICY "Users with custom_fields.manage can update groups"
  ON custom_field_groups
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = custom_field_groups.organization_id
    )
    AND user_has_permission(auth.uid(), 'custom_fields.manage')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = custom_field_groups.organization_id
    )
    AND user_has_permission(auth.uid(), 'custom_fields.manage')
  );

-- DELETE: Requires custom_fields.manage permission
CREATE POLICY "Users with custom_fields.manage can delete groups"
  ON custom_field_groups
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = custom_field_groups.organization_id
    )
    AND user_has_permission(auth.uid(), 'custom_fields.manage')
  );

-- org_opportunity_custom_field_values policies

-- SELECT: Org members can view values
CREATE POLICY "Org members can view opportunity custom field values"
  ON org_opportunity_custom_field_values
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = org_opportunity_custom_field_values.organization_id
    )
  );

-- INSERT: Requires opportunities.edit permission
CREATE POLICY "Users with opportunities.edit can add opportunity field values"
  ON org_opportunity_custom_field_values
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = org_opportunity_custom_field_values.organization_id
    )
    AND user_has_permission(auth.uid(), 'opportunities.edit')
  );

-- UPDATE: Requires opportunities.edit permission
CREATE POLICY "Users with opportunities.edit can update opportunity field values"
  ON org_opportunity_custom_field_values
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = org_opportunity_custom_field_values.organization_id
    )
    AND user_has_permission(auth.uid(), 'opportunities.edit')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = org_opportunity_custom_field_values.organization_id
    )
    AND user_has_permission(auth.uid(), 'opportunities.edit')
  );

-- DELETE: Requires opportunities.edit permission
CREATE POLICY "Users with opportunities.edit can delete opportunity field values"
  ON org_opportunity_custom_field_values
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = org_opportunity_custom_field_values.organization_id
    )
    AND user_has_permission(auth.uid(), 'opportunities.edit')
  );
