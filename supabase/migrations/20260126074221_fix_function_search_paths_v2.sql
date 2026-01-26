/*
  # Fix Function Search Paths

  This migration sets explicit search_path for all SECURITY DEFINER functions
  to prevent search path injection vulnerabilities.

  1. Security Impact
    - Prevents malicious schema manipulation attacks
    - Ensures functions operate in predictable namespace context
*/

-- Permission helper functions
ALTER FUNCTION user_has_reputation_permission(text) SET search_path = public;
ALTER FUNCTION user_has_brandboard_permission(text) SET search_path = public;
ALTER FUNCTION user_has_payments_permission(text) SET search_path = public;
ALTER FUNCTION user_has_phone_permission(text) SET search_path = public;
ALTER FUNCTION user_has_scoring_permission(text) SET search_path = public;
ALTER FUNCTION user_has_permission(uuid, text) SET search_path = public;
ALTER FUNCTION user_is_admin(uuid) SET search_path = public;
ALTER FUNCTION user_belongs_to_org(uuid) SET search_path = public;
ALTER FUNCTION has_permission(text) SET search_path = public;
ALTER FUNCTION has_automation_permission(text) SET search_path = public;
ALTER FUNCTION has_automation_permission(uuid, uuid, text) SET search_path = public;
ALTER FUNCTION has_automation_write_permission(uuid, uuid) SET search_path = public;
ALTER FUNCTION has_media_permission(uuid, uuid, text) SET search_path = public;
ALTER FUNCTION has_ai_settings_view_permission(uuid, uuid) SET search_path = public;
ALTER FUNCTION has_ai_settings_manage_permission(uuid, uuid) SET search_path = public;
ALTER FUNCTION user_has_email_permission(uuid, text) SET search_path = public;
ALTER FUNCTION user_has_calendar_permission(uuid, uuid, text) SET search_path = public;

-- User info functions
ALTER FUNCTION get_user_org_id() SET search_path = public;
ALTER FUNCTION get_user_organization_id() SET search_path = public;
ALTER FUNCTION get_user_department_id() SET search_path = public;
ALTER FUNCTION get_user_department(uuid) SET search_path = public;
ALTER FUNCTION get_user_hierarchy_level() SET search_path = public;
ALTER FUNCTION get_user_role_name() SET search_path = public;
ALTER FUNCTION get_user_role_name(uuid) SET search_path = public;
ALTER FUNCTION is_super_admin() SET search_path = public;
ALTER FUNCTION is_admin_or_higher() SET search_path = public;
ALTER FUNCTION is_pipeline_admin(uuid) SET search_path = public;
ALTER FUNCTION is_proposal_admin(uuid) SET search_path = public;

-- Access control functions
ALTER FUNCTION can_access_contact(uuid) SET search_path = public;
ALTER FUNCTION can_access_conversation(uuid) SET search_path = public;
ALTER FUNCTION can_access_snippet(uuid) SET search_path = public;
ALTER FUNCTION can_access_meeting_transcription(uuid, uuid) SET search_path = public;
ALTER FUNCTION can_access_pipeline(uuid, uuid, uuid) SET search_path = public;
ALTER FUNCTION can_access_opportunity(uuid, uuid, uuid) SET search_path = public;
ALTER FUNCTION can_access_proposal(uuid, proposals) SET search_path = public;
ALTER FUNCTION can_access_proposal_by_id(uuid, uuid) SET search_path = public;
ALTER FUNCTION user_can_access_report(reports) SET search_path = public;

-- Trigger functions
ALTER FUNCTION update_contact_last_activity() SET search_path = public;
ALTER FUNCTION fn_trigger_scoring_contact_update() SET search_path = public;
ALTER FUNCTION trigger_seed_integrations_for_new_org() SET search_path = public;
ALTER FUNCTION trigger_webhook_appointment_booked() SET search_path = public;
ALTER FUNCTION trigger_webhook_appointment_cancelled() SET search_path = public;
ALTER FUNCTION trigger_webhook_contact_created() SET search_path = public;
ALTER FUNCTION trigger_webhook_contact_updated() SET search_path = public;
ALTER FUNCTION trigger_webhook_opportunity_created() SET search_path = public;
ALTER FUNCTION trigger_webhook_opportunity_stage_changed() SET search_path = public;
ALTER FUNCTION trigger_webhook_opportunity_status_changed() SET search_path = public;
ALTER FUNCTION trigger_webhook_message_received() SET search_path = public;
ALTER FUNCTION trigger_webhook_payment_completed() SET search_path = public;
ALTER FUNCTION trigger_webhook_form_submitted() SET search_path = public;

-- Utility functions
ALTER FUNCTION seed_integrations_for_org(uuid) SET search_path = public;
ALTER FUNCTION get_channel_unread_count(uuid, uuid) SET search_path = public;
ALTER FUNCTION search_knowledge_embeddings(uuid, vector, uuid[], integer) SET search_path = public;
ALTER FUNCTION encrypt_secret_value(text) SET search_path = public;
ALTER FUNCTION decrypt_secret_value(bytea) SET search_path = public;
ALTER FUNCTION cleanup_expired_oauth_states() SET search_path = public;
ALTER FUNCTION queue_webhook_delivery(uuid, text, uuid, jsonb) SET search_path = public;
ALTER FUNCTION get_webhook_health(uuid) SET search_path = public;
