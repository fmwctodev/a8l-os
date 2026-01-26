/*
  # Fix RLS auth.uid() Performance - Phone & Twilio Batch
  
  This migration optimizes RLS policies for phone and Twilio-related tables.
  
  ## Tables Fixed
  - phone_settings, phone_test_logs (org_id)
  - twilio_connection, twilio_numbers, twilio_messaging_services (org_id)
  - messaging_service_senders, dnc_numbers (org_id)
  - voice_routing_groups, voice_routing_destinations (org_id)
  
  ## Changes
  - All auth.uid() calls wrapped in (select auth.uid())
  - Using get_auth_user_org_id() for org checks
*/

-- ============================================
-- phone_settings (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view phone settings with permission" ON phone_settings;
DROP POLICY IF EXISTS "Users can insert phone settings with manage permission" ON phone_settings;
DROP POLICY IF EXISTS "Users can update phone settings with manage permission" ON phone_settings;

CREATE POLICY "Users can view phone settings with permission"
  ON phone_settings FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can insert phone settings with manage permission"
  ON phone_settings FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update phone settings with manage permission"
  ON phone_settings FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

-- ============================================
-- phone_test_logs (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view test logs with permission" ON phone_test_logs;
DROP POLICY IF EXISTS "Users can insert test logs with test permission" ON phone_test_logs;

CREATE POLICY "Users can view test logs with permission"
  ON phone_test_logs FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can insert test logs with test permission"
  ON phone_test_logs FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

-- ============================================
-- twilio_connection (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view twilio connection with permission" ON twilio_connection;
DROP POLICY IF EXISTS "Users can insert twilio connection with manage permission" ON twilio_connection;
DROP POLICY IF EXISTS "Users can update twilio connection with manage permission" ON twilio_connection;
DROP POLICY IF EXISTS "Users can delete twilio connection with manage permission" ON twilio_connection;

CREATE POLICY "Users can view twilio connection with permission"
  ON twilio_connection FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can insert twilio connection with manage permission"
  ON twilio_connection FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update twilio connection with manage permission"
  ON twilio_connection FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can delete twilio connection with manage permission"
  ON twilio_connection FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- twilio_numbers (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view twilio numbers with permission" ON twilio_numbers;
DROP POLICY IF EXISTS "Users can insert twilio numbers with manage permission" ON twilio_numbers;
DROP POLICY IF EXISTS "Users can update twilio numbers with manage permission" ON twilio_numbers;
DROP POLICY IF EXISTS "Users can delete twilio numbers with manage permission" ON twilio_numbers;

CREATE POLICY "Users can view twilio numbers with permission"
  ON twilio_numbers FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can insert twilio numbers with manage permission"
  ON twilio_numbers FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update twilio numbers with manage permission"
  ON twilio_numbers FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can delete twilio numbers with manage permission"
  ON twilio_numbers FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- twilio_messaging_services (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view messaging services with permission" ON twilio_messaging_services;
DROP POLICY IF EXISTS "Users can insert messaging services with manage permission" ON twilio_messaging_services;
DROP POLICY IF EXISTS "Users can update messaging services with manage permission" ON twilio_messaging_services;
DROP POLICY IF EXISTS "Users can delete messaging services with manage permission" ON twilio_messaging_services;

CREATE POLICY "Users can view messaging services with permission"
  ON twilio_messaging_services FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can insert messaging services with manage permission"
  ON twilio_messaging_services FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update messaging services with manage permission"
  ON twilio_messaging_services FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can delete messaging services with manage permission"
  ON twilio_messaging_services FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- messaging_service_senders (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view service senders with permission" ON messaging_service_senders;
DROP POLICY IF EXISTS "Users can insert service senders with manage permission" ON messaging_service_senders;
DROP POLICY IF EXISTS "Users can delete service senders with manage permission" ON messaging_service_senders;

CREATE POLICY "Users can view service senders with permission"
  ON messaging_service_senders FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can insert service senders with manage permission"
  ON messaging_service_senders FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can delete service senders with manage permission"
  ON messaging_service_senders FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- dnc_numbers (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view dnc numbers with permission" ON dnc_numbers;
DROP POLICY IF EXISTS "Users can insert dnc numbers with compliance permission" ON dnc_numbers;
DROP POLICY IF EXISTS "Users can delete dnc numbers with compliance permission" ON dnc_numbers;

CREATE POLICY "Users can view dnc numbers with permission"
  ON dnc_numbers FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can insert dnc numbers with compliance permission"
  ON dnc_numbers FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can delete dnc numbers with compliance permission"
  ON dnc_numbers FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- voice_routing_groups (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view routing groups with permission" ON voice_routing_groups;
DROP POLICY IF EXISTS "Users can insert routing groups with manage permission" ON voice_routing_groups;
DROP POLICY IF EXISTS "Users can update routing groups with manage permission" ON voice_routing_groups;
DROP POLICY IF EXISTS "Users can delete routing groups with manage permission" ON voice_routing_groups;

CREATE POLICY "Users can view routing groups with permission"
  ON voice_routing_groups FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can insert routing groups with manage permission"
  ON voice_routing_groups FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update routing groups with manage permission"
  ON voice_routing_groups FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can delete routing groups with manage permission"
  ON voice_routing_groups FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());

-- ============================================
-- voice_routing_destinations (org_id)
-- ============================================
DROP POLICY IF EXISTS "Users can view routing destinations with permission" ON voice_routing_destinations;
DROP POLICY IF EXISTS "Users can insert routing destinations with manage permission" ON voice_routing_destinations;
DROP POLICY IF EXISTS "Users can update routing destinations with manage permission" ON voice_routing_destinations;
DROP POLICY IF EXISTS "Users can delete routing destinations with manage permission" ON voice_routing_destinations;

CREATE POLICY "Users can view routing destinations with permission"
  ON voice_routing_destinations FOR SELECT TO authenticated
  USING (org_id = get_auth_user_org_id());

CREATE POLICY "Users can insert routing destinations with manage permission"
  ON voice_routing_destinations FOR INSERT TO authenticated
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can update routing destinations with manage permission"
  ON voice_routing_destinations FOR UPDATE TO authenticated
  USING (org_id = get_auth_user_org_id())
  WITH CHECK (org_id = get_auth_user_org_id());

CREATE POLICY "Users can delete routing destinations with manage permission"
  ON voice_routing_destinations FOR DELETE TO authenticated
  USING (org_id = get_auth_user_org_id());
