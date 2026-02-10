/*
  # Fix RLS Permission Key Format - Batch 1 (Conversation & Core Tables)

  Many RLS policies reference permission keys with colons (e.g., 'conversations:view')
  but the permissions table stores them with dots (e.g., 'conversations.view').
  This causes has_permission() to always return false for non-super-admin users,
  silently preventing access to data.

  ## Tables Fixed
    - inbox_events (conversations:view -> conversations.view)
    - ai_drafts (conversations:view, conversations:edit -> conversations.view, conversations.manage)
    - contact_tasks (contacts:edit -> contacts.edit)
    - conversation_rules (conversations:manage_rules -> conversation_rules.manage)
    - snippets (conversations:manage_snippets -> snippets.manage)
    - workflows (automation:view/create/edit/delete -> automation.view/manage)
    - workflow_enrollments (automation:view/manage -> automation.view/manage)

  ## Security
    - No new access granted; only fixes broken policies so they work as intended
*/

-- inbox_events: fix SELECT policy
DROP POLICY IF EXISTS "Users can view inbox events in their organization" ON inbox_events;
CREATE POLICY "Users can view inbox events in their organization"
  ON inbox_events FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('conversations.view'));

-- ai_drafts: fix SELECT, UPDATE, DELETE policies
DROP POLICY IF EXISTS "Users can view AI drafts in their organization" ON ai_drafts;
CREATE POLICY "Users can view AI drafts in their organization"
  ON ai_drafts FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('conversations.view'));

DROP POLICY IF EXISTS "Users can update AI drafts" ON ai_drafts;
CREATE POLICY "Users can update AI drafts"
  ON ai_drafts FOR UPDATE TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('conversations.manage'));

DROP POLICY IF EXISTS "Users can delete AI drafts" ON ai_drafts;
CREATE POLICY "Users can delete AI drafts"
  ON ai_drafts FOR DELETE TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('conversations.manage'));

-- contact_tasks: fix DELETE policy
DROP POLICY IF EXISTS "Users can delete contact tasks" ON contact_tasks;
CREATE POLICY "Users can delete contact tasks"
  ON contact_tasks FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM contacts c
    WHERE c.id = contact_tasks.contact_id
    AND c.organization_id = get_user_org_id()
    AND has_permission('contacts.edit')
  ));

-- conversation_rules: fix ALL policy
DROP POLICY IF EXISTS "Users can manage conversation rules" ON conversation_rules;
CREATE POLICY "Users can manage conversation rules"
  ON conversation_rules FOR ALL TO authenticated
  USING (organization_id = get_user_org_id() AND has_permission('conversation_rules.manage'))
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('conversation_rules.manage'));

-- snippets: fix INSERT policy
DROP POLICY IF EXISTS "Users can create snippets in their organization" ON snippets;
CREATE POLICY "Users can create snippets in their organization"
  ON snippets FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_org_id() AND has_permission('snippets.manage'));

-- workflows: fix all policies
DROP POLICY IF EXISTS "Users can view workflows in their organization" ON workflows;
CREATE POLICY "Users can view workflows in their organization"
  ON workflows FOR SELECT TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('automation.view'));

DROP POLICY IF EXISTS "Users can create workflows in their organization" ON workflows;
CREATE POLICY "Users can create workflows in their organization"
  ON workflows FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('automation.manage'));

DROP POLICY IF EXISTS "Users can update workflows in their organization" ON workflows;
CREATE POLICY "Users can update workflows in their organization"
  ON workflows FOR UPDATE TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('automation.manage'))
  WITH CHECK (org_id = get_user_org_id() AND has_permission('automation.manage'));

DROP POLICY IF EXISTS "Users can delete workflows in their organization" ON workflows;
CREATE POLICY "Users can delete workflows in their organization"
  ON workflows FOR DELETE TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('automation.manage'));

-- workflow_enrollments: fix SELECT and DELETE policies (INSERT and UPDATE already correct)
DROP POLICY IF EXISTS "Users can view workflow enrollments in their organization" ON workflow_enrollments;
CREATE POLICY "Users can view workflow enrollments in their organization"
  ON workflow_enrollments FOR SELECT TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('automation.view'));

DROP POLICY IF EXISTS "Users can delete workflow enrollments" ON workflow_enrollments;
CREATE POLICY "Users can delete workflow enrollments"
  ON workflow_enrollments FOR DELETE TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('automation.manage'));
