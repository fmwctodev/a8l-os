/*
  # Optimize RLS Policies for Integrations and Phone Tables
  
  1. Tables Modified
    - integrations, integration_connections, integration_logs
    - phone_settings, phone_test_logs
    - twilio_connection, twilio_numbers, twilio_messaging_services
    - messaging_service_senders, dnc_numbers
    - voice_routing_groups, voice_routing_destinations
  
  2. Changes
    - Replace auth.uid() with (select auth.uid()) for performance optimization
  
  3. Security
    - All policies maintain same access control logic
*/

-- integrations
DROP POLICY IF EXISTS "Users can view integrations in their org" ON integrations;
DROP POLICY IF EXISTS "Admins can update integrations" ON integrations;
DROP POLICY IF EXISTS "Admins can delete integrations" ON integrations;

CREATE POLICY "Users can view integrations in their org" ON integrations
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ));

CREATE POLICY "Admins can update integrations" ON integrations
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_is_admin((select auth.uid())))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_is_admin((select auth.uid())));

CREATE POLICY "Admins can delete integrations" ON integrations
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_is_admin((select auth.uid())));

-- integration_connections
DROP POLICY IF EXISTS "Users can view global connections in their org" ON integration_connections;
DROP POLICY IF EXISTS "Users can update their own connections" ON integration_connections;
DROP POLICY IF EXISTS "Users can delete their own connections" ON integration_connections;

CREATE POLICY "Users can view global connections in their org" ON integration_connections
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND (user_id IS NULL OR user_id = (select auth.uid()) OR user_is_admin((select auth.uid()))));

CREATE POLICY "Users can update their own connections" ON integration_connections
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND (user_id = (select auth.uid()) OR (user_id IS NULL AND user_is_admin((select auth.uid())))))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND (user_id = (select auth.uid()) OR (user_id IS NULL AND user_is_admin((select auth.uid())))));

CREATE POLICY "Users can delete their own connections" ON integration_connections
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND (user_id = (select auth.uid()) OR (user_id IS NULL AND user_is_admin((select auth.uid())))));

-- integration_logs
DROP POLICY IF EXISTS "Admins can view integration logs" ON integration_logs;

CREATE POLICY "Admins can view integration logs" ON integration_logs
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_is_admin((select auth.uid())));

-- phone_settings
DROP POLICY IF EXISTS "Users can view phone settings with permission" ON phone_settings;
DROP POLICY IF EXISTS "Users can update phone settings with manage permission" ON phone_settings;

CREATE POLICY "Users can view phone settings with permission" ON phone_settings
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_phone_permission('phone.settings.view'));

CREATE POLICY "Users can update phone settings with manage permission" ON phone_settings
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_phone_permission('phone.settings.manage'))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_phone_permission('phone.settings.manage'));

-- phone_test_logs
DROP POLICY IF EXISTS "Users can view test logs with permission" ON phone_test_logs;

CREATE POLICY "Users can view test logs with permission" ON phone_test_logs
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_phone_permission('phone.settings.view'));

-- twilio_connection
DROP POLICY IF EXISTS "Users can view twilio connection with permission" ON twilio_connection;
DROP POLICY IF EXISTS "Users can update twilio connection with manage permission" ON twilio_connection;
DROP POLICY IF EXISTS "Users can delete twilio connection with manage permission" ON twilio_connection;

CREATE POLICY "Users can view twilio connection with permission" ON twilio_connection
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_phone_permission('phone.settings.view'));

CREATE POLICY "Users can update twilio connection with manage permission" ON twilio_connection
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_phone_permission('phone.settings.manage'))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_phone_permission('phone.settings.manage'));

CREATE POLICY "Users can delete twilio connection with manage permission" ON twilio_connection
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_phone_permission('phone.settings.manage'));

-- twilio_numbers
DROP POLICY IF EXISTS "Users can view twilio numbers with permission" ON twilio_numbers;
DROP POLICY IF EXISTS "Users can update twilio numbers with manage permission" ON twilio_numbers;
DROP POLICY IF EXISTS "Users can delete twilio numbers with manage permission" ON twilio_numbers;

