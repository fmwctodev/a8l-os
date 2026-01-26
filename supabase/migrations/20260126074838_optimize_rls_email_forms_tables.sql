/*
  # Optimize RLS Policies for Email and Forms Tables
  
  1. Tables Modified
    - email_providers, email_domains, email_from_addresses
    - email_defaults, email_unsubscribe_groups
    - email_campaign_domains, email_campaign_domain_events
    - email_warmup_config, email_warmup_daily_stats, email_warmup_ai_recommendations
    - email_test_logs
    - forms, surveys
  
  2. Changes
    - Replace auth.uid() with (select auth.uid()) for performance optimization
  
  3. Security
    - All policies maintain same access control logic
*/

-- email_providers
DROP POLICY IF EXISTS "Users can view email providers with permission" ON email_providers;
DROP POLICY IF EXISTS "Users can update email providers with manage permission" ON email_providers;
DROP POLICY IF EXISTS "Users can delete email providers with manage permission" ON email_providers;

CREATE POLICY "Users can view email providers with permission" ON email_providers
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_email_permission((select auth.uid()), 'email.settings.view'));

CREATE POLICY "Users can update email providers with manage permission" ON email_providers
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_email_permission((select auth.uid()), 'email.settings.manage'))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_email_permission((select auth.uid()), 'email.settings.manage'));

CREATE POLICY "Users can delete email providers with manage permission" ON email_providers
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_email_permission((select auth.uid()), 'email.settings.manage'));

-- email_domains
DROP POLICY IF EXISTS "Users can view email domains with permission" ON email_domains;
DROP POLICY IF EXISTS "Users can update email domains with manage permission" ON email_domains;
DROP POLICY IF EXISTS "Users can delete email domains with manage permission" ON email_domains;

CREATE POLICY "Users can view email domains with permission" ON email_domains
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_email_permission((select auth.uid()), 'email.settings.view'));

CREATE POLICY "Users can update email domains with manage permission" ON email_domains
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_email_permission((select auth.uid()), 'email.settings.manage'))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_email_permission((select auth.uid()), 'email.settings.manage'));

CREATE POLICY "Users can delete email domains with manage permission" ON email_domains
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_email_permission((select auth.uid()), 'email.settings.manage'));

-- email_from_addresses
DROP POLICY IF EXISTS "Users can view email from addresses with permission" ON email_from_addresses;
DROP POLICY IF EXISTS "Users can update email from addresses with manage permission" ON email_from_addresses;
DROP POLICY IF EXISTS "Users can delete email from addresses with manage permission" ON email_from_addresses;

CREATE POLICY "Users can view email from addresses with permission" ON email_from_addresses
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_email_permission((select auth.uid()), 'email.settings.view'));

CREATE POLICY "Users can update email from addresses with manage permission" ON email_from_addresses
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_email_permission((select auth.uid()), 'email.settings.manage'))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_email_permission((select auth.uid()), 'email.settings.manage'));

CREATE POLICY "Users can delete email from addresses with manage permission" ON email_from_addresses
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_email_permission((select auth.uid()), 'email.settings.manage'));

-- email_defaults
DROP POLICY IF EXISTS "Users can view email defaults with permission" ON email_defaults;
DROP POLICY IF EXISTS "Users can update email defaults with manage permission" ON email_defaults;

CREATE POLICY "Users can view email defaults with permission" ON email_defaults
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_email_permission((select auth.uid()), 'email.settings.view'));

CREATE POLICY "Users can update email defaults with manage permission" ON email_defaults
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_email_permission((select auth.uid()), 'email.settings.manage'))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_email_permission((select auth.uid()), 'email.settings.manage'));

-- email_unsubscribe_groups
DROP POLICY IF EXISTS "Users can view email unsubscribe groups with permission" ON email_unsubscribe_groups;
DROP POLICY IF EXISTS "Users can update email unsubscribe groups with manage permissio" ON email_unsubscribe_groups;
DROP POLICY IF EXISTS "Users can delete email unsubscribe groups with manage permissio" ON email_unsubscribe_groups;

CREATE POLICY "Users can view email unsubscribe groups with permission" ON email_unsubscribe_groups
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_email_permission((select auth.uid()), 'email.settings.view'));

CREATE POLICY "Users can update email unsubscribe groups with manage permission" ON email_unsubscribe_groups
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_email_permission((select auth.uid()), 'email.settings.manage'))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_email_permission((select auth.uid()), 'email.settings.manage'));

CREATE POLICY "Users can delete email unsubscribe groups with manage permission" ON email_unsubscribe_groups
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_email_permission((select auth.uid()), 'email.settings.manage'));

-- email_campaign_domains
DROP POLICY IF EXISTS "Users with email.settings.manage can update campaign domains" ON email_campaign_domains;
DROP POLICY IF EXISTS "Users with email.settings.manage can delete campaign domains" ON email_campaign_domains;

CREATE POLICY "Users with email.settings.manage can update campaign domains" ON email_campaign_domains
  FOR UPDATE TO authenticated
  USING (user_belongs_to_org(organization_id) AND EXISTS (
    SELECT 1 FROM users u
    JOIN role_permissions rp ON rp.role_id = u.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE u.id = (select auth.uid()) AND p.key = 'email.settings.manage'
  ))
  WITH CHECK (user_belongs_to_org(organization_id) AND EXISTS (
    SELECT 1 FROM users u
    JOIN role_permissions rp ON rp.role_id = u.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE u.id = (select auth.uid()) AND p.key = 'email.settings.manage'
  ));

