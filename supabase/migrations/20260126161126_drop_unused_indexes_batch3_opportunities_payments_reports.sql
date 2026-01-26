/*
  # Drop Unused Indexes - Batch 3: Opportunities, Payments, Reports

  This migration removes indexes that have never been used according to database statistics.

  1. Tables Affected
    - opportunities, pipelines, pipeline_stages, opportunity_notes, opportunity_timeline
    - payments, invoices, products, recurring_profiles, qbo_connections
    - reports, report_runs, report_exports, report_schedules
    - reputation, reviews, review_requests, review_providers

  2. Impact
    - Improved INSERT/UPDATE performance
    - Reduced storage usage
*/

-- Opportunities module indexes
DROP INDEX IF EXISTS idx_pipelines_org;
DROP INDEX IF EXISTS idx_pipelines_department;
DROP INDEX IF EXISTS idx_pipeline_stages_pipeline;
DROP INDEX IF EXISTS idx_pipeline_stages_org_id;
DROP INDEX IF EXISTS idx_pipeline_custom_fields_pipeline;
DROP INDEX IF EXISTS idx_pipeline_custom_fields_org_id;
DROP INDEX IF EXISTS idx_opportunities_org_stage;
DROP INDEX IF EXISTS idx_opportunities_org_assigned;
DROP INDEX IF EXISTS idx_opportunities_org_department;
DROP INDEX IF EXISTS idx_opportunities_created_at;
DROP INDEX IF EXISTS idx_opportunities_updated_at;
DROP INDEX IF EXISTS idx_opportunities_close_date;
DROP INDEX IF EXISTS idx_opportunities_assigned_user_id;
DROP INDEX IF EXISTS idx_opportunities_contact_id;
DROP INDEX IF EXISTS idx_opportunities_created_by;
DROP INDEX IF EXISTS idx_opportunities_department_id;
DROP INDEX IF EXISTS idx_opportunities_pipeline_id;
DROP INDEX IF EXISTS idx_opportunities_lost_reason;
DROP INDEX IF EXISTS idx_opportunities_stage_changed;
DROP INDEX IF EXISTS idx_opp_custom_field_values_field;
DROP INDEX IF EXISTS idx_opportunity_custom_field_values_org_id;
DROP INDEX IF EXISTS idx_opportunity_notes_opp;
DROP INDEX IF EXISTS idx_opportunity_notes_created;
DROP INDEX IF EXISTS idx_opportunity_notes_created_by;
DROP INDEX IF EXISTS idx_opportunity_notes_org_id;
DROP INDEX IF EXISTS idx_opp_timeline_contact;
DROP INDEX IF EXISTS idx_opp_timeline_type;
DROP INDEX IF EXISTS idx_opp_timeline_created;
DROP INDEX IF EXISTS idx_opportunity_timeline_events_actor;
DROP INDEX IF EXISTS idx_opportunity_timeline_events_org_id;
DROP INDEX IF EXISTS idx_opp_stage_history_org;
DROP INDEX IF EXISTS idx_opp_stage_history_changed_at;
DROP INDEX IF EXISTS idx_opportunity_stage_history_changed_by;
DROP INDEX IF EXISTS idx_opportunity_stage_history_from_stage_id;
DROP INDEX IF EXISTS idx_opportunity_stage_history_to_stage_id;
DROP INDEX IF EXISTS idx_lost_reasons_org;
DROP INDEX IF EXISTS idx_lost_reasons_org_active;
DROP INDEX IF EXISTS idx_lost_reasons_sort;

