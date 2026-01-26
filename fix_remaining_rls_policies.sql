/*
  ============================================================
  FIX REMAINING RLS POLICIES - auth.uid() Performance Optimization
  ============================================================

  This script fixes ~166 remaining RLS policies that use bare auth.uid()
  instead of the optimized (select auth.uid()) pattern.

  The optimization ensures auth.uid() is evaluated once per query
  instead of once per row, significantly improving performance.

  Run this in Supabase SQL Editor.
  ============================================================
*/

-- ============================================
-- AI AGENTS TABLES
-- ============================================

-- ai_agents
DROP POLICY IF EXISTS "Users can view ai_agents in their organization" ON ai_agents;
DROP POLICY IF EXISTS "Users can update ai_agents in their organization" ON ai_agents;
DROP POLICY IF EXISTS "Users can delete ai_agents in their organization" ON ai_agents;

CREATE POLICY "Users can view ai_agents in their organization"
  ON ai_agents FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update ai_agents in their organization"
  ON ai_agents FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can delete ai_agents in their organization"
  ON ai_agents FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ai_agent_memory
DROP POLICY IF EXISTS "Users can view ai_agent_memory in their organization" ON ai_agent_memory;
DROP POLICY IF EXISTS "Users can update ai_agent_memory in their organization" ON ai_agent_memory;
DROP POLICY IF EXISTS "Users can delete ai_agent_memory in their organization" ON ai_agent_memory;

CREATE POLICY "Users can view ai_agent_memory in their organization"
  ON ai_agent_memory FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update ai_agent_memory in their organization"
  ON ai_agent_memory FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can delete ai_agent_memory in their organization"
  ON ai_agent_memory FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ai_agent_runs
DROP POLICY IF EXISTS "Users can view ai_agent_runs in their organization" ON ai_agent_runs;
DROP POLICY IF EXISTS "Users can update ai_agent_runs in their organization" ON ai_agent_runs;

CREATE POLICY "Users can view ai_agent_runs in their organization"
  ON ai_agent_runs FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update ai_agent_runs in their organization"
  ON ai_agent_runs FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

-- ai_agent_tool_calls
DROP POLICY IF EXISTS "Users can view ai_agent_tool_calls in their organization" ON ai_agent_tool_calls;

CREATE POLICY "Users can view ai_agent_tool_calls in their organization"
  ON ai_agent_tool_calls FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ai_report_queries
DROP POLICY IF EXISTS "Users can view own AI queries" ON ai_report_queries;
DROP POLICY IF EXISTS "Users can create own AI queries" ON ai_report_queries;
DROP POLICY IF EXISTS "Users can update own AI queries" ON ai_report_queries;
DROP POLICY IF EXISTS "Users can delete own AI queries" ON ai_report_queries;

CREATE POLICY "Users can view own AI queries"
  ON ai_report_queries FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can create own AI queries"
  ON ai_report_queries FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own AI queries"
  ON ai_report_queries FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own AI queries"
  ON ai_report_queries FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================
-- CALENDAR TABLES
-- ============================================

-- calendars
DROP POLICY IF EXISTS "Users can view calendars in their org" ON calendars;
DROP POLICY IF EXISTS "Users can create calendars in their org" ON calendars;
DROP POLICY IF EXISTS "Users can update calendars in their org" ON calendars;
DROP POLICY IF EXISTS "Users can delete calendars in their org" ON calendars;
DROP POLICY IF EXISTS "Calendar owners and admins can update calendars" ON calendars;

CREATE POLICY "Users can view calendars in their org"
  ON calendars FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can create calendars in their org"
  ON calendars FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update calendars in their org"
  ON calendars FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can delete calendars in their org"
  ON calendars FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- appointments
DROP POLICY IF EXISTS "Users can view appointments in their org" ON appointments;
DROP POLICY IF EXISTS "Users can view appointments they have access to" ON appointments;
DROP POLICY IF EXISTS "Users can create appointments in their org" ON appointments;
DROP POLICY IF EXISTS "Users can update appointments in their org" ON appointments;
DROP POLICY IF EXISTS "Users can update appointments they manage" ON appointments;
DROP POLICY IF EXISTS "Users can delete appointments in their org" ON appointments;