CREATE POLICY "Users with email.settings.manage can delete campaign domains" ON email_campaign_domains
  FOR DELETE TO authenticated
  USING (user_belongs_to_org(organization_id) AND EXISTS (
    SELECT 1 FROM users u
    JOIN role_permissions rp ON rp.role_id = u.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE u.id = (select auth.uid()) AND p.key = 'email.settings.manage'
  ));

-- email_warmup_config
DROP POLICY IF EXISTS "Users with email.settings.manage can manage warmup config" ON email_warmup_config;

CREATE POLICY "Users with email.settings.manage can manage warmup config" ON email_warmup_config
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM email_campaign_domains d
    JOIN users u ON u.organization_id = d.organization_id
    JOIN role_permissions rp ON rp.role_id = u.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE d.id = email_warmup_config.campaign_domain_id
    AND u.id = (select auth.uid()) AND p.key = 'email.settings.manage'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM email_campaign_domains d
    JOIN users u ON u.organization_id = d.organization_id
    JOIN role_permissions rp ON rp.role_id = u.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE d.id = email_warmup_config.campaign_domain_id
    AND u.id = (select auth.uid()) AND p.key = 'email.settings.manage'
  ));

-- email_warmup_daily_stats
DROP POLICY IF EXISTS "Users with email.settings.manage can manage warmup stats" ON email_warmup_daily_stats;

CREATE POLICY "Users with email.settings.manage can manage warmup stats" ON email_warmup_daily_stats
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM email_campaign_domains d
    JOIN users u ON u.organization_id = d.organization_id
    JOIN role_permissions rp ON rp.role_id = u.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE d.id = email_warmup_daily_stats.campaign_domain_id
    AND u.id = (select auth.uid()) AND p.key = 'email.settings.manage'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM email_campaign_domains d
    JOIN users u ON u.organization_id = d.organization_id
    JOIN role_permissions rp ON rp.role_id = u.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE d.id = email_warmup_daily_stats.campaign_domain_id
    AND u.id = (select auth.uid()) AND p.key = 'email.settings.manage'
  ));

-- email_warmup_ai_recommendations
DROP POLICY IF EXISTS "Users with email.settings.manage can manage AI recommendations" ON email_warmup_ai_recommendations;

CREATE POLICY "Users with email.settings.manage can manage AI recommendations" ON email_warmup_ai_recommendations
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM email_campaign_domains d
    JOIN users u ON u.organization_id = d.organization_id
    JOIN role_permissions rp ON rp.role_id = u.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE d.id = email_warmup_ai_recommendations.campaign_domain_id
    AND u.id = (select auth.uid()) AND p.key = 'email.settings.manage'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM email_campaign_domains d
    JOIN users u ON u.organization_id = d.organization_id
    JOIN role_permissions rp ON rp.role_id = u.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE d.id = email_warmup_ai_recommendations.campaign_domain_id
    AND u.id = (select auth.uid()) AND p.key = 'email.settings.manage'
  ));

-- email_test_logs
DROP POLICY IF EXISTS "Users can view email test logs with permission" ON email_test_logs;

CREATE POLICY "Users can view email test logs with permission" ON email_test_logs
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_email_permission((select auth.uid()), 'email.settings.view'));

-- forms
DROP POLICY IF EXISTS "Users with manage permission can update forms" ON forms;
DROP POLICY IF EXISTS "Users with manage permission can delete forms" ON forms;

CREATE POLICY "Users with manage permission can update forms" ON forms
  FOR UPDATE TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND (EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE u.id = (select auth.uid()) AND p.key = 'marketing.forms.manage'
  ) OR EXISTS (
    SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id
    WHERE u.id = (select auth.uid()) AND r.name = 'SuperAdmin'
  )))
  WITH CHECK (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users with manage permission can delete forms" ON forms
  FOR DELETE TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND (EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE u.id = (select auth.uid()) AND p.key = 'marketing.forms.manage'
  ) OR EXISTS (
    SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id
    WHERE u.id = (select auth.uid()) AND r.name = 'SuperAdmin'
  )));

-- surveys
DROP POLICY IF EXISTS "Users with manage permission can update surveys" ON surveys;
DROP POLICY IF EXISTS "Users with manage permission can delete surveys" ON surveys;

CREATE POLICY "Users with manage permission can update surveys" ON surveys
  FOR UPDATE TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND (EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE u.id = (select auth.uid()) AND p.key = 'marketing.surveys.manage'
  ) OR EXISTS (
    SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id
    WHERE u.id = (select auth.uid()) AND r.name = 'SuperAdmin'
  )))
  WITH CHECK (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Users with manage permission can delete surveys" ON surveys
  FOR DELETE TO authenticated
  USING (organization_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND (EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE u.id = (select auth.uid()) AND p.key = 'marketing.surveys.manage'
  ) OR EXISTS (
    SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id
    WHERE u.id = (select auth.uid()) AND r.name = 'SuperAdmin'
  )));
