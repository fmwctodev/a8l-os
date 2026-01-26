/*
  # Optimize RLS Policies - Contacts, Conversations, Messages

  Optimizes RLS policies to use `(select auth.uid())` pattern for better performance.

  1. Tables Updated
    - contacts
    - conversations
    - messages

  2. Performance Impact
    - Prevents re-evaluation of auth.uid() per row
    - Caches the result for the entire query
*/

-- ============================================
-- CONTACTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view contacts in their organization" ON contacts;
DROP POLICY IF EXISTS "Users can create contacts in their organization" ON contacts;
DROP POLICY IF EXISTS "Users can update contacts in their organization" ON contacts;
DROP POLICY IF EXISTS "Users can delete contacts in their organization" ON contacts;
DROP POLICY IF EXISTS "Users can view active contacts in their department" ON contacts;
DROP POLICY IF EXISTS "Users with permission can create contacts" ON contacts;
DROP POLICY IF EXISTS "Users with permission can update contacts in their department" ON contacts;
DROP POLICY IF EXISTS "SuperAdmin and Admin can view all contacts" ON contacts;
DROP POLICY IF EXISTS "Only admins can delete contacts" ON contacts;

CREATE POLICY "Users can view contacts in their org"
  ON contacts FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

CREATE POLICY "Users can create contacts in their org"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = (select auth.uid())
      AND p.key = 'contacts.create'
    )
  );

CREATE POLICY "Users can update contacts in their org"
  ON contacts FOR UPDATE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = (select auth.uid())
      AND p.key = 'contacts.edit'
    )
  )
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

CREATE POLICY "Users can delete contacts in their org"
  ON contacts FOR DELETE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = (select auth.uid())
      AND p.key = 'contacts.delete'
    )
  );

-- ============================================
-- CONVERSATIONS TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view conversations for accessible contacts" ON conversations;
DROP POLICY IF EXISTS "Admins can view all conversations" ON conversations;
DROP POLICY IF EXISTS "System can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update conversations they have access to" ON conversations;
DROP POLICY IF EXISTS "Only admins can delete conversations" ON conversations;

CREATE POLICY "Users can view conversations in their org"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

CREATE POLICY "Users can create conversations in their org"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

CREATE POLICY "Users can update conversations in their org"
  ON conversations FOR UPDATE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  )
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

CREATE POLICY "Admins can delete conversations in their org"
  ON conversations FOR DELETE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = (select auth.uid())
      AND p.key = 'conversations.delete'
    )
  );

-- ============================================
-- MESSAGES TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view messages in their organization" ON messages;
DROP POLICY IF EXISTS "Users can view messages in accessible conversations" ON messages;
DROP POLICY IF EXISTS "Users can create messages in their organization" ON messages;
DROP POLICY IF EXISTS "Users can update messages in their organization" ON messages;
DROP POLICY IF EXISTS "Users with send permission can create messages" ON messages;
DROP POLICY IF EXISTS "System can update message status" ON messages;
DROP POLICY IF EXISTS "Only admins can delete messages" ON messages;

CREATE POLICY "Users can view messages in their org"
  ON messages FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

CREATE POLICY "Users can create messages in their org"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = (select auth.uid())
      AND p.key = 'conversations.send'
    )
  );

CREATE POLICY "Users can update messages in their org"
  ON messages FOR UPDATE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  )
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
  );

CREATE POLICY "Admins can delete messages in their org"
  ON messages FOR DELETE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = (select auth.uid()))
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = (select auth.uid())
      AND p.key = 'conversations.delete'
    )
  );