CREATE POLICY "Users can view twilio numbers with permission" ON twilio_numbers
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_phone_permission('phone.settings.view'));

CREATE POLICY "Users can update twilio numbers with manage permission" ON twilio_numbers
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_phone_permission('phone.numbers.manage'))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_phone_permission('phone.numbers.manage'));

CREATE POLICY "Users can delete twilio numbers with manage permission" ON twilio_numbers
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_phone_permission('phone.numbers.manage'));

-- twilio_messaging_services
DROP POLICY IF EXISTS "Users can view messaging services with permission" ON twilio_messaging_services;
DROP POLICY IF EXISTS "Users can update messaging services with manage permission" ON twilio_messaging_services;
DROP POLICY IF EXISTS "Users can delete messaging services with manage permission" ON twilio_messaging_services;

CREATE POLICY "Users can view messaging services with permission" ON twilio_messaging_services
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_phone_permission('phone.settings.view'));

CREATE POLICY "Users can update messaging services with manage permission" ON twilio_messaging_services
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_phone_permission('phone.settings.manage'))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_phone_permission('phone.settings.manage'));

CREATE POLICY "Users can delete messaging services with manage permission" ON twilio_messaging_services
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_phone_permission('phone.settings.manage'));

-- messaging_service_senders
DROP POLICY IF EXISTS "Users can view service senders with permission" ON messaging_service_senders;
DROP POLICY IF EXISTS "Users can delete service senders with manage permission" ON messaging_service_senders;

CREATE POLICY "Users can view service senders with permission" ON messaging_service_senders
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_phone_permission('phone.settings.view'));

CREATE POLICY "Users can delete service senders with manage permission" ON messaging_service_senders
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_phone_permission('phone.settings.manage'));

-- dnc_numbers
DROP POLICY IF EXISTS "Users can view dnc numbers with permission" ON dnc_numbers;
DROP POLICY IF EXISTS "Users can delete dnc numbers with compliance permission" ON dnc_numbers;

CREATE POLICY "Users can view dnc numbers with permission" ON dnc_numbers
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_phone_permission('phone.settings.view'));

CREATE POLICY "Users can delete dnc numbers with compliance permission" ON dnc_numbers
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_phone_permission('phone.compliance.manage'));

-- voice_routing_groups
DROP POLICY IF EXISTS "Users can view routing groups with permission" ON voice_routing_groups;
DROP POLICY IF EXISTS "Users can update routing groups with manage permission" ON voice_routing_groups;
DROP POLICY IF EXISTS "Users can delete routing groups with manage permission" ON voice_routing_groups;

CREATE POLICY "Users can view routing groups with permission" ON voice_routing_groups
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_phone_permission('phone.settings.view'));

CREATE POLICY "Users can update routing groups with manage permission" ON voice_routing_groups
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_phone_permission('phone.routing.manage'))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_phone_permission('phone.routing.manage'));

CREATE POLICY "Users can delete routing groups with manage permission" ON voice_routing_groups
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_phone_permission('phone.routing.manage'));

-- voice_routing_destinations
DROP POLICY IF EXISTS "Users can view routing destinations with permission" ON voice_routing_destinations;
DROP POLICY IF EXISTS "Users can update routing destinations with manage permission" ON voice_routing_destinations;
DROP POLICY IF EXISTS "Users can delete routing destinations with manage permission" ON voice_routing_destinations;

CREATE POLICY "Users can view routing destinations with permission" ON voice_routing_destinations
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_phone_permission('phone.settings.view'));

CREATE POLICY "Users can update routing destinations with manage permission" ON voice_routing_destinations
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_phone_permission('phone.routing.manage'))
  WITH CHECK (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_phone_permission('phone.routing.manage'));

CREATE POLICY "Users can delete routing destinations with manage permission" ON voice_routing_destinations
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT users.organization_id FROM users WHERE users.id = (select auth.uid())
  ) AND user_has_phone_permission('phone.routing.manage'));