CREATE POLICY "Users can view appointments in their org"
  ON appointments FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can create appointments in their org"
  ON appointments FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update appointments in their org"
  ON appointments FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can delete appointments in their org"
  ON appointments FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- availability_rules
DROP POLICY IF EXISTS "Users can insert their own availability" ON availability_rules;
DROP POLICY IF EXISTS "Users can update their own availability" ON availability_rules;
DROP POLICY IF EXISTS "Calendar managers can delete availability" ON availability_rules;

CREATE POLICY "Users can view availability rules in their org"
  ON availability_rules FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can insert their own availability"
  ON availability_rules FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Users can update their own availability"
  ON availability_rules FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()))
  WITH CHECK (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Calendar managers can delete availability"
  ON availability_rules FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

-- calendar_members
DROP POLICY IF EXISTS "Calendar managers can insert members" ON calendar_members;
DROP POLICY IF EXISTS "Calendar managers can update members" ON calendar_members;
DROP POLICY IF EXISTS "Calendar managers can delete members" ON calendar_members;

CREATE POLICY "Users can view calendar members in their org"
  ON calendar_members FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM calendars c WHERE c.id = calendar_members.calendar_id AND c.org_id = get_auth_user_org_id()
  ));

CREATE POLICY "Calendar managers can insert members"
  ON calendar_members FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM calendars c WHERE c.id = calendar_members.calendar_id AND c.org_id = get_auth_user_org_id()
  ));

CREATE POLICY "Calendar managers can update members"
  ON calendar_members FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM calendars c WHERE c.id = calendar_members.calendar_id AND c.org_id = get_auth_user_org_id()
  ));

CREATE POLICY "Calendar managers can delete members"
  ON calendar_members FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM calendars c WHERE c.id = calendar_members.calendar_id AND c.org_id = get_auth_user_org_id()
  ));

-- ============================================
-- CONTACT TABLES
-- ============================================

-- contact_meeting_notes
DROP POLICY IF EXISTS "Users can create meeting notes" ON contact_meeting_notes;
DROP POLICY IF EXISTS "Users can update their own meeting notes" ON contact_meeting_notes;
DROP POLICY IF EXISTS "Users can delete their own meeting notes" ON contact_meeting_notes;

CREATE POLICY "Users can create meeting notes"
  ON contact_meeting_notes FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id() AND created_by = (select auth.uid()));

CREATE POLICY "Users can update their own meeting notes"
  ON contact_meeting_notes FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id() AND created_by = (select auth.uid()))
  WITH CHECK (org_id = get_auth_user_org_id() AND created_by = (select auth.uid()));

CREATE POLICY "Users can delete their own meeting notes"
  ON contact_meeting_notes FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id() AND created_by = (select auth.uid()));

-- contact_notes (via contact_id)
DROP POLICY IF EXISTS "Users can create contact notes" ON contact_notes;
DROP POLICY IF EXISTS "Users can update their own contact notes" ON contact_notes;
DROP POLICY IF EXISTS "Users can delete their own contact notes" ON contact_notes;

CREATE POLICY "Users can create contact notes"
  ON contact_notes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM contacts c WHERE c.id = contact_notes.contact_id AND c.organization_id = get_auth_user_org_id()
  ) AND user_id = (select auth.uid()));

CREATE POLICY "Users can update their own contact notes"
  ON contact_notes FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM contacts c WHERE c.id = contact_notes.contact_id AND c.organization_id = get_auth_user_org_id()
  ) AND user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own contact notes"
  ON contact_notes FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM contacts c WHERE c.id = contact_notes.contact_id AND c.organization_id = get_auth_user_org_id()
  ) AND user_id = (select auth.uid()));

-- contact_tasks (via contact_id)
DROP POLICY IF EXISTS "Users can create contact tasks" ON contact_tasks;
DROP POLICY IF EXISTS "Users can update tasks they created or are assigned to" ON contact_tasks;
DROP POLICY IF EXISTS "Users can delete tasks they created" ON contact_tasks;

