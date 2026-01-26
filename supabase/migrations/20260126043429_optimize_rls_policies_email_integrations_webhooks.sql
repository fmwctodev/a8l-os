/*
  # Optimize RLS policies for email, integrations, webhooks, and LLM tables

  1. Changes
    - Optimize RLS policies for email service tables
    - Optimize RLS policies for Google Chat tables
    - Optimize RLS policies for integration tables
    - Optimize RLS policies for webhook tables
    - Optimize RLS policies for LLM provider/model tables
    - Optimize RLS policies for prompt templates and safety prompts
    - Optimize RLS policies for workflow_enrollments
    
  2. Security
    - Replace auth.uid() with (select auth.uid()) for performance
    - Maintain exact same security logic
    - All policies continue to check organization membership and permissions
*/

-- email_defaults (uses org_id)
DROP POLICY IF EXISTS "Users can view email defaults in their organization" ON email_defaults;
CREATE POLICY "Users can view email defaults in their organization"
  ON email_defaults FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can update email defaults" ON email_defaults;
CREATE POLICY "Users can update email defaults"
  ON email_defaults FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('email:manage'));

-- email_domains (uses org_id)
DROP POLICY IF EXISTS "Users can view email domains in their organization" ON email_domains;
CREATE POLICY "Users can view email domains in their organization"
  ON email_domains FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('email:view'));

DROP POLICY IF EXISTS "Users can create email domains" ON email_domains;
CREATE POLICY "Users can create email domains"
  ON email_domains FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('email:manage'));

DROP POLICY IF EXISTS "Users can update email domains" ON email_domains;
CREATE POLICY "Users can update email domains"
  ON email_domains FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('email:manage'));

DROP POLICY IF EXISTS "Users can delete email domains" ON email_domains;
CREATE POLICY "Users can delete email domains"
  ON email_domains FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('email:manage'));

-- email_from_addresses (uses org_id)
DROP POLICY IF EXISTS "Users can view email from addresses in their organization" ON email_from_addresses;
CREATE POLICY "Users can view email from addresses in their organization"
  ON email_from_addresses FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('email:view'));

DROP POLICY IF EXISTS "Users can create email from addresses" ON email_from_addresses;
CREATE POLICY "Users can create email from addresses"
  ON email_from_addresses FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('email:manage'));

DROP POLICY IF EXISTS "Users can update email from addresses" ON email_from_addresses;
CREATE POLICY "Users can update email from addresses"
  ON email_from_addresses FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('email:manage'));

DROP POLICY IF EXISTS "Users can delete email from addresses" ON email_from_addresses;
CREATE POLICY "Users can delete email from addresses"
  ON email_from_addresses FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('email:manage'));

-- email_providers (uses org_id)
DROP POLICY IF EXISTS "Users can view email providers in their organization" ON email_providers;
CREATE POLICY "Users can view email providers in their organization"
  ON email_providers FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('email:view'));

DROP POLICY IF EXISTS "Users can create email providers" ON email_providers;
CREATE POLICY "Users can create email providers"
  ON email_providers FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('email:manage'));

DROP POLICY IF EXISTS "Users can update email providers" ON email_providers;
CREATE POLICY "Users can update email providers"
  ON email_providers FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('email:manage'));

DROP POLICY IF EXISTS "Users can delete email providers" ON email_providers;
CREATE POLICY "Users can delete email providers"
  ON email_providers FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('email:manage'));

-- email_unsubscribe_groups (uses org_id)
DROP POLICY IF EXISTS "Users can view unsubscribe groups in their organization" ON email_unsubscribe_groups;
CREATE POLICY "Users can view unsubscribe groups in their organization"
  ON email_unsubscribe_groups FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('email:view'));

DROP POLICY IF EXISTS "Users can create unsubscribe groups" ON email_unsubscribe_groups;
CREATE POLICY "Users can create unsubscribe groups"
  ON email_unsubscribe_groups FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('email:manage'));

DROP POLICY IF EXISTS "Users can update unsubscribe groups" ON email_unsubscribe_groups;
CREATE POLICY "Users can update unsubscribe groups"
  ON email_unsubscribe_groups FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('email:manage'));

DROP POLICY IF EXISTS "Users can delete unsubscribe groups" ON email_unsubscribe_groups;
CREATE POLICY "Users can delete unsubscribe groups"
  ON email_unsubscribe_groups FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('email:manage'));

-- email_test_logs (uses org_id)
DROP POLICY IF EXISTS "Users can view email test logs in their organization" ON email_test_logs;
CREATE POLICY "Users can view email test logs in their organization"
  ON email_test_logs FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('email:view'));

DROP POLICY IF EXISTS "System can create email test logs" ON email_test_logs;
CREATE POLICY "System can create email test logs"
  ON email_test_logs FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id());

-- google_chat_tokens (uses org_id, user_id)
DROP POLICY IF EXISTS "Users can view their own Google Chat tokens" ON google_chat_tokens;
CREATE POLICY "Users can view their own Google Chat tokens"
  ON google_chat_tokens FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own Google Chat tokens" ON google_chat_tokens;
CREATE POLICY "Users can insert their own Google Chat tokens"
  ON google_chat_tokens FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own Google Chat tokens" ON google_chat_tokens;
CREATE POLICY "Users can update their own Google Chat tokens"
  ON google_chat_tokens FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own Google Chat tokens" ON google_chat_tokens;
CREATE POLICY "Users can delete their own Google Chat tokens"
  ON google_chat_tokens FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND user_id = (select auth.uid()));

-- google_chat_subscriptions (uses org_id, user_id)
DROP POLICY IF EXISTS "Users can view their Google Chat subscriptions" ON google_chat_subscriptions;
CREATE POLICY "Users can view their Google Chat subscriptions"
  ON google_chat_subscriptions FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create Google Chat subscriptions" ON google_chat_subscriptions;
CREATE POLICY "Users can create Google Chat subscriptions"
  ON google_chat_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their Google Chat subscriptions" ON google_chat_subscriptions;
CREATE POLICY "Users can update their Google Chat subscriptions"
  ON google_chat_subscriptions FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their Google Chat subscriptions" ON google_chat_subscriptions;
CREATE POLICY "Users can delete their Google Chat subscriptions"
  ON google_chat_subscriptions FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND user_id = (select auth.uid()));

-- google_chat_spaces_cache (uses org_id, user_id)
DROP POLICY IF EXISTS "Users can view their Google Chat spaces" ON google_chat_spaces_cache;
CREATE POLICY "Users can view their Google Chat spaces"
  ON google_chat_spaces_cache FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND user_id = (select auth.uid()));

DROP POLICY IF EXISTS "System can create Google Chat spaces cache" ON google_chat_spaces_cache;
CREATE POLICY "System can create Google Chat spaces cache"
  ON google_chat_spaces_cache FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND user_id = (select auth.uid()));

DROP POLICY IF EXISTS "System can update Google Chat spaces cache" ON google_chat_spaces_cache;
CREATE POLICY "System can update Google Chat spaces cache"
  ON google_chat_spaces_cache FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND user_id = (select auth.uid()));

-- google_chat_messages_cache (uses org_id, user_id)
DROP POLICY IF EXISTS "Users can view their Google Chat messages" ON google_chat_messages_cache;
CREATE POLICY "Users can view their Google Chat messages"
  ON google_chat_messages_cache FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND user_id = (select auth.uid()));

DROP POLICY IF EXISTS "System can create Google Chat messages cache" ON google_chat_messages_cache;
CREATE POLICY "System can create Google Chat messages cache"
  ON google_chat_messages_cache FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND user_id = (select auth.uid()));

DROP POLICY IF EXISTS "System can update Google Chat messages cache" ON google_chat_messages_cache;
CREATE POLICY "System can update Google Chat messages cache"
  ON google_chat_messages_cache FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND user_id = (select auth.uid()));

