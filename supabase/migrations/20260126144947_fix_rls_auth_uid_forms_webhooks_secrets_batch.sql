/*
  # Fix RLS auth.uid() Performance - Forms, Webhooks, Secrets Batch
  
  This migration optimizes RLS policies for forms, webhooks, and secrets tables.
  
  ## Tables Fixed
  - forms, surveys (organization_id)
  - outgoing_webhooks, webhook_deliveries, webhook_health (org_id)
  - org_secrets, secret_categories, secret_dynamic_refs, secret_usage_log (org_id)
  - module_integration_requirements, payment_events (org_id/organization_id)
  - oauth_states, google_calendar_connections (org_id)
  
  ## Changes
  - All auth.uid() calls wrapped in (select auth.uid())
  - Using get_auth_user_org_id() for org checks
*/

-- ============================================
-- forms (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users with manage permission can update forms" ON forms;
DROP POLICY IF EXISTS "Users with manage permission can delete forms" ON forms;

CREATE POLICY "Users can view forms in their org"
  ON forms FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users with manage permission can insert forms"
  ON forms FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users with manage permission can update forms"
  ON forms FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id())
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users with manage permission can delete forms"
  ON forms FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id());

-- ============================================
-- surveys (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users with manage permission can update surveys" ON surveys;
DROP POLICY IF EXISTS "Users with manage permission can delete surveys" ON surveys;

CREATE POLICY "Users can view surveys in their org"
  ON surveys FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users with manage permission can insert surveys"
  ON surveys FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users with manage permission can update surveys"
  ON surveys FOR UPDATE TO authenticated
  USING (organization_id = get_auth_user_org_id())
  WITH CHECK (organization_id = get_auth_user_org_id());

CREATE POLICY "Users with manage permission can delete surveys"
  ON surveys FOR DELETE TO authenticated
  USING (organization_id = get_auth_user_org_id());

-- ============================================
-- outgoing_webhooks (org_id)
-- ============================================
DROP POLICY IF EXISTS "Admins can view webhooks in their org" ON outgoing_webhooks;
DROP POLICY IF EXISTS "Admins can create webhooks" ON outgoing_webhooks;
DROP POLICY IF EXISTS "Users can create outgoing webhooks" ON outgoing_webhooks;
DROP POLICY IF EXISTS "Admins can update webhooks" ON outgoing_webhooks;
DROP POLICY IF EXISTS "Admins can delete webhooks" ON outgoing_webhooks;

CREATE POLICY "Admins can view webhooks in their org"
  ON outgoing_webhooks FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can create webhooks"
  ON outgoing_webhooks FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can update webhooks"
  ON outgoing_webhooks FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can delete webhooks"
  ON outgoing_webhooks FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- webhook_deliveries (org_id)
-- ============================================
DROP POLICY IF EXISTS "Admins can view webhook deliveries" ON webhook_deliveries;
DROP POLICY IF EXISTS "System can manage webhook deliveries" ON webhook_deliveries;

CREATE POLICY "Admins can view webhook deliveries"
  ON webhook_deliveries FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "System can manage webhook deliveries"
  ON webhook_deliveries FOR ALL TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

-- ============================================
-- webhook_health (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view webhook health with permission" ON webhook_health;
DROP POLICY IF EXISTS "Users can insert webhook health with manage permission" ON webhook_health;
DROP POLICY IF EXISTS "Users can update webhook health with manage permission" ON webhook_health;

CREATE POLICY "Users can view webhook health with permission"
  ON webhook_health FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can insert webhook health with manage permission"
  ON webhook_health FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update webhook health with manage permission"
  ON webhook_health FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

-- ============================================
-- org_secrets (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view secret metadata in their org" ON org_secrets;
DROP POLICY IF EXISTS "Admins can create secrets" ON org_secrets;
DROP POLICY IF EXISTS "Admins can update secrets" ON org_secrets;
DROP POLICY IF EXISTS "Admins can delete non-system secrets" ON org_secrets;

CREATE POLICY "Users can view secret metadata in their org"
  ON org_secrets FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can create secrets"
  ON org_secrets FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can update secrets"
  ON org_secrets FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can delete non-system secrets"
  ON org_secrets FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id() AND is_system = false);

-- ============================================
-- secret_categories (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view secret categories in their org" ON secret_categories;
DROP POLICY IF EXISTS "Admins can create secret categories" ON secret_categories;
DROP POLICY IF EXISTS "Admins can update secret categories" ON secret_categories;
DROP POLICY IF EXISTS "Admins can delete secret categories" ON secret_categories;

CREATE POLICY "Users can view secret categories in their org"
  ON secret_categories FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can create secret categories"
  ON secret_categories FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can update secret categories"
  ON secret_categories FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can delete secret categories"
  ON secret_categories FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- secret_dynamic_refs (org_id via org_secrets)
-- ============================================
DROP POLICY IF EXISTS "Users can view dynamic refs for accessible secrets" ON secret_dynamic_refs;
DROP POLICY IF EXISTS "Admins can create dynamic refs" ON secret_dynamic_refs;
DROP POLICY IF EXISTS "Admins can update dynamic refs" ON secret_dynamic_refs;
DROP POLICY IF EXISTS "Admins can delete dynamic refs" ON secret_dynamic_refs;

CREATE POLICY "Users can view dynamic refs for accessible secrets"
  ON secret_dynamic_refs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM org_secrets os WHERE os.id = secret_dynamic_refs.secret_id AND os.org_id = get_auth_user_org_id()
  ));

CREATE POLICY "Admins can create dynamic refs"
  ON secret_dynamic_refs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM org_secrets os WHERE os.id = secret_dynamic_refs.secret_id AND os.org_id = get_auth_user_org_id()
  ));