CREATE POLICY "Users can create contact tasks"
  ON contact_tasks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM contacts c WHERE c.id = contact_tasks.contact_id AND c.organization_id = get_auth_user_org_id()
  ) AND created_by_user_id = (select auth.uid()));

CREATE POLICY "Users can update tasks they created or are assigned to"
  ON contact_tasks FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM contacts c WHERE c.id = contact_tasks.contact_id AND c.organization_id = get_auth_user_org_id()
  ) AND (created_by_user_id = (select auth.uid()) OR assigned_to_user_id = (select auth.uid())));

CREATE POLICY "Users can delete tasks they created"
  ON contact_tasks FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM contacts c WHERE c.id = contact_tasks.contact_id AND c.organization_id = get_auth_user_org_id()
  ) AND created_by_user_id = (select auth.uid()));

-- ============================================
-- CONTENT AI GENERATIONS
-- ============================================

DROP POLICY IF EXISTS "Users can create AI generations" ON content_ai_generations;
DROP POLICY IF EXISTS "Users can update their AI generations" ON content_ai_generations;
DROP POLICY IF EXISTS "Users can delete their AI generations" ON content_ai_generations;

CREATE POLICY "Users can create AI generations"
  ON content_ai_generations FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Users can update their AI generations"
  ON content_ai_generations FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND user_id = (select auth.uid()))
  WITH CHECK (organization_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Users can delete their AI generations"
  ON content_ai_generations FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

-- ============================================
-- CONVERSATION NOTES
-- ============================================

DROP POLICY IF EXISTS "Users can update their own conversation notes" ON conversation_notes;
DROP POLICY IF EXISTS "Users can delete their own conversation notes" ON conversation_notes;

CREATE POLICY "Users can update their own conversation notes"
  ON conversation_notes FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND created_by = (select auth.uid()))
  WITH CHECK (organization_id = get_auth_user_org_id() AND created_by = (select auth.uid()));

CREATE POLICY "Users can delete their own conversation notes"
  ON conversation_notes FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND created_by = (select auth.uid()));

-- ============================================
-- FILE ATTACHMENTS
-- ============================================

DROP POLICY IF EXISTS "Users can create file attachments" ON file_attachments;
DROP POLICY IF EXISTS "Users can delete their own file attachments" ON file_attachments;

CREATE POLICY "Users can create file attachments"
  ON file_attachments FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id() AND attached_by = (select auth.uid()));

CREATE POLICY "Users can delete their own file attachments"
  ON file_attachments FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND attached_by = (select auth.uid()));

-- ============================================
-- GMAIL OAUTH TOKENS
-- ============================================

DROP POLICY IF EXISTS "Users can view their own Gmail tokens" ON gmail_oauth_tokens;
DROP POLICY IF EXISTS "Users can create their own Gmail tokens" ON gmail_oauth_tokens;
DROP POLICY IF EXISTS "Users can insert their own gmail oauth tokens" ON gmail_oauth_tokens;
DROP POLICY IF EXISTS "Users can update their own Gmail tokens" ON gmail_oauth_tokens;
DROP POLICY IF EXISTS "Users can delete their own Gmail tokens" ON gmail_oauth_tokens;

CREATE POLICY "Users can view their own Gmail tokens"
  ON gmail_oauth_tokens FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can create their own Gmail tokens"
  ON gmail_oauth_tokens FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update their own Gmail tokens"
  ON gmail_oauth_tokens FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own Gmail tokens"
  ON gmail_oauth_tokens FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================
-- GOOGLE CALENDAR CONNECTIONS
-- ============================================

DROP POLICY IF EXISTS "Users can view their own Google connections" ON google_calendar_connections;
DROP POLICY IF EXISTS "Users can insert their own Google connections" ON google_calendar_connections;
DROP POLICY IF EXISTS "Users can update their own Google connections" ON google_calendar_connections;
DROP POLICY IF EXISTS "Users can delete their own Google connections" ON google_calendar_connections;

CREATE POLICY "Users can view their own Google connections"
  ON google_calendar_connections FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Users can insert their own Google connections"
  ON google_calendar_connections FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Users can update their own Google connections"
  ON google_calendar_connections FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()))
  WITH CHECK (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own Google connections"
  ON google_calendar_connections FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

-- ============================================
-- GOOGLE CHAT TABLES
-- ============================================

-- google_chat_tokens
DROP POLICY IF EXISTS "Users can view own Google Chat tokens" ON google_chat_tokens;
DROP POLICY IF EXISTS "Users can insert own Google Chat tokens" ON google_chat_tokens;
DROP POLICY IF EXISTS "Users can insert their own Google Chat tokens" ON google_chat_tokens;
DROP POLICY IF EXISTS "Users can update own Google Chat tokens" ON google_chat_tokens;
DROP POLICY IF EXISTS "Users can delete own Google Chat tokens" ON google_chat_tokens;

CREATE POLICY "Users can view own Google Chat tokens"
  ON google_chat_tokens FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own Google Chat tokens"
  ON google_chat_tokens FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own Google Chat tokens"
  ON google_chat_tokens FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own Google Chat tokens"
  ON google_chat_tokens FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- google_chat_spaces_cache
DROP POLICY IF EXISTS "Users can view own Google Chat spaces" ON google_chat_spaces_cache;
DROP POLICY IF EXISTS "Users can insert own Google Chat spaces" ON google_chat_spaces_cache;
DROP POLICY IF EXISTS "System can create Google Chat spaces cache" ON google_chat_spaces_cache;
DROP POLICY IF EXISTS "Users can update own Google Chat spaces" ON google_chat_spaces_cache;
DROP POLICY IF EXISTS "Users can delete own Google Chat spaces" ON google_chat_spaces_cache;

CREATE POLICY "Users can view own Google Chat spaces"
  ON google_chat_spaces_cache FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own Google Chat spaces"
  ON google_chat_spaces_cache FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own Google Chat spaces"
  ON google_chat_spaces_cache FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own Google Chat spaces"
  ON google_chat_spaces_cache FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- google_chat_messages_cache
DROP POLICY IF EXISTS "Users can view own Google Chat messages" ON google_chat_messages_cache;
DROP POLICY IF EXISTS "Users can insert own Google Chat messages" ON google_chat_messages_cache;
DROP POLICY IF EXISTS "System can create Google Chat messages cache" ON google_chat_messages_cache;
DROP POLICY IF EXISTS "Users can update own Google Chat messages" ON google_chat_messages_cache;
DROP POLICY IF EXISTS "Users can delete own Google Chat messages" ON google_chat_messages_cache;

CREATE POLICY "Users can view own Google Chat messages"
  ON google_chat_messages_cache FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own Google Chat messages"
  ON google_chat_messages_cache FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own Google Chat messages"
  ON google_chat_messages_cache FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own Google Chat messages"
  ON google_chat_messages_cache FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- google_chat_subscriptions
DROP POLICY IF EXISTS "Users can view own Google Chat subscriptions" ON google_chat_subscriptions;
DROP POLICY IF EXISTS "Users can insert own Google Chat subscriptions" ON google_chat_subscriptions;
DROP POLICY IF EXISTS "Users can create Google Chat subscriptions" ON google_chat_subscriptions;
DROP POLICY IF EXISTS "Users can update own Google Chat subscriptions" ON google_chat_subscriptions;
DROP POLICY IF EXISTS "Users can delete own Google Chat subscriptions" ON google_chat_subscriptions;

CREATE POLICY "Users can view own Google Chat subscriptions"
  ON google_chat_subscriptions FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own Google Chat subscriptions"
  ON google_chat_subscriptions FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own Google Chat subscriptions"
  ON google_chat_subscriptions FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own Google Chat subscriptions"
  ON google_chat_subscriptions FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================
-- INTEGRATION CONNECTIONS
-- ============================================

DROP POLICY IF EXISTS "Users can insert their own connections" ON integration_connections;
DROP POLICY IF EXISTS "Users can update their own connections" ON integration_connections;
DROP POLICY IF EXISTS "Users can delete their own connections" ON integration_connections;

CREATE POLICY "Users can insert their own connections"
  ON integration_connections FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Users can update their own connections"
  ON integration_connections FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()))
  WITH CHECK (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own connections"
  ON integration_connections FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

-- ============================================
-- LLM MODEL CATALOG
-- ============================================

DROP POLICY IF EXISTS "Users can view enabled models" ON llm_model_catalog;
DROP POLICY IF EXISTS "Super admins can view model catalog" ON llm_model_catalog;
DROP POLICY IF EXISTS "Super admins can update model catalog" ON llm_model_catalog;
DROP POLICY IF EXISTS "Super admins can delete model catalog" ON llm_model_catalog;

CREATE POLICY "Users can view enabled models"
  ON llm_model_catalog FOR SELECT TO authenticated
  USING (is_enabled = true);

CREATE POLICY "Super admins can manage model catalog"
  ON llm_model_catalog FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- OAUTH STATES
-- ============================================

DROP POLICY IF EXISTS "Users can view their own OAuth states" ON oauth_states;
DROP POLICY IF EXISTS "Users can insert their own OAuth states" ON oauth_states;
DROP POLICY IF EXISTS "Users can delete their own OAuth states" ON oauth_states;

CREATE POLICY "Users can view their own OAuth states"
  ON oauth_states FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Users can insert their own OAuth states"
  ON oauth_states FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own OAuth states"
  ON oauth_states FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

-- ============================================
-- OPPORTUNITIES TABLES
-- ============================================

-- opportunities
DROP POLICY IF EXISTS "Users can view opportunities in their org" ON opportunities;
DROP POLICY IF EXISTS "Users can view opportunities in their scope" ON opportunities;
DROP POLICY IF EXISTS "Users can create opportunities in their org" ON opportunities;
DROP POLICY IF EXISTS "Users can update opportunities in their org" ON opportunities;
DROP POLICY IF EXISTS "Users can update opportunities in their scope" ON opportunities;
DROP POLICY IF EXISTS "Users can delete opportunities in their org" ON opportunities;

CREATE POLICY "Users can view opportunities in their org"
  ON opportunities FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can create opportunities in their org"
  ON opportunities FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update opportunities in their org"
  ON opportunities FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can delete opportunities in their org"
  ON opportunities FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- opportunity_notes
DROP POLICY IF EXISTS "Users can create notes on accessible opportunities" ON opportunity_notes;
DROP POLICY IF EXISTS "Users can create opportunity notes" ON opportunity_notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON opportunity_notes;
DROP POLICY IF EXISTS "Users can update their own opportunity notes" ON opportunity_notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON opportunity_notes;
DROP POLICY IF EXISTS "Users can delete their own opportunity notes" ON opportunity_notes;

CREATE POLICY "Users can view opportunity notes in their org"
  ON opportunity_notes FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can create opportunity notes"
  ON opportunity_notes FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id() AND created_by_user_id = (select auth.uid()));

