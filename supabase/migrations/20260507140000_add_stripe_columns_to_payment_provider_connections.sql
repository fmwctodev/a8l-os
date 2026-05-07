/*
  # Add Stripe-shaped columns to payment_provider_connections

  ## Why

  The Phase 7a rename migration (20260507040000) renamed
  `qbo_connections` → `payment_provider_connections` and made the
  QBO-specific columns NULL-able. But it did not add the columns
  Stripe needs to store its (different) credentials shape:

  - `credentials_encrypted` / `credentials_iv` — encrypted blob
    pattern matching how `integration_connections` stores Mailgun
    creds (no realm_id / refresh_token like QBO).
  - `account_info` (jsonb) — connected Stripe account metadata
    (nickname, stripe account id, country, default currency).
  - `connected_at` — when the provider was first connected (separate
    from `created_at`/`updated_at` so admins can see "connected on X"
    even after credential updates).

  All four columns are NULL-able. Existing QBO rows are untouched and
  the QBO code path doesn't reference any of these columns.

  Idempotent (`ADD COLUMN IF NOT EXISTS`) so safe to re-run.
*/

ALTER TABLE payment_provider_connections
  ADD COLUMN IF NOT EXISTS credentials_encrypted text,
  ADD COLUMN IF NOT EXISTS credentials_iv text,
  ADD COLUMN IF NOT EXISTS account_info jsonb,
  ADD COLUMN IF NOT EXISTS connected_at timestamptz;
