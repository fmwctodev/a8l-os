/*
  # Optimize RLS Policies for AI Tables - Batch 1
  
  1. Tables Modified
    - activity_log
    - ai_agents
    - ai_agent_memory
    - ai_agent_runs
    - ai_agent_tool_calls
    - ai_agent_settings_defaults
    - ai_report_queries
  
  2. Changes
    - Replace auth.uid() with (select auth.uid()) for performance optimization
    - This prevents per-row re-evaluation of auth.uid()
  
  3. Security
    - All policies maintain same access control logic
    - Only performance optimization, no security changes
*/

-- activity_log
DROP POLICY IF EXISTS "Users can read their organization activity" ON activity_log;
CREATE POLICY "Users can read their organization activity" ON activity_log
  FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

-- ai_agents
DROP POLICY IF EXISTS "Users can view ai_agents in their organization" ON ai_agents;
DROP POLICY IF EXISTS "Users can update ai_agents in their organization" ON ai_agents;
DROP POLICY IF EXISTS "Users can delete ai_agents in their organization" ON ai_agents;

CREATE POLICY "Users can view ai_agents in their organization" ON ai_agents
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users can update ai_agents in their organization" ON ai_agents
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users can delete ai_agents in their organization" ON ai_agents
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

-- ai_agent_memory
DROP POLICY IF EXISTS "Users can view ai_agent_memory in their organization" ON ai_agent_memory;
DROP POLICY IF EXISTS "Users can update ai_agent_memory in their organization" ON ai_agent_memory;
DROP POLICY IF EXISTS "Users can delete ai_agent_memory in their organization" ON ai_agent_memory;

CREATE POLICY "Users can view ai_agent_memory in their organization" ON ai_agent_memory
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users can update ai_agent_memory in their organization" ON ai_agent_memory
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users can delete ai_agent_memory in their organization" ON ai_agent_memory
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

-- ai_agent_runs
DROP POLICY IF EXISTS "Users can view ai_agent_runs in their organization" ON ai_agent_runs;
DROP POLICY IF EXISTS "Users can update ai_agent_runs in their organization" ON ai_agent_runs;

CREATE POLICY "Users can view ai_agent_runs in their organization" ON ai_agent_runs
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users can update ai_agent_runs in their organization" ON ai_agent_runs
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

-- ai_agent_tool_calls
DROP POLICY IF EXISTS "Users can view ai_agent_tool_calls in their organization" ON ai_agent_tool_calls;

CREATE POLICY "Users can view ai_agent_tool_calls in their organization" ON ai_agent_tool_calls
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

-- ai_agent_settings_defaults
DROP POLICY IF EXISTS "Users can view ai settings defaults in their org" ON ai_agent_settings_defaults;
DROP POLICY IF EXISTS "Admins can update ai settings defaults" ON ai_agent_settings_defaults;

CREATE POLICY "Users can view ai settings defaults in their org" ON ai_agent_settings_defaults
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Admins can update ai settings defaults" ON ai_agent_settings_defaults
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_is_admin((select auth.uid())))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_is_admin((select auth.uid())));

-- ai_report_queries
DROP POLICY IF EXISTS "Users can view own AI queries" ON ai_report_queries;
DROP POLICY IF EXISTS "Users can update own AI queries" ON ai_report_queries;
DROP POLICY IF EXISTS "Users can delete own AI queries" ON ai_report_queries;

CREATE POLICY "Users can view own AI queries" ON ai_report_queries
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can update own AI queries" ON ai_report_queries
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own AI queries" ON ai_report_queries
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));
