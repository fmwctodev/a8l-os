/*
  # Optimize RLS policies for brand and knowledge tables

  1. Changes
    - Optimize RLS policies for brand_kits table
    - Optimize RLS policies for brand_kit_versions table
    - Optimize RLS policies for brand_voices table
    - Optimize RLS policies for brand_voice_versions table
    - Optimize RLS policies for brand_usage table
    - Optimize RLS policies for knowledge_collections table
    - Optimize RLS policies for knowledge_embeddings table
    - Optimize RLS policies for knowledge_versions table
    - Optimize RLS policies for agent_knowledge_sources table
    - Optimize RLS policies for agent_templates table
    - Optimize RLS policies for content_ai_generations table
    
  2. Security
    - Replace auth.uid() with (select auth.uid()) for performance
    - Maintain exact same security logic
    - All policies continue to check organization membership and permissions
*/

-- brand_kits (uses org_id)
DROP POLICY IF EXISTS "Users can view brand kits in their organization" ON brand_kits;
CREATE POLICY "Users can view brand kits in their organization"
  ON brand_kits FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can create brand kits" ON brand_kits;
CREATE POLICY "Users can create brand kits"
  ON brand_kits FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = get_user_org_id() 
    AND created_by = (select auth.uid())
    AND has_permission('branding:manage')
  );

DROP POLICY IF EXISTS "Users can update brand kits" ON brand_kits;
CREATE POLICY "Users can update brand kits"
  ON brand_kits FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('branding:manage'));

DROP POLICY IF EXISTS "Users can delete brand kits" ON brand_kits;
CREATE POLICY "Users can delete brand kits"
  ON brand_kits FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('branding:manage'));

-- brand_kit_versions (links through brand_kits)
DROP POLICY IF EXISTS "Users can view brand kit versions" ON brand_kit_versions;
CREATE POLICY "Users can view brand kit versions"
  ON brand_kit_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM brand_kits bk
      WHERE bk.id = brand_kit_versions.brand_kit_id
      AND bk.org_id = get_user_org_id()
    )
  );

DROP POLICY IF EXISTS "Users can create brand kit versions" ON brand_kit_versions;
CREATE POLICY "Users can create brand kit versions"
  ON brand_kit_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM brand_kits bk
      WHERE bk.id = brand_kit_versions.brand_kit_id
      AND bk.org_id = get_user_org_id()
      AND has_permission('branding:manage')
    )
  );

-- brand_voices (uses org_id)
DROP POLICY IF EXISTS "Users can view brand voices in their organization" ON brand_voices;
CREATE POLICY "Users can view brand voices in their organization"
  ON brand_voices FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can create brand voices" ON brand_voices;
CREATE POLICY "Users can create brand voices"
  ON brand_voices FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = get_user_org_id() 
    AND created_by = (select auth.uid())
    AND has_permission('branding:manage')
  );

DROP POLICY IF EXISTS "Users can update brand voices" ON brand_voices;
CREATE POLICY "Users can update brand voices"
  ON brand_voices FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('branding:manage'));

DROP POLICY IF EXISTS "Users can delete brand voices" ON brand_voices;
CREATE POLICY "Users can delete brand voices"
  ON brand_voices FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('branding:manage'));

-- brand_voice_versions (links through brand_voices)
DROP POLICY IF EXISTS "Users can view brand voice versions" ON brand_voice_versions;
CREATE POLICY "Users can view brand voice versions"
  ON brand_voice_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM brand_voices bv
      WHERE bv.id = brand_voice_versions.brand_voice_id
      AND bv.org_id = get_user_org_id()
    )
  );

DROP POLICY IF EXISTS "Users can create brand voice versions" ON brand_voice_versions;
CREATE POLICY "Users can create brand voice versions"
  ON brand_voice_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM brand_voices bv
      WHERE bv.id = brand_voice_versions.brand_voice_id
      AND bv.org_id = get_user_org_id()
      AND has_permission('branding:manage')
    )
  );

-- brand_usage (uses org_id)
DROP POLICY IF EXISTS "Users can view brand usage in their organization" ON brand_usage;
CREATE POLICY "Users can view brand usage in their organization"
  ON brand_usage FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('branding:view'));

DROP POLICY IF EXISTS "System can track brand usage" ON brand_usage;
CREATE POLICY "System can track brand usage"
  ON brand_usage FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id());

-- knowledge_collections (uses org_id)
DROP POLICY IF EXISTS "Users can view knowledge collections in their organization" ON knowledge_collections;
CREATE POLICY "Users can view knowledge collections in their organization"
  ON knowledge_collections FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:view'));

DROP POLICY IF EXISTS "Users can create knowledge collections" ON knowledge_collections;
CREATE POLICY "Users can create knowledge collections"
  ON knowledge_collections FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = get_user_org_id() 
    AND created_by = (select auth.uid())
    AND has_permission('ai_agents:manage')
  );

DROP POLICY IF EXISTS "Users can update knowledge collections" ON knowledge_collections;
CREATE POLICY "Users can update knowledge collections"
  ON knowledge_collections FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:manage'));

DROP POLICY IF EXISTS "Users can delete knowledge collections" ON knowledge_collections;
CREATE POLICY "Users can delete knowledge collections"
  ON knowledge_collections FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:manage'));

-- knowledge_embeddings (links through knowledge_collections)
DROP POLICY IF EXISTS "Users can view knowledge embeddings" ON knowledge_embeddings;
CREATE POLICY "Users can view knowledge embeddings"
  ON knowledge_embeddings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_collections kc
      WHERE kc.id = knowledge_embeddings.collection_id
      AND kc.org_id = get_user_org_id()
      AND has_permission('ai_agents:view')
    )
  );

DROP POLICY IF EXISTS "System can create knowledge embeddings" ON knowledge_embeddings;
CREATE POLICY "System can create knowledge embeddings"
  ON knowledge_embeddings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM knowledge_collections kc
      WHERE kc.id = knowledge_embeddings.collection_id
      AND kc.org_id = get_user_org_id()
    )
  );

DROP POLICY IF EXISTS "System can update knowledge embeddings" ON knowledge_embeddings;
CREATE POLICY "System can update knowledge embeddings"
  ON knowledge_embeddings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_collections kc
      WHERE kc.id = knowledge_embeddings.collection_id
      AND kc.org_id = get_user_org_id()
    )
  );

DROP POLICY IF EXISTS "Users can delete knowledge embeddings" ON knowledge_embeddings;
CREATE POLICY "Users can delete knowledge embeddings"
  ON knowledge_embeddings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_collections kc
      WHERE kc.id = knowledge_embeddings.collection_id
      AND kc.org_id = get_user_org_id()
      AND has_permission('ai_agents:manage')
    )
  );

-- knowledge_versions (links through knowledge_collections)
DROP POLICY IF EXISTS "Users can view knowledge versions" ON knowledge_versions;
CREATE POLICY "Users can view knowledge versions"
  ON knowledge_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_collections kc
      WHERE kc.id = knowledge_versions.collection_id
      AND kc.org_id = get_user_org_id()
      AND has_permission('ai_agents:view')
    )
  );

DROP POLICY IF EXISTS "Users can create knowledge versions" ON knowledge_versions;
CREATE POLICY "Users can create knowledge versions"
  ON knowledge_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM knowledge_collections kc
      WHERE kc.id = knowledge_versions.collection_id
      AND kc.org_id = get_user_org_id()
      AND has_permission('ai_agents:manage')
    )
  );

-- agent_knowledge_sources (uses org_id)
DROP POLICY IF EXISTS "Users can view agent knowledge sources in their organization" ON agent_knowledge_sources;
CREATE POLICY "Users can view agent knowledge sources in their organization"
  ON agent_knowledge_sources FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:view'));

DROP POLICY IF EXISTS "Users can create agent knowledge sources" ON agent_knowledge_sources;
CREATE POLICY "Users can create agent knowledge sources"
  ON agent_knowledge_sources FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('ai_agents:manage'));

DROP POLICY IF EXISTS "Users can update agent knowledge sources" ON agent_knowledge_sources;
CREATE POLICY "Users can update agent knowledge sources"
  ON agent_knowledge_sources FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:manage'));

DROP POLICY IF EXISTS "Users can delete agent knowledge sources" ON agent_knowledge_sources;
CREATE POLICY "Users can delete agent knowledge sources"
  ON agent_knowledge_sources FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:manage'));

-- agent_templates (uses org_id)
DROP POLICY IF EXISTS "Users can view agent templates in their organization" ON agent_templates;
CREATE POLICY "Users can view agent templates in their organization"
  ON agent_templates FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:view'));

DROP POLICY IF EXISTS "Users can create agent templates" ON agent_templates;
CREATE POLICY "Users can create agent templates"
  ON agent_templates FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND has_permission('ai_agents:manage'));

DROP POLICY IF EXISTS "Users can update agent templates" ON agent_templates;
CREATE POLICY "Users can update agent templates"
  ON agent_templates FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:manage'));

DROP POLICY IF EXISTS "Users can delete agent templates" ON agent_templates;
CREATE POLICY "Users can delete agent templates"
  ON agent_templates FOR DELETE
  TO authenticated
  USING (org_id = get_user_org_id() AND has_permission('ai_agents:manage'));

-- content_ai_generations (uses organization_id)
DROP POLICY IF EXISTS "Users can view AI generations in their organization" ON content_ai_generations;
CREATE POLICY "Users can view AI generations in their organization"
  ON content_ai_generations FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can create AI generations" ON content_ai_generations;
CREATE POLICY "Users can create AI generations"
  ON content_ai_generations FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = get_user_org_id() 
    AND user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "Users can update their AI generations" ON content_ai_generations;
CREATE POLICY "Users can update their AI generations"
  ON content_ai_generations FOR UPDATE
  TO authenticated
  USING (
    organization_id = get_user_org_id() 
    AND user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete their AI generations" ON content_ai_generations;
CREATE POLICY "Users can delete their AI generations"
  ON content_ai_generations FOR DELETE
  TO authenticated
  USING (
    organization_id = get_user_org_id() 
    AND user_id = (select auth.uid())
  );