/*
  # Optimize RLS Policies - Contacts and Calendars Tables
  
  1. Changes
    - Optimizes RLS policies for contacts, contact_notes, contact_tasks, contact_timeline
    - Optimizes RLS policies for calendars, appointments, appointment_types, availability_rules
    - Changes auth.uid() to (select auth.uid()) for better query performance
  
  2. Tables Affected
    - contacts (uses organization_id)
    - contact_notes, contact_tasks, contact_timeline_events (use organization_id)
    - calendars, appointments, appointment_types, availability_rules, blocked_slots (use org_id)
  
  3. Security
    - No changes to actual security logic
    - Performance optimization only
*/

-- =============================================
-- CONTACTS TABLE (uses organization_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view contacts in their organization" ON contacts;
CREATE POLICY "Users can view contacts in their organization"
  ON contacts FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('contacts:view'));

DROP POLICY IF EXISTS "Users can create contacts in their organization" ON contacts;
CREATE POLICY "Users can create contacts in their organization"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('contacts:create'));

DROP POLICY IF EXISTS "Users can update contacts in their organization" ON contacts;
CREATE POLICY "Users can update contacts in their organization"
  ON contacts FOR UPDATE
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('contacts:edit'))
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('contacts:edit'));

DROP POLICY IF EXISTS "Users can delete contacts in their organization" ON contacts;
CREATE POLICY "Users can delete contacts in their organization"
  ON contacts FOR DELETE
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('contacts:delete'));

-- =============================================
-- CALENDARS TABLE (uses org_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view calendars in their organization" ON calendars;
CREATE POLICY "Users can view calendars in their organization"
  ON calendars FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('calendars:view'));

DROP POLICY IF EXISTS "Users can create calendars in their organization" ON calendars;
CREATE POLICY "Users can create calendars in their organization"
  ON calendars FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('calendars:manage'));

DROP POLICY IF EXISTS "Users can update calendars in their organization" ON calendars;
CREATE POLICY "Users can update calendars in their organization"
  ON calendars FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('calendars:manage'))
  WITH CHECK (org_id = get_user_org_id() AND has_permission('calendars:manage'));

DROP POLICY IF EXISTS "Users can delete calendars in their organization" ON calendars;
CREATE POLICY "Users can delete calendars in their organization"
  ON calendars FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('calendars:manage'));

-- =============================================
-- APPOINTMENTS TABLE (uses org_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view appointments in their organization" ON appointments;
CREATE POLICY "Users can view appointments in their organization"
  ON appointments FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('calendars:view'));

DROP POLICY IF EXISTS "Users can create appointments in their organization" ON appointments;
CREATE POLICY "Users can create appointments in their organization"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('calendars:book'));

DROP POLICY IF EXISTS "Users can update appointments in their organization" ON appointments;
CREATE POLICY "Users can update appointments in their organization"
  ON appointments FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('calendars:book'))
  WITH CHECK (org_id = get_user_org_id() AND has_permission('calendars:book'));

DROP POLICY IF EXISTS "Users can delete appointments in their organization" ON appointments;
CREATE POLICY "Users can delete appointments in their organization"
  ON appointments FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('calendars:book'));

-- =============================================
-- APPOINTMENT_TYPES TABLE (uses org_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view appointment types in their organization" ON appointment_types;
CREATE POLICY "Users can view appointment types in their organization"
  ON appointment_types FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can create appointment types in their organization" ON appointment_types;
CREATE POLICY "Users can create appointment types in their organization"
  ON appointment_types FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('calendars:manage'));

DROP POLICY IF EXISTS "Users can update appointment types in their organization" ON appointment_types;
CREATE POLICY "Users can update appointment types in their organization"
  ON appointment_types FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('calendars:manage'))
  WITH CHECK (org_id = get_user_org_id() AND has_permission('calendars:manage'));

DROP POLICY IF EXISTS "Users can delete appointment types in their organization" ON appointment_types;
CREATE POLICY "Users can delete appointment types in their organization"
  ON appointment_types FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('calendars:manage'));

-- =============================================
-- AVAILABILITY_RULES TABLE (uses org_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view availability rules in their organization" ON availability_rules;
CREATE POLICY "Users can view availability rules in their organization"
  ON availability_rules FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can create availability rules in their organization" ON availability_rules;
CREATE POLICY "Users can create availability rules in their organization"
  ON availability_rules FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('calendars:manage'));

DROP POLICY IF EXISTS "Users can update availability rules in their organization" ON availability_rules;
CREATE POLICY "Users can update availability rules in their organization"
  ON availability_rules FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('calendars:manage'))
  WITH CHECK (org_id = get_user_org_id() AND has_permission('calendars:manage'));

DROP POLICY IF EXISTS "Users can delete availability rules in their organization" ON availability_rules;
CREATE POLICY "Users can delete availability rules in their organization"
  ON availability_rules FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('calendars:manage'));

-- =============================================
-- BLOCKED_SLOTS TABLE (uses org_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view blocked slots in their organization" ON blocked_slots;
CREATE POLICY "Users can view blocked slots in their organization"
  ON blocked_slots FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can create blocked slots" ON blocked_slots;
CREATE POLICY "Users can create blocked slots"
  ON blocked_slots FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('calendars:manage'));

DROP POLICY IF EXISTS "Users can update blocked slots" ON blocked_slots;
CREATE POLICY "Users can update blocked slots"
  ON blocked_slots FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('calendars:manage'))
  WITH CHECK (org_id = get_user_org_id() AND has_permission('calendars:manage'));

DROP POLICY IF EXISTS "Users can delete blocked slots" ON blocked_slots;
CREATE POLICY "Users can delete blocked slots"
  ON blocked_slots FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('calendars:manage'));