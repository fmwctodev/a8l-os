/*
  # Seed BuilderLync organization

  Creates the second tenant on the platform — BuilderLync Inc. — and
  wires its domain routing + module gates.

  ## Changes

  1. INSERT BuilderLync into `organizations` (UUID
     '00000000-0000-0000-0000-000000000002', slug 'builderlync').

  2. INSERT both domain mappings:
     - autom8ionlab.com → autom8ionlab org, providers: google/microsoft/email
     - builderlync.com  → BuilderLync org, providers: google ONLY
     (Microsoft is locked to autom8ionlab; BuilderLync only gets Google.)

  3. Per-org feature_flags rows for BuilderLync — only the modules in
     the user-approved list are enabled. Proposals/Contracts/Projects
     are explicit `enabled = false` to override the global default.

  4. DELETE existing @builderlync.com auth.users so they re-sign-in
     fresh into the new BuilderLync org. The public.users row cascades.
     (Per user direction — these existing rows in autom8ionlab should
     NOT migrate; the few users will re-sign-in.)

  Run order: AFTER 20260507010000_multi_tenant_foundation and
  20260507020000_domain_routed_user_provisioning.
*/

-- 1. BuilderLync organization
INSERT INTO organizations (id, slug, name, display_name, logo_url, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'builderlync',
  'BuilderLync Inc.',
  'BuilderLync',
  '/assets/logo/builderlync-logo.png',
  now()
) ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  display_name = EXCLUDED.display_name,
  logo_url = EXCLUDED.logo_url;

-- 2. Domain → org mappings
INSERT INTO organization_email_domains (organization_id, domain, allowed_providers, is_primary)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'autom8ionlab.com', ARRAY['google', 'microsoft', 'email'], true),
  ('00000000-0000-0000-0000-000000000002', 'builderlync.com',  ARRAY['google'],                       true)
ON CONFLICT (lower(domain)) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  allowed_providers = EXCLUDED.allowed_providers,
  is_primary = EXCLUDED.is_primary;

-- 3. Per-org feature flags for BuilderLync
INSERT INTO feature_flags (organization_id, key, enabled, description)
VALUES
  -- Enabled modules per the approved BuilderLync set
  ('00000000-0000-0000-0000-000000000002', 'calendars',     true,  'Calendars module (BuilderLync)'),
  ('00000000-0000-0000-0000-000000000002', 'contacts',      true,  'Contacts module (BuilderLync)'),
  ('00000000-0000-0000-0000-000000000002', 'payments',      true,  'Payments module (BuilderLync, Stripe)'),
  ('00000000-0000-0000-0000-000000000002', 'conversations', true,  'Conversations module (BuilderLync)'),
  ('00000000-0000-0000-0000-000000000002', 'opportunities', true,  'Opportunities module (BuilderLync)'),
  ('00000000-0000-0000-0000-000000000002', 'marketing',     true,  'Marketing module (BuilderLync)'),
  ('00000000-0000-0000-0000-000000000002', 'reputation',    true,  'Reputation module (BuilderLync)'),
  ('00000000-0000-0000-0000-000000000002', 'automation',    true,  'Automation module (BuilderLync)'),
  ('00000000-0000-0000-0000-000000000002', 'ai_agents',     true,  'AI Agents module (BuilderLync)'),
  ('00000000-0000-0000-0000-000000000002', 'media',         true,  'File Manager (BuilderLync)'),
  ('00000000-0000-0000-0000-000000000002', 'reporting',     true,  'Reporting module (BuilderLync)'),
  -- Explicitly disabled modules (override any global default)
  ('00000000-0000-0000-0000-000000000002', 'proposals',     false, 'Hidden for BuilderLync'),
  ('00000000-0000-0000-0000-000000000002', 'contracts',     false, 'Hidden for BuilderLync'),
  ('00000000-0000-0000-0000-000000000002', 'projects',      false, 'Hidden for BuilderLync')
ON CONFLICT (key, COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET
    enabled = EXCLUDED.enabled,
    description = EXCLUDED.description;

-- 4. Wipe existing @builderlync.com users so they re-sign-in fresh
DO $$
DECLARE
  user_count int;
BEGIN
  SELECT count(*) INTO user_count
  FROM public.users
  WHERE lower(split_part(email, '@', 2)) = 'builderlync.com';

  IF user_count > 0 THEN
    DELETE FROM auth.users
    WHERE id IN (
      SELECT id FROM public.users
      WHERE lower(split_part(email, '@', 2)) = 'builderlync.com'
    );
    RAISE NOTICE 'Removed % existing @builderlync.com users; they will re-sign-in into the new BuilderLync org', user_count;
  END IF;
END $$;
