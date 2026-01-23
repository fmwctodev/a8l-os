/*
  # Conversations Advanced Features - RLS Policies

  ## Overview
  Implements access control for snippets, AI drafts, and conversation rules.

  ## 1. Snippets Access Rules
  - Personal snippets: Only creator can view/edit
  - Team snippets: Users in same department can view, creator/admin can edit
  - System snippets: All users can view, only admin can edit
  - Creating snippets requires snippets.create permission
  - Managing all snippets requires snippets.manage permission
  - System snippets require snippets.system.manage permission

  ## 2. AI Drafts Access Rules
  - Inherit from conversation access
  - Users with send permission can approve/reject drafts
  - Only user who approved or admin can delete

  ## 3. Conversation Rules Access Rules
  - Viewing rules requires conversation_rules.view permission
  - Managing rules requires conversation_rules.manage permission
  - Rule logs inherit from rule access

  ## 4. Security Notes
  - All policies check organization_id for data isolation
  - Department scoping ensures team data stays within teams
*/

-- Helper function to check snippet access
CREATE OR REPLACE FUNCTION can_access_snippet(p_snippet_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM snippets s
    WHERE s.id = p_snippet_id
    AND s.organization_id = get_user_org_id()
    AND (
      is_admin_or_higher()
      OR s.created_by_user_id = auth.uid()
      OR s.scope = 'system'
      OR (s.scope = 'team' AND s.department_id = get_user_department_id())
    )
  )
$$;

-- Helper function to get user's department_id
CREATE OR REPLACE FUNCTION get_user_department_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT department_id FROM users WHERE id = auth.uid()
$$;

-- =====================
-- SNIPPETS POLICIES
-- =====================

CREATE POLICY "Users can view accessible snippets"
  ON snippets FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND (
      is_admin_or_higher()
      OR created_by_user_id = auth.uid()
      OR scope = 'system'
      OR (scope = 'team' AND department_id = get_user_department_id())
    )
  );

CREATE POLICY "Users can create personal snippets"
  ON snippets FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = get_user_org_id()
    AND created_by_user_id = auth.uid()
    AND has_permission('snippets.create')
    AND (
      scope = 'personal'
      OR (scope = 'team' AND has_permission('snippets.manage'))
      OR (scope = 'system' AND has_permission('snippets.system.manage'))
    )
  );

CREATE POLICY "Users can update their own snippets"
  ON snippets FOR UPDATE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND (
      created_by_user_id = auth.uid()
      OR has_permission('snippets.manage')
      OR (scope = 'system' AND has_permission('snippets.system.manage'))
    )
  )
  WITH CHECK (
    organization_id = get_user_org_id()
    AND (
      created_by_user_id = auth.uid()
      OR has_permission('snippets.manage')
      OR (scope = 'system' AND has_permission('snippets.system.manage'))
    )
  );

CREATE POLICY "Users can delete their own snippets"
  ON snippets FOR DELETE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND (
      created_by_user_id = auth.uid()
      OR has_permission('snippets.manage')
      OR (scope = 'system' AND has_permission('snippets.system.manage'))
    )
  );

-- =====================
-- AI DRAFTS POLICIES
-- =====================

CREATE POLICY "Users can view AI drafts for accessible conversations"
  ON ai_drafts FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND can_access_conversation(conversation_id)
  );

CREATE POLICY "Users can create AI drafts"
  ON ai_drafts FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = get_user_org_id()
    AND has_permission('conversations.send')
    AND can_access_conversation(conversation_id)
  );

CREATE POLICY "Users can update AI drafts for accessible conversations"
  ON ai_drafts FOR UPDATE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND can_access_conversation(conversation_id)
    AND has_permission('conversations.send')
  )
  WITH CHECK (
    organization_id = get_user_org_id()
  );

CREATE POLICY "Users can delete rejected or superseded AI drafts"
  ON ai_drafts FOR DELETE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND (
      is_admin_or_higher()
      OR (
        can_access_conversation(conversation_id)
        AND status IN ('rejected', 'superseded')
      )
    )
  );

-- =====================
-- CONVERSATION RULES POLICIES
-- =====================

CREATE POLICY "Users can view conversation rules"
  ON conversation_rules FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND has_permission('conversation_rules.view')
  );

CREATE POLICY "Users can create conversation rules"
  ON conversation_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = get_user_org_id()
    AND has_permission('conversation_rules.manage')
  );

CREATE POLICY "Users can update conversation rules"
  ON conversation_rules FOR UPDATE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND has_permission('conversation_rules.manage')
  )
  WITH CHECK (
    organization_id = get_user_org_id()
  );

CREATE POLICY "Users can delete conversation rules"
  ON conversation_rules FOR DELETE
  TO authenticated
  USING (
    organization_id = get_user_org_id()
    AND has_permission('conversation_rules.manage')
  );

-- =====================
-- CONVERSATION RULE LOGS POLICIES
-- =====================

CREATE POLICY "Users can view rule logs for rules they can access"
  ON conversation_rule_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_rules r
      WHERE r.id = rule_id
      AND r.organization_id = get_user_org_id()
      AND has_permission('conversation_rules.view')
    )
  );

CREATE POLICY "System can create rule logs"
  ON conversation_rule_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversation_rules r
      WHERE r.id = rule_id
      AND r.organization_id = get_user_org_id()
    )
  );

CREATE POLICY "Only admins can delete rule logs"
  ON conversation_rule_logs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_rules r
      WHERE r.id = rule_id
      AND r.organization_id = get_user_org_id()
      AND is_admin_or_higher()
    )
  );
