/*
  # Optimize Additional RLS Policies - Social and Calendar Tables
  
  1. Changes
    - Optimizes remaining RLS policies that use auth.uid() directly
    - Changes auth.uid() to (select auth.uid()) for better query performance
  
  2. Tables Affected
    - social_accounts, social_oauth_states, social_post_logs
    - calendar_members, appointment_sync, google_calendar_connections
    - availability_date_overrides, lost_reasons
  
  3. Security
    - No changes to actual security logic
    - Performance optimization only
*/

-- =============================================
-- SOCIAL_ACCOUNTS TABLE
-- =============================================

DROP POLICY IF EXISTS "Users with connect permission can create social accounts" ON social_accounts;
CREATE POLICY "Users with connect permission can create social accounts"
  ON social_accounts FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_org_id() AND connected_by = (select auth.uid()) AND has_permission('social:manage_accounts'));

DROP POLICY IF EXISTS "Users with connect permission can update social accounts" ON social_accounts;
CREATE POLICY "Users with connect permission can update social accounts"
  ON social_accounts FOR UPDATE
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('social:manage_accounts'))
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('social:manage_accounts'));

DROP POLICY IF EXISTS "Users with connect permission can delete social accounts" ON social_accounts;
CREATE POLICY "Users with connect permission can delete social accounts"
  ON social_accounts FOR DELETE
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('social:manage_accounts'));

-- =============================================
-- CALENDAR_MEMBERS TABLE
-- =============================================

DROP POLICY IF EXISTS "Users can view calendar members" ON calendar_members;
CREATE POLICY "Users can view calendar members"
  ON calendar_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM calendars c
      WHERE c.id = calendar_members.calendar_id
      AND c.org_id = get_user_org_id()
    )
  );

DROP POLICY IF EXISTS "Calendar managers can insert members" ON calendar_members;
CREATE POLICY "Calendar managers can insert members"
  ON calendar_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM calendars c
      WHERE c.id = calendar_members.calendar_id
      AND c.org_id = get_user_org_id()
      AND (c.owner_user_id = (select auth.uid()) OR has_permission('calendars:manage'))
    )
  );

DROP POLICY IF EXISTS "Calendar managers can update members" ON calendar_members;
CREATE POLICY "Calendar managers can update members"
  ON calendar_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM calendars c
      WHERE c.id = calendar_members.calendar_id
      AND c.org_id = get_user_org_id()
      AND (c.owner_user_id = (select auth.uid()) OR has_permission('calendars:manage'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM calendars c
      WHERE c.id = calendar_members.calendar_id
      AND c.org_id = get_user_org_id()
      AND (c.owner_user_id = (select auth.uid()) OR has_permission('calendars:manage'))
    )
  );

DROP POLICY IF EXISTS "Calendar managers can delete members" ON calendar_members;
CREATE POLICY "Calendar managers can delete members"
  ON calendar_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM calendars c
      WHERE c.id = calendar_members.calendar_id
      AND c.org_id = get_user_org_id()
      AND (c.owner_user_id = (select auth.uid()) OR has_permission('calendars:manage'))
    )
  );

-- =============================================
-- APPOINTMENT_SYNC TABLE
-- =============================================

DROP POLICY IF EXISTS "Users can view sync status for their appointments" ON appointment_sync;
CREATE POLICY "Users can view sync status for their appointments"
  ON appointment_sync FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_sync.appointment_id
      AND a.org_id = get_user_org_id()
    )
  );

DROP POLICY IF EXISTS "Users can insert sync records for their appointments" ON appointment_sync;
CREATE POLICY "Users can insert sync records for their appointments"
  ON appointment_sync FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_sync.appointment_id
      AND a.org_id = get_user_org_id()
    )
  );

DROP POLICY IF EXISTS "Users can update sync records for their appointments" ON appointment_sync;
CREATE POLICY "Users can update sync records for their appointments"
  ON appointment_sync FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_sync.appointment_id
      AND a.org_id = get_user_org_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_sync.appointment_id
      AND a.org_id = get_user_org_id()
    )
  );

