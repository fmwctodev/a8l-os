/*
  # Fix support tickets CHECK constraints

  1. Modified Constraints
    - `request_type`: Updated to match application values (bug_report, feature_request, performance_issue, configuration_change, access_permissions, training_docs, general_inquiry)
    - `business_impact`: Updated to match application values (minimal, internal_only, team_productivity, client_facing, operations_blocked, revenue_affecting)
    - `preferred_contact_method`: Added 'portal' to allowed values
    - `source`: Added 'email' to allowed values

  2. Important Notes
    - Existing values from the old constraint set are preserved to avoid breaking existing data
    - Both old and new values are allowed for backwards compatibility
*/

ALTER TABLE project_support_tickets
  DROP CONSTRAINT IF EXISTS project_support_tickets_request_type_check;
ALTER TABLE project_support_tickets
  ADD CONSTRAINT project_support_tickets_request_type_check
  CHECK (request_type = ANY (ARRAY[
    'bug_issue', 'system_error', 'access_login', 'feature_request',
    'change_request', 'integration_issue', 'performance_issue',
    'security_concern', 'general_support',
    'bug_report', 'configuration_change', 'access_permissions',
    'training_docs', 'general_inquiry'
  ]));

ALTER TABLE project_support_tickets
  DROP CONSTRAINT IF EXISTS project_support_tickets_business_impact_check;
ALTER TABLE project_support_tickets
  ADD CONSTRAINT project_support_tickets_business_impact_check
  CHECK (business_impact = ANY (ARRAY[
    'no_impact', 'minor_inconvenience', 'slowing_operations',
    'blocking_key_processes', 'revenue_impacting',
    'minimal', 'internal_only', 'team_productivity',
    'client_facing', 'operations_blocked', 'revenue_affecting'
  ]));

ALTER TABLE project_support_tickets
  DROP CONSTRAINT IF EXISTS project_support_tickets_preferred_contact_method_check;
ALTER TABLE project_support_tickets
  ADD CONSTRAINT project_support_tickets_preferred_contact_method_check
  CHECK (preferred_contact_method = ANY (ARRAY[
    'email', 'phone', 'slack', 'portal', 'other'
  ]));

ALTER TABLE project_support_tickets
  DROP CONSTRAINT IF EXISTS project_support_tickets_source_check;
ALTER TABLE project_support_tickets
  ADD CONSTRAINT project_support_tickets_source_check
  CHECK (source = ANY (ARRAY['portal', 'internal', 'email']));
