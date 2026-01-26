/*
  # Optimize RLS Policies for Social and Scoring Tables
  
  1. Tables Modified
    - social_account_groups, social_posts, social_post_content
    - social_post_media, social_post_metrics, social_post_ai_metadata
    - social_ai_learning_signals, social_oauth_states
    - scoring_models, scoring_rules, scoring_rule_executions
    - scoring_adjustment_limits, scoring_model_decay_config
    - entity_scores, score_events
  
  2. Changes
    - Replace auth.uid() with (select auth.uid()) for performance optimization
  
  3. Security
    - All policies maintain same access control logic
*/

-- social_account_groups
DROP POLICY IF EXISTS "Users can view account groups in their organization" ON social_account_groups;
DROP POLICY IF EXISTS "Users can update account groups in their organization" ON social_account_groups;
DROP POLICY IF EXISTS "Users can delete account groups in their organization" ON social_account_groups;

CREATE POLICY "Users can view account groups in their organization" ON social_account_groups
  FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users can update account groups in their organization" ON social_account_groups
  FOR UPDATE TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ))
  WITH CHECK (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users can delete account groups in their organization" ON social_account_groups
  FOR DELETE TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

-- social_posts
DROP POLICY IF EXISTS "Users with manage permission can update social posts" ON social_posts;
DROP POLICY IF EXISTS "Users with manage permission can delete social posts" ON social_posts;

CREATE POLICY "Users with manage permission can update social posts" ON social_posts
  FOR UPDATE TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND (EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE u.id = (select auth.uid()) AND p.key = 'marketing.social.manage'
  ) OR EXISTS (
    SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id
    WHERE u.id = (select auth.uid()) AND r.name = 'SuperAdmin'
  )))
  WITH CHECK (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users with manage permission can delete social posts" ON social_posts
  FOR DELETE TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND (EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE u.id = (select auth.uid()) AND p.key = 'marketing.social.manage'
  ) OR EXISTS (
    SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id
    WHERE u.id = (select auth.uid()) AND r.name = 'SuperAdmin'
  )));

-- social_post_content
DROP POLICY IF EXISTS "Users can view post content in their organization" ON social_post_content;
DROP POLICY IF EXISTS "Users can update post content in their organization" ON social_post_content;
DROP POLICY IF EXISTS "Users can delete post content in their organization" ON social_post_content;

CREATE POLICY "Users can view post content in their organization" ON social_post_content
  FOR SELECT TO authenticated
  USING (post_id IN (
    SELECT social_posts.id FROM social_posts
    WHERE social_posts.organization_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    )
  ));

CREATE POLICY "Users can update post content in their organization" ON social_post_content
  FOR UPDATE TO authenticated
  USING (post_id IN (
    SELECT social_posts.id FROM social_posts
    WHERE social_posts.organization_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    )
  ))
  WITH CHECK (post_id IN (
    SELECT social_posts.id FROM social_posts
    WHERE social_posts.organization_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    )
  ));

CREATE POLICY "Users can delete post content in their organization" ON social_post_content
  FOR DELETE TO authenticated
  USING (post_id IN (
    SELECT social_posts.id FROM social_posts
    WHERE social_posts.organization_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    )
  ));

-- social_post_media
DROP POLICY IF EXISTS "Users can view post media in their organization" ON social_post_media;
DROP POLICY IF EXISTS "Users can update post media in their organization" ON social_post_media;
DROP POLICY IF EXISTS "Users can delete post media in their organization" ON social_post_media;

CREATE POLICY "Users can view post media in their organization" ON social_post_media
  FOR SELECT TO authenticated
  USING (post_id IN (
    SELECT social_posts.id FROM social_posts
    WHERE social_posts.organization_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    )
  ));

CREATE POLICY "Users can update post media in their organization" ON social_post_media
  FOR UPDATE TO authenticated
  USING (post_id IN (
    SELECT social_posts.id FROM social_posts
    WHERE social_posts.organization_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    )
  ))
  WITH CHECK (post_id IN (
    SELECT social_posts.id FROM social_posts
    WHERE social_posts.organization_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    )
  ));

CREATE POLICY "Users can delete post media in their organization" ON social_post_media
  FOR DELETE TO authenticated
  USING (post_id IN (
    SELECT social_posts.id FROM social_posts
    WHERE social_posts.organization_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    )
  ));

-- social_post_metrics
DROP POLICY IF EXISTS "Users can view their organization's post metrics" ON social_post_metrics;
DROP POLICY IF EXISTS "Users can update metrics for their organization" ON social_post_metrics;
DROP POLICY IF EXISTS "Users can delete metrics for their organization" ON social_post_metrics;

CREATE POLICY "Users can view their organization's post metrics" ON social_post_metrics
  FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users can update metrics for their organization" ON social_post_metrics
  FOR UPDATE TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ))
  WITH CHECK (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users can delete metrics for their organization" ON social_post_metrics
  FOR DELETE TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

-- social_post_ai_metadata
DROP POLICY IF EXISTS "Users can view AI metadata in their organization" ON social_post_ai_metadata;
DROP POLICY IF EXISTS "Users can update AI metadata they created" ON social_post_ai_metadata;

CREATE POLICY "Users can view AI metadata in their organization" ON social_post_ai_metadata
  FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users can update AI metadata they created" ON social_post_ai_metadata
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()) OR organization_id IN (
    SELECT users.organization_id FROM users
    WHERE users.id = (select auth.uid()) AND users.role_id IN (
      SELECT roles.id FROM roles WHERE roles.name = ANY(ARRAY['SuperAdmin', 'Admin'])
    )
  ))
  WITH CHECK (user_id = (select auth.uid()) OR organization_id IN (
    SELECT users.organization_id FROM users
    WHERE users.id = (select auth.uid()) AND users.role_id IN (
      SELECT roles.id FROM roles WHERE roles.name = ANY(ARRAY['SuperAdmin', 'Admin'])
    )
  ));

