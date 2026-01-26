/*
  # Optimize RLS Policies for Google and LLM Tables
  
  1. Tables Modified
    - google_chat_tokens, google_chat_spaces_cache
    - google_chat_subscriptions, google_chat_messages_cache
    - google_calendar_connections, gmail_oauth_tokens
    - elevenlabs_connection, elevenlabs_voices
    - llm_providers, llm_models, llm_model_catalog
    - custom_llm_providers
    - prompt_templates, prompt_template_versions
    - message_templates
  
  2. Changes
    - Replace auth.uid() with (select auth.uid())
    - Consolidate duplicate policies
  
  3. Security
    - All policies maintain same access control logic
*/

-- google_chat_tokens - consolidate duplicate policies
DROP POLICY IF EXISTS "Users can view own Google Chat tokens" ON google_chat_tokens;
DROP POLICY IF EXISTS "Users can view their own Google Chat tokens" ON google_chat_tokens;
DROP POLICY IF EXISTS "Users can update own Google Chat tokens" ON google_chat_tokens;
DROP POLICY IF EXISTS "Users can update their own Google Chat tokens" ON google_chat_tokens;
DROP POLICY IF EXISTS "Users can delete own Google Chat tokens" ON google_chat_tokens;
DROP POLICY IF EXISTS "Users can delete their own Google Chat tokens" ON google_chat_tokens;

CREATE POLICY "Users can view own Google Chat tokens" ON google_chat_tokens
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own Google Chat tokens" ON google_chat_tokens
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own Google Chat tokens" ON google_chat_tokens
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- google_chat_spaces_cache - consolidate duplicate policies
DROP POLICY IF EXISTS "Users can view own Google Chat spaces" ON google_chat_spaces_cache;
DROP POLICY IF EXISTS "Users can view their Google Chat spaces" ON google_chat_spaces_cache;
DROP POLICY IF EXISTS "Users can update own Google Chat spaces" ON google_chat_spaces_cache;
DROP POLICY IF EXISTS "System can update Google Chat spaces cache" ON google_chat_spaces_cache;
DROP POLICY IF EXISTS "Users can delete own Google Chat spaces" ON google_chat_spaces_cache;

CREATE POLICY "Users can view own Google Chat spaces" ON google_chat_spaces_cache
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own Google Chat spaces" ON google_chat_spaces_cache
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own Google Chat spaces" ON google_chat_spaces_cache
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- google_chat_subscriptions - consolidate duplicate policies
DROP POLICY IF EXISTS "Users can view own Google Chat subscriptions" ON google_chat_subscriptions;
DROP POLICY IF EXISTS "Users can view their Google Chat subscriptions" ON google_chat_subscriptions;
DROP POLICY IF EXISTS "Users can update own Google Chat subscriptions" ON google_chat_subscriptions;
DROP POLICY IF EXISTS "Users can update their Google Chat subscriptions" ON google_chat_subscriptions;
DROP POLICY IF EXISTS "Users can delete own Google Chat subscriptions" ON google_chat_subscriptions;
DROP POLICY IF EXISTS "Users can delete their Google Chat subscriptions" ON google_chat_subscriptions;

CREATE POLICY "Users can view own Google Chat subscriptions" ON google_chat_subscriptions
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own Google Chat subscriptions" ON google_chat_subscriptions
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own Google Chat subscriptions" ON google_chat_subscriptions
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- google_chat_messages_cache - consolidate duplicate policies
DROP POLICY IF EXISTS "Users can view own Google Chat messages" ON google_chat_messages_cache;
DROP POLICY IF EXISTS "Users can view their Google Chat messages" ON google_chat_messages_cache;
DROP POLICY IF EXISTS "Users can update own Google Chat messages" ON google_chat_messages_cache;
DROP POLICY IF EXISTS "System can update Google Chat messages cache" ON google_chat_messages_cache;
DROP POLICY IF EXISTS "Users can delete own Google Chat messages" ON google_chat_messages_cache;

CREATE POLICY "Users can view own Google Chat messages" ON google_chat_messages_cache
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own Google Chat messages" ON google_chat_messages_cache
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own Google Chat messages" ON google_chat_messages_cache
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- google_calendar_connections
DROP POLICY IF EXISTS "Users can view their own Google connections" ON google_calendar_connections;
DROP POLICY IF EXISTS "Users can update their own Google connections" ON google_calendar_connections;
DROP POLICY IF EXISTS "Users can delete their own Google connections" ON google_calendar_connections;

