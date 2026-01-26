/*
  # Drop Unused Indexes - Batch 4: AI, Integrations, Users, and Remaining Tables

  This migration removes indexes that have never been used according to database statistics.

  1. Tables Affected
    - AI agents, knowledge, drafts, workflow AI runs
    - Users, audit logs, departments, organizations
    - Integrations, webhooks, oauth
    - Brand kits, custom fields, email services, phone system
    - Google Chat, LLM providers, proposals, meetings, team messaging

  2. Impact
    - Improved INSERT/UPDATE performance
    - Reduced storage usage
*/

-- AI Agents module indexes
DROP INDEX IF EXISTS idx_ai_agents_type_org;
DROP INDEX IF EXISTS idx_ai_agents_created_by;
DROP INDEX IF EXISTS idx_ai_agents_model_id;
DROP INDEX IF EXISTS idx_agent_knowledge_sources_agent;
DROP INDEX IF EXISTS idx_agent_knowledge_sources_created_by;
DROP INDEX IF EXISTS idx_agent_knowledge_links_agent;
DROP INDEX IF EXISTS idx_agent_knowledge_links_collection;
DROP INDEX IF EXISTS idx_agent_prompt_links_agent;
DROP INDEX IF EXISTS idx_agent_prompt_links_template_id;
DROP INDEX IF EXISTS idx_agent_templates_created_by;
DROP INDEX IF EXISTS idx_ai_agent_memory_contact;
DROP INDEX IF EXISTS idx_ai_agent_memory_org_id;
DROP INDEX IF EXISTS idx_ai_agent_runs_contact_created;
DROP INDEX IF EXISTS idx_ai_agent_runs_approved_by;
DROP INDEX IF EXISTS idx_ai_agent_runs_conversation_id;
DROP INDEX IF EXISTS idx_ai_agent_tool_calls_run;
DROP INDEX IF EXISTS idx_ai_agent_tool_calls_org_id;
DROP INDEX IF EXISTS idx_ai_agent_settings_defaults_model_id;
DROP INDEX IF EXISTS idx_ai_drafts_org;
DROP INDEX IF EXISTS idx_ai_drafts_conversation;
DROP INDEX IF EXISTS idx_ai_drafts_status;
DROP INDEX IF EXISTS idx_ai_drafts_pending;
DROP INDEX IF EXISTS idx_ai_drafts_agent;
DROP INDEX IF EXISTS idx_ai_drafts_enrollment;
DROP INDEX IF EXISTS idx_ai_drafts_workflow_ai_run;
DROP INDEX IF EXISTS idx_ai_drafts_approved_by;
DROP INDEX IF EXISTS idx_ai_drafts_contact_id;
DROP INDEX IF EXISTS idx_ai_drafts_context_message_id;
DROP INDEX IF EXISTS idx_ai_drafts_triggered_by_rule;
DROP INDEX IF EXISTS idx_ai_drafts_workflow;
DROP INDEX IF EXISTS idx_ai_drafts_source;
DROP INDEX IF EXISTS idx_ai_drafts_pending_workflow;
DROP INDEX IF EXISTS idx_ai_action_guardrails_created_by;
DROP INDEX IF EXISTS idx_guardrails_org_active;
DROP INDEX IF EXISTS idx_guardrails_type;
DROP INDEX IF EXISTS idx_ai_workflow_learning_signals_agent;
DROP INDEX IF EXISTS idx_ai_workflow_learning_signals_contact;
DROP INDEX IF EXISTS idx_ai_workflow_learning_signals_conversation;
DROP INDEX IF EXISTS idx_learning_signals_org_workflow;
DROP INDEX IF EXISTS idx_learning_signals_ai_run;
DROP INDEX IF EXISTS idx_learning_signals_org_captured;
DROP INDEX IF EXISTS idx_learning_signals_outcome;
DROP INDEX IF EXISTS idx_learning_signals_action_type;
DROP INDEX IF EXISTS idx_learning_signals_node;
DROP INDEX IF EXISTS idx_workflow_ai_runs_conversation;
DROP INDEX IF EXISTS idx_workflow_ai_runs_workflow;
DROP INDEX IF EXISTS idx_workflow_ai_runs_org_workflow;
DROP INDEX IF EXISTS idx_workflow_ai_runs_enrollment;
DROP INDEX IF EXISTS idx_workflow_ai_runs_org_created;
DROP INDEX IF EXISTS idx_workflow_ai_runs_status;
DROP INDEX IF EXISTS idx_workflow_ai_runs_action_type;
DROP INDEX IF EXISTS idx_workflow_ai_runs_agent;
DROP INDEX IF EXISTS idx_workflow_ai_runs_contact;
DROP INDEX IF EXISTS idx_ai_usage_logs_org_created;
DROP INDEX IF EXISTS idx_ai_usage_logs_agent;
DROP INDEX IF EXISTS idx_ai_usage_logs_user;
DROP INDEX IF EXISTS idx_ai_usage_logs_status;
DROP INDEX IF EXISTS idx_ai_usage_logs_failed;
DROP INDEX IF EXISTS idx_ai_voice_defaults_fallback_voice;