CREATE POLICY "Users can update their own opportunity notes"
  ON opportunity_notes FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id() AND created_by_user_id = (select auth.uid()))
  WITH CHECK (org_id = get_auth_user_org_id() AND created_by_user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own opportunity notes"
  ON opportunity_notes FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id() AND created_by_user_id = (select auth.uid()));

-- org_opportunity_custom_field_values
DROP POLICY IF EXISTS "Org members can view opportunity custom field values" ON org_opportunity_custom_field_values;
DROP POLICY IF EXISTS "Users with opportunities.edit can add opportunity field values" ON org_opportunity_custom_field_values;
DROP POLICY IF EXISTS "Users with opportunities.edit can update opportunity field valu" ON org_opportunity_custom_field_values;
DROP POLICY IF EXISTS "Users with opportunities.edit can delete opportunity field valu" ON org_opportunity_custom_field_values;

CREATE POLICY "Org members can view opportunity custom field values"
  ON org_opportunity_custom_field_values FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can add opportunity field values"
  ON org_opportunity_custom_field_values FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can update opportunity field values"
  ON org_opportunity_custom_field_values FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id())
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can delete opportunity field values"
  ON org_opportunity_custom_field_values FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id());

-- ============================================
-- PIPELINES TABLES
-- ============================================

-- pipelines
DROP POLICY IF EXISTS "Users can view pipelines in their org" ON pipelines;
DROP POLICY IF EXISTS "Users can create pipelines in their org" ON pipelines;
DROP POLICY IF EXISTS "Users can update pipelines in their org" ON pipelines;
DROP POLICY IF EXISTS "Users can delete pipelines in their org" ON pipelines;

