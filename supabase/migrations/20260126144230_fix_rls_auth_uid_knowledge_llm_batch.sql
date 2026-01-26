/*
  # Fix RLS auth.uid() Performance - Knowledge & LLM Batch
  
  This migration optimizes RLS policies for knowledge and LLM-related tables.
  
  ## Tables Fixed
  - agent_knowledge_links, agent_knowledge_sources, agent_prompt_links, agent_templates
  - knowledge_collections, knowledge_versions, knowledge_embeddings
  - prompt_templates, prompt_template_versions
  - elevenlabs_connection, elevenlabs_voices
  - llm_providers, llm_models, custom_llm_providers
  
  ## Changes
  - All auth.uid() calls wrapped in (select auth.uid())
  - Using get_auth_user_org_id() for org checks
*/

-- ============================================
-- agent_knowledge_sources (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view knowledge sources in their organization" ON agent_knowledge_sources;
DROP POLICY IF EXISTS "Users can insert knowledge sources in their organization" ON agent_knowledge_sources;
DROP POLICY IF EXISTS "Users can update knowledge sources in their organization" ON agent_knowledge_sources;
DROP POLICY IF EXISTS "Users can delete knowledge sources in their organization" ON agent_knowledge_sources;

CREATE POLICY "Users can view knowledge sources in their organization"
  ON agent_knowledge_sources FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can insert knowledge sources in their organization"
  ON agent_knowledge_sources FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update knowledge sources in their organization"
  ON agent_knowledge_sources FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can delete knowledge sources in their organization"
  ON agent_knowledge_sources FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- agent_knowledge_links
-- ============================================
DROP POLICY IF EXISTS "Users can view agent knowledge links" ON agent_knowledge_links;
DROP POLICY IF EXISTS "Users with ai_agents.manage can insert agent knowledge links" ON agent_knowledge_links;
DROP POLICY IF EXISTS "Users with ai_agents.manage can delete agent knowledge links" ON agent_knowledge_links;

CREATE POLICY "Users can view agent knowledge links"
  ON agent_knowledge_links FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM ai_agents a WHERE a.id = agent_knowledge_links.agent_id AND a.org_id = get_auth_user_org_id()
  ));

CREATE POLICY "Users with ai_agents.manage can insert agent knowledge links"
  ON agent_knowledge_links FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM ai_agents a WHERE a.id = agent_knowledge_links.agent_id AND a.org_id = get_auth_user_org_id()
  ));

CREATE POLICY "Users with ai_agents.manage can delete agent knowledge links"
  ON agent_knowledge_links FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM ai_agents a WHERE a.id = agent_knowledge_links.agent_id AND a.org_id = get_auth_user_org_id()
  ));

-- ============================================
-- agent_prompt_links
-- ============================================
DROP POLICY IF EXISTS "Users can view agent prompt links" ON agent_prompt_links;
DROP POLICY IF EXISTS "Users with ai_agents.manage can insert agent prompt links" ON agent_prompt_links;
DROP POLICY IF EXISTS "Users with ai_agents.manage can update agent prompt links" ON agent_prompt_links;
DROP POLICY IF EXISTS "Users with ai_agents.manage can delete agent prompt links" ON agent_prompt_links;

CREATE POLICY "Users can view agent prompt links"
  ON agent_prompt_links FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM ai_agents a WHERE a.id = agent_prompt_links.agent_id AND a.org_id = get_auth_user_org_id()
  ));

CREATE POLICY "Users with ai_agents.manage can insert agent prompt links"
  ON agent_prompt_links FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM ai_agents a WHERE a.id = agent_prompt_links.agent_id AND a.org_id = get_auth_user_org_id()
  ));

CREATE POLICY "Users with ai_agents.manage can update agent prompt links"
  ON agent_prompt_links FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM ai_agents a WHERE a.id = agent_prompt_links.agent_id AND a.org_id = get_auth_user_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM ai_agents a WHERE a.id = agent_prompt_links.agent_id AND a.org_id = get_auth_user_org_id()
  ));

