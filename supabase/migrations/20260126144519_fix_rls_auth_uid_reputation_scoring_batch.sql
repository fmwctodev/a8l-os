/*
  # Fix RLS auth.uid() Performance - Reputation & Scoring Batch
  
  This migration optimizes RLS policies for reputation and scoring tables.
  
  ## Tables Fixed
  - reputation_settings, reputation_competitors (organization_id)
  - review_providers, review_requests, reviews (organization_id)
  - scoring_models, scoring_rules, scoring_model_decay_config, scoring_adjustment_limits (org_id)
  - entity_scores, score_events, scoring_rule_executions (org_id)
  
  ## Changes
  - All auth.uid() calls wrapped in (select auth.uid())
  - Using get_auth_user_org_id() for org checks
*/

-- ============================================
-- reputation_settings (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view reputation settings in their org" ON reputation_settings;
DROP POLICY IF EXISTS "Admins can insert reputation settings" ON reputation_settings;
DROP POLICY IF EXISTS "Admins can update reputation settings" ON reputation_settings;

CREATE POLICY "Users can view reputation settings in their org"
  ON reputation_settings FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Admins can insert reputation settings"
  ON reputation_settings FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Admins can update reputation settings"
  ON reputation_settings FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id())
  WITH CHECK (organization_id = get_auth_user_org_id());

-- ============================================
-- reputation_competitors (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view own org competitors" ON reputation_competitors;
DROP POLICY IF EXISTS "Users with permission can create competitors" ON reputation_competitors;
DROP POLICY IF EXISTS "Users with permission can update competitors" ON reputation_competitors;
DROP POLICY IF EXISTS "Users with permission can delete competitors" ON reputation_competitors;

CREATE POLICY "Users can view own org competitors"
  ON reputation_competitors FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users with permission can create competitors"
  ON reputation_competitors FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users with permission can update competitors"
  ON reputation_competitors FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id())
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users with permission can delete competitors"
  ON reputation_competitors FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id());

-- ============================================
-- review_providers (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view review providers in their org" ON review_providers;
DROP POLICY IF EXISTS "Admins can insert review providers" ON review_providers;
DROP POLICY IF EXISTS "Admins can update review providers" ON review_providers;
DROP POLICY IF EXISTS "Admins can delete review providers" ON review_providers;

CREATE POLICY "Users can view review providers in their org"
  ON review_providers FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Admins can insert review providers"
  ON review_providers FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Admins can update review providers"
  ON review_providers FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id())
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Admins can delete review providers"
  ON review_providers FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id());

-- ============================================
-- review_requests (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view review requests in their org" ON review_requests;

CREATE POLICY "Users can view review requests in their org"
  ON review_requests FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

-- ============================================
-- reviews (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view reviews in their org" ON reviews;
DROP POLICY IF EXISTS "Users can create reviews" ON reviews;
DROP POLICY IF EXISTS "Users can update reviews" ON reviews;

CREATE POLICY "Users can view reviews in their org"
  ON reviews FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can create reviews"
  ON reviews FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can update reviews"
  ON reviews FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id())
  WITH CHECK (organization_id = get_auth_user_org_id());

-- ============================================
-- scoring_models (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view scoring models in their org" ON scoring_models;
DROP POLICY IF EXISTS "Admins can insert scoring models" ON scoring_models;
DROP POLICY IF EXISTS "Admins can update scoring models" ON scoring_models;
DROP POLICY IF EXISTS "Admins can delete scoring models" ON scoring_models;

CREATE POLICY "Users can view scoring models in their org"
  ON scoring_models FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can insert scoring models"
  ON scoring_models FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can update scoring models"
  ON scoring_models FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can delete scoring models"
  ON scoring_models FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- scoring_rules (org_id via model)
-- ============================================
DROP POLICY IF EXISTS "Users can view scoring rules in their org" ON scoring_rules;
DROP POLICY IF EXISTS "Admins can insert scoring rules" ON scoring_rules;
DROP POLICY IF EXISTS "Admins can update scoring rules" ON scoring_rules;
DROP POLICY IF EXISTS "Admins can delete scoring rules" ON scoring_rules;

CREATE POLICY "Users can view scoring rules in their org"
  ON scoring_rules FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM scoring_models sm WHERE sm.id = scoring_rules.model_id AND sm.org_id = get_auth_user_org_id()
  ));