CREATE POLICY "Users can view their own Google connections" ON google_calendar_connections
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) AND org_id = get_user_org_id());

CREATE POLICY "Users can update their own Google connections" ON google_calendar_connections
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()) AND org_id = get_user_org_id())
  WITH CHECK (user_id = (select auth.uid()) AND org_id = get_user_org_id());

CREATE POLICY "Users can delete their own Google connections" ON google_calendar_connections
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()) AND org_id = get_user_org_id());

-- gmail_oauth_tokens - consolidate duplicate policies
DROP POLICY IF EXISTS "Users can view their own Gmail tokens" ON gmail_oauth_tokens;
DROP POLICY IF EXISTS "Users can view their own gmail oauth tokens" ON gmail_oauth_tokens;
DROP POLICY IF EXISTS "Users can update their own Gmail tokens" ON gmail_oauth_tokens;
DROP POLICY IF EXISTS "Users can update their own gmail oauth tokens" ON gmail_oauth_tokens;
DROP POLICY IF EXISTS "Users can delete their own Gmail tokens" ON gmail_oauth_tokens;
DROP POLICY IF EXISTS "Users can delete their own gmail oauth tokens" ON gmail_oauth_tokens;

CREATE POLICY "Users can view their own Gmail tokens" ON gmail_oauth_tokens
  FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id() AND (user_id = (select auth.uid()) OR is_admin_or_higher()));

CREATE POLICY "Users can update their own Gmail tokens" ON gmail_oauth_tokens
  FOR UPDATE TO authenticated
  USING (organization_id = get_user_org_id() AND user_id = (select auth.uid()))
  WITH CHECK (organization_id = get_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own Gmail tokens" ON gmail_oauth_tokens
  FOR DELETE TO authenticated
  USING (organization_id = get_user_org_id() AND (user_id = (select auth.uid()) OR is_admin_or_higher()));

-- elevenlabs_connection
DROP POLICY IF EXISTS "Users can view elevenlabs connection in their org" ON elevenlabs_connection;
DROP POLICY IF EXISTS "Admins can update elevenlabs connection" ON elevenlabs_connection;
DROP POLICY IF EXISTS "Admins can delete elevenlabs connection" ON elevenlabs_connection;

CREATE POLICY "Users can view elevenlabs connection in their org" ON elevenlabs_connection
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Admins can update elevenlabs connection" ON elevenlabs_connection
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_is_admin((select auth.uid())))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_is_admin((select auth.uid())));

CREATE POLICY "Admins can delete elevenlabs connection" ON elevenlabs_connection
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_is_admin((select auth.uid())));

-- elevenlabs_voices
DROP POLICY IF EXISTS "Users can view voices in their org" ON elevenlabs_voices;
DROP POLICY IF EXISTS "Admins can update voices" ON elevenlabs_voices;
DROP POLICY IF EXISTS "Admins can delete voices" ON elevenlabs_voices;

CREATE POLICY "Users can view voices in their org" ON elevenlabs_voices
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Admins can update voices" ON elevenlabs_voices
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_is_admin((select auth.uid())))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_is_admin((select auth.uid())));

CREATE POLICY "Admins can delete voices" ON elevenlabs_voices
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_is_admin((select auth.uid())));

-- llm_providers
DROP POLICY IF EXISTS "Users can view provider status in their org" ON llm_providers;
DROP POLICY IF EXISTS "Admins can update providers" ON llm_providers;
DROP POLICY IF EXISTS "Admins can delete providers" ON llm_providers;

CREATE POLICY "Users can view provider status in their org" ON llm_providers
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Admins can update providers" ON llm_providers
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_is_admin((select auth.uid())))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_is_admin((select auth.uid())));

CREATE POLICY "Admins can delete providers" ON llm_providers
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_is_admin((select auth.uid())));

-- llm_models
DROP POLICY IF EXISTS "Users can view models in their org" ON llm_models;
DROP POLICY IF EXISTS "Admins can update models" ON llm_models;
DROP POLICY IF EXISTS "Admins can delete models" ON llm_models;

CREATE POLICY "Users can view models in their org" ON llm_models
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Admins can update models" ON llm_models
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_is_admin((select auth.uid())))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_is_admin((select auth.uid())));

CREATE POLICY "Admins can delete models" ON llm_models
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_is_admin((select auth.uid())));