CREATE POLICY "Users with ai_agents.manage can delete agent prompt links"
  ON agent_prompt_links FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM ai_agents a WHERE a.id = agent_prompt_links.agent_id AND a.org_id = get_auth_user_org_id()
  ));

-- ============================================
-- agent_templates (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view templates in their organization" ON agent_templates;
DROP POLICY IF EXISTS "Users can insert templates in their organization" ON agent_templates;
DROP POLICY IF EXISTS "Users can update templates in their organization" ON agent_templates;
DROP POLICY IF EXISTS "Users can delete templates in their organization" ON agent_templates;

CREATE POLICY "Users can view templates in their organization"
  ON agent_templates FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id() OR org_id IS NULL);

CREATE POLICY "Users can insert templates in their organization"
  ON agent_templates FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update templates in their organization"
  ON agent_templates FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can delete templates in their organization"
  ON agent_templates FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- knowledge_collections (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view knowledge collections in their org" ON knowledge_collections;
DROP POLICY IF EXISTS "Users can create knowledge collections" ON knowledge_collections;
DROP POLICY IF EXISTS "Users with permission can insert knowledge collections" ON knowledge_collections;
DROP POLICY IF EXISTS "Users with permission can update knowledge collections" ON knowledge_collections;
DROP POLICY IF EXISTS "Users with permission can delete knowledge collections" ON knowledge_collections;

CREATE POLICY "Users can view knowledge collections in their org"
  ON knowledge_collections FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users with permission can insert knowledge collections"
  ON knowledge_collections FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users with permission can update knowledge collections"
  ON knowledge_collections FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users with permission can delete knowledge collections"
  ON knowledge_collections FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- knowledge_versions
-- ============================================
DROP POLICY IF EXISTS "Users can view knowledge versions via collection" ON knowledge_versions;
DROP POLICY IF EXISTS "Users can create knowledge versions" ON knowledge_versions;
DROP POLICY IF EXISTS "Users with permission can insert knowledge versions" ON knowledge_versions;

CREATE POLICY "Users can view knowledge versions via collection"
  ON knowledge_versions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM knowledge_collections kc 
    WHERE kc.id = knowledge_versions.collection_id AND kc.org_id = get_auth_user_org_id()
  ));

CREATE POLICY "Users with permission can insert knowledge versions"
  ON knowledge_versions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM knowledge_collections kc 
    WHERE kc.id = knowledge_versions.collection_id AND kc.org_id = get_auth_user_org_id()
  ));

-- ============================================
-- knowledge_embeddings
-- ============================================
DROP POLICY IF EXISTS "Users can view embeddings via collection" ON knowledge_embeddings;
DROP POLICY IF EXISTS "Users with permission can insert embeddings" ON knowledge_embeddings;
DROP POLICY IF EXISTS "Users with permission can delete embeddings" ON knowledge_embeddings;

CREATE POLICY "Users can view embeddings via collection"
  ON knowledge_embeddings FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM knowledge_collections kc 
    WHERE kc.id = knowledge_embeddings.collection_id AND kc.org_id = get_auth_user_org_id()
  ));

CREATE POLICY "Users with permission can insert embeddings"
  ON knowledge_embeddings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM knowledge_collections kc 
    WHERE kc.id = knowledge_embeddings.collection_id AND kc.org_id = get_auth_user_org_id()
  ));

CREATE POLICY "Users with permission can delete embeddings"
  ON knowledge_embeddings FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM knowledge_collections kc 
    WHERE kc.id = knowledge_embeddings.collection_id AND kc.org_id = get_auth_user_org_id()
  ));

