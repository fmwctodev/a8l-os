/*
  # Fix RLS permission key format - Batch 2a (AI, Calendar, LLM, Opportunity tables)

  Fixes colon-delimited permission keys to use dot-delimited format matching
  the actual permissions table entries. Without this fix, has_permission()
  always returns false for non-super-admin users.

  ## Tables fixed:
  - ai_agents: INSERT policy (ai_agents:create → ai_agents.manage)
  - ai_safety_prompts: INSERT/UPDATE/DELETE (ai_agents:manage → ai_agents.manage)
  - appointment_types: INSERT/UPDATE/DELETE (calendars:manage → calendars.manage)
  - availability_date_overrides: INSERT/UPDATE/DELETE (calendars:manage → calendars.manage)
  - availability_rules: INSERT/UPDATE/DELETE (calendars:manage → calendars.manage)
  - custom_llm_providers: INSERT/UPDATE/DELETE (ai_agents:manage → ai_agents.manage)
  - llm_models: INSERT/UPDATE/DELETE (ai_agents:manage → ai_agents.manage)
  - llm_providers: INSERT/UPDATE/DELETE (ai_agents:manage → ai_agents.manage)
  - prompt_templates: SELECT (ai_agents:view → ai_agents.view)
  - lost_reasons: INSERT/UPDATE/DELETE (opportunities:manage_pipelines → pipelines.manage)
  - opportunity_notes: SELECT (opportunities:view → opportunities.view)
  - opportunity_timeline_events: SELECT (opportunities:view → opportunities.view)
*/

-- ai_agents: INSERT
DROP POLICY IF EXISTS "Users can create AI agents in their organization" ON ai_agents;
CREATE POLICY "Users can create AI agents in their organization"
  ON ai_agents FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('ai_agents.manage'));

-- ai_safety_prompts: INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can create AI safety prompts" ON ai_safety_prompts;
CREATE POLICY "Users can create AI safety prompts"
  ON ai_safety_prompts FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('ai_agents.manage'));

DROP POLICY IF EXISTS "Users can update AI safety prompts" ON ai_safety_prompts;
CREATE POLICY "Users can update AI safety prompts"
  ON ai_safety_prompts FOR UPDATE TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents.manage'));

DROP POLICY IF EXISTS "Users can delete AI safety prompts" ON ai_safety_prompts;
CREATE POLICY "Users can delete AI safety prompts"
  ON ai_safety_prompts FOR DELETE TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents.manage'));

-- appointment_types: INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can create appointment types in their organization" ON appointment_types;
CREATE POLICY "Users can create appointment types in their organization"
  ON appointment_types FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('calendars.manage'));

DROP POLICY IF EXISTS "Users can update appointment types in their organization" ON appointment_types;
CREATE POLICY "Users can update appointment types in their organization"
  ON appointment_types FOR UPDATE TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('calendars.manage'))
  WITH CHECK (org_id = get_user_org_id() AND has_permission('calendars.manage'));

DROP POLICY IF EXISTS "Users can delete appointment types in their organization" ON appointment_types;
CREATE POLICY "Users can delete appointment types in their organization"
  ON appointment_types FOR DELETE TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('calendars.manage'));

-- availability_date_overrides: INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users with calendars.manage can create date overrides" ON availability_date_overrides;
CREATE POLICY "Users with calendars.manage can create date overrides"
  ON availability_date_overrides FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('calendars.manage'));

DROP POLICY IF EXISTS "Users with calendars.manage can update date overrides" ON availability_date_overrides;
CREATE POLICY "Users with calendars.manage can update date overrides"
  ON availability_date_overrides FOR UPDATE TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('calendars.manage'))
  WITH CHECK (org_id = get_user_org_id() AND has_permission('calendars.manage'));

DROP POLICY IF EXISTS "Users with calendars.manage can delete date overrides" ON availability_date_overrides;
CREATE POLICY "Users with calendars.manage can delete date overrides"
  ON availability_date_overrides FOR DELETE TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('calendars.manage'));

