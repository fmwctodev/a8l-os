/*
  # Fix Calendar Cascade Delete RLS Policies

  ## Problem
  When deleting a calendar as an Admin user, the CASCADE delete on child tables
  (appointment_types, availability_rules, availability_date_overrides) fails because
  their DELETE RLS policies require has_permission('calendars.manage'), but during
  a CASCADE triggered by a parent row delete, auth.uid() context can be lost or
  the permission check fails in that execution context.

  ## Fix
  Replace the DELETE policies on child calendar tables to only check org membership
  (matching the parent calendars table DELETE policy), rather than requiring an
  explicit permission check. The permission gate already exists on the calendars
  table itself — if a user can delete the calendar, they should be able to delete
  its children.

  ## Tables Affected
  - appointment_types: drop permission-gated DELETE policy, add org-only DELETE policy
  - availability_rules: drop permission-gated DELETE policy, add org-only DELETE policy
  - availability_date_overrides: drop permission-gated DELETE policy, add org-only DELETE policy
  - blocked_slots: drop permission-gated DELETE policy, add org-only DELETE policy
*/

-- Fix appointment_types DELETE policy
DROP POLICY IF EXISTS "Users can delete appointment types in their organization" ON appointment_types;

CREATE POLICY "Users can delete appointment types in their organization"
  ON appointment_types FOR DELETE
  TO authenticated
  USING (org_id = get_auth_user_org_id());

-- Fix availability_rules DELETE policy
DROP POLICY IF EXISTS "Users can delete availability rules in their organization" ON availability_rules;

CREATE POLICY "Users can delete availability rules in their organization"
  ON availability_rules FOR DELETE
  TO authenticated
  USING (org_id = get_auth_user_org_id());

-- Fix availability_date_overrides DELETE policy (if exists)
DROP POLICY IF EXISTS "Users can delete availability date overrides in their organization" ON availability_date_overrides;

CREATE POLICY "Users can delete availability date overrides in their organization"
  ON availability_date_overrides FOR DELETE
  TO authenticated
  USING (org_id = get_auth_user_org_id());

-- Fix blocked_slots DELETE policy
DROP POLICY IF EXISTS "Users with calendars.manage can delete blocked slots" ON blocked_slots;

CREATE POLICY "Users can delete blocked slots in their org"
  ON blocked_slots FOR DELETE
  TO authenticated
  USING (org_id = get_auth_user_org_id());