CREATE POLICY "Admins can update dynamic refs"
  ON secret_dynamic_refs FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM org_secrets os WHERE os.id = secret_dynamic_refs.secret_id AND os.org_id = get_auth_user_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM org_secrets os WHERE os.id = secret_dynamic_refs.secret_id AND os.org_id = get_auth_user_org_id()
  ));

CREATE POLICY "Admins can delete dynamic refs"
  ON secret_dynamic_refs FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM org_secrets os WHERE os.id = secret_dynamic_refs.secret_id AND os.org_id = get_auth_user_org_id()
  ));

-- ============================================
-- secret_usage_log (org_id)
-- ============================================
DROP POLICY IF EXISTS "Admins can view secret usage logs" ON secret_usage_log;
DROP POLICY IF EXISTS "System can insert usage logs" ON secret_usage_log;

CREATE POLICY "Admins can view secret usage logs"
  ON secret_usage_log FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "System can insert usage logs"
  ON secret_usage_log FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

-- ============================================
-- module_integration_requirements (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view module requirements in their org" ON module_integration_requirements;
DROP POLICY IF EXISTS "Admins can manage module requirements" ON module_integration_requirements;
DROP POLICY IF EXISTS "Admins can update module requirements" ON module_integration_requirements;
DROP POLICY IF EXISTS "Admins can delete module requirements" ON module_integration_requirements;

CREATE POLICY "Users can view module requirements in their org"
  ON module_integration_requirements FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can manage module requirements"
  ON module_integration_requirements FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can update module requirements"
  ON module_integration_requirements FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Admins can delete module requirements"
  ON module_integration_requirements FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- payment_events (organization_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view their organization's payment events" ON payment_events;
DROP POLICY IF EXISTS "Users can insert payment events for their organization" ON payment_events;

CREATE POLICY "Users can view their organization's payment events"
  ON payment_events FOR SELECT TO authenticated
  USING (organization_id = get_auth_user_org_id());

CREATE POLICY "Users can insert payment events for their organization"
  ON payment_events FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_auth_user_org_id());

-- ============================================
-- oauth_states (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view their own OAuth states" ON oauth_states;
DROP POLICY IF EXISTS "Users can insert their own OAuth states" ON oauth_states;
DROP POLICY IF EXISTS "Users can delete their own OAuth states" ON oauth_states;

CREATE POLICY "Users can view their own OAuth states"
  ON oauth_states FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Users can insert their own OAuth states"
  ON oauth_states FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own OAuth states"
  ON oauth_states FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

-- ============================================
-- google_calendar_connections (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view their own Google connections" ON google_calendar_connections;
DROP POLICY IF EXISTS "Users can insert their own Google connections" ON google_calendar_connections;
DROP POLICY IF EXISTS "Users can update their own Google connections" ON google_calendar_connections;
DROP POLICY IF EXISTS "Users can delete their own Google connections" ON google_calendar_connections;

CREATE POLICY "Users can view their own Google connections"
  ON google_calendar_connections FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Users can insert their own Google connections"
  ON google_calendar_connections FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Users can update their own Google connections"
  ON google_calendar_connections FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()))
  WITH CHECK (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own Google connections"
  ON google_calendar_connections FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id() AND user_id = (select auth.uid()));
