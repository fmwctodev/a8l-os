/*
  # Consolidate Duplicate RLS Policies - Batch 2

  This migration removes redundant permissive policies.

  1. Tables Affected
    - departments, email_warmup_*, feature_flags
    - opportunity_notes, organizations, permissions
    - report_schedules, reports, reputation_settings

  2. Strategy
    - Keep the policy with proper organization/ownership checks
    - Remove catch-all policies that bypass specific checks
*/

-- departments: Keep specific role-based policies, remove SuperAdmin catch-all for each operation
-- The SuperAdmin policy is redundant when combined with admin-level policies
DROP POLICY IF EXISTS "SuperAdmin can do everything on departments" ON departments;

-- email_warmup_ai_recommendations: Keep org-scoped policy
DROP POLICY IF EXISTS "Users can manage warmup AI recommendations" ON email_warmup_ai_recommendations;

-- email_warmup_config: Keep org-scoped policy
DROP POLICY IF EXISTS "Users can manage warmup config" ON email_warmup_config;

-- email_warmup_daily_stats: Keep org-scoped policy
DROP POLICY IF EXISTS "Users can manage warmup stats" ON email_warmup_daily_stats;

-- feature_flags: Keep "Anyone can view feature flags" (intended to be public read)
DROP POLICY IF EXISTS "SuperAdmin can manage feature flags" ON feature_flags;
-- Note: Management should be done through migrations, not direct RLS

-- opportunity_notes: Keep one SELECT policy
DROP POLICY IF EXISTS "Users can view opportunity notes in their org" ON opportunity_notes;

-- organizations: Keep specific policies
DROP POLICY IF EXISTS "SuperAdmin can do everything on organizations" ON organizations;

-- permissions: Keep "Anyone can view permissions" (reference data)
DROP POLICY IF EXISTS "SuperAdmin can manage permissions" ON permissions;
-- Note: Permissions should be managed through migrations

-- report_schedules: Keep permission-based policies
DROP POLICY IF EXISTS "Users can manage report schedules" ON report_schedules;

-- reports: Keep org-scoped policy
DROP POLICY IF EXISTS "Users can create reports" ON reports;

-- reputation_settings: Keep admin-based policies
DROP POLICY IF EXISTS "Users can manage reputation settings" ON reputation_settings;
