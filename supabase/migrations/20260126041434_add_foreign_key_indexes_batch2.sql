/*
  # Add Indexes for Unindexed Foreign Keys - Batch 2

  ## Overview
  Continuing to add indexes for foreign keys to improve query performance.

  ## Tables Updated
  - Custom fields/values tables
  - Email related tables
  - Integration tables
  - Invoice/Payment tables
*/

-- Custom fields/values tables
CREATE INDEX IF NOT EXISTS idx_custom_values_created_by ON custom_values(created_by);
CREATE INDEX IF NOT EXISTS idx_custom_values_updated_by ON custom_values(updated_by);

-- Email related tables
CREATE INDEX IF NOT EXISTS idx_dnc_numbers_added_by ON dnc_numbers(added_by);
CREATE INDEX IF NOT EXISTS idx_email_campaign_domain_events_actor_id ON email_campaign_domain_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_email_defaults_default_from_address_id ON email_defaults(default_from_address_id);
CREATE INDEX IF NOT EXISTS idx_email_defaults_default_unsubscribe_group_id ON email_defaults(default_unsubscribe_group_id);
CREATE INDEX IF NOT EXISTS idx_email_test_logs_from_address_id ON email_test_logs(from_address_id);
CREATE INDEX IF NOT EXISTS idx_email_test_logs_sent_by ON email_test_logs(sent_by);

-- Event/Workflow tables
CREATE INDEX IF NOT EXISTS idx_event_outbox_contact_id ON event_outbox(contact_id);

-- File/Media tables
CREATE INDEX IF NOT EXISTS idx_file_attachments_attached_by ON file_attachments(attached_by);

-- Google Chat tables
CREATE INDEX IF NOT EXISTS idx_google_chat_messages_cache_org_id ON google_chat_messages_cache(org_id);
CREATE INDEX IF NOT EXISTS idx_google_chat_spaces_cache_org_id ON google_chat_spaces_cache(org_id);
CREATE INDEX IF NOT EXISTS idx_google_chat_subscriptions_org_id ON google_chat_subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_google_chat_tokens_org_id ON google_chat_tokens(org_id);

-- Inbox events
CREATE INDEX IF NOT EXISTS idx_inbox_events_actor_user_id ON inbox_events(actor_user_id);

-- Integration tables
CREATE INDEX IF NOT EXISTS idx_integration_connections_connected_by ON integration_connections(connected_by);
CREATE INDEX IF NOT EXISTS idx_integration_logs_user_id ON integration_logs(user_id);

-- Invoice/Payment tables
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_org_id ON invoice_line_items(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contact_id ON invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON invoices(created_by);
CREATE INDEX IF NOT EXISTS idx_invoices_opportunity_id ON invoices(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_payments_contact_id ON payments(contact_id);

-- Knowledge tables
CREATE INDEX IF NOT EXISTS idx_knowledge_collections_created_by ON knowledge_collections(created_by);
CREATE INDEX IF NOT EXISTS idx_knowledge_versions_created_by ON knowledge_versions(created_by);

-- Meeting transcription tables
CREATE INDEX IF NOT EXISTS idx_meeting_transcription_contacts_org_id ON meeting_transcription_contacts(org_id);

-- Message tables
CREATE INDEX IF NOT EXISTS idx_message_attachments_uploaded_by ON message_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_message_templates_created_by ON message_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_messages_hidden_by_user_id ON messages(hidden_by_user_id);

-- Messaging service tables
CREATE INDEX IF NOT EXISTS idx_messaging_service_senders_number_id ON messaging_service_senders(number_id);
CREATE INDEX IF NOT EXISTS idx_messaging_service_senders_org_id ON messaging_service_senders(org_id);

-- OAuth tables
CREATE INDEX IF NOT EXISTS idx_oauth_states_org_id ON oauth_states(org_id);
CREATE INDEX IF NOT EXISTS idx_oauth_states_user_id ON oauth_states(user_id);
