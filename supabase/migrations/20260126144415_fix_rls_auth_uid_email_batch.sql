/*
  # Fix RLS auth.uid() Performance - Email Batch
  
  This migration optimizes RLS policies for email-related tables.
  
  ## Tables Fixed
  - email_providers, email_domains, email_from_addresses (org_id)
  - email_unsubscribe_groups, email_defaults, email_test_logs (org_id)
  - email_campaign_domains, email_campaign_domain_events (organization_id, campaign_domain_id)
  - email_warmup_config, email_warmup_daily_stats, email_warmup_ai_recommendations (campaign_domain_id)
  
  ## Changes
  - All auth.uid() calls wrapped in (select auth.uid())
  - Using get_auth_user_org_id() for org checks
*/

-- ============================================
-- email_providers (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view email providers with permission" ON email_providers;
DROP POLICY IF EXISTS "Users can insert email providers with manage permission" ON email_providers;
DROP POLICY IF EXISTS "Users can update email providers with manage permission" ON email_providers;
DROP POLICY IF EXISTS "Users can delete email providers with manage permission" ON email_providers;

CREATE POLICY "Users can view email providers with permission"
  ON email_providers FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can insert email providers with manage permission"
  ON email_providers FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update email providers with manage permission"
  ON email_providers FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can delete email providers with manage permission"
  ON email_providers FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- email_domains (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view email domains with permission" ON email_domains;
DROP POLICY IF EXISTS "Users can insert email domains with manage permission" ON email_domains;
DROP POLICY IF EXISTS "Users can update email domains with manage permission" ON email_domains;
DROP POLICY IF EXISTS "Users can delete email domains with manage permission" ON email_domains;

CREATE POLICY "Users can view email domains with permission"
  ON email_domains FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can insert email domains with manage permission"
  ON email_domains FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update email domains with manage permission"
  ON email_domains FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can delete email domains with manage permission"
  ON email_domains FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- email_from_addresses (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view email from addresses with permission" ON email_from_addresses;
DROP POLICY IF EXISTS "Users can insert email from addresses with manage permission" ON email_from_addresses;
DROP POLICY IF EXISTS "Users can update email from addresses with manage permission" ON email_from_addresses;
DROP POLICY IF EXISTS "Users can delete email from addresses with manage permission" ON email_from_addresses;

CREATE POLICY "Users can view email from addresses with permission"
  ON email_from_addresses FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can insert email from addresses with manage permission"
  ON email_from_addresses FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update email from addresses with manage permission"
  ON email_from_addresses FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can delete email from addresses with manage permission"
  ON email_from_addresses FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- email_unsubscribe_groups (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view email unsubscribe groups with permission" ON email_unsubscribe_groups;
DROP POLICY IF EXISTS "Users can insert email unsubscribe groups with manage permissio" ON email_unsubscribe_groups;
DROP POLICY IF EXISTS "Users can update email unsubscribe groups with manage permissio" ON email_unsubscribe_groups;
DROP POLICY IF EXISTS "Users can delete email unsubscribe groups with manage permissio" ON email_unsubscribe_groups;

CREATE POLICY "Users can view email unsubscribe groups with permission"
  ON email_unsubscribe_groups FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can insert email unsubscribe groups"
  ON email_unsubscribe_groups FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update email unsubscribe groups"
  ON email_unsubscribe_groups FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can delete email unsubscribe groups"
  ON email_unsubscribe_groups FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- email_defaults (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view email defaults with permission" ON email_defaults;
DROP POLICY IF EXISTS "Users can insert email defaults with manage permission" ON email_defaults;
DROP POLICY IF EXISTS "Users can update email defaults with manage permission" ON email_defaults;

CREATE POLICY "Users can view email defaults with permission"
  ON email_defaults FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can insert email defaults with manage permission"
  ON email_defaults FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update email defaults with manage permission"
  ON email_defaults FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

-- ============================================
-- email_test_logs (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view email test logs with permission" ON email_test_logs;
DROP POLICY IF EXISTS "Users can insert email test logs with test permission" ON email_test_logs;

CREATE POLICY "Users can view email test logs with permission"
  ON email_test_logs FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can insert email test logs with test permission"
  ON email_test_logs FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

-- ============================================
-- email_campaign_domains (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users with email.settings.manage can insert campaign domains" ON email_campaign_domains;
DROP POLICY IF EXISTS "Users with email.settings.manage can update campaign domains" ON email_campaign_domains;
DROP POLICY IF EXISTS "Users with email.settings.manage can delete campaign domains" ON email_campaign_domains;

CREATE POLICY "Users can view email campaign domains"
  ON email_campaign_domains FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can insert email campaign domains"
  ON email_campaign_domains FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can update email campaign domains"
  ON email_campaign_domains FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id())
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can delete email campaign domains"
  ON email_campaign_domains FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id());

-- ============================================
-- email_campaign_domain_events (campaign_domain_id)
-- ============================================
DROP POLICY IF EXISTS "Users with email.settings.manage can insert domain events" ON email_campaign_domain_events;

CREATE POLICY "Users can view email campaign domain events"
  ON email_campaign_domain_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM email_campaign_domains ecd
    WHERE ecd.id = email_campaign_domain_events.campaign_domain_id AND ecd.organization_id = get_auth_user_org_id()
  ));

CREATE POLICY "Users can insert email campaign domain events"
  ON email_campaign_domain_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM email_campaign_domains ecd
    WHERE ecd.id = email_campaign_domain_events.campaign_domain_id AND ecd.organization_id = get_auth_user_org_id()
  ));

-- ============================================
-- email_warmup_config (campaign_domain_id)
-- ============================================
DROP POLICY IF EXISTS "Users with email.settings.manage can manage warmup config" ON email_warmup_config;

CREATE POLICY "Users can manage warmup config"
  ON email_warmup_config FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM email_campaign_domains ecd
    WHERE ecd.id = email_warmup_config.campaign_domain_id AND ecd.organization_id = get_auth_user_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM email_campaign_domains ecd
    WHERE ecd.id = email_warmup_config.campaign_domain_id AND ecd.organization_id = get_auth_user_org_id()
  ));

-- ============================================
-- email_warmup_daily_stats (campaign_domain_id)
-- ============================================
DROP POLICY IF EXISTS "Users with email.settings.manage can manage warmup stats" ON email_warmup_daily_stats;

CREATE POLICY "Users can manage warmup stats"
  ON email_warmup_daily_stats FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM email_campaign_domains ecd
    WHERE ecd.id = email_warmup_daily_stats.campaign_domain_id AND ecd.organization_id = get_auth_user_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM email_campaign_domains ecd
    WHERE ecd.id = email_warmup_daily_stats.campaign_domain_id AND ecd.organization_id = get_auth_user_org_id()
  ));

-- ============================================
-- email_warmup_ai_recommendations (campaign_domain_id)
-- ============================================
DROP POLICY IF EXISTS "Users with email.settings.manage can manage AI recommendations" ON email_warmup_ai_recommendations;

CREATE POLICY "Users can manage warmup AI recommendations"
  ON email_warmup_ai_recommendations FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM email_campaign_domains ecd
    WHERE ecd.id = email_warmup_ai_recommendations.campaign_domain_id AND ecd.organization_id = get_auth_user_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM email_campaign_domains ecd
    WHERE ecd.id = email_warmup_ai_recommendations.campaign_domain_id AND ecd.organization_id = get_auth_user_org_id()
  ));
