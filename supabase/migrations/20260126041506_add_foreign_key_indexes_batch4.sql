/*
  # Add Indexes for Unindexed Foreign Keys - Batch 4

  ## Overview
  Final batch of foreign key indexes to improve query performance.

  ## Tables Updated
  - QBO/Recurring profile tables
  - Report tables
  - Review/Reputation tables
  - Scoring tables
  - Social tables
  - Survey tables
  - Team messaging tables
  - Twilio/Phone tables
  - User tables
  - Voice routing tables
  - Workflow tables
*/

-- QBO/Recurring profile tables
CREATE INDEX IF NOT EXISTS idx_qbo_connections_connected_by ON qbo_connections(connected_by);
CREATE INDEX IF NOT EXISTS idx_recurring_profile_items_org_id ON recurring_profile_items(org_id);
CREATE INDEX IF NOT EXISTS idx_recurring_profile_items_product_id ON recurring_profile_items(product_id);
CREATE INDEX IF NOT EXISTS idx_recurring_profiles_contact_id ON recurring_profiles(contact_id);
CREATE INDEX IF NOT EXISTS idx_recurring_profiles_created_by ON recurring_profiles(created_by);

-- Report tables
CREATE INDEX IF NOT EXISTS idx_report_email_queue_organization_id ON report_email_queue(organization_id);
CREATE INDEX IF NOT EXISTS idx_report_email_queue_report_run_id ON report_email_queue(report_run_id);
CREATE INDEX IF NOT EXISTS idx_report_exports_organization_id ON report_exports(organization_id);
CREATE INDEX IF NOT EXISTS idx_report_runs_triggered_by_user_id ON report_runs(triggered_by_user_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_created_by ON report_schedules(created_by);
CREATE INDEX IF NOT EXISTS idx_report_schedules_organization_id ON report_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_reports_department_id ON reports(department_id);

-- Review/Reputation tables
CREATE INDEX IF NOT EXISTS idx_review_requests_created_by ON review_requests(created_by);
CREATE INDEX IF NOT EXISTS idx_reviews_responded_by ON reviews(responded_by);

-- Scoring tables
CREATE INDEX IF NOT EXISTS idx_score_events_created_by ON score_events(created_by);
CREATE INDEX IF NOT EXISTS idx_score_events_rule_id ON score_events(rule_id);

-- Social tables
CREATE INDEX IF NOT EXISTS idx_social_accounts_connected_by ON social_accounts(connected_by);
CREATE INDEX IF NOT EXISTS idx_social_oauth_states_organization_id ON social_oauth_states(organization_id);
CREATE INDEX IF NOT EXISTS idx_social_oauth_states_user_id ON social_oauth_states(user_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_approved_by ON social_posts(approved_by);

-- Survey tables
CREATE INDEX IF NOT EXISTS idx_survey_continuations_completed_submission_id ON survey_continuations(completed_submission_id);

-- Team messaging tables
CREATE INDEX IF NOT EXISTS idx_team_channels_department_id ON team_channels(department_id);
CREATE INDEX IF NOT EXISTS idx_team_message_reactions_organization_id ON team_message_reactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_team_message_reactions_user_id ON team_message_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_team_messages_organization_id ON team_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_team_messages_reply_to_id ON team_messages(reply_to_id);

-- Twilio/Phone tables
CREATE INDEX IF NOT EXISTS idx_twilio_connection_connected_by ON twilio_connection(connected_by);
CREATE INDEX IF NOT EXISTS idx_twilio_numbers_department_id ON twilio_numbers(department_id);

-- User tables
CREATE INDEX IF NOT EXISTS idx_user_preferences_default_calendar_id ON user_preferences(default_calendar_id);
CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id);

-- Voice routing tables
CREATE INDEX IF NOT EXISTS idx_voice_routing_destinations_org_id ON voice_routing_destinations(org_id);

-- Workflow tables
CREATE INDEX IF NOT EXISTS idx_workflow_enrollments_org_id ON workflow_enrollments(org_id);
CREATE INDEX IF NOT EXISTS idx_workflow_enrollments_version_id ON workflow_enrollments(version_id);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_org_id ON workflow_execution_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_workflow_jobs_org_id ON workflow_jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_workflow_triggers_org_id ON workflow_triggers(org_id);
CREATE INDEX IF NOT EXISTS idx_workflow_versions_created_by_user_id ON workflow_versions(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_versions_org_id ON workflow_versions(org_id);
CREATE INDEX IF NOT EXISTS idx_workflows_created_by_user_id ON workflows(created_by_user_id);