CREATE POLICY "Users can view pipelines in their org"
  ON pipelines FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can create pipelines in their org"
  ON pipelines FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update pipelines in their org"
  ON pipelines FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can delete pipelines in their org"
  ON pipelines FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- pipeline_stages
DROP POLICY IF EXISTS "Users can view stages in their org" ON pipeline_stages;
DROP POLICY IF EXISTS "Users can create stages in their org" ON pipeline_stages;
DROP POLICY IF EXISTS "Users can update stages in their org" ON pipeline_stages;
DROP POLICY IF EXISTS "Users can delete stages in their org" ON pipeline_stages;

CREATE POLICY "Users can view stages in their org"
  ON pipeline_stages FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can create stages in their org"
  ON pipeline_stages FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update stages in their org"
  ON pipeline_stages FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can delete stages in their org"
  ON pipeline_stages FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- PROPOSAL COMMENTS
-- ============================================

DROP POLICY IF EXISTS "Users can update their own comments" ON proposal_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON proposal_comments;

CREATE POLICY "Users can update their own comments"
  ON proposal_comments FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()))
  WITH CHECK (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own comments"
  ON proposal_comments FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

-- ============================================
-- REPORTS TABLES
-- ============================================

-- reports
DROP POLICY IF EXISTS "Users can create reports" ON reports;
DROP POLICY IF EXISTS "Users can update their own reports" ON reports;
DROP POLICY IF EXISTS "Users can delete their own reports" ON reports;

CREATE POLICY "Users can create reports"
  ON reports FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id() AND created_by = (select auth.uid()));

CREATE POLICY "Users can update their own reports"
  ON reports FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND created_by = (select auth.uid()))
  WITH CHECK (organization_id = get_auth_user_org_id() AND created_by = (select auth.uid()));

CREATE POLICY "Users can delete their own reports"
  ON reports FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND created_by = (select auth.uid()));

-- report_runs (triggered_by is TEXT)
DROP POLICY IF EXISTS "Users can create report runs for accessible reports" ON report_runs;
DROP POLICY IF EXISTS "Users can update report runs they created" ON report_runs;

CREATE POLICY "Users can create report runs for accessible reports"
  ON report_runs FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id() AND triggered_by = (select auth.uid())::text);

CREATE POLICY "Users can update report runs they created"
  ON report_runs FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND triggered_by = (select auth.uid())::text)
  WITH CHECK (organization_id = get_auth_user_org_id() AND triggered_by = (select auth.uid())::text);

-- report_schedules
DROP POLICY IF EXISTS "Users can create schedules for their reports" ON report_schedules;
DROP POLICY IF EXISTS "Users can update their own schedules" ON report_schedules;
DROP POLICY IF EXISTS "Users can delete their own schedules" ON report_schedules;

CREATE POLICY "Users can create schedules for their reports"
  ON report_schedules FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id() AND created_by = (select auth.uid()));

CREATE POLICY "Users can update their own schedules"
  ON report_schedules FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND created_by = (select auth.uid()))
  WITH CHECK (organization_id = get_auth_user_org_id() AND created_by = (select auth.uid()));

CREATE POLICY "Users can delete their own schedules"
  ON report_schedules FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND created_by = (select auth.uid()));

-- ============================================
-- SNIPPETS
-- ============================================

DROP POLICY IF EXISTS "Users can view accessible snippets" ON snippets;
DROP POLICY IF EXISTS "Users can create personal snippets" ON snippets;
DROP POLICY IF EXISTS "Users can update their own snippets" ON snippets;
DROP POLICY IF EXISTS "Users can delete their own snippets" ON snippets;

