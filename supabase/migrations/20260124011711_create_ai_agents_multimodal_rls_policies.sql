/*
  # Create RLS Policies for AI Agents Multi-Modal Extension

  This migration creates Row Level Security policies for the new tables:
  - agent_knowledge_sources
  - agent_templates

  1. Security Rules
    - All tables require authentication
    - All operations scoped to user's organization
    - Fine-grained permissions enforced at application layer

  2. Policy Types
    - SELECT: View agent knowledge and templates
    - INSERT: Create new knowledge sources and templates
    - UPDATE: Modify existing knowledge sources and templates
    - DELETE: Remove knowledge sources and templates
*/

-- ============================================================================
-- RLS Policies for agent_knowledge_sources
-- ============================================================================

CREATE POLICY "Users can view knowledge sources in their organization"
  ON agent_knowledge_sources FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert knowledge sources in their organization"
  ON agent_knowledge_sources FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update knowledge sources in their organization"
  ON agent_knowledge_sources FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete knowledge sources in their organization"
  ON agent_knowledge_sources FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- ============================================================================
-- RLS Policies for agent_templates
-- ============================================================================

CREATE POLICY "Users can view templates in their organization"
  ON agent_templates FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert templates in their organization"
  ON agent_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update templates in their organization"
  ON agent_templates FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete templates in their organization"
  ON agent_templates FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );
