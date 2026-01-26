/*
  # Consolidate Duplicate RLS Policies - Batch 1

  This migration removes redundant permissive policies that create overlapping access.
  When multiple permissive policies exist for the same operation, they create an OR condition
  which may unintentionally widen access.

  1. Tables Affected
    - audit_logs, calendar_members, contact_tasks, content_ai_generations
    - conversation_rules, custom_field_groups, custom_fields

  2. Strategy
    - Keep the policy with proper organization/ownership checks
    - Remove the more permissive or redundant policy
*/

-- audit_logs: Keep "Users can insert audit logs for their organization" (has org check)
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON audit_logs;

-- calendar_members: Keep "Users can view calendar members in their org" (has org check)
DROP POLICY IF EXISTS "Users can view calendar members" ON calendar_members;

-- contact_tasks: Keep both - they serve different purposes (org access vs creator access for delete)
-- The "Users can delete contact tasks" likely checks org membership
-- The "Users can delete tasks they created" allows creators to delete their own
-- These are valid overlapping policies - no change needed

-- content_ai_generations: Keep "Users can create AI generations in their organization" (has org check)
DROP POLICY IF EXISTS "Users can create AI generations" ON content_ai_generations;

-- conversation_rules: Consolidate to single policies with proper checks
DROP POLICY IF EXISTS "Users can delete conversation rules" ON conversation_rules;
DROP POLICY IF EXISTS "Users can create conversation rules" ON conversation_rules;
DROP POLICY IF EXISTS "Users can view conversation rules in their organization" ON conversation_rules;
DROP POLICY IF EXISTS "Users can update conversation rules" ON conversation_rules;
-- Keep "Users can manage conversation rules" as it covers all operations

-- custom_field_groups: Keep the permission-based policies
DROP POLICY IF EXISTS "Users can manage custom field groups" ON custom_field_groups;
-- Keep "Users can view custom field groups in their organization" for SELECT
-- Keep "Users with custom_fields.manage can create/update/delete groups" for modifications

-- custom_fields: Keep the permission-based policies
DROP POLICY IF EXISTS "Users can manage custom fields" ON custom_fields;
-- Keep "Users can view org custom fields" for SELECT
-- Keep "Only admins can create/update/delete custom fields" for modifications
