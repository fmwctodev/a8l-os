/*
  # Fix RLS Auth Function Performance - Calendars Batch
  
  1. Problem
    - RLS policies using auth.uid() re-evaluate for each row
    - Wrapping in (select auth.uid()) evaluates once per query
  
  2. Tables Fixed
    - appointment_types (uses org_id)
    - availability_rules (uses org_id, user_id)
    - appointments (uses org_id, assigned_user_id)
    - calendars (uses org_id, owner_user_id)
    - blocked_slots (uses org_id)
*/

-- appointment_types policies
DROP POLICY IF EXISTS "Calendar managers can delete appointment types" ON appointment_types;
DROP POLICY IF EXISTS "Calendar managers can insert appointment types" ON appointment_types;
DROP POLICY IF EXISTS "Calendar managers can update appointment types" ON appointment_types;
DROP POLICY IF EXISTS "Users can view appointment types" ON appointment_types;

CREATE POLICY "Calendar managers can delete appointment types" ON appointment_types
  FOR DELETE TO authenticated
  USING (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'calendars.manage'
    )
  );

CREATE POLICY "Calendar managers can insert appointment types" ON appointment_types
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'calendars.manage'
    )
  );

CREATE POLICY "Calendar managers can update appointment types" ON appointment_types
  FOR UPDATE TO authenticated
  USING (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'calendars.manage'
    )
  )
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can view appointment types" ON appointment_types
  FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

-- availability_rules policies
DROP POLICY IF EXISTS "Calendar managers can delete availability" ON availability_rules;
DROP POLICY IF EXISTS "Users can insert their own availability" ON availability_rules;
DROP POLICY IF EXISTS "Users can update their own availability" ON availability_rules;
DROP POLICY IF EXISTS "Users can view availability rules" ON availability_rules;

CREATE POLICY "Calendar managers can delete availability" ON availability_rules
  FOR DELETE TO authenticated
  USING (
    user_id = (select auth.uid())
    OR (
      org_id = get_auth_user_org_id()
      AND EXISTS (
        SELECT 1 FROM role_permissions rp
        JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = get_auth_user_role_id()
        AND p.key = 'calendars.manage'
      )
    )
  );

CREATE POLICY "Users can insert their own availability" ON availability_rules
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND org_id = get_auth_user_org_id()
  );

CREATE POLICY "Users can update their own availability" ON availability_rules
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can view availability rules" ON availability_rules
  FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

-- appointments policies (uses assigned_user_id)
DROP POLICY IF EXISTS "Calendar managers can delete appointments" ON appointments;
DROP POLICY IF EXISTS "Users can insert appointments" ON appointments;
DROP POLICY IF EXISTS "Users can update appointments they manage" ON appointments;
DROP POLICY IF EXISTS "Users can view appointments they have access to" ON appointments;

CREATE POLICY "Calendar managers can delete appointments" ON appointments
  FOR DELETE TO authenticated
  USING (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'calendars.manage'
    )
  );

CREATE POLICY "Users can insert appointments" ON appointments
  FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update appointments they manage" ON appointments
  FOR UPDATE TO authenticated
  USING (
    assigned_user_id = (select auth.uid())
    OR org_id = get_auth_user_org_id()
  )
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can view appointments they have access to" ON appointments
  FOR SELECT TO authenticated
  USING (
    assigned_user_id = (select auth.uid())
    OR org_id = get_auth_user_org_id()
  );

-- calendars policies (uses owner_user_id)
DROP POLICY IF EXISTS "Admins can delete calendars" ON calendars;
DROP POLICY IF EXISTS "Admins can insert calendars" ON calendars;
DROP POLICY IF EXISTS "Calendar owners and admins can update calendars" ON calendars;

CREATE POLICY "Admins can delete calendars" ON calendars
  FOR DELETE TO authenticated
  USING (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'calendars.manage'
    )
  );

CREATE POLICY "Admins can insert calendars" ON calendars
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'calendars.manage'
    )
  );

CREATE POLICY "Calendar owners and admins can update calendars" ON calendars
  FOR UPDATE TO authenticated
  USING (
    owner_user_id = (select auth.uid())
    OR (
      org_id = get_auth_user_org_id()
      AND EXISTS (
        SELECT 1 FROM role_permissions rp
        JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = get_auth_user_role_id()
        AND p.key = 'calendars.manage'
      )
    )
  )
  WITH CHECK (org_id = get_auth_user_org_id());

-- blocked_slots policies
DROP POLICY IF EXISTS "Users with calendars.manage can create blocked slots" ON blocked_slots;
DROP POLICY IF EXISTS "Users with calendars.manage can delete blocked slots" ON blocked_slots;
DROP POLICY IF EXISTS "Users with calendars.manage can update blocked slots" ON blocked_slots;

CREATE POLICY "Users with calendars.manage can create blocked slots" ON blocked_slots
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'calendars.manage'
    )
  );

CREATE POLICY "Users with calendars.manage can delete blocked slots" ON blocked_slots
  FOR DELETE TO authenticated
  USING (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'calendars.manage'
    )
  );

CREATE POLICY "Users with calendars.manage can update blocked slots" ON blocked_slots
  FOR UPDATE TO authenticated
  USING (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'calendars.manage'
    )
  )
  WITH CHECK (org_id = get_auth_user_org_id());
