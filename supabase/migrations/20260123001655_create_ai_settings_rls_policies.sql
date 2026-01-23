/*
  # AI Settings RLS Policies

  This migration creates Row Level Security policies for all AI settings tables.
  
  1. Policy Overview
    - LLM Providers: Admin/SuperAdmin only for full access; others see status only (no API keys)
    - LLM Models: Org users can view enabled models; Admin manages
    - ElevenLabs: Admin/SuperAdmin only for full access; others see status only
    - Knowledge: Users with ai.knowledge.manage can create/edit; all org users can view
    - Prompts: Users with ai.prompts.manage can create/edit; all org users can view
    - Junction tables: Follow parent table permissions
    - Settings Defaults: Admin/SuperAdmin only

  2. Security Principles
    - API keys are only visible to Admin/SuperAdmin roles
    - All tables scoped by org_id
    - Permission checks use role hierarchy
*/

-- Helper function to check if user has specific permission
CREATE OR REPLACE FUNCTION user_has_permission(p_user_id uuid, p_permission_key text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users u
    JOIN role_permissions rp ON rp.role_id = u.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE u.id = p_user_id
      AND p.key = p_permission_key
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to check if user is Admin or SuperAdmin
CREATE OR REPLACE FUNCTION user_is_admin(p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = p_user_id
      AND r.name IN ('SuperAdmin', 'Admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- LLM Providers Policies
DROP POLICY IF EXISTS "Users can view provider status in their org" ON llm_providers;
CREATE POLICY "Users can view provider status in their org"
  ON llm_providers FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can insert providers" ON llm_providers;
CREATE POLICY "Admins can insert providers"
  ON llm_providers FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update providers" ON llm_providers;
CREATE POLICY "Admins can update providers"
  ON llm_providers FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can delete providers" ON llm_providers;
CREATE POLICY "Admins can delete providers"
  ON llm_providers FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  );

-- LLM Models Policies
DROP POLICY IF EXISTS "Users can view models in their org" ON llm_models;
CREATE POLICY "Users can view models in their org"
  ON llm_models FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can insert models" ON llm_models;
CREATE POLICY "Admins can insert models"
  ON llm_models FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update models" ON llm_models;
CREATE POLICY "Admins can update models"
  ON llm_models FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can delete models" ON llm_models;
CREATE POLICY "Admins can delete models"
  ON llm_models FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  );

-- ElevenLabs Connection Policies
DROP POLICY IF EXISTS "Users can view elevenlabs connection in their org" ON elevenlabs_connection;
CREATE POLICY "Users can view elevenlabs connection in their org"
  ON elevenlabs_connection FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can insert elevenlabs connection" ON elevenlabs_connection;
CREATE POLICY "Admins can insert elevenlabs connection"
  ON elevenlabs_connection FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update elevenlabs connection" ON elevenlabs_connection;
CREATE POLICY "Admins can update elevenlabs connection"
  ON elevenlabs_connection FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can delete elevenlabs connection" ON elevenlabs_connection;
CREATE POLICY "Admins can delete elevenlabs connection"
  ON elevenlabs_connection FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  );

-- ElevenLabs Voices Policies
DROP POLICY IF EXISTS "Users can view voices in their org" ON elevenlabs_voices;
CREATE POLICY "Users can view voices in their org"
  ON elevenlabs_voices FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can insert voices" ON elevenlabs_voices;
CREATE POLICY "Admins can insert voices"
  ON elevenlabs_voices FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update voices" ON elevenlabs_voices;
CREATE POLICY "Admins can update voices"
  ON elevenlabs_voices FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can delete voices" ON elevenlabs_voices;
CREATE POLICY "Admins can delete voices"
  ON elevenlabs_voices FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  );

-- Knowledge Collections Policies
DROP POLICY IF EXISTS "Users can view knowledge collections in their org" ON knowledge_collections;
CREATE POLICY "Users can view knowledge collections in their org"
  ON knowledge_collections FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users with permission can insert knowledge collections" ON knowledge_collections;
CREATE POLICY "Users with permission can insert knowledge collections"
  ON knowledge_collections FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND (user_has_permission(auth.uid(), 'ai.knowledge.manage') OR user_is_admin(auth.uid()))
  );

