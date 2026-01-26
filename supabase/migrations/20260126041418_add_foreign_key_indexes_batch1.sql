/*
  # Add Indexes for Unindexed Foreign Keys - Batch 1

  ## Overview
  Foreign keys without covering indexes can cause poor query performance,
  especially during JOIN operations and cascading deletes/updates.

  ## Tables Updated
  This migration adds indexes for foreign keys on:
  - AI/Agent related tables
  - Appointment/Calendar tables
  - Brand/Marketing tables
  - Contact related tables
  - Conversation tables
*/

-- AI Agent related tables
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_sources_created_by ON agent_knowledge_sources(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_agent_prompt_links_template_id ON agent_prompt_links(template_id);
CREATE INDEX IF NOT EXISTS idx_agent_templates_created_by ON agent_templates(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_memory_org_id ON ai_agent_memory(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_approved_by ON ai_agent_runs(approved_by_user_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_conversation_id ON ai_agent_runs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_settings_defaults_model_id ON ai_agent_settings_defaults(default_model_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tool_calls_org_id ON ai_agent_tool_calls(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_created_by ON ai_agents(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_model_id ON ai_agents(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_approved_by ON ai_drafts(approved_by);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_contact_id ON ai_drafts(contact_id);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_context_message_id ON ai_drafts(context_message_id);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_triggered_by_rule ON ai_drafts(triggered_by_rule_id);

-- Appointment/Calendar tables
CREATE INDEX IF NOT EXISTS idx_appointment_sync_org_id ON appointment_sync(org_id);
CREATE INDEX IF NOT EXISTS idx_appointment_types_org_id ON appointment_types(org_id);
CREATE INDEX IF NOT EXISTS idx_appointments_appointment_type_id ON appointments(appointment_type_id);
CREATE INDEX IF NOT EXISTS idx_appointments_contact_id ON appointments(contact_id);
CREATE INDEX IF NOT EXISTS idx_appointments_org_id ON appointments(org_id);
CREATE INDEX IF NOT EXISTS idx_availability_rules_org_id ON availability_rules(org_id);
CREATE INDEX IF NOT EXISTS idx_availability_rules_user_id ON availability_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_slots_created_by ON blocked_slots(created_by);
CREATE INDEX IF NOT EXISTS idx_blocked_slots_user_id ON blocked_slots(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_members_user_id ON calendar_members(user_id);
CREATE INDEX IF NOT EXISTS idx_calendars_department_id ON calendars(department_id);
CREATE INDEX IF NOT EXISTS idx_calendars_owner_user_id ON calendars(owner_user_id);

-- Brand/Marketing tables
CREATE INDEX IF NOT EXISTS idx_brand_kit_versions_created_by ON brand_kit_versions(created_by);
CREATE INDEX IF NOT EXISTS idx_brand_kit_versions_published_by ON brand_kit_versions(published_by);
CREATE INDEX IF NOT EXISTS idx_brand_kits_created_by ON brand_kits(created_by);
CREATE INDEX IF NOT EXISTS idx_brand_voice_versions_created_by ON brand_voice_versions(created_by);
CREATE INDEX IF NOT EXISTS idx_brand_voices_created_by ON brand_voices(created_by);

-- Contact related tables
CREATE INDEX IF NOT EXISTS idx_contact_meeting_notes_created_by ON contact_meeting_notes(created_by);
CREATE INDEX IF NOT EXISTS idx_contact_meeting_notes_org_id ON contact_meeting_notes(org_id);
CREATE INDEX IF NOT EXISTS idx_contact_tasks_created_by_user_id ON contact_tasks(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_contact_timeline_user_id ON contact_timeline(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_created_by_user_id ON contacts(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_merged_by_user_id ON contacts(merged_by_user_id);

-- Conversation related tables
CREATE INDEX IF NOT EXISTS idx_conversation_notes_created_by ON conversation_notes(created_by);
CREATE INDEX IF NOT EXISTS idx_conversations_department_id ON conversations(department_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_organization_id ON call_logs(organization_id);
