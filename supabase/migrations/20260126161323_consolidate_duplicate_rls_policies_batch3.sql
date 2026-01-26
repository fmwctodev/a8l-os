/*
  # Consolidate Duplicate RLS Policies - Batch 3

  This migration removes redundant permissive policies.

  1. Tables Affected
    - review_providers, role_permissions, roles
    - snippets, social_accounts, survey_continuations
    - users, webhook_deliveries, workflow_enrollments

  2. Strategy
    - Keep the policy with proper organization/ownership checks
    - Remove catch-all policies that bypass specific checks
*/

-- review_providers: Keep admin-based policies
DROP POLICY IF EXISTS "Users can manage review providers" ON review_providers;

-- role_permissions: Keep "Anyone can view role_permissions" (reference data)
DROP POLICY IF EXISTS "SuperAdmin can manage role_permissions" ON role_permissions;
-- Note: Role permissions should be managed through migrations

-- roles: Keep "Anyone can view roles" (reference data)
DROP POLICY IF EXISTS "SuperAdmin can manage roles" ON roles;
-- Note: Roles should be managed through migrations

-- snippets: Keep org-scoped policies
DROP POLICY IF EXISTS "Users can create personal snippets" ON snippets;
DROP POLICY IF EXISTS "Users can view accessible snippets" ON snippets;

-- social_accounts: Keep permission-based policies
DROP POLICY IF EXISTS "Users can manage social accounts" ON social_accounts;

-- survey_continuations: These are intentionally permissive for public surveys
-- Keep "Anyone can read survey continuations by token" for public access
-- Keep "Users can view survey continuations in their organization" for admin access
-- Keep both - they serve different purposes (token-based vs org-based access)

-- users: Keep specific role-based policies
DROP POLICY IF EXISTS "SuperAdmin can do everything on users" ON users;

-- webhook_deliveries: Keep org-scoped policies
DROP POLICY IF EXISTS "System can manage webhook deliveries" ON webhook_deliveries;

-- workflow_enrollments: Keep org-scoped policies
DROP POLICY IF EXISTS "Users can create workflow enrollments" ON workflow_enrollments;
DROP POLICY IF EXISTS "Users can update workflow enrollments" ON workflow_enrollments;
