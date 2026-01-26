/*
  # Drop Unused Indexes - Batch 2: Contacts, Workflows, Conversations

  This migration removes indexes that have never been used according to database statistics.

  1. Tables Affected
    - contacts, contact_tags, contact_custom_field_values, contact_notes, contact_tasks
    - workflows, workflow_versions, workflow_triggers, workflow_enrollments, workflow_jobs
    - conversations, messages, call_logs, inbox_events, channel_configurations

  2. Impact
    - Improved INSERT/UPDATE performance
    - Reduced storage usage
*/

-- Contacts module indexes
DROP INDEX IF EXISTS idx_contacts_org;
DROP INDEX IF EXISTS idx_contacts_department;
DROP INDEX IF EXISTS idx_contacts_owner;
DROP INDEX IF EXISTS idx_contacts_status;
DROP INDEX IF EXISTS idx_contacts_email;
DROP INDEX IF EXISTS idx_contacts_phone;
DROP INDEX IF EXISTS idx_contacts_merged_into;
DROP INDEX IF EXISTS idx_contacts_company;
DROP INDEX IF EXISTS idx_contacts_created_by_user_id;
DROP INDEX IF EXISTS idx_contacts_merged_by_user_id;
DROP INDEX IF EXISTS idx_contacts_dnc;
DROP INDEX IF EXISTS idx_contacts_last_activity;
DROP INDEX IF EXISTS idx_contacts_lead_score;
DROP INDEX IF EXISTS idx_contact_tags_tag;
DROP INDEX IF EXISTS idx_custom_field_values_field;
DROP INDEX IF EXISTS idx_contact_notes_user;
DROP INDEX IF EXISTS idx_contact_tasks_assigned;
DROP INDEX IF EXISTS idx_contact_tasks_due;
DROP INDEX IF EXISTS idx_contact_tasks_opportunity;
DROP INDEX IF EXISTS idx_contact_tasks_opp_status;
DROP INDEX IF EXISTS idx_contact_tasks_created_by_user_id;
DROP INDEX IF EXISTS idx_contact_timeline_user_id;
DROP INDEX IF EXISTS idx_contact_meeting_notes_created_by;
DROP INDEX IF EXISTS idx_contact_meeting_notes_org_id;
DROP INDEX IF EXISTS idx_contact_meeting_notes_contact;
DROP INDEX IF EXISTS idx_contact_meeting_notes_meeting;
DROP INDEX IF EXISTS idx_contact_meeting_notes_created;

-- Workflows module indexes
DROP INDEX IF EXISTS idx_workflow_versions_workflow;
DROP INDEX IF EXISTS idx_workflow_versions_created_by_user_id;
DROP INDEX IF EXISTS idx_workflow_versions_org_id;
DROP INDEX IF EXISTS idx_workflow_triggers_type_active;
DROP INDEX IF EXISTS idx_workflow_triggers_created_by;
DROP INDEX IF EXISTS idx_workflow_triggers_org_id;
DROP INDEX IF EXISTS idx_workflow_triggers_priority;
DROP INDEX IF EXISTS idx_workflow_enrollments_contact;
DROP INDEX IF EXISTS idx_workflow_enrollments_org_id;
DROP INDEX IF EXISTS idx_workflow_enrollments_version_id;
DROP INDEX IF EXISTS idx_workflow_enrollments_trigger;
DROP INDEX IF EXISTS idx_workflow_enrollments_goal;
DROP INDEX IF EXISTS idx_workflow_jobs_queue;
DROP INDEX IF EXISTS idx_workflow_jobs_enrollment;
DROP INDEX IF EXISTS idx_workflow_jobs_org_id;
DROP INDEX IF EXISTS idx_workflow_execution_logs_enrollment;
DROP INDEX IF EXISTS idx_workflow_execution_logs_org_id;
DROP INDEX IF EXISTS idx_workflows_created_by_user_id;
DROP INDEX IF EXISTS idx_workflow_condition_waits_enrollment;
DROP INDEX IF EXISTS idx_workflow_condition_waits_status;
DROP INDEX IF EXISTS idx_workflow_condition_waits_timeout;
DROP INDEX IF EXISTS idx_workflow_condition_waits_check;
DROP INDEX IF EXISTS idx_workflow_condition_waits_org;
DROP INDEX IF EXISTS idx_workflow_goals_org;
DROP INDEX IF EXISTS idx_workflow_goals_workflow;
DROP INDEX IF EXISTS idx_workflow_action_retries_workflow;
DROP INDEX IF EXISTS idx_workflow_action_retries_org;
DROP INDEX IF EXISTS idx_workflow_loops_enrollment;
DROP INDEX IF EXISTS idx_workflow_loops_org;
DROP INDEX IF EXISTS idx_workflow_logs_org_executed;
DROP INDEX IF EXISTS idx_workflow_logs_workflow;
DROP INDEX IF EXISTS idx_workflow_logs_enrollment;
DROP INDEX IF EXISTS idx_workflow_logs_status;
DROP INDEX IF EXISTS idx_workflow_logs_step_type;
DROP INDEX IF EXISTS idx_scheduled_triggers_poll;
DROP INDEX IF EXISTS idx_scheduled_triggers_workflow;
DROP INDEX IF EXISTS idx_scheduled_triggers_org;
DROP INDEX IF EXISTS idx_scheduled_trigger_runs_trigger;
DROP INDEX IF EXISTS idx_scheduled_trigger_runs_org;
DROP INDEX IF EXISTS idx_scheduled_trigger_jobs_queue;
DROP INDEX IF EXISTS idx_scheduled_trigger_jobs_trigger;
DROP INDEX IF EXISTS idx_scheduled_trigger_jobs_contact;
DROP INDEX IF EXISTS idx_scheduled_trigger_jobs_org;
DROP INDEX IF EXISTS idx_workflow_trigger_audit_log_trigger;
DROP INDEX IF EXISTS idx_workflow_trigger_audit_log_workflow;
DROP INDEX IF EXISTS idx_workflow_trigger_audit_log_org;
DROP INDEX IF EXISTS idx_workflow_trigger_audit_log_user;
DROP INDEX IF EXISTS idx_webhook_triggers_workflow;
DROP INDEX IF EXISTS idx_webhook_triggers_org;
DROP INDEX IF EXISTS idx_webhook_triggers_active;
DROP INDEX IF EXISTS idx_webhook_requests_trigger;
DROP INDEX IF EXISTS idx_webhook_requests_org;