-- LLM and knowledge indexes
DROP INDEX IF EXISTS idx_llm_model_catalog_org_provider;
DROP INDEX IF EXISTS idx_llm_model_catalog_org_enabled;
DROP INDEX IF EXISTS idx_llm_model_catalog_org_default;
DROP INDEX IF EXISTS idx_llm_providers_org;
DROP INDEX IF EXISTS idx_llm_models_org_enabled;
DROP INDEX IF EXISTS idx_llm_models_provider;
DROP INDEX IF EXISTS idx_custom_llm_providers_org;
DROP INDEX IF EXISTS idx_custom_llm_providers_enabled;
DROP INDEX IF EXISTS idx_knowledge_collections_created_by;
DROP INDEX IF EXISTS idx_knowledge_collections_source_type;
DROP INDEX IF EXISTS idx_knowledge_versions_created_by;
DROP INDEX IF EXISTS idx_knowledge_versions_collection;
DROP INDEX IF EXISTS idx_knowledge_embeddings_vector;
DROP INDEX IF EXISTS idx_knowledge_embeddings_collection;
DROP INDEX IF EXISTS idx_knowledge_embeddings_version;
DROP INDEX IF EXISTS idx_elevenlabs_voices_org;

-- Users and audit indexes
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_status;
DROP INDEX IF EXISTS idx_users_invited_by;
DROP INDEX IF EXISTS idx_users_disabled_by;
DROP INDEX IF EXISTS idx_users_department_id;
DROP INDEX IF EXISTS idx_audit_logs_user;
DROP INDEX IF EXISTS idx_audit_logs_entity;
DROP INDEX IF EXISTS idx_audit_logs_organization;
DROP INDEX IF EXISTS idx_user_preferences_user_id;
DROP INDEX IF EXISTS idx_user_preferences_default_calendar_id;
DROP INDEX IF EXISTS idx_user_notification_preferences_user_id;
DROP INDEX IF EXISTS idx_user_connected_accounts_user_id;
DROP INDEX IF EXISTS idx_user_connected_accounts_provider;
DROP INDEX IF EXISTS idx_user_sessions_user_id;
DROP INDEX IF EXISTS idx_user_sessions_token;
DROP INDEX IF EXISTS idx_user_permission_overrides_user;
DROP INDEX IF EXISTS idx_user_permission_overrides_permission;
DROP INDEX IF EXISTS idx_user_permission_overrides_created_by;
DROP INDEX IF EXISTS idx_activity_log_organization_id;
DROP INDEX IF EXISTS idx_activity_log_user_id;
DROP INDEX IF EXISTS idx_activity_log_entity_type;
DROP INDEX IF EXISTS idx_activity_log_contact_id;
DROP INDEX IF EXISTS idx_activity_log_created_at;
DROP INDEX IF EXISTS idx_activity_log_dashboard;

