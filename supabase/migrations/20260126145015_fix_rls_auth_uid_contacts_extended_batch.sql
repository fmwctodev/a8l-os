/*
  # Fix RLS auth.uid() Performance - Contacts Extended Batch
  
  This migration optimizes RLS policies for contacts and related tables.
  
  ## Tables Fixed
  - contacts (organization_id)
  - contact_notes, contact_tasks, contact_timeline (via contact_id -> contacts)
  - contact_meeting_notes (org_id, created_by)
  
  ## Changes
  - All auth.uid() calls wrapped in (select auth.uid())
  - Using get_auth_user_org_id() for org checks
*/

-- ============================================
-- contacts (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view contacts in their org" ON contacts;
DROP POLICY IF EXISTS "Users can create contacts in their org" ON contacts;
DROP POLICY IF EXISTS "Users can update contacts in their org" ON contacts;
DROP POLICY IF EXISTS "Users can delete contacts in their org" ON contacts;

CREATE POLICY "Users can view contacts in their org"
  ON contacts FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can create contacts in their org"
  ON contacts FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can update contacts in their org"
  ON contacts FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id())
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can delete contacts in their org"
  ON contacts FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id());

-- ============================================
-- contact_notes (via contact_id -> contacts, user_id)
-- ============================================
DROP POLICY IF EXISTS "Users can create contact notes" ON contact_notes;
DROP POLICY IF EXISTS "Users can update their own contact notes" ON contact_notes;
DROP POLICY IF EXISTS "Users can delete their own contact notes" ON contact_notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON contact_notes;
DROP POLICY IF EXISTS "Users can delete their own notes or admins can delete any" ON contact_notes;
DROP POLICY IF EXISTS "Users with edit permission can create notes" ON contact_notes;

CREATE POLICY "Users can view contact notes in their org"
  ON contact_notes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM contacts c WHERE c.id = contact_notes.contact_id AND c.organization_id = get_auth_user_org_id()
  ));

CREATE POLICY "Users can create contact notes"
  ON contact_notes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM contacts c WHERE c.id = contact_notes.contact_id AND c.organization_id = get_auth_user_org_id()
  ) AND user_id = (select auth.uid()));

CREATE POLICY "Users can update their own contact notes"
  ON contact_notes FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM contacts c WHERE c.id = contact_notes.contact_id AND c.organization_id = get_auth_user_org_id()
  ) AND user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own contact notes"
  ON contact_notes FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM contacts c WHERE c.id = contact_notes.contact_id AND c.organization_id = get_auth_user_org_id()
  ) AND user_id = (select auth.uid()));

-- ============================================
-- contact_tasks (via contact_id -> contacts)
-- ============================================
DROP POLICY IF EXISTS "Users can create contact tasks" ON contact_tasks;
DROP POLICY IF EXISTS "Users can update contact tasks" ON contact_tasks;
DROP POLICY IF EXISTS "Users can update tasks they created or are assigned to" ON contact_tasks;
DROP POLICY IF EXISTS "Users can delete tasks they created or admins can delete any" ON contact_tasks;
DROP POLICY IF EXISTS "Users with edit permission can create tasks" ON contact_tasks;

CREATE POLICY "Users can view contact tasks in their org"
  ON contact_tasks FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM contacts c WHERE c.id = contact_tasks.contact_id AND c.organization_id = get_auth_user_org_id()
  ));

CREATE POLICY "Users can create contact tasks"
  ON contact_tasks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM contacts c WHERE c.id = contact_tasks.contact_id AND c.organization_id = get_auth_user_org_id()
  ) AND created_by_user_id = (select auth.uid()));

CREATE POLICY "Users can update tasks they created or are assigned to"
  ON contact_tasks FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM contacts c WHERE c.id = contact_tasks.contact_id AND c.organization_id = get_auth_user_org_id()
  ) AND (created_by_user_id = (select auth.uid()) OR assigned_to_user_id = (select auth.uid())));

CREATE POLICY "Users can delete tasks they created"
  ON contact_tasks FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM contacts c WHERE c.id = contact_tasks.contact_id AND c.organization_id = get_auth_user_org_id()
  ) AND created_by_user_id = (select auth.uid()));

-- ============================================
-- contact_timeline (via contact_id -> contacts)
-- ============================================
DROP POLICY IF EXISTS "Users can create contact timeline events" ON contact_timeline;

CREATE POLICY "Users can view contact timeline in their org"
  ON contact_timeline FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM contacts c WHERE c.id = contact_timeline.contact_id AND c.organization_id = get_auth_user_org_id()
  ));

CREATE POLICY "Users can create contact timeline events"
  ON contact_timeline FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM contacts c WHERE c.id = contact_timeline.contact_id AND c.organization_id = get_auth_user_org_id()
  ));

-- ============================================
-- contact_meeting_notes (org_id, created_by)
-- ============================================
DROP POLICY IF EXISTS "Users can view meeting notes in their org" ON contact_meeting_notes;
DROP POLICY IF EXISTS "Users can create meeting notes" ON contact_meeting_notes;
DROP POLICY IF EXISTS "Users can update their own meeting notes" ON contact_meeting_notes;
DROP POLICY IF EXISTS "Users can delete their own meeting notes" ON contact_meeting_notes;

CREATE POLICY "Users can view meeting notes in their org"
  ON contact_meeting_notes FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can create meeting notes"
  ON contact_meeting_notes FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id() AND created_by = (select auth.uid()));

CREATE POLICY "Users can update their own meeting notes"
  ON contact_meeting_notes FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id() AND created_by = (select auth.uid()))
  WITH CHECK (org_id = get_auth_user_org_id() AND created_by = (select auth.uid()));

CREATE POLICY "Users can delete their own meeting notes"
  ON contact_meeting_notes FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id() AND created_by = (select auth.uid()));
