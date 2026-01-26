/*
  # Add Indexes for Unindexed Foreign Keys - Batch 3

  ## Overview
  Continuing to add indexes for foreign keys to improve query performance.

  ## Tables Updated
  - Opportunity tables
  - Phone system tables
  - Pipeline tables
  - Product tables
  - Prompt/Template tables
  - Proposal tables
*/

-- Opportunity tables
CREATE INDEX IF NOT EXISTS idx_opportunities_assigned_user_id ON opportunities(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_contact_id ON opportunities(contact_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_created_by ON opportunities(created_by);
CREATE INDEX IF NOT EXISTS idx_opportunities_department_id ON opportunities(department_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_pipeline_id ON opportunities(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_custom_field_values_org_id ON opportunity_custom_field_values(org_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_notes_created_by ON opportunity_notes(created_by);
CREATE INDEX IF NOT EXISTS idx_opportunity_notes_org_id ON opportunity_notes(org_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_stage_history_changed_by ON opportunity_stage_history(changed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_stage_history_from_stage_id ON opportunity_stage_history(from_stage_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_stage_history_to_stage_id ON opportunity_stage_history(to_stage_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_timeline_events_actor ON opportunity_timeline_events(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_timeline_events_org_id ON opportunity_timeline_events(org_id);

-- Secrets tables
CREATE INDEX IF NOT EXISTS idx_org_secrets_created_by ON org_secrets(created_by);
CREATE INDEX IF NOT EXISTS idx_org_secrets_updated_by ON org_secrets(updated_by);

-- Webhook tables
CREATE INDEX IF NOT EXISTS idx_outgoing_webhooks_created_by ON outgoing_webhooks(created_by);

-- Phone system tables
CREATE INDEX IF NOT EXISTS idx_phone_settings_default_messaging_service_id ON phone_settings(default_messaging_service_id);
CREATE INDEX IF NOT EXISTS idx_phone_settings_default_routing_group_id ON phone_settings(default_routing_group_id);
CREATE INDEX IF NOT EXISTS idx_phone_settings_default_sms_number_id ON phone_settings(default_sms_number_id);
CREATE INDEX IF NOT EXISTS idx_phone_settings_default_voice_number_id ON phone_settings(default_voice_number_id);
CREATE INDEX IF NOT EXISTS idx_phone_test_logs_tested_by ON phone_test_logs(tested_by);

-- Pipeline tables
CREATE INDEX IF NOT EXISTS idx_pipeline_custom_fields_org_id ON pipeline_custom_fields(org_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_org_id ON pipeline_stages(org_id);

-- Product tables
CREATE INDEX IF NOT EXISTS idx_products_created_by ON products(created_by);

-- Prompt/Template tables
CREATE INDEX IF NOT EXISTS idx_prompt_template_versions_created_by ON prompt_template_versions(created_by);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_created_by ON prompt_templates(created_by);

-- Proposal tables
CREATE INDEX IF NOT EXISTS idx_proposal_activities_actor_user_id ON proposal_activities(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_proposal_activities_org_id ON proposal_activities(org_id);
CREATE INDEX IF NOT EXISTS idx_proposal_comments_org_id ON proposal_comments(org_id);
CREATE INDEX IF NOT EXISTS idx_proposal_comments_user_id ON proposal_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_proposal_line_items_org_id ON proposal_line_items(org_id);
CREATE INDEX IF NOT EXISTS idx_proposal_meeting_contexts_org_id ON proposal_meeting_contexts(org_id);
CREATE INDEX IF NOT EXISTS idx_proposal_sections_org_id ON proposal_sections(org_id);
CREATE INDEX IF NOT EXISTS idx_proposal_templates_created_by ON proposal_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_proposals_assigned_user_id ON proposals(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_proposals_template_id ON proposals(template_id);