CREATE POLICY "Admins can insert scoring rules"
  ON scoring_rules FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM scoring_models sm WHERE sm.id = scoring_rules.model_id AND sm.org_id = get_auth_user_org_id()
  ));

CREATE POLICY "Admins can update scoring rules"
  ON scoring_rules FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM scoring_models sm WHERE sm.id = scoring_rules.model_id AND sm.org_id = get_auth_user_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM scoring_models sm WHERE sm.id = scoring_rules.model_id AND sm.org_id = get_auth_user_org_id()
  ));

CREATE POLICY "Admins can delete scoring rules"
  ON scoring_rules FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM scoring_models sm WHERE sm.id = scoring_rules.model_id AND sm.org_id = get_auth_user_org_id()
  ));

-- ============================================
-- scoring_model_decay_config (org_id via model)
-- ============================================
DROP POLICY IF EXISTS "Users can view decay config in their org" ON scoring_model_decay_config;
DROP POLICY IF EXISTS "Admins can insert decay config" ON scoring_model_decay_config;
DROP POLICY IF EXISTS "Admins can update decay config" ON scoring_model_decay_config;
DROP POLICY IF EXISTS "Admins can delete decay config" ON scoring_model_decay_config;

CREATE POLICY "Users can view decay config in their org"
  ON scoring_model_decay_config FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM scoring_models sm WHERE sm.id = scoring_model_decay_config.model_id AND sm.org_id = get_auth_user_org_id()
  ));

CREATE POLICY "Admins can insert decay config"
  ON scoring_model_decay_config FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM scoring_models sm WHERE sm.id = scoring_model_decay_config.model_id AND sm.org_id = get_auth_user_org_id()
  ));

CREATE POLICY "Admins can update decay config"
  ON scoring_model_decay_config FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM scoring_models sm WHERE sm.id = scoring_model_decay_config.model_id AND sm.org_id = get_auth_user_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM scoring_models sm WHERE sm.id = scoring_model_decay_config.model_id AND sm.org_id = get_auth_user_org_id()
  ));

CREATE POLICY "Admins can delete decay config"
  ON scoring_model_decay_config FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM scoring_models sm WHERE sm.id = scoring_model_decay_config.model_id AND sm.org_id = get_auth_user_org_id()
  ));

-- ============================================
-- scoring_adjustment_limits (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view adjustment limits in their org" ON scoring_adjustment_limits;
DROP POLICY IF EXISTS "Admins can insert adjustment limits" ON scoring_adjustment_limits;
DROP POLICY IF EXISTS "Admins can update adjustment limits" ON scoring_adjustment_limits;

CREATE POLICY "Users can view adjustment limits in their org"
  ON scoring_adjustment_limits FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can insert adjustment limits"
  ON scoring_adjustment_limits FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can update adjustment limits"
  ON scoring_adjustment_limits FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

-- ============================================
-- entity_scores (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view entity scores in their org" ON entity_scores;
DROP POLICY IF EXISTS "System can insert entity scores" ON entity_scores;
DROP POLICY IF EXISTS "System can update entity scores" ON entity_scores;

CREATE POLICY "Users can view entity scores in their org"
  ON entity_scores FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "System can insert entity scores"
  ON entity_scores FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "System can update entity scores"
  ON entity_scores FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

-- ============================================
-- score_events (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view score events in their org" ON score_events;
DROP POLICY IF EXISTS "System can insert score events" ON score_events;

CREATE POLICY "Users can view score events in their org"
  ON score_events FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "System can insert score events"
  ON score_events FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

-- ============================================
-- scoring_rule_executions (org_id via rule -> model)
-- ============================================
DROP POLICY IF EXISTS "System can view rule executions" ON scoring_rule_executions;
DROP POLICY IF EXISTS "System can insert rule executions" ON scoring_rule_executions;

CREATE POLICY "System can view rule executions"
  ON scoring_rule_executions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM scoring_rules sr
    JOIN scoring_models sm ON sm.id = sr.model_id
    WHERE sr.id = scoring_rule_executions.rule_id AND sm.org_id = get_auth_user_org_id()
  ));

CREATE POLICY "System can insert rule executions"
  ON scoring_rule_executions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM scoring_rules sr
    JOIN scoring_models sm ON sm.id = sr.model_id
    WHERE sr.id = scoring_rule_executions.rule_id AND sm.org_id = get_auth_user_org_id()
  ));
