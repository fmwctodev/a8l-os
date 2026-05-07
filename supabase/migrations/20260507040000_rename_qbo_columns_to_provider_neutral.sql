/*
  # Rename QBO-specific Payments columns to provider-neutral

  Mirrors the SendGrid -> Mailgun rename done last week
  (`20260506020000_rename_sendgrid_columns_to_provider_neutral.sql`).
  Prepares the Payments module to support multiple providers (currently
  QuickBooks; Stripe added in `20260507050000_seed_stripe_integration`).

  ## Renames

  - `qbo_connections` table → `payment_provider_connections`
  - `products.qbo_item_id`         → `products.provider_item_id`
  - `invoices.qbo_invoice_id`      → `invoices.provider_invoice_id`
  - `payments.qbo_payment_id`      → `payments.provider_payment_id`
  - `recurring_profiles.qbo_recurring_template_id` → `provider_recurring_template_id`
  - `qbo_webhook_logs` table → `payment_provider_webhook_logs`

  ## Adds

  Each affected table gets a `provider text` column. Existing rows are
  backfilled with `'quickbooks_online'` since the only data today comes
  from QBO. Future Stripe rows write `provider = 'stripe'`.

  ## Indexes / constraints

  Old indexes referencing renamed columns are renamed in lock-step.

  ## Idempotent guards

  Each step uses information_schema checks so the migration is safe to
  re-run even if partially applied.
*/

-- 1. Rename qbo_connections -> payment_provider_connections + add provider column
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'qbo_connections')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_provider_connections') THEN
    ALTER TABLE qbo_connections RENAME TO payment_provider_connections;
  END IF;
END $$;

ALTER TABLE payment_provider_connections
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'quickbooks_online';

-- The realm_id and company_name columns are QBO-specific. Keep them as
-- nullable for forward-compat (Stripe rows leave them NULL).
ALTER TABLE payment_provider_connections
  ALTER COLUMN realm_id DROP NOT NULL,
  ALTER COLUMN company_name DROP NOT NULL,
  ALTER COLUMN access_token_encrypted DROP NOT NULL,
  ALTER COLUMN refresh_token_encrypted DROP NOT NULL,
  ALTER COLUMN token_expiry DROP NOT NULL;

-- One connection per (org, provider) — drops old single-conn-per-org constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'payment_provider_connections'
      AND constraint_name = 'qbo_connections_org_id_key'
  ) THEN
    ALTER TABLE payment_provider_connections DROP CONSTRAINT qbo_connections_org_id_key;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'payment_provider_connections'
      AND indexname = 'uniq_payment_provider_connection_per_org'
  ) THEN
    CREATE UNIQUE INDEX uniq_payment_provider_connection_per_org
      ON payment_provider_connections(org_id, provider);
  END IF;
END $$;

-- Rename old indexes (best-effort; ignore if already renamed)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_qbo_connections_org') THEN
    ALTER INDEX idx_qbo_connections_org RENAME TO idx_payment_provider_connections_org;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_qbo_connections_realm') THEN
    ALTER INDEX idx_qbo_connections_realm RENAME TO idx_payment_provider_connections_realm;
  END IF;
END $$;

-- 2. products.qbo_item_id -> products.provider_item_id, add provider
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'qbo_item_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'provider_item_id'
  ) THEN
    ALTER TABLE products RENAME COLUMN qbo_item_id TO provider_item_id;
  END IF;
END $$;

ALTER TABLE products ADD COLUMN IF NOT EXISTS provider text;
UPDATE products SET provider = 'quickbooks_online' WHERE provider IS NULL AND provider_item_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_products_qbo_item') THEN
    ALTER INDEX idx_products_qbo_item RENAME TO idx_products_provider_item;
  END IF;
END $$;

-- 3. invoices.qbo_invoice_id -> invoices.provider_invoice_id, add provider
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'qbo_invoice_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'provider_invoice_id'
  ) THEN
    ALTER TABLE invoices RENAME COLUMN qbo_invoice_id TO provider_invoice_id;
  END IF;
END $$;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS provider text;
UPDATE invoices SET provider = 'quickbooks_online' WHERE provider IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoices_qbo_id') THEN
    ALTER INDEX idx_invoices_qbo_id RENAME TO idx_invoices_provider_id;
  END IF;
END $$;

-- 4. payments.qbo_payment_id -> payments.provider_payment_id, add provider
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'qbo_payment_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'provider_payment_id'
  ) THEN
    ALTER TABLE payments RENAME COLUMN qbo_payment_id TO provider_payment_id;
  END IF;
END $$;

ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider text;
UPDATE payments SET provider = 'quickbooks_online' WHERE provider IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payments_qbo_id') THEN
    ALTER INDEX idx_payments_qbo_id RENAME TO idx_payments_provider_id;
  END IF;
END $$;

-- 5. recurring_profiles.qbo_recurring_template_id -> provider_recurring_template_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recurring_profiles' AND column_name = 'qbo_recurring_template_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recurring_profiles' AND column_name = 'provider_recurring_template_id'
  ) THEN
    ALTER TABLE recurring_profiles RENAME COLUMN qbo_recurring_template_id TO provider_recurring_template_id;
  END IF;
END $$;

ALTER TABLE recurring_profiles ADD COLUMN IF NOT EXISTS provider text;
UPDATE recurring_profiles SET provider = 'quickbooks_online' WHERE provider IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_recurring_profiles_qbo') THEN
    ALTER INDEX idx_recurring_profiles_qbo RENAME TO idx_recurring_profiles_provider_template;
  END IF;
END $$;

-- 6. qbo_webhook_logs -> payment_provider_webhook_logs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'qbo_webhook_logs')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_provider_webhook_logs') THEN
    ALTER TABLE qbo_webhook_logs RENAME TO payment_provider_webhook_logs;
  END IF;
END $$;

ALTER TABLE payment_provider_webhook_logs
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'quickbooks_online';
