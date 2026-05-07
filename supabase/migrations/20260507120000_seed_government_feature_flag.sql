/*
  # Split Government from Opportunities feature flag

  ## Why

  The Government Contract Search module shared the `opportunities`
  feature flag with the Opportunities module — toggling one toggled
  both. BuilderLync needs Opportunities visible but Government hidden.

  ## Fix

  - Add a dedicated `government` feature flag.
  - Global default: enabled (so Autom8ion Lab keeps Government visible).
  - BuilderLync per-org override: disabled.

  Frontend changes (separate commit):
  - `src/config/navigation.ts` — Government nav item uses
    `featureFlag: 'government'`.
  - `src/App.tsx` — `/government` route's `ProtectedRoute` uses
    `featureFlag="government"`.
*/

INSERT INTO feature_flags (organization_id, key, enabled, description) VALUES
  (NULL, 'government', true,  'Government Contract Search module (global default)'),
  ('00000000-0000-0000-0000-000000000002', 'government', false, 'Hidden for BuilderLync')
ON CONFLICT (key, COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET
    enabled = EXCLUDED.enabled,
    description = EXCLUDED.description;
