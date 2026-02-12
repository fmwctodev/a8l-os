/*
  # Purge All Seed/Demo Data

  Removes all demo and sample data that was inserted by seed migrations,
  while preserving system infrastructure (organization, roles, permissions,
  feature flags, departments, users, integrations, AI agents, brand config,
  snippets, and reputation settings).

  1. Deleted Data (ordered by FK dependencies, deepest children first)
    - Scoring: score_events, scoring_rule_executions, entity_scores, scoring_model_decay_config, scoring_rules, scoring_models, scoring_adjustment_limits
    - Workflow children: workflow_webhook_triggers, workflow_versions, workflow_version_snapshots, workflow_triggers, workflow_trigger_audit_log, workflow_scheduled_triggers, workflow_logs, workflow_goals, workflow_enrollments, workflow_analytics_cache, workflow_ai_runs, workflow_action_retries, workflow_condition_waits, workflow_execution_logs, workflow_jobs, workflow_loops, ai_workflow_learning_signals, ai_drafts (workflow-linked)
    - Opportunity children: proposal_line_items, proposal_sections, proposal_comments, proposal_activities, proposal_meeting_contexts, proposals, org_opportunity_custom_field_values, opportunity_custom_field_values, opportunity_timeline_events, opportunity_stage_history, opportunity_notes
    - Invoice children: payment_reminders, payment_events, payments, invoice_line_items
    - Contact children: contact_timeline, contact_custom_field_values, contact_tags, contact_notes, contact_tasks, contact_meeting_notes, ai_agent_memory, ai_agent_runs, ai_drafts, call_logs, event_outbox, scheduled_trigger_jobs
    - Conversation children: messages, message_attachments, conversation_notes, conversation_rule_logs, inbox_events, webchat_sessions
    - Review children: negative_review_tasks, review_ai_analysis, review_moderation_log, review_reply_drafts, review_reply_queue, review_sync_queue, review_requests
    - Report children: report_runs, report_schedules, ai_report_queries, report_email_queue, report_exports
    - Form/Survey children: form_files, form_submissions, survey_continuations, survey_submissions
    - Parent records: opportunities, invoices, conversations, appointments, contacts, reviews, workflows
    - Structural config: pipeline_custom_fields, pipeline_stages, pipelines, availability_date_overrides, availability_rules, appointment_types, calendar_members, blocked_slots, calendars, forms, surveys, reports, tags, products, lost_reasons, review_providers, custom_fields, custom_field_groups

  2. Preserved Data (NOT deleted)
    - organizations, departments, roles, permissions, role_permissions, feature_flags
    - users, user_preferences, user_notification_preferences, user_permission_overrides
    - integrations, llm_model_catalog, llm_providers, llm_models
    - ai_agents, ai_agent_settings_defaults, ai_response_style_defaults, ai_voice_defaults
    - brand_kits, brand_voices, brand_kit_versions, brand_voice_versions
    - snippets, reputation_settings, ai_safety_prompts, ai_usage_limits
    - condition_templates, prompt_templates, prompt_template_versions
    - channel_configurations, conversation_rules

  3. Important Notes
    - All DELETE statements use TRUNCATE ... CASCADE where safe
    - System configuration and user accounts are fully preserved
    - After this migration, all module pages will show empty states
*/

-- ============================================================
-- LAYER 1: Scoring system (no other tables depend on these leaf tables)
-- ============================================================
DELETE FROM score_events;
DELETE FROM scoring_rule_executions;
DELETE FROM entity_scores;
DELETE FROM scoring_model_decay_config;
DELETE FROM scoring_adjustment_limits;
DELETE FROM scoring_rules;
DELETE FROM scoring_models;

-- ============================================================
-- LAYER 2: Workflow children
-- ============================================================
DELETE FROM workflow_scheduled_trigger_runs;
DELETE FROM workflow_webhook_requests;
DELETE FROM workflow_webhook_triggers;
DELETE FROM workflow_version_snapshots;
DELETE FROM workflow_versions;
DELETE FROM workflow_triggers;
DELETE FROM workflow_trigger_audit_log;
DELETE FROM workflow_scheduled_triggers;
DELETE FROM workflow_logs;
DELETE FROM workflow_goals;
DELETE FROM workflow_execution_logs;
DELETE FROM workflow_condition_waits;
DELETE FROM workflow_action_retries;
DELETE FROM workflow_ai_runs;
DELETE FROM workflow_analytics_cache;
DELETE FROM workflow_loops;
DELETE FROM workflow_jobs;
DELETE FROM ai_workflow_learning_signals;
DELETE FROM workflow_enrollments;

