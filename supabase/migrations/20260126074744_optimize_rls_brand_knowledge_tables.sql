/*
  # Optimize RLS Policies for Brand and Knowledge Tables
  
  1. Tables Modified
    - brand_kits, brand_kit_versions
    - brand_voices, brand_voice_versions
    - brand_usage
    - knowledge_collections, knowledge_versions, knowledge_embeddings
    - agent_templates, agent_knowledge_sources, agent_knowledge_links, agent_prompt_links
  
  2. Changes
    - Replace auth.uid() with (select auth.uid()) for performance optimization
  
  3. Security
    - All policies maintain same access control logic
*/

-- brand_kits
DROP POLICY IF EXISTS "Users can view org brand kits" ON brand_kits;
DROP POLICY IF EXISTS "Users can update org brand kits" ON brand_kits;
DROP POLICY IF EXISTS "Users can delete org brand kits" ON brand_kits;

CREATE POLICY "Users can view org brand kits" ON brand_kits
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND archived_at IS NULL AND user_has_brandboard_permission('brandboard.view'));

CREATE POLICY "Users can update org brand kits" ON brand_kits
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_brandboard_permission('brandboard.manage'))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_brandboard_permission('brandboard.manage'));

CREATE POLICY "Users can delete org brand kits" ON brand_kits
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_brandboard_permission('brandboard.manage'));

-- brand_kit_versions
DROP POLICY IF EXISTS "Users can view org brand kit versions" ON brand_kit_versions;

CREATE POLICY "Users can view org brand kit versions" ON brand_kit_versions
  FOR SELECT TO authenticated
  USING (brand_kit_id IN (
    SELECT brand_kits.id FROM brand_kits
    WHERE brand_kits.org_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    ) AND brand_kits.archived_at IS NULL
  ) AND user_has_brandboard_permission('brandboard.view'));

-- brand_voices
DROP POLICY IF EXISTS "Users can view org brand voices" ON brand_voices;
DROP POLICY IF EXISTS "Users can update org brand voices" ON brand_voices;
DROP POLICY IF EXISTS "Users can delete org brand voices" ON brand_voices;

CREATE POLICY "Users can view org brand voices" ON brand_voices
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND archived_at IS NULL AND user_has_brandboard_permission('brandboard.view'));

CREATE POLICY "Users can update org brand voices" ON brand_voices
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_brandboard_permission('brandboard.manage'))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_brandboard_permission('brandboard.manage'));

CREATE POLICY "Users can delete org brand voices" ON brand_voices
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_brandboard_permission('brandboard.manage'));

-- brand_voice_versions
DROP POLICY IF EXISTS "Users can view org brand voice versions" ON brand_voice_versions;

CREATE POLICY "Users can view org brand voice versions" ON brand_voice_versions
  FOR SELECT TO authenticated
  USING (brand_voice_id IN (
    SELECT brand_voices.id FROM brand_voices
    WHERE brand_voices.org_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    ) AND brand_voices.archived_at IS NULL
  ) AND user_has_brandboard_permission('brandboard.view'));

-- brand_usage
DROP POLICY IF EXISTS "Users can view org brand usage" ON brand_usage;
DROP POLICY IF EXISTS "Users can update brand usage" ON brand_usage;
DROP POLICY IF EXISTS "Users can delete brand usage" ON brand_usage;

CREATE POLICY "Users can view org brand usage" ON brand_usage
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_brandboard_permission('brandboard.view'));

CREATE POLICY "Users can update brand usage" ON brand_usage
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_brandboard_permission('brandboard.view'))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_brandboard_permission('brandboard.view'));

CREATE POLICY "Users can delete brand usage" ON brand_usage
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_brandboard_permission('brandboard.manage'));

-- knowledge_collections
DROP POLICY IF EXISTS "Users can view knowledge collections in their org" ON knowledge_collections;
DROP POLICY IF EXISTS "Users with permission can update knowledge collections" ON knowledge_collections;
DROP POLICY IF EXISTS "Users with permission can delete knowledge collections" ON knowledge_collections;

CREATE POLICY "Users can view knowledge collections in their org" ON knowledge_collections
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users with permission can update knowledge collections" ON knowledge_collections
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND (user_has_permission((select auth.uid()), 'ai.knowledge.manage') OR user_is_admin((select auth.uid()))))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND (user_has_permission((select auth.uid()), 'ai.knowledge.manage') OR user_is_admin((select auth.uid()))));

CREATE POLICY "Users with permission can delete knowledge collections" ON knowledge_collections
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND (user_has_permission((select auth.uid()), 'ai.knowledge.manage') OR user_is_admin((select auth.uid()))));

-- knowledge_versions
DROP POLICY IF EXISTS "Users can view knowledge versions via collection" ON knowledge_versions;

CREATE POLICY "Users can view knowledge versions via collection" ON knowledge_versions
  FOR SELECT TO authenticated
  USING (collection_id IN (
    SELECT knowledge_collections.id FROM knowledge_collections
    WHERE knowledge_collections.org_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    )
  ));

-- knowledge_embeddings
DROP POLICY IF EXISTS "Users can view embeddings via collection" ON knowledge_embeddings;
DROP POLICY IF EXISTS "Users with permission can delete embeddings" ON knowledge_embeddings;

CREATE POLICY "Users can view embeddings via collection" ON knowledge_embeddings
  FOR SELECT TO authenticated
  USING (collection_id IN (
    SELECT knowledge_collections.id FROM knowledge_collections
    WHERE knowledge_collections.org_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    )
  ));

CREATE POLICY "Users with permission can delete embeddings" ON knowledge_embeddings
  FOR DELETE TO authenticated
  USING (collection_id IN (
    SELECT knowledge_collections.id FROM knowledge_collections
    WHERE knowledge_collections.org_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    )
  ) AND (user_has_permission((select auth.uid()), 'ai.knowledge.manage') OR user_is_admin((select auth.uid()))));

-- agent_templates
DROP POLICY IF EXISTS "Users can view templates in their organization" ON agent_templates;
DROP POLICY IF EXISTS "Users can update templates in their organization" ON agent_templates;
DROP POLICY IF EXISTS "Users can delete templates in their organization" ON agent_templates;

CREATE POLICY "Users can view templates in their organization" ON agent_templates
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users can update templates in their organization" ON agent_templates
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users can delete templates in their organization" ON agent_templates
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

-- agent_knowledge_sources
DROP POLICY IF EXISTS "Users can view knowledge sources in their organization" ON agent_knowledge_sources;
DROP POLICY IF EXISTS "Users can update knowledge sources in their organization" ON agent_knowledge_sources;
DROP POLICY IF EXISTS "Users can delete knowledge sources in their organization" ON agent_knowledge_sources;

CREATE POLICY "Users can view knowledge sources in their organization" ON agent_knowledge_sources
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users can update knowledge sources in their organization" ON agent_knowledge_sources
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users can delete knowledge sources in their organization" ON agent_knowledge_sources
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

-- agent_knowledge_links
DROP POLICY IF EXISTS "Users can view agent knowledge links" ON agent_knowledge_links;
DROP POLICY IF EXISTS "Users with ai_agents.manage can delete agent knowledge links" ON agent_knowledge_links;

CREATE POLICY "Users can view agent knowledge links" ON agent_knowledge_links
  FOR SELECT TO authenticated
  USING (agent_id IN (
    SELECT ai_agents.id FROM ai_agents
    WHERE ai_agents.org_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    )
  ));

CREATE POLICY "Users with ai_agents.manage can delete agent knowledge links" ON agent_knowledge_links
  FOR DELETE TO authenticated
  USING (agent_id IN (
    SELECT ai_agents.id FROM ai_agents
    WHERE ai_agents.org_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    )
  ) AND (user_has_permission((select auth.uid()), 'ai_agents.manage') OR user_is_admin((select auth.uid()))));

-- agent_prompt_links
DROP POLICY IF EXISTS "Users can view agent prompt links" ON agent_prompt_links;
DROP POLICY IF EXISTS "Users with ai_agents.manage can update agent prompt links" ON agent_prompt_links;
DROP POLICY IF EXISTS "Users with ai_agents.manage can delete agent prompt links" ON agent_prompt_links;

CREATE POLICY "Users can view agent prompt links" ON agent_prompt_links
  FOR SELECT TO authenticated
  USING (agent_id IN (
    SELECT ai_agents.id FROM ai_agents
    WHERE ai_agents.org_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    )
  ));

CREATE POLICY "Users with ai_agents.manage can update agent prompt links" ON agent_prompt_links
  FOR UPDATE TO authenticated
  USING (agent_id IN (
    SELECT ai_agents.id FROM ai_agents
    WHERE ai_agents.org_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    )
  ) AND (user_has_permission((select auth.uid()), 'ai_agents.manage') OR user_is_admin((select auth.uid()))))
  WITH CHECK (agent_id IN (
    SELECT ai_agents.id FROM ai_agents
    WHERE ai_agents.org_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    )
  ) AND (user_has_permission((select auth.uid()), 'ai_agents.manage') OR user_is_admin((select auth.uid()))));

CREATE POLICY "Users with ai_agents.manage can delete agent prompt links" ON agent_prompt_links
  FOR DELETE TO authenticated
  USING (agent_id IN (
    SELECT ai_agents.id FROM ai_agents
    WHERE ai_agents.org_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    )
  ) AND (user_has_permission((select auth.uid()), 'ai_agents.manage') OR user_is_admin((select auth.uid()))));
