/*
  # Optimize RLS Policies - User Related Tables

  ## Overview
  Optimizing RLS policies for user-related tables to use (select auth.uid())
  instead of direct auth.uid() calls.

  ## Tables Updated
  - user_preferences
  - user_notification_preferences
  - user_connected_accounts
  - user_sessions
  - user_permission_overrides
*/

-- user_preferences policies
DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;

CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- user_notification_preferences policies
DROP POLICY IF EXISTS "Users can view own notification preferences" ON user_notification_preferences;
DROP POLICY IF EXISTS "Users can insert own notification preferences" ON user_notification_preferences;
DROP POLICY IF EXISTS "Users can update own notification preferences" ON user_notification_preferences;
DROP POLICY IF EXISTS "Users can delete own notification preferences" ON user_notification_preferences;

CREATE POLICY "Users can view own notification preferences"
  ON user_notification_preferences FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own notification preferences"
  ON user_notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own notification preferences"
  ON user_notification_preferences FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own notification preferences"
  ON user_notification_preferences FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- user_connected_accounts policies
DROP POLICY IF EXISTS "Users can view own connected accounts" ON user_connected_accounts;
DROP POLICY IF EXISTS "Users can insert own connected accounts" ON user_connected_accounts;
DROP POLICY IF EXISTS "Users can update own connected accounts" ON user_connected_accounts;
DROP POLICY IF EXISTS "Users can delete own connected accounts" ON user_connected_accounts;

CREATE POLICY "Users can view own connected accounts"
  ON user_connected_accounts FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own connected accounts"
  ON user_connected_accounts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own connected accounts"
  ON user_connected_accounts FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own connected accounts"
  ON user_connected_accounts FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- user_sessions policies
DROP POLICY IF EXISTS "Users can view own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON user_sessions;

CREATE POLICY "Users can view own sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own sessions"
  ON user_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own sessions"
  ON user_sessions FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- user_permission_overrides policies
DROP POLICY IF EXISTS "Users can view their own permission overrides" ON user_permission_overrides;
DROP POLICY IF EXISTS "Admins can view all permission overrides in their org" ON user_permission_overrides;
DROP POLICY IF EXISTS "Admins can insert permission overrides" ON user_permission_overrides;
DROP POLICY IF EXISTS "Admins can update permission overrides" ON user_permission_overrides;
DROP POLICY IF EXISTS "Admins can delete permission overrides" ON user_permission_overrides;

CREATE POLICY "Users can view their own permission overrides"
  ON user_permission_overrides FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Admins can view all permission overrides in their org"
  ON user_permission_overrides FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = user_permission_overrides.user_id
      AND u.organization_id = get_user_org_id()
    )
    AND is_admin_or_higher()
  );

CREATE POLICY "Admins can insert permission overrides"
  ON user_permission_overrides FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = user_permission_overrides.user_id
      AND u.organization_id = get_user_org_id()
    )
    AND is_admin_or_higher()
  );

CREATE POLICY "Admins can update permission overrides"
  ON user_permission_overrides FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = user_permission_overrides.user_id
      AND u.organization_id = get_user_org_id()
    )
    AND is_admin_or_higher()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = user_permission_overrides.user_id
      AND u.organization_id = get_user_org_id()
    )
    AND is_admin_or_higher()
  );

CREATE POLICY "Admins can delete permission overrides"
  ON user_permission_overrides FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = user_permission_overrides.user_id
      AND u.organization_id = get_user_org_id()
    )
    AND is_admin_or_higher()
  );