CREATE POLICY "Users can view accessible snippets"
  ON snippets FOR SELECT TO authenticated
  USING (
    organization_id = get_auth_user_org_id()
    AND (scope = 'organization' OR created_by_user_id = (select auth.uid()))
  );

CREATE POLICY "Users can create personal snippets"
  ON snippets FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id() AND created_by_user_id = (select auth.uid()));

CREATE POLICY "Users can update their own snippets"
  ON snippets FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND created_by_user_id = (select auth.uid()))
  WITH CHECK (organization_id = get_auth_user_org_id() AND created_by_user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own snippets"
  ON snippets FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND created_by_user_id = (select auth.uid()));

-- ============================================
-- SOCIAL OAUTH STATES
-- ============================================

DROP POLICY IF EXISTS "Users can view their own OAuth states" ON social_oauth_states;
DROP POLICY IF EXISTS "Users can create their own OAuth states" ON social_oauth_states;
DROP POLICY IF EXISTS "Users can delete their own OAuth states" ON social_oauth_states;

CREATE POLICY "Users can view their own OAuth states"
  ON social_oauth_states FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Users can create their own OAuth states"
  ON social_oauth_states FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own OAuth states"
  ON social_oauth_states FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

-- ============================================
-- TEAM MESSAGING TABLES
-- ============================================

-- team_channels
DROP POLICY IF EXISTS "Users can view channels in their organization" ON team_channels;
DROP POLICY IF EXISTS "Users can create channels" ON team_channels;
DROP POLICY IF EXISTS "Channel creators can update their channels" ON team_channels;
DROP POLICY IF EXISTS "Channel creators can delete their channels" ON team_channels;

CREATE POLICY "Users can view channels in their organization"
  ON team_channels FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can create channels"
  ON team_channels FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id() AND created_by = (select auth.uid()));

CREATE POLICY "Channel creators can update their channels"
  ON team_channels FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND created_by = (select auth.uid()))
  WITH CHECK (organization_id = get_auth_user_org_id() AND created_by = (select auth.uid()));

CREATE POLICY "Channel creators can delete their channels"
  ON team_channels FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND created_by = (select auth.uid()));

-- team_channel_members
DROP POLICY IF EXISTS "Users can view channel members" ON team_channel_members;
DROP POLICY IF EXISTS "Channel owners can add members" ON team_channel_members;
DROP POLICY IF EXISTS "Channel owners can remove members" ON team_channel_members;
DROP POLICY IF EXISTS "Users can update their own membership" ON team_channel_members;

CREATE POLICY "Users can view channel members"
  ON team_channel_members FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Channel owners can add members"
  ON team_channel_members FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Channel owners can remove members"
  ON team_channel_members FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can update their own membership"
  ON team_channel_members FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- team_messages
DROP POLICY IF EXISTS "Channel members can view messages" ON team_messages;
DROP POLICY IF EXISTS "Channel members can create messages" ON team_messages;
DROP POLICY IF EXISTS "Message senders can update their messages" ON team_messages;
DROP POLICY IF EXISTS "Message senders can delete their messages" ON team_messages;

CREATE POLICY "Channel members can view messages"
  ON team_messages FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Channel members can create messages"
  ON team_messages FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id() AND sender_id = (select auth.uid()));

CREATE POLICY "Message senders can update their messages"
  ON team_messages FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND sender_id = (select auth.uid()))
  WITH CHECK (organization_id = get_auth_user_org_id() AND sender_id = (select auth.uid()));

CREATE POLICY "Message senders can delete their messages"
  ON team_messages FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND sender_id = (select auth.uid()));

-- team_message_reactions
DROP POLICY IF EXISTS "Channel members can view reactions" ON team_message_reactions;
DROP POLICY IF EXISTS "Channel members can add reactions" ON team_message_reactions;
DROP POLICY IF EXISTS "Users can remove their reactions" ON team_message_reactions;

CREATE POLICY "Channel members can view reactions"
  ON team_message_reactions FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Channel members can add reactions"
  ON team_message_reactions FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Users can remove their reactions"
  ON team_message_reactions FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

-- ============================================
-- USER TABLES
-- ============================================