-- ============================================
-- prompt_templates (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view prompt templates in their org" ON prompt_templates;
DROP POLICY IF EXISTS "Users can create prompt templates" ON prompt_templates;
DROP POLICY IF EXISTS "Users with permission can insert prompt templates" ON prompt_templates;
DROP POLICY IF EXISTS "Users with permission can update prompt templates" ON prompt_templates;
DROP POLICY IF EXISTS "Users with permission can delete prompt templates" ON prompt_templates;

CREATE POLICY "Users can view prompt templates in their org"
  ON prompt_templates FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users with permission can insert prompt templates"
  ON prompt_templates FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users with permission can update prompt templates"
  ON prompt_templates FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users with permission can delete prompt templates"
  ON prompt_templates FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- prompt_template_versions
-- ============================================
DROP POLICY IF EXISTS "Users can view prompt versions via template" ON prompt_template_versions;
DROP POLICY IF EXISTS "Users with permission can insert prompt versions" ON prompt_template_versions;

CREATE POLICY "Users can view prompt versions via template"
  ON prompt_template_versions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM prompt_templates pt 
    WHERE pt.id = prompt_template_versions.template_id AND pt.org_id = get_auth_user_org_id()
  ));

CREATE POLICY "Users with permission can insert prompt versions"
  ON prompt_template_versions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM prompt_templates pt 
    WHERE pt.id = prompt_template_versions.template_id AND pt.org_id = get_auth_user_org_id()
  ));

-- ============================================
-- elevenlabs_connection (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view elevenlabs connection in their org" ON elevenlabs_connection;
DROP POLICY IF EXISTS "Admins can insert elevenlabs connection" ON elevenlabs_connection;
DROP POLICY IF EXISTS "Admins can update elevenlabs connection" ON elevenlabs_connection;
DROP POLICY IF EXISTS "Admins can delete elevenlabs connection" ON elevenlabs_connection;

CREATE POLICY "Users can view elevenlabs connection in their org"
  ON elevenlabs_connection FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can insert elevenlabs connection"
  ON elevenlabs_connection FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can update elevenlabs connection"
  ON elevenlabs_connection FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can delete elevenlabs connection"
  ON elevenlabs_connection FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- elevenlabs_voices (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view voices in their org" ON elevenlabs_voices;
DROP POLICY IF EXISTS "Admins can insert voices" ON elevenlabs_voices;
DROP POLICY IF EXISTS "Admins can update voices" ON elevenlabs_voices;
DROP POLICY IF EXISTS "Admins can delete voices" ON elevenlabs_voices;

CREATE POLICY "Users can view voices in their org"
  ON elevenlabs_voices FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can insert voices"
  ON elevenlabs_voices FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can update voices"
  ON elevenlabs_voices FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can delete voices"
  ON elevenlabs_voices FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- llm_providers (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view provider status in their org" ON llm_providers;
DROP POLICY IF EXISTS "Admins can insert providers" ON llm_providers;
DROP POLICY IF EXISTS "Admins can update providers" ON llm_providers;
DROP POLICY IF EXISTS "Admins can delete providers" ON llm_providers;

CREATE POLICY "Users can view provider status in their org"
  ON llm_providers FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can insert providers"
  ON llm_providers FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can update providers"
  ON llm_providers FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can delete providers"
  ON llm_providers FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- llm_models (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view models in their org" ON llm_models;
DROP POLICY IF EXISTS "Admins can insert models" ON llm_models;
DROP POLICY IF EXISTS "Admins can update models" ON llm_models;
DROP POLICY IF EXISTS "Admins can delete models" ON llm_models;

CREATE POLICY "Users can view models in their org"
  ON llm_models FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can insert models"
  ON llm_models FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can update models"
  ON llm_models FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can delete models"
  ON llm_models FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- custom_llm_providers (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view org custom llm providers" ON custom_llm_providers;
DROP POLICY IF EXISTS "Admins can insert custom llm providers" ON custom_llm_providers;
DROP POLICY IF EXISTS "Admins can update custom llm providers" ON custom_llm_providers;
DROP POLICY IF EXISTS "Admins can delete custom llm providers" ON custom_llm_providers;

CREATE POLICY "Users can view org custom llm providers"
  ON custom_llm_providers FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can insert custom llm providers"
  ON custom_llm_providers FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can update custom llm providers"
  ON custom_llm_providers FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can delete custom llm providers"
  ON custom_llm_providers FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());
