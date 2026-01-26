/*
  # Fix RLS Auth Function Performance - AI Agents Batch
  
  1. Problem
    - RLS policies using auth.uid() re-evaluate for each row
    - Wrapping in (select auth.uid()) evaluates once per query
  
  2. Tables Fixed
    - ai_agents (org_id)
    - ai_agent_memory (org_id)
    - ai_agent_runs (org_id)
    - ai_agent_tool_calls (org_id)
    - llm_model_catalog (org_id)
    - google_chat_tokens (org_id, user_id)
    - google_chat_spaces_cache (org_id, user_id)
    - google_chat_messages_cache (org_id, user_id)
    - google_chat_subscriptions (org_id, user_id)
*/

-- ai_agents policies
DROP POLICY IF EXISTS "Users can insert ai_agents in their organization" ON ai_agents;

CREATE POLICY "Users can insert ai_agents in their organization" ON ai_agents
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = get_auth_user_org_id()
    AND EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = get_auth_user_role_id()
      AND p.key = 'ai_agents.manage'
    )
  );

-- ai_agent_memory policies
DROP POLICY IF EXISTS "Users can insert ai_agent_memory in their organization" ON ai_agent_memory;

CREATE POLICY "Users can insert ai_agent_memory in their organization" ON ai_agent_memory
  FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

-- ai_agent_runs policies
DROP POLICY IF EXISTS "Users can insert ai_agent_runs in their organization" ON ai_agent_runs;

CREATE POLICY "Users can insert ai_agent_runs in their organization" ON ai_agent_runs
  FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

-- ai_agent_tool_calls policies
DROP POLICY IF EXISTS "Users can insert ai_agent_tool_calls in their organization" ON ai_agent_tool_calls;

CREATE POLICY "Users can insert ai_agent_tool_calls in their organization" ON ai_agent_tool_calls
  FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

-- llm_model_catalog policies
DROP POLICY IF EXISTS "Super admins can insert model catalog" ON llm_model_catalog;

CREATE POLICY "Super admins can insert model catalog" ON llm_model_catalog
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin()
    OR org_id = get_auth_user_org_id()
  );

-- google_chat_tokens policies
DROP POLICY IF EXISTS "Users can insert own Google Chat tokens" ON google_chat_tokens;

CREATE POLICY "Users can insert own Google Chat tokens" ON google_chat_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND org_id = get_auth_user_org_id()
  );

-- google_chat_spaces_cache policies
DROP POLICY IF EXISTS "Users can insert own Google Chat spaces" ON google_chat_spaces_cache;

CREATE POLICY "Users can insert own Google Chat spaces" ON google_chat_spaces_cache
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND org_id = get_auth_user_org_id()
  );

-- google_chat_messages_cache policies
DROP POLICY IF EXISTS "Users can insert own Google Chat messages" ON google_chat_messages_cache;

CREATE POLICY "Users can insert own Google Chat messages" ON google_chat_messages_cache
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND org_id = get_auth_user_org_id()
  );

-- google_chat_subscriptions policies
DROP POLICY IF EXISTS "Users can insert own Google Chat subscriptions" ON google_chat_subscriptions;

CREATE POLICY "Users can insert own Google Chat subscriptions" ON google_chat_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND org_id = get_auth_user_org_id()
  );
