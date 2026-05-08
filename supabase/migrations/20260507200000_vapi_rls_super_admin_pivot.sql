/*
  # Vapi tables: switch RLS from inline org subquery to get_auth_user_org_id()

  Same bug pattern as 20260507130000_super_admin_full_cross_org_writes.sql:
  vapi_* tables had INSERT/UPDATE/DELETE/SELECT policies of the form:
    org_id IN (SELECT u.organization_id FROM users u WHERE u.id = auth.uid())

  That subquery reads HOME organization_id and ignores
  super_admin_active_org_id, so SuperAdmin pivoted to BL could not
  view OR insert vapi rows in BL — Sierra's import 403'd on
  POST /rest/v1/vapi_assistants because the WITH CHECK rejected
  org_id=BL even though the user was actively pivoted there.

  Fix: rewrite each policy to use `org_id = get_auth_user_org_id()`,
  which already honors `super_admin_active_org_id` (defined in
  20260507090000_unify_org_resolution_helpers.sql).

  Tables fixed (20 policies total):
    - vapi_assistants     (4: SELECT/INSERT/UPDATE/DELETE)
    - vapi_bindings       (4)
    - vapi_calls          (3: no DELETE)
    - vapi_sessions       (3)
    - vapi_tool_registry  (4: preserves NULL org_id system-tool semantics)
    - vapi_webhook_logs   (2: SELECT/UPDATE — preserves NULL org_id rows)

  Behavior preserved:
    - Non-pivoted users: active_org === home_org, identical RLS outcome.
    - vapi_tool_registry SELECT still shows system tools (org_id IS NULL).
    - vapi_tool_registry INSERT/UPDATE/DELETE still require org_id IS NOT NULL.
    - vapi_webhook_logs SELECT/UPDATE still allow NULL-org rows
      (logged before the gateway resolves to an org).
*/

-- vapi_assistants ============================================================
DROP POLICY IF EXISTS "Org members can view vapi assistants" ON vapi_assistants;
CREATE POLICY "Org members can view vapi assistants"
  ON vapi_assistants FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

DROP POLICY IF EXISTS "Org members can insert vapi assistants" ON vapi_assistants;
CREATE POLICY "Org members can insert vapi assistants"
  ON vapi_assistants FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

DROP POLICY IF EXISTS "Org members can update vapi assistants" ON vapi_assistants;
CREATE POLICY "Org members can update vapi assistants"
  ON vapi_assistants FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

DROP POLICY IF EXISTS "Org members can delete vapi assistants" ON vapi_assistants;
CREATE POLICY "Org members can delete vapi assistants"
  ON vapi_assistants FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- vapi_bindings ==============================================================
DROP POLICY IF EXISTS "Org members can view vapi bindings" ON vapi_bindings;
CREATE POLICY "Org members can view vapi bindings"
  ON vapi_bindings FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

DROP POLICY IF EXISTS "Org members can insert vapi bindings" ON vapi_bindings;
CREATE POLICY "Org members can insert vapi bindings"
  ON vapi_bindings FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

DROP POLICY IF EXISTS "Org members can update vapi bindings" ON vapi_bindings;
CREATE POLICY "Org members can update vapi bindings"
  ON vapi_bindings FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

DROP POLICY IF EXISTS "Org members can delete vapi bindings" ON vapi_bindings;
CREATE POLICY "Org members can delete vapi bindings"
  ON vapi_bindings FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- vapi_calls (no DELETE policy) ==============================================
DROP POLICY IF EXISTS "Org members can view vapi calls" ON vapi_calls;
CREATE POLICY "Org members can view vapi calls"
  ON vapi_calls FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

DROP POLICY IF EXISTS "Org members can insert vapi calls" ON vapi_calls;
CREATE POLICY "Org members can insert vapi calls"
  ON vapi_calls FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

DROP POLICY IF EXISTS "Org members can update vapi calls" ON vapi_calls;
CREATE POLICY "Org members can update vapi calls"
  ON vapi_calls FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

-- vapi_sessions ==============================================================
DROP POLICY IF EXISTS "Org members can view vapi sessions" ON vapi_sessions;
CREATE POLICY "Org members can view vapi sessions"
  ON vapi_sessions FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

DROP POLICY IF EXISTS "Org members can insert vapi sessions" ON vapi_sessions;
CREATE POLICY "Org members can insert vapi sessions"
  ON vapi_sessions FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

DROP POLICY IF EXISTS "Org members can update vapi sessions" ON vapi_sessions;
CREATE POLICY "Org members can update vapi sessions"
  ON vapi_sessions FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

-- vapi_tool_registry (preserves NULL = system-tool semantics) ================
DROP POLICY IF EXISTS "Authenticated users can view system and org tools" ON vapi_tool_registry;
CREATE POLICY "Authenticated users can view system and org tools"
  ON vapi_tool_registry FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = get_auth_user_org_id());

DROP POLICY IF EXISTS "Org members can insert custom tools" ON vapi_tool_registry;
CREATE POLICY "Org members can insert custom tools"
  ON vapi_tool_registry FOR INSERT TO authenticated
  WITH CHECK (org_id IS NOT NULL AND org_id = get_auth_user_org_id());

DROP POLICY IF EXISTS "Org members can update their tools" ON vapi_tool_registry;
CREATE POLICY "Org members can update their tools"
  ON vapi_tool_registry FOR UPDATE TO authenticated
  USING (org_id IS NOT NULL AND org_id = get_auth_user_org_id())
  WITH CHECK (org_id IS NOT NULL AND org_id = get_auth_user_org_id());

DROP POLICY IF EXISTS "Org members can delete their custom tools" ON vapi_tool_registry;
CREATE POLICY "Org members can delete their custom tools"
  ON vapi_tool_registry FOR DELETE TO authenticated
  USING (org_id IS NOT NULL AND org_id = get_auth_user_org_id());

-- vapi_webhook_logs (preserves NULL-org pre-resolution rows) =================
DROP POLICY IF EXISTS "Org members can view their webhook logs" ON vapi_webhook_logs;
CREATE POLICY "Org members can view their webhook logs"
  ON vapi_webhook_logs FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = get_auth_user_org_id());

DROP POLICY IF EXISTS "Authenticated users can update webhook logs" ON vapi_webhook_logs;
CREATE POLICY "Authenticated users can update webhook logs"
  ON vapi_webhook_logs FOR UPDATE TO authenticated
  USING (org_id IS NULL OR org_id = get_auth_user_org_id())
  WITH CHECK (org_id IS NULL OR org_id = get_auth_user_org_id());
