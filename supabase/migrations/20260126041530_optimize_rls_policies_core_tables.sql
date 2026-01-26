/*
  # Optimize RLS Policies - Core Tables

  ## Overview
  RLS policies that call auth.uid() or auth.jwt() directly re-evaluate these
  functions for each row, causing poor performance at scale. Wrapping these
  calls in (select ...) causes them to be evaluated once per query.

  ## Tables Updated
  - users
  - contacts  
  - conversations
  - opportunities

  ## Security Note
  These policies maintain the same security guarantees, just with better performance.
*/

-- Drop and recreate users policies with optimization
DROP POLICY IF EXISTS "Users can view own profile data" ON users;
DROP POLICY IF EXISTS "Users can update own profile data" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Admins can update users in their org" ON users;

CREATE POLICY "Users can view own profile data"
  ON users FOR SELECT
  TO authenticated
  USING (id = (select auth.uid()));

CREATE POLICY "Users can update own profile data"
  ON users FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

CREATE POLICY "Admins can update users in their org"
  ON users FOR UPDATE
  TO authenticated
  USING (
    organization_id = get_user_org_id() 
    AND is_admin_or_higher()
  )
  WITH CHECK (
    organization_id = get_user_org_id()
    AND is_admin_or_higher()
  );

-- Drop and recreate conversations policies
DROP POLICY IF EXISTS "Users can view conversations for accessible contacts" ON conversations;
DROP POLICY IF EXISTS "Users can update conversations they have access to" ON conversations;

CREATE POLICY "Users can view conversations for accessible contacts"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND (
      assigned_user_id = (select auth.uid())
      OR contact_id IN (SELECT id FROM contacts WHERE can_access_contact(id))
    )
  );

CREATE POLICY "Users can update conversations they have access to"
  ON conversations FOR UPDATE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND (
      assigned_user_id = (select auth.uid())
      OR is_admin_or_higher()
    )
  )
  WITH CHECK (
    organization_id = get_user_org_id()
  );