-- =============================================
-- GOOGLE_CALENDAR_CONNECTIONS TABLE
-- =============================================

DROP POLICY IF EXISTS "Users can view their own Google connections" ON google_calendar_connections;
CREATE POLICY "Users can view their own Google connections"
  ON google_calendar_connections FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()) AND org_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can insert their own Google connections" ON google_calendar_connections;
CREATE POLICY "Users can insert their own Google connections"
  ON google_calendar_connections FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()) AND org_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can update their own Google connections" ON google_calendar_connections;
CREATE POLICY "Users can update their own Google connections"
  ON google_calendar_connections FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()) AND org_id = get_user_org_id())
  WITH CHECK (user_id = (select auth.uid()) AND org_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can delete their own Google connections" ON google_calendar_connections;
CREATE POLICY "Users can delete their own Google connections"
  ON google_calendar_connections FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()) AND org_id = get_user_org_id());

-- =============================================
-- SOCIAL_OAUTH_STATES TABLE
-- =============================================

DROP POLICY IF EXISTS "Users can view their own OAuth states" ON social_oauth_states;
CREATE POLICY "Users can view their own OAuth states"
  ON social_oauth_states FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create their own OAuth states" ON social_oauth_states;
CREATE POLICY "Users can create their own OAuth states"
  ON social_oauth_states FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own OAuth states" ON social_oauth_states;
CREATE POLICY "Users can delete their own OAuth states"
  ON social_oauth_states FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- =============================================
-- SOCIAL_POST_LOGS TABLE
-- =============================================

DROP POLICY IF EXISTS "Users can view post logs in their organization" ON social_post_logs;
CREATE POLICY "Users can view post logs in their organization"
  ON social_post_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM social_posts sp
      WHERE sp.id = social_post_logs.post_id
      AND sp.organization_id = get_user_org_id()
    )
  );

-- =============================================
-- AVAILABILITY_DATE_OVERRIDES TABLE
-- =============================================

DROP POLICY IF EXISTS "Users can view date overrides in their org" ON availability_date_overrides;
CREATE POLICY "Users can view date overrides in their org"
  ON availability_date_overrides FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "Users with calendars.manage can create date overrides" ON availability_date_overrides;
CREATE POLICY "Users with calendars.manage can create date overrides"
  ON availability_date_overrides FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('calendars:manage'));

DROP POLICY IF EXISTS "Users with calendars.manage can update date overrides" ON availability_date_overrides;
CREATE POLICY "Users with calendars.manage can update date overrides"
  ON availability_date_overrides FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('calendars:manage'))
  WITH CHECK (org_id = get_user_org_id() AND has_permission('calendars:manage'));

DROP POLICY IF EXISTS "Users with calendars.manage can delete date overrides" ON availability_date_overrides;
CREATE POLICY "Users with calendars.manage can delete date overrides"
  ON availability_date_overrides FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('calendars:manage'));

-- =============================================
-- LOST_REASONS TABLE
-- =============================================

DROP POLICY IF EXISTS "Users can view active lost reasons" ON lost_reasons;
CREATE POLICY "Users can view active lost reasons"
  ON lost_reasons FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "Admins can create lost reasons" ON lost_reasons;
CREATE POLICY "Admins can create lost reasons"
  ON lost_reasons FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('opportunities:manage_pipelines'));

DROP POLICY IF EXISTS "Admins can update lost reasons" ON lost_reasons;
CREATE POLICY "Admins can update lost reasons"
  ON lost_reasons FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('opportunities:manage_pipelines'))
  WITH CHECK (org_id = get_user_org_id() AND has_permission('opportunities:manage_pipelines'));

DROP POLICY IF EXISTS "Admins can delete lost reasons" ON lost_reasons;
CREATE POLICY "Admins can delete lost reasons"
  ON lost_reasons FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('opportunities:manage_pipelines'));