-- Conversations and messages indexes
DROP INDEX IF EXISTS idx_conversations_org;
DROP INDEX IF EXISTS idx_conversations_department_id;
DROP INDEX IF EXISTS idx_messages_conversation;
DROP INDEX IF EXISTS idx_messages_contact;
DROP INDEX IF EXISTS idx_messages_external;
DROP INDEX IF EXISTS idx_messages_hidden;
DROP INDEX IF EXISTS idx_messages_hidden_by_user_id;
DROP INDEX IF EXISTS idx_call_logs_conversation;
DROP INDEX IF EXISTS idx_call_logs_contact;
DROP INDEX IF EXISTS idx_call_logs_sid;
DROP INDEX IF EXISTS idx_call_logs_organization_id;
DROP INDEX IF EXISTS idx_inbox_events_conversation;
DROP INDEX IF EXISTS idx_inbox_events_actor_user_id;
DROP INDEX IF EXISTS idx_channel_configs_org;
DROP INDEX IF EXISTS idx_gmail_tokens_user;
DROP INDEX IF EXISTS idx_webchat_sessions_org;
DROP INDEX IF EXISTS idx_webchat_sessions_conversation;
DROP INDEX IF EXISTS idx_message_attachments_message;
DROP INDEX IF EXISTS idx_message_attachments_org;
DROP INDEX IF EXISTS idx_message_attachments_drive;
DROP INDEX IF EXISTS idx_message_attachments_uploaded_by;
DROP INDEX IF EXISTS idx_conversation_notes_conversation;
DROP INDEX IF EXISTS idx_conversation_notes_org;
DROP INDEX IF EXISTS idx_conversation_notes_pinned;
DROP INDEX IF EXISTS idx_conversation_notes_created_by;
DROP INDEX IF EXISTS idx_snippets_org;
DROP INDEX IF EXISTS idx_snippets_created_by;
DROP INDEX IF EXISTS idx_snippets_department;
DROP INDEX IF EXISTS idx_conversation_rules_org;
DROP INDEX IF EXISTS idx_conversation_rules_enabled;
DROP INDEX IF EXISTS idx_conversation_rules_trigger;
DROP INDEX IF EXISTS idx_rule_logs_rule;
DROP INDEX IF EXISTS idx_rule_logs_conversation;
DROP INDEX IF EXISTS idx_rule_logs_time;
DROP INDEX IF EXISTS idx_rule_logs_success;

-- Event outbox indexes
DROP INDEX IF EXISTS idx_event_outbox_unprocessed;
DROP INDEX IF EXISTS idx_event_outbox_type_unprocessed;
DROP INDEX IF EXISTS idx_event_outbox_org;
DROP INDEX IF EXISTS idx_event_outbox_contact_id;
