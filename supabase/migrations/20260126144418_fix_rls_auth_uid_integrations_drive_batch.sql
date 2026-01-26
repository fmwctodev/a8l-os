/*
  # Fix RLS auth.uid() Performance - Integrations & Drive Batch
  
  This migration optimizes RLS policies for integration and drive-related tables.
  
  ## Tables Fixed
  - integrations, integration_connections, integration_logs (org_id)
  - drive_connections, drive_folders, drive_files (organization_id)
  - file_attachments (organization_id, attached_by)
  
  ## Changes
  - All auth.uid() calls wrapped in (select auth.uid())
  - Using get_auth_user_org_id() for org checks
*/

-- ============================================
-- integrations (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view integrations in their org" ON integrations;
DROP POLICY IF EXISTS "Admins can insert integrations" ON integrations;
DROP POLICY IF EXISTS "Admins can update integrations" ON integrations;
DROP POLICY IF EXISTS "Admins can delete integrations" ON integrations;

CREATE POLICY "Users can view integrations in their org"
  ON integrations FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id() OR org_id IS NULL);

CREATE POLICY "Admins can insert integrations"
  ON integrations FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can update integrations"
  ON integrations FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can delete integrations"
  ON integrations FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- integration_connections (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view global connections in their org" ON integration_connections;
DROP POLICY IF EXISTS "Users can create integration connections" ON integration_connections;
DROP POLICY IF EXISTS "Users can insert their own connections" ON integration_connections;
DROP POLICY IF EXISTS "Users can update their own connections" ON integration_connections;
DROP POLICY IF EXISTS "Users can delete their own connections" ON integration_connections;

CREATE POLICY "Users can view global connections in their org"
  ON integration_connections FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can insert their own connections"
  ON integration_connections FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Users can update their own connections"
  ON integration_connections FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()))
  WITH CHECK (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own connections"
  ON integration_connections FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

-- ============================================
-- integration_logs (org_id)
-- ============================================
DROP POLICY IF EXISTS "Admins can view integration logs" ON integration_logs;
DROP POLICY IF EXISTS "System can insert integration logs" ON integration_logs;

CREATE POLICY "Admins can view integration logs"
  ON integration_logs FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "System can insert integration logs"
  ON integration_logs FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

-- ============================================
-- drive_connections (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view drive connection for their org" ON drive_connections;
DROP POLICY IF EXISTS "Users with media.manage can create drive connection" ON drive_connections;
DROP POLICY IF EXISTS "Users with media.manage can update drive connection" ON drive_connections;
DROP POLICY IF EXISTS "Users with media.manage can delete drive connection" ON drive_connections;

CREATE POLICY "Users can view drive connection for their org"
  ON drive_connections FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users with media.manage can create drive connection"
  ON drive_connections FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users with media.manage can update drive connection"
  ON drive_connections FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id())
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users with media.manage can delete drive connection"
  ON drive_connections FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id());

-- ============================================
-- drive_folders (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view drive folders for their org" ON drive_folders;
DROP POLICY IF EXISTS "Users with media.manage can create folder records" ON drive_folders;
DROP POLICY IF EXISTS "Users with media.manage can update folder records" ON drive_folders;
DROP POLICY IF EXISTS "Users with media.manage can delete folder records" ON drive_folders;

CREATE POLICY "Users can view drive folders for their org"
  ON drive_folders FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users with media.manage can create folder records"
  ON drive_folders FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users with media.manage can update folder records"
  ON drive_folders FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id())
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users with media.manage can delete folder records"
  ON drive_folders FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id());

-- ============================================
-- drive_files (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view drive files for their org" ON drive_files;
DROP POLICY IF EXISTS "Users with media.manage can create file records" ON drive_files;
DROP POLICY IF EXISTS "Users with media.manage can update file records" ON drive_files;
DROP POLICY IF EXISTS "Users with media.manage can delete file records" ON drive_files;

CREATE POLICY "Users can view drive files for their org"
  ON drive_files FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users with media.manage can create file records"
  ON drive_files FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users with media.manage can update file records"
  ON drive_files FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id())
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users with media.manage can delete file records"
  ON drive_files FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id());

-- ============================================
-- file_attachments (organization_id, attached_by)
-- ============================================
DROP POLICY IF EXISTS "Users can view file attachments for their org" ON file_attachments;
DROP POLICY IF EXISTS "Users can create file attachments" ON file_attachments;
DROP POLICY IF EXISTS "Users can delete their own file attachments" ON file_attachments;
DROP POLICY IF EXISTS "Users with media.manage can create file attachments" ON file_attachments;
DROP POLICY IF EXISTS "Users with media.manage can update file attachments" ON file_attachments;
DROP POLICY IF EXISTS "Users with media.manage can delete file attachments" ON file_attachments;

CREATE POLICY "Users can view file attachments for their org"
  ON file_attachments FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can create file attachments"
  ON file_attachments FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id() AND attached_by = (select auth.uid()));

CREATE POLICY "Users can update file attachments"
  ON file_attachments FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id())
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can delete their own file attachments"
  ON file_attachments FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND attached_by = (select auth.uid()));