-- Integrations and webhooks indexes
DROP INDEX IF EXISTS idx_integrations_org_id;
DROP INDEX IF EXISTS idx_integrations_key;
DROP INDEX IF EXISTS idx_integration_connections_user_id;
DROP INDEX IF EXISTS idx_integration_connections_connected_by;
DROP INDEX IF EXISTS idx_integration_connections_status;
DROP INDEX IF EXISTS idx_integration_logs_org_id;
DROP INDEX IF EXISTS idx_integration_logs_integration_id;
DROP INDEX IF EXISTS idx_integration_logs_user_id;
DROP INDEX IF EXISTS idx_oauth_states_state_token;
DROP INDEX IF EXISTS idx_oauth_states_expires_at;
DROP INDEX IF EXISTS idx_oauth_states_org_id;
DROP INDEX IF EXISTS idx_oauth_states_user_id;
DROP INDEX IF EXISTS idx_module_integration_requirements_org_id;
DROP INDEX IF EXISTS idx_module_integration_requirements_integration_key;
DROP INDEX IF EXISTS idx_outgoing_webhooks_org_id;
DROP INDEX IF EXISTS idx_outgoing_webhooks_enabled;
DROP INDEX IF EXISTS idx_outgoing_webhooks_created_by;
DROP INDEX IF EXISTS idx_webhook_deliveries_webhook_id;
DROP INDEX IF EXISTS idx_webhook_deliveries_org_id;
DROP INDEX IF EXISTS idx_webhook_deliveries_status;
DROP INDEX IF EXISTS idx_webhook_deliveries_next_retry_at;
DROP INDEX IF EXISTS idx_webhook_deliveries_created_at;
DROP INDEX IF EXISTS idx_webhook_health_org_id;

-- Brand and custom fields indexes
DROP INDEX IF EXISTS idx_brand_kits_org_id;
DROP INDEX IF EXISTS idx_brand_kits_active;
DROP INDEX IF EXISTS idx_brand_kits_created_by;
DROP INDEX IF EXISTS idx_brand_kit_versions_kit_id;
DROP INDEX IF EXISTS idx_brand_kit_versions_published;
DROP INDEX IF EXISTS idx_brand_kit_versions_created_by;
DROP INDEX IF EXISTS idx_brand_kit_versions_published_by;
DROP INDEX IF EXISTS idx_brand_voices_org_id;
DROP INDEX IF EXISTS idx_brand_voices_active;
DROP INDEX IF EXISTS idx_brand_voices_created_by;
DROP INDEX IF EXISTS idx_brand_voice_versions_voice_id;
DROP INDEX IF EXISTS idx_brand_voice_versions_created_by;
DROP INDEX IF EXISTS idx_brand_usage_org_type;
DROP INDEX IF EXISTS idx_brand_usage_brand_id;
DROP INDEX IF EXISTS idx_brand_usage_entity_type;
DROP INDEX IF EXISTS idx_custom_values_org_id;
DROP INDEX IF EXISTS idx_custom_values_category_id;
DROP INDEX IF EXISTS idx_custom_values_created_by;
DROP INDEX IF EXISTS idx_custom_values_updated_by;
DROP INDEX IF EXISTS idx_custom_field_groups_org;
DROP INDEX IF EXISTS idx_custom_field_groups_org_scope;
DROP INDEX IF EXISTS idx_custom_field_groups_org_scope_active;
DROP INDEX IF EXISTS idx_custom_fields_org_scope;
DROP INDEX IF EXISTS idx_custom_fields_org_scope_active;
DROP INDEX IF EXISTS idx_custom_fields_deleted;
DROP INDEX IF EXISTS idx_custom_fields_visible_automations;
DROP INDEX IF EXISTS idx_custom_fields_visible_reporting;
DROP INDEX IF EXISTS idx_custom_fields_list_view;
DROP INDEX IF EXISTS idx_custom_fields_option_items;
DROP INDEX IF EXISTS idx_org_opp_cfv_org;
DROP INDEX IF EXISTS idx_org_opp_cfv_opp;
DROP INDEX IF EXISTS idx_org_opp_cfv_field;