-- users
DROP POLICY IF EXISTS "Users can update own profile data" ON users;

CREATE POLICY "Users can update own profile data"
  ON users FOR UPDATE TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- user_connected_accounts
DROP POLICY IF EXISTS "Users can view own connected accounts" ON user_connected_accounts;
DROP POLICY IF EXISTS "Users can insert own connected accounts" ON user_connected_accounts;
DROP POLICY IF EXISTS "Users can update own connected accounts" ON user_connected_accounts;
DROP POLICY IF EXISTS "Users can delete own connected accounts" ON user_connected_accounts;

CREATE POLICY "Users can view own connected accounts"
  ON user_connected_accounts FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own connected accounts"
  ON user_connected_accounts FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own connected accounts"
  ON user_connected_accounts FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own connected accounts"
  ON user_connected_accounts FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- user_notification_preferences
DROP POLICY IF EXISTS "Users can view own notification preferences" ON user_notification_preferences;
DROP POLICY IF EXISTS "Users can insert own notification preferences" ON user_notification_preferences;
DROP POLICY IF EXISTS "Users can update own notification preferences" ON user_notification_preferences;
DROP POLICY IF EXISTS "Users can delete own notification preferences" ON user_notification_preferences;

CREATE POLICY "Users can view own notification preferences"
  ON user_notification_preferences FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own notification preferences"
  ON user_notification_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own notification preferences"
  ON user_notification_preferences FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own notification preferences"
  ON user_notification_preferences FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- user_permission_overrides
DROP POLICY IF EXISTS "Users can view their own permission overrides" ON user_permission_overrides;

CREATE POLICY "Users can view their own permission overrides"
  ON user_permission_overrides FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- user_preferences
DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;

CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- user_sessions
DROP POLICY IF EXISTS "Users can view own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON user_sessions;

CREATE POLICY "Users can view own sessions"
  ON user_sessions FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own sessions"
  ON user_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own sessions"
  ON user_sessions FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================
-- WORKFLOW TABLES
-- ============================================

-- workflow_action_retries
DROP POLICY IF EXISTS "Users can view workflow action retries in their org" ON workflow_action_retries;
DROP POLICY IF EXISTS "Users with workflow permission can update workflow action retri" ON workflow_action_retries;
DROP POLICY IF EXISTS "Users with workflow permission can delete workflow action retri" ON workflow_action_retries;

CREATE POLICY "Users can view workflow action retries in their org"
  ON workflow_action_retries FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users with workflow permission can update workflow action retries"
  ON workflow_action_retries FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users with workflow permission can delete workflow action retries"
  ON workflow_action_retries FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- workflow_condition_waits
DROP POLICY IF EXISTS "Users can view workflow condition waits in their org" ON workflow_condition_waits;
DROP POLICY IF EXISTS "Users with workflow permission can update workflow condition wa" ON workflow_condition_waits;
DROP POLICY IF EXISTS "Users with workflow permission can delete workflow condition wa" ON workflow_condition_waits;

CREATE POLICY "Users can view workflow condition waits in their org"
  ON workflow_condition_waits FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users with workflow permission can update workflow condition waits"
  ON workflow_condition_waits FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users with workflow permission can delete workflow condition waits"
  ON workflow_condition_waits FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- workflow_loops
DROP POLICY IF EXISTS "Users can view workflow loops in their org" ON workflow_loops;
DROP POLICY IF EXISTS "Users with workflow permission can update workflow loops" ON workflow_loops;
DROP POLICY IF EXISTS "Users with workflow permission can delete workflow loops" ON workflow_loops;

CREATE POLICY "Users can view workflow loops in their org"
  ON workflow_loops FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users with workflow permission can update workflow loops"
  ON workflow_loops FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users with workflow permission can delete workflow loops"
  ON workflow_loops FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- VERIFICATION
-- ============================================

-- Count remaining unoptimized policies (should be 0 or very few)
SELECT COUNT(*) as remaining_unoptimized_policies
FROM pg_policies
WHERE schemaname = 'public'
AND (
  (qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(select auth.uid())%')
  OR (with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%(select auth.uid())%')
);