-- availability_rules: INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can create availability rules in their organization" ON availability_rules;
CREATE POLICY "Users can create availability rules in their organization"
  ON availability_rules FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('calendars.manage'));

DROP POLICY IF EXISTS "Users can update availability rules in their organization" ON availability_rules;
CREATE POLICY "Users can update availability rules in their organization"
  ON availability_rules FOR UPDATE TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('calendars.manage'))
  WITH CHECK (org_id = get_user_org_id() AND has_permission('calendars.manage'));

DROP POLICY IF EXISTS "Users can delete availability rules in their organization" ON availability_rules;
CREATE POLICY "Users can delete availability rules in their organization"
  ON availability_rules FOR DELETE TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('calendars.manage'));

-- custom_llm_providers: INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can create custom LLM providers" ON custom_llm_providers;
CREATE POLICY "Users can create custom LLM providers"
  ON custom_llm_providers FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('ai_agents.manage'));

DROP POLICY IF EXISTS "Users can update custom LLM providers" ON custom_llm_providers;
CREATE POLICY "Users can update custom LLM providers"
  ON custom_llm_providers FOR UPDATE TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents.manage'));

DROP POLICY IF EXISTS "Users can delete custom LLM providers" ON custom_llm_providers;
CREATE POLICY "Users can delete custom LLM providers"
  ON custom_llm_providers FOR DELETE TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents.manage'));

-- llm_models: INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can create LLM models" ON llm_models;
CREATE POLICY "Users can create LLM models"
  ON llm_models FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('ai_agents.manage'));

DROP POLICY IF EXISTS "Users can update LLM models" ON llm_models;
CREATE POLICY "Users can update LLM models"
  ON llm_models FOR UPDATE TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents.manage'));

DROP POLICY IF EXISTS "Users can delete LLM models" ON llm_models;
CREATE POLICY "Users can delete LLM models"
  ON llm_models FOR DELETE TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents.manage'));

-- llm_providers: INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can create LLM providers" ON llm_providers;
CREATE POLICY "Users can create LLM providers"
  ON llm_providers FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('ai_agents.manage'));

DROP POLICY IF EXISTS "Users can update LLM providers" ON llm_providers;
CREATE POLICY "Users can update LLM providers"
  ON llm_providers FOR UPDATE TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents.manage'));

DROP POLICY IF EXISTS "Users can delete LLM providers" ON llm_providers;
CREATE POLICY "Users can delete LLM providers"
  ON llm_providers FOR DELETE TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents.manage'));

-- prompt_templates: SELECT
DROP POLICY IF EXISTS "Users can view prompt templates in their organization" ON prompt_templates;
CREATE POLICY "Users can view prompt templates in their organization"
  ON prompt_templates FOR SELECT TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents.view'));

-- lost_reasons: INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Admins can create lost reasons" ON lost_reasons;
CREATE POLICY "Admins can create lost reasons"
  ON lost_reasons FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('pipelines.manage'));

DROP POLICY IF EXISTS "Admins can update lost reasons" ON lost_reasons;
CREATE POLICY "Admins can update lost reasons"
  ON lost_reasons FOR UPDATE TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('pipelines.manage'))
  WITH CHECK (org_id = get_user_org_id() AND has_permission('pipelines.manage'));

DROP POLICY IF EXISTS "Admins can delete lost reasons" ON lost_reasons;
CREATE POLICY "Admins can delete lost reasons"
  ON lost_reasons FOR DELETE TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('pipelines.manage'));

-- opportunity_notes: SELECT
DROP POLICY IF EXISTS "Users can view opportunity notes in their organization" ON opportunity_notes;
CREATE POLICY "Users can view opportunity notes in their organization"
  ON opportunity_notes FOR SELECT TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('opportunities.view'));

-- opportunity_timeline_events: SELECT
DROP POLICY IF EXISTS "Users can view opportunity timeline in their organization" ON opportunity_timeline_events;
CREATE POLICY "Users can view opportunity timeline in their organization"
  ON opportunity_timeline_events FOR SELECT TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('opportunities.view'));