-- Email services indexes
DROP INDEX IF EXISTS idx_email_providers_org_id;
DROP INDEX IF EXISTS idx_email_domains_org_id;
DROP INDEX IF EXISTS idx_email_domains_org_status;
DROP INDEX IF EXISTS idx_email_from_addresses_org_id;
DROP INDEX IF EXISTS idx_email_from_addresses_domain_id;
DROP INDEX IF EXISTS idx_email_unsubscribe_groups_org_id;
DROP INDEX IF EXISTS idx_email_test_logs_org_id;
DROP INDEX IF EXISTS idx_email_test_logs_sent_at;
DROP INDEX IF EXISTS idx_email_test_logs_from_address_id;
DROP INDEX IF EXISTS idx_email_test_logs_sent_by;
DROP INDEX IF EXISTS idx_email_defaults_default_from_address_id;
DROP INDEX IF EXISTS idx_email_defaults_default_unsubscribe_group_id;
DROP INDEX IF EXISTS idx_email_campaign_domains_status;
DROP INDEX IF EXISTS idx_email_warmup_daily_stats_domain_date;
DROP INDEX IF EXISTS idx_email_campaign_domain_events_domain_id;
DROP INDEX IF EXISTS idx_email_campaign_domain_events_actor_id;
DROP INDEX IF EXISTS idx_email_warmup_ai_recommendations_domain_pending;

-- Phone system indexes
DROP INDEX IF EXISTS idx_twilio_connection_org_id;
DROP INDEX IF EXISTS idx_twilio_connection_connected_by;
DROP INDEX IF EXISTS idx_twilio_numbers_org_id;
DROP INDEX IF EXISTS idx_twilio_numbers_status;
DROP INDEX IF EXISTS idx_twilio_numbers_phone;
DROP INDEX IF EXISTS idx_twilio_numbers_department_id;
DROP INDEX IF EXISTS idx_twilio_messaging_services_org_id;
DROP INDEX IF EXISTS idx_messaging_service_senders_service;
DROP INDEX IF EXISTS idx_messaging_service_senders_number_id;
DROP INDEX IF EXISTS idx_messaging_service_senders_org_id;
DROP INDEX IF EXISTS idx_voice_routing_groups_org_id;
DROP INDEX IF EXISTS idx_voice_routing_destinations_group;
DROP INDEX IF EXISTS idx_voice_routing_destinations_org_id;
DROP INDEX IF EXISTS idx_phone_settings_org_id;
DROP INDEX IF EXISTS idx_phone_settings_default_messaging_service_id;
DROP INDEX IF EXISTS idx_phone_settings_default_routing_group_id;
DROP INDEX IF EXISTS idx_phone_settings_default_sms_number_id;
DROP INDEX IF EXISTS idx_phone_settings_default_voice_number_id;
DROP INDEX IF EXISTS idx_dnc_numbers_org_id;
DROP INDEX IF EXISTS idx_dnc_numbers_phone;
DROP INDEX IF EXISTS idx_dnc_numbers_added_by;
DROP INDEX IF EXISTS idx_phone_test_logs_org_id;
DROP INDEX IF EXISTS idx_phone_test_logs_tested_by;

