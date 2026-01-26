/*
  # Fix RLS auth.uid() Performance - Conversations & Messages Batch
  
  This migration optimizes RLS policies for conversations and messaging tables.
  
  ## Tables Fixed
  - conversations, conversation_notes (organization_id)
  - messages, message_attachments, message_templates (organization_id)
  - snippets (organization_id, created_by_user_id, scope)
  
  ## Changes
  - All auth.uid() calls wrapped in (select auth.uid())
  - Using get_auth_user_org_id() for org checks
*/

-- ============================================
-- conversations (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view conversations in their org" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations in their org" ON conversations;
DROP POLICY IF EXISTS "Users can update conversations in their org" ON conversations;
DROP POLICY IF EXISTS "Admins can delete conversations in their org" ON conversations;

CREATE POLICY "Users can view conversations in their org"
  ON conversations FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can create conversations in their org"
  ON conversations FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can update conversations in their org"
  ON conversations FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id())
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Admins can delete conversations in their org"
  ON conversations FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id());

-- ============================================
-- conversation_notes (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view org conversation notes" ON conversation_notes;
DROP POLICY IF EXISTS "Users can create conversation notes" ON conversation_notes;
DROP POLICY IF EXISTS "Users can update conversation notes" ON conversation_notes;
DROP POLICY IF EXISTS "Users can update their own conversation notes" ON conversation_notes;
DROP POLICY IF EXISTS "Users can delete conversation notes" ON conversation_notes;
DROP POLICY IF EXISTS "Users can delete their own conversation notes" ON conversation_notes;

CREATE POLICY "Users can view org conversation notes"
  ON conversation_notes FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can create conversation notes"
  ON conversation_notes FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can update their own conversation notes"
  ON conversation_notes FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND created_by = (select auth.uid()))
  WITH CHECK (organization_id = get_auth_user_org_id() AND created_by = (select auth.uid()));

CREATE POLICY "Users can delete their own conversation notes"
  ON conversation_notes FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND created_by = (select auth.uid()));

-- ============================================
-- messages (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view messages in their org" ON messages;
DROP POLICY IF EXISTS "Users can create messages in their org" ON messages;
DROP POLICY IF EXISTS "Users can update messages in their org" ON messages;
DROP POLICY IF EXISTS "Admins can delete messages in their org" ON messages;

CREATE POLICY "Users can view messages in their org"
  ON messages FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can create messages in their org"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can update messages in their org"
  ON messages FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id())
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Admins can delete messages in their org"
  ON messages FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id());

-- ============================================
-- message_attachments (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view org message attachments" ON message_attachments;
DROP POLICY IF EXISTS "Users with reply permission can add attachments" ON message_attachments;
DROP POLICY IF EXISTS "Users with manage permission can delete attachments" ON message_attachments;

CREATE POLICY "Users can view org message attachments"
  ON message_attachments FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users with reply permission can add attachments"
  ON message_attachments FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users with manage permission can delete attachments"
  ON message_attachments FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id());

-- ============================================
-- message_templates (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view org message templates" ON message_templates;
DROP POLICY IF EXISTS "Users with permission can create message templates" ON message_templates;
DROP POLICY IF EXISTS "Users with permission can update message templates" ON message_templates;
DROP POLICY IF EXISTS "Users with permission can delete message templates" ON message_templates;

CREATE POLICY "Users can view org message templates"
  ON message_templates FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users with permission can create message templates"
  ON message_templates FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users with permission can update message templates"
  ON message_templates FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id())
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users with permission can delete message templates"
  ON message_templates FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id());

-- ============================================
-- snippets (organization_id, created_by_user_id, scope)
-- ============================================
DROP POLICY IF EXISTS "Users can view accessible snippets" ON snippets;
DROP POLICY IF EXISTS "Users can create personal snippets" ON snippets;
DROP POLICY IF EXISTS "Users can update their own snippets" ON snippets;
DROP POLICY IF EXISTS "Users can delete their own snippets" ON snippets;

CREATE POLICY "Users can view accessible snippets"
  ON snippets FOR SELECT TO authenticated
  USING (
    organization_id = get_auth_user_org_id() 
    AND (scope = 'organization' OR created_by_user_id = (select auth.uid()))
  );

CREATE POLICY "Users can create personal snippets"
  ON snippets FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id() AND created_by_user_id = (select auth.uid()));

CREATE POLICY "Users can update their own snippets"
  ON snippets FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND created_by_user_id = (select auth.uid()))
  WITH CHECK (organization_id = get_auth_user_org_id() AND created_by_user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own snippets"
  ON snippets FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND created_by_user_id = (select auth.uid()));
