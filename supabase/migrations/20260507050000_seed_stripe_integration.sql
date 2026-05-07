/*
  # Seed Stripe integration in the catalog

  Adds Stripe as a payment provider integration alongside QuickBooks Online.
  Mirrors the pattern from the Mailgun seed (`20260506020100`).

  ## What this migration does

  1. Inserts a `stripe` integration row for every existing organization.
  2. Updates `seed_integrations_for_org(org_id)` to also seed `stripe` when
     a new organization is created.
  3. Adds Stripe as an OPTIONAL integration alternative for the `payments`
     module — orgs can connect either QBO or Stripe (or both, for testing).
*/

-- 1. Insert stripe integration row for every existing organization
INSERT INTO integrations (
  org_id, key, name, description, category, scope, connection_type,
  oauth_config, api_key_config, docs_url, settings_path
)
SELECT
  o.id,
  'stripe',
  'Stripe',
  'Online payments, invoicing, subscriptions, and Stripe Connect for marketplaces.',
  'Payments',
  'global',
  'api_key',
  NULL,
  '{"fields": [
    {"name": "secret_key", "label": "Secret Key (sk_live_... or sk_test_...)", "required": true, "secret": true},
    {"name": "publishable_key", "label": "Publishable Key (pk_live_...)", "required": false, "secret": false},
    {"name": "webhook_signing_secret", "label": "Webhook Signing Secret (whsec_...)", "required": false, "secret": true}
  ]}'::jsonb,
  'https://docs.stripe.com/api',
  '/settings/payments'
FROM organizations o
ON CONFLICT (org_id, key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  scope = EXCLUDED.scope,
  connection_type = EXCLUDED.connection_type,
  api_key_config = EXCLUDED.api_key_config,
  docs_url = EXCLUDED.docs_url,
  settings_path = EXCLUDED.settings_path;

-- 2. Add Stripe as an option for the `payments` module. Both QBO and Stripe
-- satisfy the requirement; the org picks one in /settings/payments.
INSERT INTO module_integration_requirements (org_id, module_key, integration_key, is_required, feature_description)
SELECT
  o.id,
  'payments',
  'stripe',
  false,
  'Stripe payment processing, invoicing, and subscriptions'
FROM organizations o
ON CONFLICT (org_id, module_key, integration_key) DO NOTHING;

-- 3. Update seed_integrations_for_org to include stripe for newly-created orgs
CREATE OR REPLACE FUNCTION public.seed_integrations_for_org(target_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  src_org_id uuid;
BEGIN
  -- Use the autom8ionlab default org as the template
  SELECT id INTO src_org_id FROM organizations WHERE slug = 'autom8ionlab' LIMIT 1;
  IF src_org_id IS NULL THEN
    SELECT id INTO src_org_id FROM organizations
    WHERE id = '00000000-0000-0000-0000-000000000001';
  END IF;
  IF src_org_id IS NULL OR src_org_id = target_org_id THEN
    RETURN;
  END IF;

  -- Copy all integrations rows that exist in the template org
  INSERT INTO integrations (
    org_id, key, name, description, category, scope, connection_type,
    oauth_config, api_key_config, docs_url, settings_path, enabled, created_at
  )
  SELECT
    target_org_id, key, name, description, category, scope, connection_type,
    oauth_config, api_key_config, docs_url, settings_path, enabled, now()
  FROM integrations
  WHERE org_id = src_org_id
  ON CONFLICT (org_id, key) DO NOTHING;

  -- Copy module_integration_requirements
  INSERT INTO module_integration_requirements (org_id, module_key, integration_key, is_required, feature_description)
  SELECT
    target_org_id, module_key, integration_key, is_required, feature_description
  FROM module_integration_requirements
  WHERE org_id = src_org_id
  ON CONFLICT (org_id, module_key, integration_key) DO NOTHING;
END;
$$;
