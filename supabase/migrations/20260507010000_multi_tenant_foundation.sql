/*
  # Multi-Tenant Foundation

  Lays the groundwork for hosting more than one organization on the same
  instance. Single-tenant today: one `organizations` row, hardcoded UUID
  references in 17 places. After this migration the platform can hold
  many orgs, route users by domain, gate features per org, and let a
  SuperAdmin switch between them without altering RLS pivots.

  ## Changes

  1. `organizations` — add `slug` (unique), `display_name`, `logo_url`.
     Backfill the existing Autom8ion Lab row before NOT NULL on slug.

  2. `organization_email_domains` — new table. Maps email domains to
     organizations and declares which auth providers are allowed for
     each domain. The auth trigger (Phase 2) reads from this.

  3. `feature_flags` — add nullable `organization_id`. NULL row is the
     global default; per-org rows override. Replaces the global UNIQUE
     on `key` with a partial-aware UNIQUE on `(key, COALESCE(org, ZERO))`
     so the same key can have a global row plus per-org overrides.

  4. `users.super_admin_active_org_id` — when a SuperAdmin sets this,
     `get_user_org_id()` returns it instead of their home org. RLS
     pivots automatically; no service-layer changes needed.

  5. `get_user_org_id()` — replaced to honor super_admin_active_org_id
     when the caller has the SuperAdmin role.

  All changes are idempotent (IF NOT EXISTS, ON CONFLICT, DO blocks) so
  the migration is safe to re-run.
*/

-- 1. Extend organizations table
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS logo_url text;

-- Backfill the existing Autom8ion Lab org BEFORE making slug NOT NULL
UPDATE organizations
SET
  slug = COALESCE(slug, 'autom8ionlab'),
  display_name = COALESCE(display_name, 'Autom8ion Lab'),
  logo_url = COALESCE(logo_url, '/assets/logo/logo.png')
WHERE id = '00000000-0000-0000-0000-000000000001';

-- For any other rows that exist (defensive — there shouldn't be any),
-- generate a slug from the name to satisfy NOT NULL
UPDATE organizations
SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- Now safe to enforce NOT NULL + UNIQUE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'organizations' AND constraint_name = 'organizations_slug_key'
  ) THEN
    ALTER TABLE organizations ADD CONSTRAINT organizations_slug_key UNIQUE (slug);
  END IF;
END $$;

ALTER TABLE organizations ALTER COLUMN slug SET NOT NULL;

-- 2. organization_email_domains — domain → org + allowed providers
CREATE TABLE IF NOT EXISTS organization_email_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  domain text NOT NULL,
  allowed_providers text[] NOT NULL DEFAULT ARRAY['google'],
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_org_email_domain
  ON organization_email_domains(lower(domain));

CREATE INDEX IF NOT EXISTS idx_org_email_domains_org
  ON organization_email_domains(organization_id);

ALTER TABLE organization_email_domains ENABLE ROW LEVEL SECURITY;

-- The auth trigger needs to read this BEFORE a user exists in public.users,
-- so the trigger uses SECURITY DEFINER and bypasses RLS. For app-side reads
-- (e.g. settings UI), restrict to same-org admins.
DROP POLICY IF EXISTS "Org admins can view their domains" ON organization_email_domains;
CREATE POLICY "Org admins can view their domains"
  ON organization_email_domains FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id() OR is_super_admin());

DROP POLICY IF EXISTS "SuperAdmin manages all domains" ON organization_email_domains;
CREATE POLICY "SuperAdmin manages all domains"
  ON organization_email_domains FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- 3. feature_flags — make per-org possible. NULL org_id = global default.
ALTER TABLE feature_flags
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

-- Drop the old global UNIQUE on key — it blocks per-org rows
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'feature_flags' AND constraint_name = 'feature_flags_key_key'
  ) THEN
    ALTER TABLE feature_flags DROP CONSTRAINT feature_flags_key_key;
  END IF;
END $$;

-- New UNIQUE: (key, org). NULL org collapses via COALESCE so only one global row per key.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_feature_flag_per_org
  ON feature_flags(key, COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS idx_feature_flags_org
  ON feature_flags(organization_id) WHERE organization_id IS NOT NULL;

-- Tighten RLS: anyone can read flags for their org or global; only SuperAdmin writes.
DROP POLICY IF EXISTS "Authenticated users can view feature flags" ON feature_flags;
CREATE POLICY "Authenticated users can view feature flags"
  ON feature_flags FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id = get_user_org_id()
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "SuperAdmin manages feature flags" ON feature_flags;
CREATE POLICY "SuperAdmin manages feature flags"
  ON feature_flags FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- 4. users.super_admin_active_org_id — SuperAdmin org switcher pivot
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS super_admin_active_org_id uuid REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_super_admin_active_org
  ON users(super_admin_active_org_id) WHERE super_admin_active_org_id IS NOT NULL;

-- 5. Replace get_user_org_id() to honor SuperAdmin override
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    CASE
      WHEN (SELECT r.name FROM roles r WHERE r.id = u.role_id) = 'SuperAdmin'
      THEN u.super_admin_active_org_id
    END,
    u.organization_id
  )
  FROM users u
  WHERE u.id = auth.uid();
$$;
