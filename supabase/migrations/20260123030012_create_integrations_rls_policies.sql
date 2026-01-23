/*
  # Integrations Module RLS Policies

  This migration creates Row Level Security policies for all integration tables.
  
  1. Policy Overview
    - integrations: Org users can view catalog; Admin can manage
    - integration_connections: Global connections visible to all; user-scoped visible to owner/admin
    - oauth_states: User can only see/manage their own OAuth states
    - module_integration_requirements: Org users can view; Admin can manage
    - integration_logs: Admin/SuperAdmin only
    - outgoing_webhooks: Admin/SuperAdmin only
    - webhook_deliveries: Admin/SuperAdmin only

  2. Security Principles
    - All tables scoped by org_id
    - Encrypted credentials never exposed to non-admins
    - Personal integrations (user-scoped) only visible to owner
    - Audit logs restricted to administrators
*/

-- Integrations catalog policies
DROP POLICY IF EXISTS "Users can view integrations in their org" ON integrations;
CREATE POLICY "Users can view integrations in their org"
  ON integrations FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can insert integrations" ON integrations;
CREATE POLICY "Admins can insert integrations"
  ON integrations FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update integrations" ON integrations;
CREATE POLICY "Admins can update integrations"
  ON integrations FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can delete integrations" ON integrations;
CREATE POLICY "Admins can delete integrations"
  ON integrations FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  );

-- Integration connections policies
DROP POLICY IF EXISTS "Users can view global connections in their org" ON integration_connections;
CREATE POLICY "Users can view global connections in their org"
  ON integration_connections FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND (
      user_id IS NULL
      OR user_id = auth.uid()
      OR user_is_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own connections" ON integration_connections;
CREATE POLICY "Users can insert their own connections"
  ON integration_connections FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND (
      (user_id = auth.uid())
      OR (user_id IS NULL AND user_is_admin(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can update their own connections" ON integration_connections;
CREATE POLICY "Users can update their own connections"
  ON integration_connections FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND (
      user_id = auth.uid()
      OR (user_id IS NULL AND user_is_admin(auth.uid()))
    )
  )
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND (
      user_id = auth.uid()
      OR (user_id IS NULL AND user_is_admin(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can delete their own connections" ON integration_connections;
CREATE POLICY "Users can delete their own connections"
  ON integration_connections FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND (
      user_id = auth.uid()
      OR (user_id IS NULL AND user_is_admin(auth.uid()))
    )
  );

-- OAuth states policies (user can only manage their own)
DROP POLICY IF EXISTS "Users can view their own OAuth states" ON oauth_states;
CREATE POLICY "Users can view their own OAuth states"
  ON oauth_states FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own OAuth states" ON oauth_states;
CREATE POLICY "Users can insert their own OAuth states"
  ON oauth_states FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can delete their own OAuth states" ON oauth_states;
CREATE POLICY "Users can delete their own OAuth states"
  ON oauth_states FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Module integration requirements policies
DROP POLICY IF EXISTS "Users can view module requirements in their org" ON module_integration_requirements;
CREATE POLICY "Users can view module requirements in their org"
  ON module_integration_requirements FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can manage module requirements" ON module_integration_requirements;
CREATE POLICY "Admins can manage module requirements"
  ON module_integration_requirements FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update module requirements" ON module_integration_requirements;
CREATE POLICY "Admins can update module requirements"
  ON module_integration_requirements FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can delete module requirements" ON module_integration_requirements;
CREATE POLICY "Admins can delete module requirements"
  ON module_integration_requirements FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  );

-- Integration logs policies (admin only)
DROP POLICY IF EXISTS "Admins can view integration logs" ON integration_logs;
CREATE POLICY "Admins can view integration logs"
  ON integration_logs FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "System can insert integration logs" ON integration_logs;
CREATE POLICY "System can insert integration logs"
  ON integration_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- Outgoing webhooks policies (admin only)
DROP POLICY IF EXISTS "Admins can view webhooks in their org" ON outgoing_webhooks;
CREATE POLICY "Admins can view webhooks in their org"
  ON outgoing_webhooks FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can create webhooks" ON outgoing_webhooks;
CREATE POLICY "Admins can create webhooks"
  ON outgoing_webhooks FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update webhooks" ON outgoing_webhooks;
CREATE POLICY "Admins can update webhooks"
  ON outgoing_webhooks FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can delete webhooks" ON outgoing_webhooks;
CREATE POLICY "Admins can delete webhooks"
  ON outgoing_webhooks FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  );

-- Webhook deliveries policies (admin only)
DROP POLICY IF EXISTS "Admins can view webhook deliveries" ON webhook_deliveries;
CREATE POLICY "Admins can view webhook deliveries"
  ON webhook_deliveries FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "System can manage webhook deliveries" ON webhook_deliveries;
CREATE POLICY "System can manage webhook deliveries"
  ON webhook_deliveries FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "System can update webhook deliveries" ON webhook_deliveries;
CREATE POLICY "System can update webhook deliveries"
  ON webhook_deliveries FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );
