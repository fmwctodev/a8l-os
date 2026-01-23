/*
  # AI Agents RLS Policies

  This migration creates Row Level Security policies for the AI Agents module.
  All policies enforce organization-level access (global within org, no department restrictions).

  1. Security Policies
    - ai_agents: Users can view/manage agents within their organization
    - ai_agent_memory: Users can view/manage memory within their organization
    - ai_agent_runs: Users can view/manage runs within their organization
    - ai_agent_tool_calls: Users can view tool calls within their organization

  2. Access Pattern
    - All authenticated users in an org can view agents and runs
    - Management operations require appropriate permissions (enforced in application layer)
    - Service role has full access for Edge Functions
*/

-- AI Agents policies
CREATE POLICY "Users can view ai_agents in their organization"
  ON ai_agents FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert ai_agents in their organization"
  ON ai_agents FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update ai_agents in their organization"
  ON ai_agents FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete ai_agents in their organization"
  ON ai_agents FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- AI Agent Memory policies
CREATE POLICY "Users can view ai_agent_memory in their organization"
  ON ai_agent_memory FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert ai_agent_memory in their organization"
  ON ai_agent_memory FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update ai_agent_memory in their organization"
  ON ai_agent_memory FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete ai_agent_memory in their organization"
  ON ai_agent_memory FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- AI Agent Runs policies
CREATE POLICY "Users can view ai_agent_runs in their organization"
  ON ai_agent_runs FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert ai_agent_runs in their organization"
  ON ai_agent_runs FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update ai_agent_runs in their organization"
  ON ai_agent_runs FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- AI Agent Tool Calls policies
CREATE POLICY "Users can view ai_agent_tool_calls in their organization"
  ON ai_agent_tool_calls FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert ai_agent_tool_calls in their organization"
  ON ai_agent_tool_calls FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );