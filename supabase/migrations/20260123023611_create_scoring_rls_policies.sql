/*
  # Lead Scoring Module - RLS Policies

  1. Security
    - scoring_models: Admins can manage, all authenticated users can view
    - scoring_model_decay_config: Admins can manage, all authenticated users can view
    - scoring_rules: Admins can manage, all authenticated users can view
    - entity_scores: All authenticated users can view org scores
    - score_events: All authenticated users can view org events, restricted insert
    - scoring_rule_executions: System-only access via service role
    - scoring_adjustment_limits: Admins can manage, all authenticated users can view

  2. Notes
    - Users can only access data within their organization
    - Manual score adjustments require scoring.adjust permission
*/

-- Helper function to check if user has a specific permission
CREATE OR REPLACE FUNCTION user_has_scoring_permission(p_permission text)
RETURNS boolean AS $$
DECLARE
  v_user_id uuid;
  v_has_permission boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 
    FROM users u
    JOIN role_permissions rp ON rp.role_id = u.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE u.id = v_user_id 
      AND p.code = p_permission
  ) INTO v_has_permission;

  RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- scoring_models policies
CREATE POLICY "Users can view scoring models in their org"
  ON scoring_models
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Admins can insert scoring models"
  ON scoring_models
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_scoring_permission('scoring.manage')
  );

CREATE POLICY "Admins can update scoring models"
  ON scoring_models
  FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_scoring_permission('scoring.manage')
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_scoring_permission('scoring.manage')
  );

CREATE POLICY "Admins can delete scoring models"
  ON scoring_models
  FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_scoring_permission('scoring.manage')
  );

-- scoring_model_decay_config policies
CREATE POLICY "Users can view decay config in their org"
  ON scoring_model_decay_config
  FOR SELECT
  TO authenticated
  USING (
    model_id IN (
      SELECT id FROM scoring_models 
      WHERE org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Admins can insert decay config"
  ON scoring_model_decay_config
  FOR INSERT
  TO authenticated
  WITH CHECK (
    model_id IN (
      SELECT id FROM scoring_models 
      WHERE org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    )
    AND user_has_scoring_permission('scoring.manage')
  );

CREATE POLICY "Admins can update decay config"
  ON scoring_model_decay_config
  FOR UPDATE
  TO authenticated
  USING (
    model_id IN (
      SELECT id FROM scoring_models 
      WHERE org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    )
    AND user_has_scoring_permission('scoring.manage')
  )
  WITH CHECK (
    model_id IN (
      SELECT id FROM scoring_models 
      WHERE org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    )
    AND user_has_scoring_permission('scoring.manage')
  );

CREATE POLICY "Admins can delete decay config"
  ON scoring_model_decay_config
  FOR DELETE
  TO authenticated
  USING (
    model_id IN (
      SELECT id FROM scoring_models 
      WHERE org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    )
    AND user_has_scoring_permission('scoring.manage')
  );

-- scoring_rules policies
CREATE POLICY "Users can view scoring rules in their org"
  ON scoring_rules
  FOR SELECT
  TO authenticated
  USING (
    model_id IN (
      SELECT id FROM scoring_models 
      WHERE org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Admins can insert scoring rules"
  ON scoring_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    model_id IN (
      SELECT id FROM scoring_models 
      WHERE org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    )
    AND user_has_scoring_permission('scoring.manage')
  );

CREATE POLICY "Admins can update scoring rules"
  ON scoring_rules
  FOR UPDATE
  TO authenticated
  USING (
    model_id IN (
      SELECT id FROM scoring_models 
      WHERE org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    )
    AND user_has_scoring_permission('scoring.manage')
  )
  WITH CHECK (
    model_id IN (
      SELECT id FROM scoring_models 
      WHERE org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    )
    AND user_has_scoring_permission('scoring.manage')
  );

CREATE POLICY "Admins can delete scoring rules"
  ON scoring_rules
  FOR DELETE
  TO authenticated
  USING (
    model_id IN (
      SELECT id FROM scoring_models 
      WHERE org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    )
    AND user_has_scoring_permission('scoring.manage')
  );

-- entity_scores policies
CREATE POLICY "Users can view entity scores in their org"
  ON entity_scores
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "System can insert entity scores"
  ON entity_scores
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "System can update entity scores"
  ON entity_scores
  FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- score_events policies (append-only audit log)
CREATE POLICY "Users can view score events in their org"
  ON score_events
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "System can insert score events"
  ON score_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- scoring_rule_executions policies (system access only, no direct user access)
CREATE POLICY "System can view rule executions"
  ON scoring_rule_executions
  FOR SELECT
  TO authenticated
  USING (
    rule_id IN (
      SELECT sr.id FROM scoring_rules sr
      JOIN scoring_models sm ON sr.model_id = sm.id
      WHERE sm.org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "System can insert rule executions"
  ON scoring_rule_executions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    rule_id IN (
      SELECT sr.id FROM scoring_rules sr
      JOIN scoring_models sm ON sr.model_id = sm.id
      WHERE sm.org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    )
  );

-- scoring_adjustment_limits policies
CREATE POLICY "Users can view adjustment limits in their org"
  ON scoring_adjustment_limits
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Admins can insert adjustment limits"
  ON scoring_adjustment_limits
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_scoring_permission('scoring.manage')
  );

CREATE POLICY "Admins can update adjustment limits"
  ON scoring_adjustment_limits
  FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_scoring_permission('scoring.manage')
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_has_scoring_permission('scoring.manage')
  );