-- integration_connections (uses org_id, user_id)
DROP POLICY IF EXISTS "Users can view integration connections in their organization" ON integration_connections;
CREATE POLICY "Users can view integration connections in their organization"
  ON integration_connections FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can create integration connections" ON integration_connections;
CREATE POLICY "Users can create integration connections"
  ON integration_connections FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND (user_id = (select auth.uid()) OR user_id IS NULL));

DROP POLICY IF EXISTS "Users can update integration connections" ON integration_connections;
CREATE POLICY "Users can update integration connections"
  ON integration_connections FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('integrations:manage'));

DROP POLICY IF EXISTS "Users can delete integration connections" ON integration_connections;
CREATE POLICY "Users can delete integration connections"
  ON integration_connections FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('integrations:manage'));

-- integration_logs (uses org_id)
DROP POLICY IF EXISTS "Users can view integration logs in their organization" ON integration_logs;
CREATE POLICY "Users can view integration logs in their organization"
  ON integration_logs FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('integrations:view'));

DROP POLICY IF EXISTS "System can create integration logs" ON integration_logs;
CREATE POLICY "System can create integration logs"
  ON integration_logs FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id());

-- outgoing_webhooks (uses org_id)
DROP POLICY IF EXISTS "Users can view outgoing webhooks in their organization" ON outgoing_webhooks;
CREATE POLICY "Users can view outgoing webhooks in their organization"
  ON outgoing_webhooks FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('integrations:view'));

DROP POLICY IF EXISTS "Users can create outgoing webhooks" ON outgoing_webhooks;
CREATE POLICY "Users can create outgoing webhooks"
  ON outgoing_webhooks FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = get_user_org_id() 
    AND created_by = (select auth.uid())
    AND has_permission('integrations:manage')
  );

DROP POLICY IF EXISTS "Users can update outgoing webhooks" ON outgoing_webhooks;
CREATE POLICY "Users can update outgoing webhooks"
  ON outgoing_webhooks FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('integrations:manage'));

DROP POLICY IF EXISTS "Users can delete outgoing webhooks" ON outgoing_webhooks;
CREATE POLICY "Users can delete outgoing webhooks"
  ON outgoing_webhooks FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('integrations:manage'));

-- webhook_deliveries (uses org_id)
DROP POLICY IF EXISTS "Users can view webhook deliveries in their organization" ON webhook_deliveries;
CREATE POLICY "Users can view webhook deliveries in their organization"
  ON webhook_deliveries FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('integrations:view'));

DROP POLICY IF EXISTS "System can create webhook deliveries" ON webhook_deliveries;
CREATE POLICY "System can create webhook deliveries"
  ON webhook_deliveries FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id());

DROP POLICY IF EXISTS "System can update webhook deliveries" ON webhook_deliveries;
CREATE POLICY "System can update webhook deliveries"
  ON webhook_deliveries FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id());

-- llm_providers (uses org_id)
DROP POLICY IF EXISTS "Users can view LLM providers in their organization" ON llm_providers;
CREATE POLICY "Users can view LLM providers in their organization"
  ON llm_providers FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:view'));

DROP POLICY IF EXISTS "Users can create LLM providers" ON llm_providers;
CREATE POLICY "Users can create LLM providers"
  ON llm_providers FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('ai_agents:manage'));

DROP POLICY IF EXISTS "Users can update LLM providers" ON llm_providers;
CREATE POLICY "Users can update LLM providers"
  ON llm_providers FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:manage'));

DROP POLICY IF EXISTS "Users can delete LLM providers" ON llm_providers;
CREATE POLICY "Users can delete LLM providers"
  ON llm_providers FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:manage'));

-- llm_models (uses org_id)
DROP POLICY IF EXISTS "Users can view LLM models in their organization" ON llm_models;
CREATE POLICY "Users can view LLM models in their organization"
  ON llm_models FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:view'));

