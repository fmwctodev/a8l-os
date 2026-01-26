/*
  # Optimize RLS Policies - AI Agents Tables
  
  1. Changes
    - Optimizes RLS policies for AI agent related tables
    - Tables use org_id column
  
  2. Tables Affected
    - ai_agents (uses org_id)
  
  3. Security
    - No changes to actual security logic
    - Performance optimization only
*/

-- =============================================
-- AI_AGENTS TABLE (uses org_id)
-- =============================================

DROP POLICY IF EXISTS "Users can view AI agents in their organization" ON ai_agents;
CREATE POLICY "Users can view AI agents in their organization"
  ON ai_agents FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:view'));

DROP POLICY IF EXISTS "Users can create AI agents in their organization" ON ai_agents;
CREATE POLICY "Users can create AI agents in their organization"
  ON ai_agents FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('ai_agents:create'));

DROP POLICY IF EXISTS "Users can update AI agents in their organization" ON ai_agents;
CREATE POLICY "Users can update AI agents in their organization"
  ON ai_agents FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:edit'))
  WITH CHECK (org_id = get_user_org_id() AND has_permission('ai_agents:edit'));

DROP POLICY IF EXISTS "Users can delete AI agents in their organization" ON ai_agents;
CREATE POLICY "Users can delete AI agents in their organization"
  ON ai_agents FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:delete'));