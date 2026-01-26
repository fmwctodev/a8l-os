/*
  # Optimize RLS Policies - Conversations and Messages Tables
  
  1. Changes
    - Optimizes RLS policies for conversations, messages (use organization_id)
    - Optimizes RLS policies for snippets, conversation_rules (use organization_id)
  
  2. Tables Affected
    - messages, conversation_notes (use organization_id)
    - snippets, conversation_rules, tags, custom_fields, departments (use organization_id)
  
  3. Security
    - No changes to actual security logic
    - Performance optimization only
*/

-- =============================================
-- MESSAGES TABLE (uses organization_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view messages in their organization" ON messages;
CREATE POLICY "Users can view messages in their organization"
  ON messages FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('conversations:view'));

DROP POLICY IF EXISTS "Users can create messages in their organization" ON messages;
CREATE POLICY "Users can create messages in their organization"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('conversations:send'));

DROP POLICY IF EXISTS "Users can update messages in their organization" ON messages;
CREATE POLICY "Users can update messages in their organization"
  ON messages FOR UPDATE
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('conversations:send'))
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('conversations:send'));

-- =============================================
-- CONVERSATION_NOTES TABLE (uses organization_id, created_by)
-- =============================================

DROP POLICY IF EXISTS "Users can view conversation notes in their organization" ON conversation_notes;
CREATE POLICY "Users can view conversation notes in their organization"
  ON conversation_notes FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can create conversation notes" ON conversation_notes;
CREATE POLICY "Users can create conversation notes"
  ON conversation_notes FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_org_id() AND created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own conversation notes" ON conversation_notes;
CREATE POLICY "Users can update their own conversation notes"
  ON conversation_notes FOR UPDATE
  TO authenticated
  USING (organization_id = get_user_org_id() AND created_by = (select auth.uid()))
  WITH CHECK (organization_id = get_user_org_id() AND created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own conversation notes" ON conversation_notes;
CREATE POLICY "Users can delete their own conversation notes"
  ON conversation_notes FOR DELETE
  TO authenticated
  USING (organization_id = get_user_org_id() AND created_by = (select auth.uid()));

-- =============================================
-- SNIPPETS TABLE (uses organization_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view snippets in their organization" ON snippets;
CREATE POLICY "Users can view snippets in their organization"
  ON snippets FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can create snippets in their organization" ON snippets;
CREATE POLICY "Users can create snippets in their organization"
  ON snippets FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('conversations:manage_snippets'));

DROP POLICY IF EXISTS "Users can update snippets in their organization" ON snippets;
CREATE POLICY "Users can update snippets in their organization"
  ON snippets FOR UPDATE
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('conversations:manage_snippets'))
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('conversations:manage_snippets'));

DROP POLICY IF EXISTS "Users can delete snippets in their organization" ON snippets;
CREATE POLICY "Users can delete snippets in their organization"
  ON snippets FOR DELETE
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('conversations:manage_snippets'));

-- =============================================
-- CONVERSATION_RULES TABLE (uses organization_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view conversation rules in their organization" ON conversation_rules;
CREATE POLICY "Users can view conversation rules in their organization"
  ON conversation_rules FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can manage conversation rules" ON conversation_rules;
CREATE POLICY "Users can manage conversation rules"
  ON conversation_rules FOR ALL
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('conversations:manage_rules'))
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('conversations:manage_rules'));

-- =============================================
-- TAGS TABLE (uses organization_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view tags in their organization" ON tags;
CREATE POLICY "Users can view tags in their organization"
  ON tags FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can create tags in their organization" ON tags;
CREATE POLICY "Users can create tags in their organization"
  ON tags FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can update tags in their organization" ON tags;
CREATE POLICY "Users can update tags in their organization"
  ON tags FOR UPDATE
  TO authenticated
  USING (organization_id = get_user_org_id())
  WITH CHECK (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can delete tags in their organization" ON tags;
CREATE POLICY "Users can delete tags in their organization"
  ON tags FOR DELETE
  TO authenticated
  USING (organization_id = get_user_org_id());

-- =============================================
-- CUSTOM_FIELDS TABLE (uses organization_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view custom fields in their organization" ON custom_fields;
CREATE POLICY "Users can view custom fields in their organization"
  ON custom_fields FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can manage custom fields" ON custom_fields;
CREATE POLICY "Users can manage custom fields"
  ON custom_fields FOR ALL
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('settings:custom_fields'))
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('settings:custom_fields'));

-- =============================================
-- CUSTOM_FIELD_GROUPS TABLE (uses organization_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view custom field groups in their organization" ON custom_field_groups;
CREATE POLICY "Users can view custom field groups in their organization"
  ON custom_field_groups FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can manage custom field groups" ON custom_field_groups;
CREATE POLICY "Users can manage custom field groups"
  ON custom_field_groups FOR ALL
  TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('settings:custom_fields'))
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('settings:custom_fields'));

-- =============================================
-- DEPARTMENTS TABLE (uses organization_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view departments in their organization" ON departments;
CREATE POLICY "Users can view departments in their organization"
  ON departments FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Admins can manage departments" ON departments;
CREATE POLICY "Admins can manage departments"
  ON departments FOR ALL
  TO authenticated
  USING (organization_id = get_user_org_id() AND is_admin_or_higher())
  WITH CHECK (organization_id = get_user_org_id() AND is_admin_or_higher());