DROP POLICY IF EXISTS "Users can create LLM models" ON llm_models;
CREATE POLICY "Users can create LLM models"
  ON llm_models FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('ai_agents:manage'));

DROP POLICY IF EXISTS "Users can update LLM models" ON llm_models;
CREATE POLICY "Users can update LLM models"
  ON llm_models FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:manage'));

DROP POLICY IF EXISTS "Users can delete LLM models" ON llm_models;
CREATE POLICY "Users can delete LLM models"
  ON llm_models FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:manage'));

-- custom_llm_providers (uses org_id)
DROP POLICY IF EXISTS "Users can view custom LLM providers in their organization" ON custom_llm_providers;
CREATE POLICY "Users can view custom LLM providers in their organization"
  ON custom_llm_providers FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:view'));

DROP POLICY IF EXISTS "Users can create custom LLM providers" ON custom_llm_providers;
CREATE POLICY "Users can create custom LLM providers"
  ON custom_llm_providers FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('ai_agents:manage'));

DROP POLICY IF EXISTS "Users can update custom LLM providers" ON custom_llm_providers;
CREATE POLICY "Users can update custom LLM providers"
  ON custom_llm_providers FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:manage'));

DROP POLICY IF EXISTS "Users can delete custom LLM providers" ON custom_llm_providers;
CREATE POLICY "Users can delete custom LLM providers"
  ON custom_llm_providers FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:manage'));

-- prompt_templates (uses org_id)
DROP POLICY IF EXISTS "Users can view prompt templates in their organization" ON prompt_templates;
CREATE POLICY "Users can view prompt templates in their organization"
  ON prompt_templates FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:view'));

DROP POLICY IF EXISTS "Users can create prompt templates" ON prompt_templates;
CREATE POLICY "Users can create prompt templates"
  ON prompt_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = get_user_org_id() 
    AND created_by = (select auth.uid())
    AND has_permission('ai_agents:manage')
  );

DROP POLICY IF EXISTS "Users can update prompt templates" ON prompt_templates;
CREATE POLICY "Users can update prompt templates"
  ON prompt_templates FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:manage'));

DROP POLICY IF EXISTS "Users can delete prompt templates" ON prompt_templates;
CREATE POLICY "Users can delete prompt templates"
  ON prompt_templates FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:manage'));

-- ai_safety_prompts (uses org_id)
DROP POLICY IF EXISTS "Users can view AI safety prompts in their organization" ON ai_safety_prompts;
CREATE POLICY "Users can view AI safety prompts in their organization"
  ON ai_safety_prompts FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:view'));

DROP POLICY IF EXISTS "Users can create AI safety prompts" ON ai_safety_prompts;
CREATE POLICY "Users can create AI safety prompts"
  ON ai_safety_prompts FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('ai_agents:manage'));

DROP POLICY IF EXISTS "Users can update AI safety prompts" ON ai_safety_prompts;
CREATE POLICY "Users can update AI safety prompts"
  ON ai_safety_prompts FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:manage'));

DROP POLICY IF EXISTS "Users can delete AI safety prompts" ON ai_safety_prompts;
CREATE POLICY "Users can delete AI safety prompts"
  ON ai_safety_prompts FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:manage'));

-- workflow_enrollments (uses org_id)
DROP POLICY IF EXISTS "Users can view workflow enrollments in their organization" ON workflow_enrollments;
CREATE POLICY "Users can view workflow enrollments in their organization"
  ON workflow_enrollments FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('automation:view'));

DROP POLICY IF EXISTS "System can create workflow enrollments" ON workflow_enrollments;
CREATE POLICY "System can create workflow enrollments"
  ON workflow_enrollments FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id());

DROP POLICY IF EXISTS "System can update workflow enrollments" ON workflow_enrollments;
CREATE POLICY "System can update workflow enrollments"
  ON workflow_enrollments FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can delete workflow enrollments" ON workflow_enrollments;
CREATE POLICY "Users can delete workflow enrollments"
  ON workflow_enrollments FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('automation:manage'));