-- llm_model_catalog
DROP POLICY IF EXISTS "Users can view enabled models" ON llm_model_catalog;
DROP POLICY IF EXISTS "Super admins can view model catalog" ON llm_model_catalog;
DROP POLICY IF EXISTS "Super admins can update model catalog" ON llm_model_catalog;
DROP POLICY IF EXISTS "Super admins can delete model catalog" ON llm_model_catalog;

CREATE POLICY "Users can view enabled models" ON llm_model_catalog
  FOR SELECT TO authenticated
  USING (is_enabled = true AND EXISTS (
    SELECT 1 FROM users u WHERE u.id = (select auth.uid()) AND u.organization_id = llm_model_catalog.org_id
  ));

CREATE POLICY "Super admins can view model catalog" ON llm_model_catalog
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = (select auth.uid()) AND u.organization_id = llm_model_catalog.org_id AND r.name = 'SuperAdmin'
  ));

CREATE POLICY "Super admins can update model catalog" ON llm_model_catalog
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = (select auth.uid()) AND u.organization_id = llm_model_catalog.org_id AND r.name = 'SuperAdmin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = (select auth.uid()) AND u.organization_id = llm_model_catalog.org_id AND r.name = 'SuperAdmin'
  ));

CREATE POLICY "Super admins can delete model catalog" ON llm_model_catalog
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = (select auth.uid()) AND u.organization_id = llm_model_catalog.org_id AND r.name = 'SuperAdmin'
  ));

-- custom_llm_providers
DROP POLICY IF EXISTS "Users can view org custom llm providers" ON custom_llm_providers;
DROP POLICY IF EXISTS "Admins can update custom llm providers" ON custom_llm_providers;
DROP POLICY IF EXISTS "Admins can delete custom llm providers" ON custom_llm_providers;

CREATE POLICY "Users can view org custom llm providers" ON custom_llm_providers
  FOR SELECT TO authenticated
  USING (has_ai_settings_view_permission((select auth.uid()), org_id));

CREATE POLICY "Admins can update custom llm providers" ON custom_llm_providers
  FOR UPDATE TO authenticated
  USING (has_ai_settings_manage_permission((select auth.uid()), org_id))
  WITH CHECK (has_ai_settings_manage_permission((select auth.uid()), org_id));

CREATE POLICY "Admins can delete custom llm providers" ON custom_llm_providers
  FOR DELETE TO authenticated
  USING (has_ai_settings_manage_permission((select auth.uid()), org_id));

-- prompt_templates
DROP POLICY IF EXISTS "Users can view prompt templates in their org" ON prompt_templates;
DROP POLICY IF EXISTS "Users with permission can update prompt templates" ON prompt_templates;
DROP POLICY IF EXISTS "Users with permission can delete prompt templates" ON prompt_templates;

CREATE POLICY "Users can view prompt templates in their org" ON prompt_templates
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users with permission can update prompt templates" ON prompt_templates
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND (user_has_permission((select auth.uid()), 'ai.prompts.manage') OR user_is_admin((select auth.uid()))))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND (user_has_permission((select auth.uid()), 'ai.prompts.manage') OR user_is_admin((select auth.uid()))));

CREATE POLICY "Users with permission can delete prompt templates" ON prompt_templates
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND (user_has_permission((select auth.uid()), 'ai.prompts.manage') OR user_is_admin((select auth.uid()))));

-- prompt_template_versions
DROP POLICY IF EXISTS "Users can view prompt versions via template" ON prompt_template_versions;

CREATE POLICY "Users can view prompt versions via template" ON prompt_template_versions
  FOR SELECT TO authenticated
  USING (template_id IN (
    SELECT prompt_templates.id FROM prompt_templates
    WHERE prompt_templates.org_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    )
  ));

-- message_templates
DROP POLICY IF EXISTS "Users can view org message templates" ON message_templates;
DROP POLICY IF EXISTS "Users with permission can update message templates" ON message_templates;
DROP POLICY IF EXISTS "Users with permission can delete message templates" ON message_templates;

CREATE POLICY "Users can view org message templates" ON message_templates
  FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users with permission can update message templates" ON message_templates
  FOR UPDATE TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND has_permission('conversations.templates'))
  WITH CHECK (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users with permission can delete message templates" ON message_templates
  FOR DELETE TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND has_permission('conversations.templates'));