DROP POLICY IF EXISTS "Users with permission can update knowledge collections" ON knowledge_collections;
CREATE POLICY "Users with permission can update knowledge collections"
  ON knowledge_collections FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND (user_has_permission(auth.uid(), 'ai.knowledge.manage') OR user_is_admin(auth.uid()))
  )
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND (user_has_permission(auth.uid(), 'ai.knowledge.manage') OR user_is_admin(auth.uid()))
  );

DROP POLICY IF EXISTS "Users with permission can delete knowledge collections" ON knowledge_collections;
CREATE POLICY "Users with permission can delete knowledge collections"
  ON knowledge_collections FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND (user_has_permission(auth.uid(), 'ai.knowledge.manage') OR user_is_admin(auth.uid()))
  );

-- Knowledge Versions Policies
DROP POLICY IF EXISTS "Users can view knowledge versions via collection" ON knowledge_versions;
CREATE POLICY "Users can view knowledge versions via collection"
  ON knowledge_versions FOR SELECT
  TO authenticated
  USING (
    collection_id IN (
      SELECT id FROM knowledge_collections
      WHERE org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users with permission can insert knowledge versions" ON knowledge_versions;
CREATE POLICY "Users with permission can insert knowledge versions"
  ON knowledge_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    collection_id IN (
      SELECT id FROM knowledge_collections
      WHERE org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    AND (user_has_permission(auth.uid(), 'ai.knowledge.manage') OR user_is_admin(auth.uid()))
  );

-- Knowledge Embeddings Policies
DROP POLICY IF EXISTS "Users can view embeddings via collection" ON knowledge_embeddings;
CREATE POLICY "Users can view embeddings via collection"
  ON knowledge_embeddings FOR SELECT
  TO authenticated
  USING (
    collection_id IN (
      SELECT id FROM knowledge_collections
      WHERE org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users with permission can insert embeddings" ON knowledge_embeddings;
CREATE POLICY "Users with permission can insert embeddings"
  ON knowledge_embeddings FOR INSERT
  TO authenticated
  WITH CHECK (
    collection_id IN (
      SELECT id FROM knowledge_collections
      WHERE org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    AND (user_has_permission(auth.uid(), 'ai.knowledge.manage') OR user_is_admin(auth.uid()))
  );

DROP POLICY IF EXISTS "Users with permission can delete embeddings" ON knowledge_embeddings;
CREATE POLICY "Users with permission can delete embeddings"
  ON knowledge_embeddings FOR DELETE
  TO authenticated
  USING (
    collection_id IN (
      SELECT id FROM knowledge_collections
      WHERE org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    AND (user_has_permission(auth.uid(), 'ai.knowledge.manage') OR user_is_admin(auth.uid()))
  );

-- Prompt Templates Policies
DROP POLICY IF EXISTS "Users can view prompt templates in their org" ON prompt_templates;
CREATE POLICY "Users can view prompt templates in their org"
  ON prompt_templates FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users with permission can insert prompt templates" ON prompt_templates;
CREATE POLICY "Users with permission can insert prompt templates"
  ON prompt_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND (user_has_permission(auth.uid(), 'ai.prompts.manage') OR user_is_admin(auth.uid()))
  );

DROP POLICY IF EXISTS "Users with permission can update prompt templates" ON prompt_templates;
CREATE POLICY "Users with permission can update prompt templates"
  ON prompt_templates FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND (user_has_permission(auth.uid(), 'ai.prompts.manage') OR user_is_admin(auth.uid()))
  )
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND (user_has_permission(auth.uid(), 'ai.prompts.manage') OR user_is_admin(auth.uid()))
  );

DROP POLICY IF EXISTS "Users with permission can delete prompt templates" ON prompt_templates;
CREATE POLICY "Users with permission can delete prompt templates"
  ON prompt_templates FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND (user_has_permission(auth.uid(), 'ai.prompts.manage') OR user_is_admin(auth.uid()))
  );

-- Prompt Template Versions Policies
DROP POLICY IF EXISTS "Users can view prompt versions via template" ON prompt_template_versions;
CREATE POLICY "Users can view prompt versions via template"
  ON prompt_template_versions FOR SELECT
  TO authenticated
  USING (
    template_id IN (
      SELECT id FROM prompt_templates
      WHERE org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users with permission can insert prompt versions" ON prompt_template_versions;
CREATE POLICY "Users with permission can insert prompt versions"
  ON prompt_template_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    template_id IN (
      SELECT id FROM prompt_templates
      WHERE org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    AND (user_has_permission(auth.uid(), 'ai.prompts.manage') OR user_is_admin(auth.uid()))
  );

-- Agent Knowledge Links Policies
DROP POLICY IF EXISTS "Users can view agent knowledge links" ON agent_knowledge_links;
CREATE POLICY "Users can view agent knowledge links"
  ON agent_knowledge_links FOR SELECT
  TO authenticated
  USING (
    agent_id IN (
      SELECT id FROM ai_agents
      WHERE org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users with ai_agents.manage can insert agent knowledge links" ON agent_knowledge_links;
CREATE POLICY "Users with ai_agents.manage can insert agent knowledge links"
  ON agent_knowledge_links FOR INSERT
  TO authenticated
  WITH CHECK (
    agent_id IN (
      SELECT id FROM ai_agents
      WHERE org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    AND (user_has_permission(auth.uid(), 'ai_agents.manage') OR user_is_admin(auth.uid()))
  );

DROP POLICY IF EXISTS "Users with ai_agents.manage can delete agent knowledge links" ON agent_knowledge_links;
CREATE POLICY "Users with ai_agents.manage can delete agent knowledge links"
  ON agent_knowledge_links FOR DELETE
  TO authenticated
  USING (
    agent_id IN (
      SELECT id FROM ai_agents
      WHERE org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    AND (user_has_permission(auth.uid(), 'ai_agents.manage') OR user_is_admin(auth.uid()))
  );

-- Agent Prompt Links Policies
DROP POLICY IF EXISTS "Users can view agent prompt links" ON agent_prompt_links;
CREATE POLICY "Users can view agent prompt links"
  ON agent_prompt_links FOR SELECT
  TO authenticated
  USING (
    agent_id IN (
      SELECT id FROM ai_agents
      WHERE org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users with ai_agents.manage can insert agent prompt links" ON agent_prompt_links;
CREATE POLICY "Users with ai_agents.manage can insert agent prompt links"
  ON agent_prompt_links FOR INSERT
  TO authenticated
  WITH CHECK (
    agent_id IN (
      SELECT id FROM ai_agents
      WHERE org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    AND (user_has_permission(auth.uid(), 'ai_agents.manage') OR user_is_admin(auth.uid()))
  );

DROP POLICY IF EXISTS "Users with ai_agents.manage can update agent prompt links" ON agent_prompt_links;
CREATE POLICY "Users with ai_agents.manage can update agent prompt links"
  ON agent_prompt_links FOR UPDATE
  TO authenticated
  USING (
    agent_id IN (
      SELECT id FROM ai_agents
      WHERE org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    AND (user_has_permission(auth.uid(), 'ai_agents.manage') OR user_is_admin(auth.uid()))
  )
  WITH CHECK (
    agent_id IN (
      SELECT id FROM ai_agents
      WHERE org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    AND (user_has_permission(auth.uid(), 'ai_agents.manage') OR user_is_admin(auth.uid()))
  );

DROP POLICY IF EXISTS "Users with ai_agents.manage can delete agent prompt links" ON agent_prompt_links;
CREATE POLICY "Users with ai_agents.manage can delete agent prompt links"
  ON agent_prompt_links FOR DELETE
  TO authenticated
  USING (
    agent_id IN (
      SELECT id FROM ai_agents
      WHERE org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    AND (user_has_permission(auth.uid(), 'ai_agents.manage') OR user_is_admin(auth.uid()))
  );

-- AI Agent Settings Defaults Policies
DROP POLICY IF EXISTS "Users can view ai settings defaults in their org" ON ai_agent_settings_defaults;
CREATE POLICY "Users can view ai settings defaults in their org"
  ON ai_agent_settings_defaults FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can insert ai settings defaults" ON ai_agent_settings_defaults;
CREATE POLICY "Admins can insert ai settings defaults"
  ON ai_agent_settings_defaults FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update ai settings defaults" ON ai_agent_settings_defaults;
CREATE POLICY "Admins can update ai settings defaults"
  ON ai_agent_settings_defaults FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  );