-- Google Chat indexes
DROP INDEX IF EXISTS idx_google_chat_tokens_user_id;
DROP INDEX IF EXISTS idx_google_chat_tokens_org_id;
DROP INDEX IF EXISTS idx_google_chat_spaces_cache_user_id;
DROP INDEX IF EXISTS idx_google_chat_spaces_cache_space_id;
DROP INDEX IF EXISTS idx_google_chat_spaces_cache_org_id;
DROP INDEX IF EXISTS idx_google_chat_messages_cache_user_id;
DROP INDEX IF EXISTS idx_google_chat_messages_cache_space_cache_id;
DROP INDEX IF EXISTS idx_google_chat_messages_cache_message_id;
DROP INDEX IF EXISTS idx_google_chat_messages_cache_sent_at;
DROP INDEX IF EXISTS idx_google_chat_messages_cache_org_id;
DROP INDEX IF EXISTS idx_google_chat_subscriptions_user_id;
DROP INDEX IF EXISTS idx_google_chat_subscriptions_org_id;

-- Proposals and meetings indexes
DROP INDEX IF EXISTS idx_proposal_templates_org;
DROP INDEX IF EXISTS idx_proposal_templates_category;
DROP INDEX IF EXISTS idx_proposal_templates_default;
DROP INDEX IF EXISTS idx_proposal_templates_created_by;
DROP INDEX IF EXISTS idx_proposals_org;
DROP INDEX IF EXISTS idx_proposals_contact;
DROP INDEX IF EXISTS idx_proposals_status;
DROP INDEX IF EXISTS idx_proposals_assigned;
DROP INDEX IF EXISTS idx_proposals_created_by;
DROP INDEX IF EXISTS idx_proposals_created_at;
DROP INDEX IF EXISTS idx_proposals_public_token;
DROP INDEX IF EXISTS idx_proposals_valid_until;
DROP INDEX IF EXISTS idx_proposals_assigned_user_id;
DROP INDEX IF EXISTS idx_proposals_template_id;
DROP INDEX IF EXISTS idx_proposal_line_items_proposal;
DROP INDEX IF EXISTS idx_proposal_line_items_product;
DROP INDEX IF EXISTS idx_proposal_line_items_org_id;
DROP INDEX IF EXISTS idx_proposal_sections_proposal;
DROP INDEX IF EXISTS idx_proposal_sections_sort;
DROP INDEX IF EXISTS idx_proposal_sections_org_id;
DROP INDEX IF EXISTS idx_proposal_comments_created;
DROP INDEX IF EXISTS idx_proposal_comments_org_id;
DROP INDEX IF EXISTS idx_proposal_comments_user_id;
DROP INDEX IF EXISTS idx_proposal_activities_type;
DROP INDEX IF EXISTS idx_proposal_activities_created;
DROP INDEX IF EXISTS idx_proposal_activities_actor_user_id;
DROP INDEX IF EXISTS idx_proposal_activities_org_id;
DROP INDEX IF EXISTS idx_proposal_meeting_contexts_meeting;
DROP INDEX IF EXISTS idx_proposal_meeting_contexts_org_id;
DROP INDEX IF EXISTS idx_meeting_transcriptions_org;
DROP INDEX IF EXISTS idx_meeting_transcriptions_source;
DROP INDEX IF EXISTS idx_meeting_transcriptions_external_id;
DROP INDEX IF EXISTS idx_meeting_transcriptions_date;
DROP INDEX IF EXISTS idx_meeting_transcriptions_imported_by;
DROP INDEX IF EXISTS idx_meeting_transcriptions_created;
DROP INDEX IF EXISTS idx_meeting_transcriptions_recording;
DROP INDEX IF EXISTS idx_meeting_transcriptions_transcript_search;
DROP INDEX IF EXISTS idx_meeting_transcriptions_participants;
DROP INDEX IF EXISTS idx_meeting_trans_contacts_meeting;
DROP INDEX IF EXISTS idx_meeting_trans_contacts_email;
DROP INDEX IF EXISTS idx_meeting_transcription_contacts_org_id;

-- Team messaging indexes
DROP INDEX IF EXISTS idx_team_channels_org;
DROP INDEX IF EXISTS idx_team_channels_created_by;
DROP INDEX IF EXISTS idx_team_channels_department_id;
DROP INDEX IF EXISTS idx_team_channel_members_channel;
DROP INDEX IF EXISTS idx_team_channel_members_user;
DROP INDEX IF EXISTS idx_team_channel_members_org;
DROP INDEX IF EXISTS idx_team_messages_channel;
DROP INDEX IF EXISTS idx_team_messages_sender;
DROP INDEX IF EXISTS idx_team_messages_created;
DROP INDEX IF EXISTS idx_team_messages_organization_id;
DROP INDEX IF EXISTS idx_team_messages_reply_to_id;
DROP INDEX IF EXISTS idx_team_message_reactions_message;
DROP INDEX IF EXISTS idx_team_message_reactions_organization_id;
DROP INDEX IF EXISTS idx_team_message_reactions_user_id;

-- Content AI and message templates indexes
DROP INDEX IF EXISTS idx_content_ai_generations_org_id;
DROP INDEX IF EXISTS idx_content_ai_generations_user_id;
DROP INDEX IF EXISTS idx_content_ai_generations_type;
DROP INDEX IF EXISTS idx_content_ai_generations_platform;
DROP INDEX IF EXISTS idx_content_ai_generations_created_at;
DROP INDEX IF EXISTS idx_content_ai_generations_brand_kit;
DROP INDEX IF EXISTS idx_content_ai_generations_brand_voice;
DROP INDEX IF EXISTS idx_content_ai_generations_action_type;
DROP INDEX IF EXISTS idx_content_ai_generations_applied;
DROP INDEX IF EXISTS idx_message_templates_org_active;
DROP INDEX IF EXISTS idx_message_templates_category;
DROP INDEX IF EXISTS idx_message_templates_channel;
DROP INDEX IF EXISTS idx_message_templates_created_by;
DROP INDEX IF EXISTS idx_prompt_templates_created_by;
DROP INDEX IF EXISTS idx_prompt_template_versions_created_by;

-- Scoring indexes
DROP INDEX IF EXISTS idx_scoring_models_org;
DROP INDEX IF EXISTS idx_scoring_models_primary;
DROP INDEX IF EXISTS idx_entity_scores_org;
DROP INDEX IF EXISTS idx_entity_scores_model;
DROP INDEX IF EXISTS idx_entity_scores_decay;
DROP INDEX IF EXISTS idx_score_events_entity;
DROP INDEX IF EXISTS idx_score_events_model;
DROP INDEX IF EXISTS idx_score_events_org;
DROP INDEX IF EXISTS idx_score_events_created_by;
DROP INDEX IF EXISTS idx_score_events_rule_id;

-- Secrets management indexes
DROP INDEX IF EXISTS idx_org_secrets_category;
DROP INDEX IF EXISTS idx_secret_categories_org;
DROP INDEX IF EXISTS idx_org_secrets_org;
DROP INDEX IF EXISTS idx_org_secrets_key;
DROP INDEX IF EXISTS idx_org_secrets_expires;
DROP INDEX IF EXISTS idx_org_secrets_created_by;
DROP INDEX IF EXISTS idx_org_secrets_updated_by;
DROP INDEX IF EXISTS idx_secret_dynamic_refs_secret;
DROP INDEX IF EXISTS idx_secret_usage_log_org;
DROP INDEX IF EXISTS idx_secret_usage_log_secret;
DROP INDEX IF EXISTS idx_secret_usage_log_created;

-- Drive files indexes
DROP INDEX IF EXISTS idx_drive_folders_org_folder;
DROP INDEX IF EXISTS idx_drive_folders_org_parent;
DROP INDEX IF EXISTS idx_drive_files_org_file;
DROP INDEX IF EXISTS idx_file_attachments_drive_file;
DROP INDEX IF EXISTS idx_file_attachments_org;
DROP INDEX IF EXISTS idx_file_attachments_attached_by;
