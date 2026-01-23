/*
  # Create RLS Policies for Media Module

  1. Security Policies
    - drive_connections: Only admins can view/manage
    - drive_folders: All authenticated org members can view
    - drive_files: All authenticated org members can view, managers can modify
    - file_attachments: All authenticated org members can view, managers can create/delete

  2. Policy Details
    - All policies check organization membership
    - Write policies check for media.manage permission
    - Read policies check for media.view permission
*/

-- Helper function to check media permission (if not exists)
CREATE OR REPLACE FUNCTION has_media_permission(user_id uuid, org_id uuid, required_permission text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE u.id = user_id
    AND u.organization_id = org_id
    AND p.key = required_permission
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- drive_connections policies
-- =====================

-- Users with media.view can see connection status
CREATE POLICY "Users can view drive connection for their org"
  ON drive_connections
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND has_media_permission(auth.uid(), organization_id, 'media.view')
  );

-- Only users with media.manage can create connections
CREATE POLICY "Users with media.manage can create drive connection"
  ON drive_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND has_media_permission(auth.uid(), organization_id, 'media.manage')
  );

-- Only users with media.manage can update connections
CREATE POLICY "Users with media.manage can update drive connection"
  ON drive_connections
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND has_media_permission(auth.uid(), organization_id, 'media.manage')
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND has_media_permission(auth.uid(), organization_id, 'media.manage')
  );

-- Only users with media.manage can delete connections
CREATE POLICY "Users with media.manage can delete drive connection"
  ON drive_connections
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND has_media_permission(auth.uid(), organization_id, 'media.manage')
  );

-- =====================
-- drive_folders policies
-- =====================

-- Users with media.view can see folders
CREATE POLICY "Users can view drive folders for their org"
  ON drive_folders
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND has_media_permission(auth.uid(), organization_id, 'media.view')
  );

-- Users with media.manage can create folder records
CREATE POLICY "Users with media.manage can create folder records"
  ON drive_folders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND has_media_permission(auth.uid(), organization_id, 'media.manage')
  );

-- Users with media.manage can update folder records
CREATE POLICY "Users with media.manage can update folder records"
  ON drive_folders
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND has_media_permission(auth.uid(), organization_id, 'media.manage')
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND has_media_permission(auth.uid(), organization_id, 'media.manage')
  );

-- Users with media.manage can delete folder records
CREATE POLICY "Users with media.manage can delete folder records"
  ON drive_folders
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND has_media_permission(auth.uid(), organization_id, 'media.manage')
  );

-- =====================
-- drive_files policies
-- =====================

-- Users with media.view can see files
CREATE POLICY "Users can view drive files for their org"
  ON drive_files
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND has_media_permission(auth.uid(), organization_id, 'media.view')
  );

-- Users with media.manage can create file records
CREATE POLICY "Users with media.manage can create file records"
  ON drive_files
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND has_media_permission(auth.uid(), organization_id, 'media.manage')
  );

-- Users with media.manage can update file records
CREATE POLICY "Users with media.manage can update file records"
  ON drive_files
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND has_media_permission(auth.uid(), organization_id, 'media.manage')
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND has_media_permission(auth.uid(), organization_id, 'media.manage')
  );

-- Users with media.manage can delete file records
CREATE POLICY "Users with media.manage can delete file records"
  ON drive_files
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND has_media_permission(auth.uid(), organization_id, 'media.manage')
  );

-- =====================
-- file_attachments policies
-- =====================

-- Users with media.view can see attachments
CREATE POLICY "Users can view file attachments for their org"
  ON file_attachments
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND has_media_permission(auth.uid(), organization_id, 'media.view')
  );

-- Users with media.manage can create attachments
CREATE POLICY "Users with media.manage can create file attachments"
  ON file_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND has_media_permission(auth.uid(), organization_id, 'media.manage')
  );

-- Users with media.manage can update attachments
CREATE POLICY "Users with media.manage can update file attachments"
  ON file_attachments
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND has_media_permission(auth.uid(), organization_id, 'media.manage')
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND has_media_permission(auth.uid(), organization_id, 'media.manage')
  );

-- Users with media.manage can delete attachments
CREATE POLICY "Users with media.manage can delete file attachments"
  ON file_attachments
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND has_media_permission(auth.uid(), organization_id, 'media.manage')
  );
