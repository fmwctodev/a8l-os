/*
  # Drop Unused Indexes - Batch 1: Social, Appointments, Forms

  This migration removes indexes that have never been used according to database statistics.
  Removing unused indexes improves write performance and reduces storage overhead.

  1. Tables Affected
    - social_accounts, social_oauth_states, social_posts, social_post_logs
    - appointments, google_calendar_connections
    - forms, form_submissions, surveys, survey_submissions

  2. Impact
    - Improved INSERT/UPDATE performance
    - Reduced storage usage
    - No impact on query performance (indexes were not being used)
*/

-- Social module indexes
DROP INDEX IF EXISTS idx_social_accounts_provider;
DROP INDEX IF EXISTS idx_social_accounts_status;
DROP INDEX IF EXISTS idx_social_accounts_token_expiry;
DROP INDEX IF EXISTS idx_social_accounts_connected_by;
DROP INDEX IF EXISTS idx_social_oauth_states_state_token;
DROP INDEX IF EXISTS idx_social_oauth_states_expires_at;
DROP INDEX IF EXISTS idx_social_oauth_states_organization_id;
DROP INDEX IF EXISTS idx_social_oauth_states_user_id;
DROP INDEX IF EXISTS idx_social_posts_scheduled_at;
DROP INDEX IF EXISTS idx_social_posts_created_by;
DROP INDEX IF EXISTS idx_social_posts_approved_by;
DROP INDEX IF EXISTS idx_social_posts_approval_token;
DROP INDEX IF EXISTS idx_social_posts_ai_generation;
DROP INDEX IF EXISTS idx_social_post_logs_post_id;
DROP INDEX IF EXISTS idx_social_post_logs_account_id;
DROP INDEX IF EXISTS idx_social_post_logs_created_at;
DROP INDEX IF EXISTS idx_social_post_content_post_id;
DROP INDEX IF EXISTS idx_social_post_content_platform;
DROP INDEX IF EXISTS idx_social_post_content_account;
DROP INDEX IF EXISTS idx_social_post_media_post_id;
DROP INDEX IF EXISTS idx_social_post_media_platform;
DROP INDEX IF EXISTS idx_social_post_media_account;
DROP INDEX IF EXISTS idx_social_post_ai_metadata_org_created;
DROP INDEX IF EXISTS idx_social_post_ai_metadata_post_id;
DROP INDEX IF EXISTS idx_social_post_ai_metadata_user_id;
DROP INDEX IF EXISTS idx_social_post_ai_metadata_action_type;
DROP INDEX IF EXISTS idx_social_post_ai_metadata_applied;
DROP INDEX IF EXISTS idx_social_post_ai_metadata_platform;
DROP INDEX IF EXISTS idx_social_post_ai_metadata_brand_kit;
DROP INDEX IF EXISTS idx_social_post_ai_metadata_brand_voice;
DROP INDEX IF EXISTS idx_social_post_metrics_post_fetched;
DROP INDEX IF EXISTS idx_social_post_metrics_org_platform_fetched;
DROP INDEX IF EXISTS idx_social_post_metrics_org_created;
DROP INDEX IF EXISTS idx_social_post_metrics_engagement;
DROP INDEX IF EXISTS idx_social_account_groups_created_by;
DROP INDEX IF EXISTS idx_ai_learning_org_platform;
DROP INDEX IF EXISTS idx_ai_learning_high_performers;
DROP INDEX IF EXISTS idx_ai_learning_timing;
DROP INDEX IF EXISTS idx_ai_learning_media_type;
DROP INDEX IF EXISTS idx_ai_learning_analyzed;

-- Appointments and calendar indexes
DROP INDEX IF EXISTS idx_appointments_user_start;
DROP INDEX IF EXISTS idx_appointments_reschedule;
DROP INDEX IF EXISTS idx_appointments_cancel;
DROP INDEX IF EXISTS idx_appointments_appointment_type_id;
DROP INDEX IF EXISTS idx_appointments_contact_id;
DROP INDEX IF EXISTS idx_google_connections_user;
DROP INDEX IF EXISTS idx_appointment_sync_org_id;
DROP INDEX IF EXISTS idx_appointment_types_org_id;
DROP INDEX IF EXISTS idx_availability_rules_org_id;
DROP INDEX IF EXISTS idx_availability_rules_user_id;
DROP INDEX IF EXISTS idx_blocked_slots_created_by;
DROP INDEX IF EXISTS idx_blocked_slots_user_id;
DROP INDEX IF EXISTS idx_blocked_slots_calendar_id;
DROP INDEX IF EXISTS idx_blocked_slots_date_range;
DROP INDEX IF EXISTS idx_calendar_members_user_id;
DROP INDEX IF EXISTS idx_calendars_department_id;
DROP INDEX IF EXISTS idx_calendars_owner_user_id;
DROP INDEX IF EXISTS idx_calendars_active;
DROP INDEX IF EXISTS idx_availability_overrides_calendar_date;
DROP INDEX IF EXISTS idx_availability_overrides_org;
DROP INDEX IF EXISTS idx_availability_overrides_date_range;

-- Forms and surveys indexes
DROP INDEX IF EXISTS idx_forms_public_slug;
DROP INDEX IF EXISTS idx_forms_status;
DROP INDEX IF EXISTS idx_forms_created_by;
DROP INDEX IF EXISTS idx_form_submissions_form_id;
DROP INDEX IF EXISTS idx_form_submissions_contact_id;
DROP INDEX IF EXISTS idx_form_submissions_submitted_at;
DROP INDEX IF EXISTS idx_form_submissions_idempotency;
DROP INDEX IF EXISTS idx_form_submissions_processed_status;
DROP INDEX IF EXISTS idx_form_files_org_id;
DROP INDEX IF EXISTS idx_form_files_form_id;
DROP INDEX IF EXISTS idx_form_files_submission_id;
DROP INDEX IF EXISTS idx_form_files_storage_path;
DROP INDEX IF EXISTS idx_surveys_public_slug;
DROP INDEX IF EXISTS idx_surveys_status;
DROP INDEX IF EXISTS idx_surveys_created_by;
DROP INDEX IF EXISTS idx_survey_submissions_survey_id;
DROP INDEX IF EXISTS idx_survey_submissions_contact_id;
DROP INDEX IF EXISTS idx_survey_submissions_submitted_at;
DROP INDEX IF EXISTS idx_survey_submissions_idempotency;
DROP INDEX IF EXISTS idx_survey_submissions_score_band;
DROP INDEX IF EXISTS idx_survey_continuations_org_id;
DROP INDEX IF EXISTS idx_survey_continuations_survey_id;
DROP INDEX IF EXISTS idx_survey_continuations_token;
DROP INDEX IF EXISTS idx_survey_continuations_expires_at;
DROP INDEX IF EXISTS idx_survey_continuations_email;