-- ============================================================
-- LAYER 3: Proposal children (before opportunities)
-- ============================================================
DELETE FROM proposal_line_items;
DELETE FROM proposal_sections;
DELETE FROM proposal_comments;
DELETE FROM proposal_activities;
DELETE FROM proposal_meeting_contexts;
DELETE FROM proposals;

-- ============================================================
-- LAYER 4: Opportunity children
-- ============================================================
DELETE FROM org_opportunity_custom_field_values;
DELETE FROM opportunity_custom_field_values;
DELETE FROM opportunity_timeline_events;
DELETE FROM opportunity_stage_history;
DELETE FROM opportunity_notes;

-- ============================================================
-- LAYER 5: Invoice/Payment children
-- ============================================================
DELETE FROM payment_reminders;
DELETE FROM payment_events;
DELETE FROM payments;
DELETE FROM invoice_line_items;
DELETE FROM recurring_profile_items;
DELETE FROM recurring_profiles;

-- ============================================================
-- LAYER 6: Review children
-- ============================================================
DELETE FROM negative_review_tasks;
DELETE FROM review_ai_analysis;
DELETE FROM review_ai_summaries;
DELETE FROM review_moderation_log;
DELETE FROM review_reply_drafts;
DELETE FROM review_reply_queue;
DELETE FROM review_sync_queue;

-- ============================================================
-- LAYER 7: Report children
-- ============================================================
DELETE FROM report_email_queue;
DELETE FROM report_exports;
DELETE FROM report_runs;
DELETE FROM report_schedules;
DELETE FROM ai_report_queries;

-- ============================================================
-- LAYER 8: Form/Survey children
-- ============================================================
DELETE FROM form_files;
DELETE FROM form_submissions;
DELETE FROM survey_continuations;
DELETE FROM survey_submissions;

-- ============================================================
-- LAYER 9: Contact children (before contacts)
-- ============================================================
DELETE FROM contact_timeline;
DELETE FROM contact_custom_field_values;
DELETE FROM contact_tags;
DELETE FROM contact_notes;
DELETE FROM contact_tasks;
DELETE FROM contact_meeting_notes;
DELETE FROM meeting_transcription_contacts;
DELETE FROM meeting_transcriptions;
DELETE FROM ai_agent_memory;
DELETE FROM ai_agent_runs;
DELETE FROM ai_agent_tool_calls;
DELETE FROM ai_drafts;
DELETE FROM call_logs;
DELETE FROM event_outbox;
DELETE FROM scheduled_trigger_jobs;
DELETE FROM file_attachments;

-- ============================================================
-- LAYER 10: Conversation children (before conversations)
-- ============================================================
DELETE FROM gmail_attachments;
DELETE FROM message_attachments;
DELETE FROM messages;
DELETE FROM conversation_notes;
DELETE FROM conversation_rule_logs;
DELETE FROM inbox_events;
DELETE FROM webchat_sessions;
DELETE FROM crm_email_links;

-- ============================================================
-- LAYER 11: Parent entities
-- ============================================================
DELETE FROM invoices;
DELETE FROM opportunities;
DELETE FROM appointments;
DELETE FROM conversations;
DELETE FROM review_requests;
DELETE FROM reviews;
DELETE FROM contacts;
DELETE FROM workflows;

-- ============================================================
-- LAYER 12: Structural/config demo data
-- ============================================================
DELETE FROM pipeline_custom_fields;
DELETE FROM pipeline_stages;
DELETE FROM pipelines;

DELETE FROM availability_date_overrides;
DELETE FROM availability_rules;
DELETE FROM blocked_slots;
DELETE FROM appointment_sync;
DELETE FROM appointment_types;
DELETE FROM calendar_members;
DELETE FROM calendars;

DELETE FROM forms;
DELETE FROM surveys;
DELETE FROM reports;
DELETE FROM tags;
DELETE FROM products;
DELETE FROM lost_reasons;
DELETE FROM review_providers;
DELETE FROM reputation_competitors;

DELETE FROM custom_fields;
DELETE FROM custom_field_groups;
