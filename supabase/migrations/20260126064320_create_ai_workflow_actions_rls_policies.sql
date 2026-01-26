/*
  # AI Workflow Actions RLS Policies

  ## Overview
  Creates Row Level Security policies for the AI workflow actions tables.
  All policies are scoped to organization membership.

  ## Tables Covered
  - workflow_ai_runs
  - ai_workflow_learning_signals
  - ai_action_guardrails

  ## Security Model
  - Users can only access data from their own organization
  - Service role has full access for edge function operations
  - Read access for all org members on runs and signals
  - Write access controlled by permissions
*/

-- Helper function to check user organization
CREATE OR REPLACE FUNCTION user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM users WHERE id = auth.uid()
$$;

-- =============================================
-- workflow_ai_runs policies
-- =============================================

DROP POLICY IF EXISTS "workflow_ai_runs_select_org" ON workflow_ai_runs;
CREATE POLICY "workflow_ai_runs_select_org"
  ON workflow_ai_runs FOR SELECT
  TO authenticated
  USING (org_id = user_org_id());

DROP POLICY IF EXISTS "workflow_ai_runs_insert_org" ON workflow_ai_runs;
CREATE POLICY "workflow_ai_runs_insert_org"
  ON workflow_ai_runs FOR INSERT
  TO authenticated
  WITH CHECK (org_id = user_org_id());

DROP POLICY IF EXISTS "workflow_ai_runs_update_org" ON workflow_ai_runs;
CREATE POLICY "workflow_ai_runs_update_org"
  ON workflow_ai_runs FOR UPDATE
  TO authenticated
  USING (org_id = user_org_id())
  WITH CHECK (org_id = user_org_id());

DROP POLICY IF EXISTS "workflow_ai_runs_delete_org" ON workflow_ai_runs;
CREATE POLICY "workflow_ai_runs_delete_org"
  ON workflow_ai_runs FOR DELETE
  TO authenticated
  USING (org_id = user_org_id());

-- Service role bypass for edge functions
DROP POLICY IF EXISTS "workflow_ai_runs_service_role" ON workflow_ai_runs;
CREATE POLICY "workflow_ai_runs_service_role"
  ON workflow_ai_runs
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================
-- ai_workflow_learning_signals policies
-- =============================================

DROP POLICY IF EXISTS "learning_signals_select_org" ON ai_workflow_learning_signals;
CREATE POLICY "learning_signals_select_org"
  ON ai_workflow_learning_signals FOR SELECT
  TO authenticated
  USING (org_id = user_org_id());

DROP POLICY IF EXISTS "learning_signals_insert_org" ON ai_workflow_learning_signals;
CREATE POLICY "learning_signals_insert_org"
  ON ai_workflow_learning_signals FOR INSERT
  TO authenticated
  WITH CHECK (org_id = user_org_id());

DROP POLICY IF EXISTS "learning_signals_update_org" ON ai_workflow_learning_signals;
CREATE POLICY "learning_signals_update_org"
  ON ai_workflow_learning_signals FOR UPDATE
  TO authenticated
  USING (org_id = user_org_id())
  WITH CHECK (org_id = user_org_id());

DROP POLICY IF EXISTS "learning_signals_delete_org" ON ai_workflow_learning_signals;
CREATE POLICY "learning_signals_delete_org"
  ON ai_workflow_learning_signals FOR DELETE
  TO authenticated
  USING (org_id = user_org_id());

-- Service role bypass for edge functions
DROP POLICY IF EXISTS "learning_signals_service_role" ON ai_workflow_learning_signals;
CREATE POLICY "learning_signals_service_role"
  ON ai_workflow_learning_signals
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================
-- ai_action_guardrails policies
-- =============================================

DROP POLICY IF EXISTS "guardrails_select_org" ON ai_action_guardrails;
CREATE POLICY "guardrails_select_org"
  ON ai_action_guardrails FOR SELECT
  TO authenticated
  USING (org_id = user_org_id());

DROP POLICY IF EXISTS "guardrails_insert_org" ON ai_action_guardrails;
CREATE POLICY "guardrails_insert_org"
  ON ai_action_guardrails FOR INSERT
  TO authenticated
  WITH CHECK (org_id = user_org_id());

DROP POLICY IF EXISTS "guardrails_update_org" ON ai_action_guardrails;
CREATE POLICY "guardrails_update_org"
  ON ai_action_guardrails FOR UPDATE
  TO authenticated
  USING (org_id = user_org_id())
  WITH CHECK (org_id = user_org_id());

DROP POLICY IF EXISTS "guardrails_delete_org" ON ai_action_guardrails;
CREATE POLICY "guardrails_delete_org"
  ON ai_action_guardrails FOR DELETE
  TO authenticated
  USING (org_id = user_org_id());

-- Service role bypass for edge functions
DROP POLICY IF EXISTS "guardrails_service_role" ON ai_action_guardrails;
CREATE POLICY "guardrails_service_role"
  ON ai_action_guardrails
  TO service_role
  USING (true)
  WITH CHECK (true);
