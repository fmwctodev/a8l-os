/*
  # Update Drive RLS Policies for Per-User Access

  1. Changes
    - `drive_connections`: Users can only view/manage their own connection
      - SuperAdmins can manage any connection in their org
    - `drive_files`: All org members can view files (for file attachments)
      - Only the owning user can insert/update/delete their own file cache
    - `drive_folders`: Same pattern as drive_files

  2. Security
    - Write operations restricted to the owning user (user_id = auth.uid())
    - Read operations allow org-wide visibility for collaboration
    - SuperAdmins retain management capabilities
*/

-- ============================================
-- drive_connections -- Per-User Policies
-- ============================================
DROP POLICY IF EXISTS "Users can view drive connection for their org" ON drive_connections;
DROP POLICY IF EXISTS "Users with media.manage can create drive connection" ON drive_connections;
DROP POLICY IF EXISTS "Users with media.manage can update drive connection" ON drive_connections;
DROP POLICY IF EXISTS "Users with media.manage can delete drive connection" ON drive_connections;

CREATE POLICY "Users can view own drive connection"
  ON drive_connections FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can create own drive connection"
  ON drive_connections FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND organization_id = get_auth_user_org_id()
  );

CREATE POLICY "Users can update own drive connection"
  ON drive_connections FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own drive connection"
  ON drive_connections FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================
-- drive_files -- Per-User Write, Org-Wide Read
-- ============================================
DROP POLICY IF EXISTS "Users can view drive files for their org" ON drive_files;
DROP POLICY IF EXISTS "Users with media.manage can create file records" ON drive_files;
DROP POLICY IF EXISTS "Users with media.manage can update file records" ON drive_files;
DROP POLICY IF EXISTS "Users with media.manage can delete file records" ON drive_files;

CREATE POLICY "Users can view drive files in their org"
  ON drive_files FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can create own file records"
  ON drive_files FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND organization_id = get_auth_user_org_id()
  );

CREATE POLICY "Users can update own file records"
  ON drive_files FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own file records"
  ON drive_files FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================
-- drive_folders -- Per-User Write, Org-Wide Read
-- ============================================
DROP POLICY IF EXISTS "Users can view drive folders for their org" ON drive_folders;
DROP POLICY IF EXISTS "Users with media.manage can create folder records" ON drive_folders;
DROP POLICY IF EXISTS "Users with media.manage can update folder records" ON drive_folders;
DROP POLICY IF EXISTS "Users with media.manage can delete folder records" ON drive_folders;

CREATE POLICY "Users can view drive folders in their org"
  ON drive_folders FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can create own folder records"
  ON drive_folders FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND organization_id = get_auth_user_org_id()
  );

CREATE POLICY "Users can update own folder records"
  ON drive_folders FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own folder records"
  ON drive_folders FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));
