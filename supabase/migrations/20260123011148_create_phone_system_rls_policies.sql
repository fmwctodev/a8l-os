/*
  # Phone System RLS Policies

  1. Security Functions
    - `user_has_phone_permission` - Helper to check phone-related permissions

  2. Policies
    - All tables require org membership via users table
    - Read access requires `phone.settings.view` permission
    - Write access requires specific permissions per table type
    - Webhook health can be updated by service role for webhook processing
*/

-- Helper function to check phone permissions
CREATE OR REPLACE FUNCTION user_has_phone_permission(required_permission text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM users u
    JOIN role_permissions rp ON rp.role_id = u.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE u.id = auth.uid()
    AND p.key = required_permission
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Twilio Connection policies
CREATE POLICY "Users can view twilio connection with permission"
  ON twilio_connection FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.settings.view')
  );

CREATE POLICY "Users can insert twilio connection with manage permission"
  ON twilio_connection FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.settings.manage')
  );

CREATE POLICY "Users can update twilio connection with manage permission"
  ON twilio_connection FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.settings.manage')
  )
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.settings.manage')
  );

CREATE POLICY "Users can delete twilio connection with manage permission"
  ON twilio_connection FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.settings.manage')
  );

-- Twilio Numbers policies
CREATE POLICY "Users can view twilio numbers with permission"
  ON twilio_numbers FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.settings.view')
  );

CREATE POLICY "Users can insert twilio numbers with manage permission"
  ON twilio_numbers FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.numbers.manage')
  );

CREATE POLICY "Users can update twilio numbers with manage permission"
  ON twilio_numbers FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.numbers.manage')
  )
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.numbers.manage')
  );

CREATE POLICY "Users can delete twilio numbers with manage permission"
  ON twilio_numbers FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.numbers.manage')
  );

-- Twilio Messaging Services policies
CREATE POLICY "Users can view messaging services with permission"
  ON twilio_messaging_services FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.settings.view')
  );

CREATE POLICY "Users can insert messaging services with manage permission"
  ON twilio_messaging_services FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.settings.manage')
  );

CREATE POLICY "Users can update messaging services with manage permission"
  ON twilio_messaging_services FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.settings.manage')
  )
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.settings.manage')
  );

CREATE POLICY "Users can delete messaging services with manage permission"
  ON twilio_messaging_services FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.settings.manage')
  );

-- Messaging Service Senders policies
CREATE POLICY "Users can view service senders with permission"
  ON messaging_service_senders FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.settings.view')
  );

CREATE POLICY "Users can insert service senders with manage permission"
  ON messaging_service_senders FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.settings.manage')
  );

CREATE POLICY "Users can delete service senders with manage permission"
  ON messaging_service_senders FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.settings.manage')
  );

-- Voice Routing Groups policies
CREATE POLICY "Users can view routing groups with permission"
  ON voice_routing_groups FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.settings.view')
  );

CREATE POLICY "Users can insert routing groups with manage permission"
  ON voice_routing_groups FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.routing.manage')
  );

CREATE POLICY "Users can update routing groups with manage permission"
  ON voice_routing_groups FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.routing.manage')
  )
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.routing.manage')
  );

CREATE POLICY "Users can delete routing groups with manage permission"
  ON voice_routing_groups FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.routing.manage')
  );

-- Voice Routing Destinations policies
CREATE POLICY "Users can view routing destinations with permission"
  ON voice_routing_destinations FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.settings.view')
  );

CREATE POLICY "Users can insert routing destinations with manage permission"
  ON voice_routing_destinations FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.routing.manage')
  );

CREATE POLICY "Users can update routing destinations with manage permission"
  ON voice_routing_destinations FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.routing.manage')
  )
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.routing.manage')
  );

CREATE POLICY "Users can delete routing destinations with manage permission"
  ON voice_routing_destinations FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.routing.manage')
  );

-- Phone Settings policies
CREATE POLICY "Users can view phone settings with permission"
  ON phone_settings FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.settings.view')
  );

CREATE POLICY "Users can insert phone settings with manage permission"
  ON phone_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.settings.manage')
  );

CREATE POLICY "Users can update phone settings with manage permission"
  ON phone_settings FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.settings.manage')
  )
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.settings.manage')
  );

-- DNC Numbers policies
CREATE POLICY "Users can view dnc numbers with permission"
  ON dnc_numbers FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.settings.view')
  );

CREATE POLICY "Users can insert dnc numbers with compliance permission"
  ON dnc_numbers FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.compliance.manage')
  );

CREATE POLICY "Users can delete dnc numbers with compliance permission"
  ON dnc_numbers FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.compliance.manage')
  );

-- Phone Test Logs policies
CREATE POLICY "Users can view test logs with permission"
  ON phone_test_logs FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.settings.view')
  );

CREATE POLICY "Users can insert test logs with test permission"
  ON phone_test_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.test.run')
  );

-- Webhook Health policies
CREATE POLICY "Users can view webhook health with permission"
  ON webhook_health FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.settings.view')
  );

CREATE POLICY "Users can insert webhook health with manage permission"
  ON webhook_health FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.settings.manage')
  );

CREATE POLICY "Users can update webhook health with manage permission"
  ON webhook_health FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.settings.manage')
  )
  WITH CHECK (
    org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    AND user_has_phone_permission('phone.settings.manage')
  );