-- Payments module indexes
DROP INDEX IF EXISTS idx_products_org;
DROP INDEX IF EXISTS idx_products_org_billing;
DROP INDEX IF EXISTS idx_products_qbo_item;
DROP INDEX IF EXISTS idx_products_created_by;
DROP INDEX IF EXISTS idx_invoices_org;
DROP INDEX IF EXISTS idx_invoices_org_status;
DROP INDEX IF EXISTS idx_invoices_org_contact;
DROP INDEX IF EXISTS idx_invoices_due_date;
DROP INDEX IF EXISTS idx_invoices_qbo_id;
DROP INDEX IF EXISTS idx_invoices_created_at;
DROP INDEX IF EXISTS idx_invoices_contact_id;
DROP INDEX IF EXISTS idx_invoices_created_by;
DROP INDEX IF EXISTS idx_invoices_opportunity_id;
DROP INDEX IF EXISTS idx_invoice_line_items_product;
DROP INDEX IF EXISTS idx_invoice_line_items_org_id;
DROP INDEX IF EXISTS idx_payments_org;
DROP INDEX IF EXISTS idx_payments_org_contact;
DROP INDEX IF EXISTS idx_payments_invoice;
DROP INDEX IF EXISTS idx_payments_qbo_id;
DROP INDEX IF EXISTS idx_payments_received_at;
DROP INDEX IF EXISTS idx_payments_contact_id;
DROP INDEX IF EXISTS idx_recurring_profiles_org;
DROP INDEX IF EXISTS idx_recurring_profiles_org_contact;
DROP INDEX IF EXISTS idx_recurring_profiles_org_status;
DROP INDEX IF EXISTS idx_recurring_profiles_next_date;
DROP INDEX IF EXISTS idx_recurring_profiles_qbo;
DROP INDEX IF EXISTS idx_recurring_profiles_contact_id;
DROP INDEX IF EXISTS idx_recurring_profiles_created_by;
DROP INDEX IF EXISTS idx_recurring_profile_items_profile;
DROP INDEX IF EXISTS idx_recurring_profile_items_org_id;
DROP INDEX IF EXISTS idx_recurring_profile_items_product_id;
DROP INDEX IF EXISTS idx_qbo_connections_org;
DROP INDEX IF EXISTS idx_qbo_connections_realm;
DROP INDEX IF EXISTS idx_qbo_connections_connected_by;
DROP INDEX IF EXISTS idx_qbo_webhook_logs_org;
DROP INDEX IF EXISTS idx_qbo_webhook_logs_event;
DROP INDEX IF EXISTS idx_qbo_webhook_logs_created;
DROP INDEX IF EXISTS idx_payment_events_org_occurred;
DROP INDEX IF EXISTS idx_payment_events_invoice;
DROP INDEX IF EXISTS idx_payment_events_type;
DROP INDEX IF EXISTS idx_payment_events_amount;

-- Reports module indexes
DROP INDEX IF EXISTS idx_reports_org_visibility;
DROP INDEX IF EXISTS idx_reports_created_by;
DROP INDEX IF EXISTS idx_reports_department_id;
DROP INDEX IF EXISTS idx_report_runs_report;
DROP INDEX IF EXISTS idx_report_runs_triggered_by_user_id;
DROP INDEX IF EXISTS idx_report_exports_status;
DROP INDEX IF EXISTS idx_report_exports_run;
DROP INDEX IF EXISTS idx_report_exports_organization_id;
DROP INDEX IF EXISTS idx_report_email_queue_status;
DROP INDEX IF EXISTS idx_report_email_queue_schedule;
DROP INDEX IF EXISTS idx_report_email_queue_organization_id;
DROP INDEX IF EXISTS idx_report_email_queue_report_run_id;
DROP INDEX IF EXISTS idx_report_schedules_created_by;
DROP INDEX IF EXISTS idx_report_schedules_organization_id;
DROP INDEX IF EXISTS idx_ai_report_queries_user;
DROP INDEX IF EXISTS idx_ai_report_queries_org;
DROP INDEX IF EXISTS idx_ai_report_queries_saved;

-- Reputation module indexes
DROP INDEX IF EXISTS idx_review_providers_status;
DROP INDEX IF EXISTS idx_review_requests_contact;
DROP INDEX IF EXISTS idx_review_requests_slug;
DROP INDEX IF EXISTS idx_review_requests_sent;
DROP INDEX IF EXISTS idx_review_requests_created_by;
DROP INDEX IF EXISTS idx_review_requests_status;
DROP INDEX IF EXISTS idx_review_requests_source;
DROP INDEX IF EXISTS idx_reviews_contact;
DROP INDEX IF EXISTS idx_reviews_request;
DROP INDEX IF EXISTS idx_reviews_provider_received;
DROP INDEX IF EXISTS idx_reviews_rating;
DROP INDEX IF EXISTS idx_reviews_is_spam;
DROP INDEX IF EXISTS idx_reviews_response;
DROP INDEX IF EXISTS idx_reviews_responded;
DROP INDEX IF EXISTS idx_reviews_responded_by;
DROP INDEX IF EXISTS idx_reputation_competitors_org;