-- social_ai_learning_signals
DROP POLICY IF EXISTS "Users can view their organization's learning signals" ON social_ai_learning_signals;
DROP POLICY IF EXISTS "Users can update learning signals for their organization" ON social_ai_learning_signals;
DROP POLICY IF EXISTS "Users can delete learning signals for their organization" ON social_ai_learning_signals;

CREATE POLICY "Users can view their organization's learning signals" ON social_ai_learning_signals
  FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users can update learning signals for their organization" ON social_ai_learning_signals
  FOR UPDATE TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ))
  WITH CHECK (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users can delete learning signals for their organization" ON social_ai_learning_signals
  FOR DELETE TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

-- scoring_models
DROP POLICY IF EXISTS "Users can view scoring models in their org" ON scoring_models;
DROP POLICY IF EXISTS "Admins can update scoring models" ON scoring_models;
DROP POLICY IF EXISTS "Admins can delete scoring models" ON scoring_models;

CREATE POLICY "Users can view scoring models in their org" ON scoring_models
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Admins can update scoring models" ON scoring_models
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_scoring_permission('scoring.manage'))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_scoring_permission('scoring.manage'));

CREATE POLICY "Admins can delete scoring models" ON scoring_models
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_scoring_permission('scoring.manage'));

-- scoring_rules
DROP POLICY IF EXISTS "Users can view scoring rules in their org" ON scoring_rules;
DROP POLICY IF EXISTS "Admins can update scoring rules" ON scoring_rules;
DROP POLICY IF EXISTS "Admins can delete scoring rules" ON scoring_rules;

CREATE POLICY "Users can view scoring rules in their org" ON scoring_rules
  FOR SELECT TO authenticated
  USING (model_id IN (
    SELECT scoring_models.id FROM scoring_models
    WHERE scoring_models.org_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    )
  ));

CREATE POLICY "Admins can update scoring rules" ON scoring_rules
  FOR UPDATE TO authenticated
  USING (model_id IN (
    SELECT scoring_models.id FROM scoring_models
    WHERE scoring_models.org_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    )
  ) AND user_has_scoring_permission('scoring.manage'))
  WITH CHECK (model_id IN (
    SELECT scoring_models.id FROM scoring_models
    WHERE scoring_models.org_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    )
  ) AND user_has_scoring_permission('scoring.manage'));

CREATE POLICY "Admins can delete scoring rules" ON scoring_rules
  FOR DELETE TO authenticated
  USING (model_id IN (
    SELECT scoring_models.id FROM scoring_models
    WHERE scoring_models.org_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    )
  ) AND user_has_scoring_permission('scoring.manage'));

-- scoring_rule_executions
DROP POLICY IF EXISTS "System can view rule executions" ON scoring_rule_executions;

CREATE POLICY "System can view rule executions" ON scoring_rule_executions
  FOR SELECT TO authenticated
  USING (rule_id IN (
    SELECT sr.id FROM scoring_rules sr
    JOIN scoring_models sm ON sr.model_id = sm.id
    WHERE sm.org_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    )
  ));

-- scoring_adjustment_limits
DROP POLICY IF EXISTS "Users can view adjustment limits in their org" ON scoring_adjustment_limits;
DROP POLICY IF EXISTS "Admins can update adjustment limits" ON scoring_adjustment_limits;

CREATE POLICY "Users can view adjustment limits in their org" ON scoring_adjustment_limits
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Admins can update adjustment limits" ON scoring_adjustment_limits
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_scoring_permission('scoring.manage'))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_scoring_permission('scoring.manage'));

-- scoring_model_decay_config
DROP POLICY IF EXISTS "Users can view decay config in their org" ON scoring_model_decay_config;
DROP POLICY IF EXISTS "Admins can update decay config" ON scoring_model_decay_config;
DROP POLICY IF EXISTS "Admins can delete decay config" ON scoring_model_decay_config;

CREATE POLICY "Users can view decay config in their org" ON scoring_model_decay_config
  FOR SELECT TO authenticated
  USING (model_id IN (
    SELECT scoring_models.id FROM scoring_models
    WHERE scoring_models.org_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    )
  ));

CREATE POLICY "Admins can update decay config" ON scoring_model_decay_config
  FOR UPDATE TO authenticated
  USING (model_id IN (
    SELECT scoring_models.id FROM scoring_models
    WHERE scoring_models.org_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    )
  ) AND user_has_scoring_permission('scoring.manage'))
  WITH CHECK (model_id IN (
    SELECT scoring_models.id FROM scoring_models
    WHERE scoring_models.org_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    )
  ) AND user_has_scoring_permission('scoring.manage'));

CREATE POLICY "Admins can delete decay config" ON scoring_model_decay_config
  FOR DELETE TO authenticated
  USING (model_id IN (
    SELECT scoring_models.id FROM scoring_models
    WHERE scoring_models.org_id IN (
      SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
    )
  ) AND user_has_scoring_permission('scoring.manage'));

-- entity_scores
DROP POLICY IF EXISTS "Users can view entity scores in their org" ON entity_scores;
DROP POLICY IF EXISTS "System can update entity scores" ON entity_scores;

CREATE POLICY "Users can view entity scores in their org" ON entity_scores
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "System can update entity scores" ON entity_scores
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

-- score_events
DROP POLICY IF EXISTS "Users can view score events in their org" ON score_events;

CREATE POLICY "Users can view score events in their org" ON score_events
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));
